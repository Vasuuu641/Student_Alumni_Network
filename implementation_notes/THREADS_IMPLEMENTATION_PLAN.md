# Threads Implementation Plan - AI-Powered Discussion Panels

## Overview

The **Threads** feature is a Reddit-like discussion platform integrated with an LLM to provide real-time similarity detection. Two discussion panels will serve different communities:

1. **Academic Threads Panel** - Students & Professors discussing academics and university life
2. **Alumni Threads Panel** - Students, Alumni, & Professors discussing career advice and life after graduation

### Key Differentiator: LLM-Powered Deduplication
As users type thread titles/descriptions, an AI service analyzes the input in real-time to detect and suggest similar existing threads, reducing redundancy and improving user experience.

### Connection to Notes Feature
The LLM analysis pipeline built for notes (chunking, embedding, semantic search) will be reused and extended for threads. Threads can also be linked to notes for contextual learning.

---

## Architecture Decision Summary

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Data Model** | Separate `Thread` entities for each panel | Clean separation of concerns; different permission models |
| **Real-time Transport** | WebSocket (Socket.IO) + REST | Live updates for new replies; fallback REST for polling |
| **LLM Integration** | Cohere API for embeddings & semantic search | Consistent with notes infrastructure; proven integration |
| **Embedding Strategy** | FAISS in-memory OR PostgreSQL pgvector | FAISS for fast dev; pgvector for production scale |
| **Permission Model** | Role-based (STUDENT/ALUMNI/PROFESSOR) | Maps to existing User roles; no new permission level needed |
| **Reply Structure** | Flat replies + nested reply groups | Simpler than full tree; scales well for voting & sorting |

---

# DETAILED BACKEND IMPLEMENTATION PLAN

## Phase 0 – Project Setup & Planning

### 0.1 Define Scope for V1

**In scope:**
- Create, read, update, delete threads in both panels
- Post, edit, delete replies to threads
- Real-time reply notifications via WebSocket
- Basic sorting (newest, most replies, trending)
- LLM similarity detection on thread creation/edit
- Manual linking between threads and notes
- Vote/like system for replies (optional for V1)

**Out of scope (for later phases):**
- User reputation/karma system
- Thread moderation queue
- Advanced filtering (by topic, tags)
- AI automatic thread linking (manual linking first)
- Thread attachments/media uploads
- Full-text search indexing (TSVECTOR)

### 0.2 Module Cleanup
Current thread files are empty placeholders. Prepare:
- `backend/src/presentation/threads/threads.controller.ts`
- `backend/src/presentation/threads/threads.module.ts`
- `backend/src/application/threads/create-thread.usecase.ts`
- `backend/src/application/threads/post-reply.usecase.ts`
- `backend/src/application/threads/get-thread.usecase.ts`

### 0.3 Tech Stack Confirmation
- **Forum Transport**: WebSocket + REST (reuse notes.gateway pattern)
- **Database**: PostgreSQL + Prisma (existing)
- **Embedding Engine**: Cohere Embed API (new use case)
- **Semantic Search**: Simple cosine similarity on embeddings OR pgvector if scaling
- **Frontend Editor**: Markdown or rich-text (TipTap for consistency with notes)

---

## Phase 1 – Data Model & Migration

### 1.1 Add Enums to Prisma Schema

```prisma
enum ThreadPanel {
  ACADEMIC    # Students & Professors
  ALUMNI      # Students, Alumni, Professors
}

enum ThreadStatus {
  OPEN        # Accepting new replies
  CLOSED      # No new replies
  PINNED      # Appears at top
  ARCHIVED    # Hidden from list
  DELETED     # Soft-delete
}

enum ReplyStatus {
  ACTIVE
  EDITED
  DELETED    # Soft-delete
}
```

### 1.2 Add Core Models to Prisma Schema

```prisma
model Thread {
  id               String         @id @default(uuid())
  title            String         @db.VarChar(255)
  description      Json?          # Rich-text or markdown
  panel            ThreadPanel    @default(ACADEMIC)
  status           ThreadStatus   @default(OPEN)
  
  authorId         String
  author           User           @relation("ThreadAuthor", fields: [authorId], references: [id])
  
  replyCount       Int            @default(0)   # Denormalized for sorting
  lastReplyAt      DateTime?
  viewCount        Int            @default(0)
  
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  
  replies          ThreadReply[]
  linkedNotes      ThreadNoteLink[]
  similarThreads   ThreadSimilarity[] @relation("SourceThread")
  
  @@index([panel, status, createdAt])
  @@index([authorId])
  @@index([lastReplyAt])
  @@index([panel, status, replyCount])  # For trending queries
}

model ThreadReply {
  id           String        @id @default(uuid())
  threadId     String
  thread       Thread        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  
  content      Json          # Rich-text / markdown
  authorId     String
  author       User          @relation("ReplyAuthor", fields: [authorId], references: [id])
  
  status       ReplyStatus   @default(ACTIVE)
  editedAt     DateTime?     # When last edited
  likeCount    Int           @default(0)
  
  # Optional: for nested replies or reply groups
  parentReplyId String?       # References another reply for threaded view
  parentReply   ThreadReply?  @relation("ReplyHierarchy", fields: [parentReplyId], references: [id])
  childReplies  ThreadReply[] @relation("ReplyHierarchy")
  
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  
  likedBy      ThreadReplyLike[]
  
  @@index([threadId, createdAt])
  @@index([authorId])
  @@index([parentReplyId])  # For fetching child replies
}

model ThreadReplyLike {
  replyId   String
  userId    String
  createdAt DateTime @default(now())
  
  reply     ThreadReply @relation(fields: [replyId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@id([replyId, userId])
}

# Linking threads to notes for context
model ThreadNoteLink {
  id              String        @id @default(uuid())
  threadId        String
  noteId          String
  thread          Thread        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  note            Note          @relation(fields: [noteId], references: [id], onDelete: Cascade)
  
  linkType        NoteLinkSource @default(MANUAL)  # MANUAL or AI
  confidence      Float?         # For AI-generated links (0-1)
  createdAt       DateTime      @default(now())
  
  @@unique([threadId, noteId])
  @@index([threadId])
  @@index([noteId])
}

# For LLM-based deduplication: stores similar thread pairs
model ThreadSimilarity {
  id              String        @id @default(uuid())
  sourceThreadId  String
  targetThreadId  String
  
  sourceThread    Thread        @relation("SourceThread", fields: [sourceThreadId], references: [id], onDelete: Cascade)
  targetThread    Thread        @relation("TargetThread", fields: [targetThreadId], references: [id], onDelete: Cascade)
  
  similarityScore Float         # 0-1 cosine similarity
  computedAt      DateTime      @default(now())
  
  @@unique([sourceThreadId, targetThreadId])
  @@index([sourceThreadId])
}

# Store thread embeddings for semantic search (Phase 2)
model ThreadEmbedding {
  id        String        @id @default(uuid())
  threadId  String        @unique
  thread    Thread        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  
  # Vector embedding from Cohere (1024-dim for Cohere Embed 3)
  embedding Unsupported("vector(1024)")?   # Requires pgvector extension
  
  # Fallback: store raw vector as JSON for FAISS
  embeddingJson Json?
  
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  
  @@index([threadId])
}

# Update User model
model User {
  // ... existing fields ...
  threadsAuthored   Thread[]      @relation("ThreadAuthor")
  repliesAuthored   ThreadReply[] @relation("ReplyAuthor")
  replyLikes        ThreadReplyLike[]
}

# Update Note model
model Note {
  // ... existing fields ...
  linkedThreads     ThreadNoteLink[]
}
```

### 1.3 Migration Checklist
- [ ] Add enums to schema
- [ ] Add all thread models
- [ ] Create `.sql` migration file for PostgreSQL
- [ ] Run Prisma migration: `prisma migrate dev --name add_threads`
- [ ] Verify pgvector extension installed (optional, for V2): `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Regenerate Prisma client: `prisma generate`
- [ ] Add indexes for query performance
- [ ] Create seed script for test data

### 1.4 Database Extensions Setup
For production, enable pgvector:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX ON thread_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

## Phase 2 – Domain Layer & Repository Contracts

### 2.1 Create Domain Entities

**File: `backend/src/domain/entities/thread.entity.ts`**
```typescript
export enum ThreadPanel {
  ACADEMIC = 'ACADEMIC',
  ALUMNI = 'ALUMNI',
}

export enum ThreadStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PINNED = 'PINNED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export class Thread {
  constructor(
    public readonly id: string,
    public title: string,
    public description: unknown,      // JSON rich-text/markdown
    public panel: ThreadPanel,
    public status: ThreadStatus,
    public authorId: string,
    public replyCount: number,
    public lastReplyAt: Date | null,
    public viewCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isAuthoredBy(userId: string): boolean {
    return this.authorId === userId;
  }

  canAccept(): boolean {
    return this.status === ThreadStatus.OPEN;
  }
}

export class ThreadReply {
  constructor(
    public readonly id: string,
    public threadId: string,
    public content: unknown,
    public authorId: string,
    public status: ReplyStatus,
    public editedAt: Date | null,
    public likeCount: number,
    public parentReplyId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isAuthoredBy(userId: string): boolean {
    return this.authorId === userId;
  }

  isDeleted(): boolean {
    return this.status === ReplyStatus.DELETED;
  }
}
```

**File: `backend/src/domain/entities/thread-similarity.entity.ts`**
```typescript
export class ThreadSimilarity {
  constructor(
    public readonly id: string,
    public sourceThreadId: string,
    public targetThreadId: string,
    public similarityScore: number,   // 0-1 cosine similarity
    public readonly computedAt: Date,
  ) {}

  isHighlyRelevant(threshold: number = 0.7): boolean {
    return this.similarityScore >= threshold;
  }
}
```

### 2.2 Create Repository Interfaces

**File: `backend/src/domain/repositories/thread.repository.ts`**
```typescript
import { Thread, ThreadPanel, ThreadStatus } from '../entities/thread.entity';
import { ThreadReply } from '../entities/thread.entity';

export interface ThreadRepository {
  // Thread CRUD
  create(thread: Thread): Promise<Thread>;
  findById(id: string): Promise<Thread | null>;
  update(id: string, updates: Partial<Thread>): Promise<Thread>;
  delete(id: string): Promise<void>;
  
  // Queries
  listByPanel(
    panel: ThreadPanel,
    status: ThreadStatus,
    options: { skip: number; take: number; sortBy: 'newest' | 'trending' | 'mostReplies' }
  ): Promise<{ threads: Thread[]; total: number }>;
  
  listByAuthor(authorId: string, options: { skip: number; take: number }): Promise<Thread[]>;
  
  // Counts
  getReplyCount(threadId: string): Promise<number>;
  incrementViewCount(threadId: string): Promise<void>;
}

export interface ThreadReplyRepository {
  create(reply: ThreadReply): Promise<ThreadReply>;
  findById(id: string): Promise<ThreadReply | null>;
  update(id: string, updates: Partial<ThreadReply>): Promise<ThreadReply>;
  delete(id: string): Promise<void>;
  
  // Queries
  listByThread(
    threadId: string,
    options: { skip: number; take: number; sortBy: 'newest' | 'mostLiked' }
  ): Promise<{ replies: ThreadReply[]; total: number }>;
  
  listByAuthor(authorId: string): Promise<ThreadReply[]>;
  listChildReplies(parentReplyId: string): Promise<ThreadReply[]>;
}

export interface ThreadSimilarityRepository {
  create(similarity: ThreadSimilarity): Promise<ThreadSimilarity>;
  findSimilar(
    threadId: string,
    threshold?: number
  ): Promise<ThreadSimilarity[]>;
  
  deleteBefore(threadId: string): Promise<void>;  // Clean old similarities
}

export interface ThreadNoteLinksRepository {
  create(threadId: string, noteId: string, confidence?: number): Promise<void>;
  findByThread(threadId: string): Promise<Array<{ noteId: string; confidence: number }>>;
  delete(threadId: string, noteId: string): Promise<void>;
}
```

### 2.3 Create LLM Service Interface

**File: `backend/src/domain/services/thread-llm.service.ts`**
```typescript
export interface ThreadLLMService {
  // Embedding & Semantic Search
  embedText(text: string): Promise<number[]>;        // Returns vector
  
  // Find similar threads by semantic matching
  findSimilarThreads(
    text: string,
    panel: ThreadPanel,
    limit?: number,
    threshold?: number
  ): Promise<Array<{
    threadId: string;
    title: string;
    similarityScore: number;
  }>>;
  
  // Batch embed threads (for indexing)
  embedThreads(threads: Array<{ id: string; text: string }>): Promise<void>;
  
  // Rerank results (optional: use Cohere Rerank API for better ordering)
  rerankResults(
    query: string,
    candidates: Array<{ id: string; text: string }>
  ): Promise<Array<{ id: string; score: number }>>;
}
```

---

## Phase 3 – Application Layer (Use Cases)

### 3.1 Core Use Cases

Create files under `backend/src/application/threads/`:

**File: `create-thread.usecase.ts`**
```typescript
// Input: title, description, panel, authorId
// Process:
//   1. Validate user has permission to post in panel
//   2. Check for duplicate/very similar threads via LLM
//   3. Create thread entity
//   4. Embed thread in background job
// Output: { thread, similarThreads[] }

export class CreateThreadUseCase {
  constructor(
    @Inject('ThreadRepository') private threadRepository: ThreadRepository,
    @Inject('ThreadSimilarityRepository') private similarityRepository: ThreadSimilarityRepository,
    @Inject('ThreadLLMService') private llmService: ThreadLLMService,
  ) {}

  async execute(input: CreateThreadInput): Promise<CreateThreadOutput> {
    // Validate user role against panel access
    // Create thread
    // Find similar threads via LLM
    // Return thread + suggestions
  }
}
```

**File: `get-thread.usecase.ts`**
- Fetch thread with replies (paginated)
- Increment view count
- Return with reply count and author info

**File: `post-reply.usecase.ts`**
- Create reply to thread
- Increment reply count on thread
- Update lastReplyAt timestamp
- Broadcast via WebSocket to room

**File: `update-reply.usecase.ts`**
- Only author can edit
- Mark editedAt timestamp
- Broadcast update via WebSocket

**File: `delete-reply.usecase.ts`**
- Soft-delete reply (mark status = DELETED)
- Keep for audit trail
- Update reply count

**File: `list-threads.usecase.ts`**
- List threads by panel, status, sorting
- Options: newest, trending (by replyCount + likeCount), mostReplies
- Pagination support

**File: `get-similar-threads.usecase.ts`**
- Called as user types thread title
- Real-time LLM similarity matching
- Return top N candidates with score

**File: `like-reply.usecase.ts`**
- Toggle like on reply
- Update likeCount
- Record in ThreadReplyLike table

**File: `link-thread-to-note.usecase.ts`**
- Manual linking between thread and note
- Set confidence = NULL (user-created)
- Allow for contextual learning

### 3.2 Permission Policy

Create a helper:
**File: `backend/src/application/threads/policies/thread-access.policy.ts`**
```typescript
export class ThreadAccessPolicy {
  // Panel access validation
  static canAccessPanel(userRole: Role, panel: ThreadPanel): boolean {
    // ACADEMIC: STUDENT, PROFESSOR
    // ALUMNI: STUDENT, ALUMNI, PROFESSOR
    // ADMIN: all panels
  }

  // Reply edit/delete validation
  static canEditReply(authorId: string, userId: string, isAdmin: boolean): boolean {
    return userId === authorId || isAdmin;
  }

  static canDeleteThread(authorId: string, userId: string, isAdmin: boolean): boolean {
    return userId === authorId || isAdmin;
  }

  static canCloseThread(userId: string, thread: Thread): boolean {
    // Only author or admin
  }
}
```

### 3.3 Background Jobs & Integration

**File: `backend/src/application/threads/jobs/embed-thread.job.ts`**
```typescript
// After thread creation, queue a job to:
// 1. Extract text from title + description
// 2. Call Cohere Embed API
// 3. Store vector in ThreadEmbedding table
// 4. Recompute similarities for all threads in same panel
// 5. Update ThreadSimilarity table
```

**File: `backend/src/application/threads/jobs/update-thread-embedding.job.ts`**
- Triggered on thread edit
- Re-embed and recompute similarities

---

## Phase 4 – API & Presentation Layer

### 4.1 Controller

**File: `backend/src/presentation/threads/threads.controller.ts`**

Endpoints:
```typescript
// Threads
POST    /threads                    # Create thread
GET     /threads?panel=ACADEMIC     # List threads by panel
GET     /threads/:id                # Get thread with replies
PATCH   /threads/:id                # Update thread (author only)
DELETE  /threads/:id                # Soft-delete thread (author/admin)

// Suggestions & Search
POST    /threads/search-similar     # Real-time similarity check (user typing)
GET     /threads/:id/similar        # Get similar threads for a thread

// Replies
POST    /threads/:id/replies        # Post reply to thread
GET     /threads/:id/replies        # List replies (paginated)
PATCH   /threads/:id/replies/:replyId  # Edit reply
DELETE  /threads/:id/replies/:replyId  # Delete reply

// Likes
POST    /threads/:id/replies/:replyId/like   # Like a reply
DELETE  /threads/:id/replies/:replyId/like   # Unlike a reply

// Thread-Note Linking
POST    /threads/:id/link-note/:noteId    # Link thread to note
GET     /threads/:id/linked-notes         # Get linked notes
DELETE  /threads/:id/link-note/:noteId    # Unlink
```

### 4.2 DTOs

**File: `backend/src/presentation/threads/dto/create-thread.dto.ts`**
```typescript
export class CreateThreadRequestDto {
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @IsNotEmpty()
  description: unknown;  // JSON rich-text

  @IsEnum(ThreadPanel)
  panel: ThreadPanel;
}

export class CreateThreadResponseDto {
  id: string;
  title: string;
  panel: ThreadPanel;
  author: { id: string; email: string; displayName: string };
  createdAt: Date;
  
  // Similar threads found
  similarThreads: Array<{
    id: string;
    title: string;
    replyCount: number;
    similarityScore: number;
  }>;
}
```

**File: `backend/src/presentation/threads/dto/post-reply.dto.ts`**
```typescript
export class PostReplyRequestDto {
  @IsNotEmpty()
  content: unknown;  // JSON rich-text
}

export class ReplyResponseDto {
  id: string;
  content: unknown;
  author: UserSummaryDto;
  likeCount: number;
  createdAt: Date;
  editedAt?: Date;
}
```

**File: `backend/src/presentation/threads/dto/list-threads.dto.ts`**
```typescript
export class ListThreadsQueryDto {
  @IsEnum(ThreadPanel)
  panel: ThreadPanel;

  @IsEnum(['newest', 'trending', 'mostReplies'])
  sortBy: string = 'newest';

  @IsNumber()
  skip: number = 0;

  @IsNumber()
  take: number = 20;
}
```

**File: `backend/src/presentation/threads/dto/search-similar.dto.ts`**
```typescript
export class SearchSimilarThreadsDto {
  @IsString()
  @MinLength(5)
  query: string;

  @IsEnum(ThreadPanel)
  panel: ThreadPanel;

  @IsNumber()
  @Min(1)
  @Max(10)
  limit: number = 5;

  @IsNumber()
  @Min(0)
  @Max(1)
  threshold: number = 0.6;  // Confidence threshold
}

export class SearchSimilarThreadsResponseDto {
  results: Array<{
    id: string;
    title: string;
    author: UserSummaryDto;
    replyCount: number;
    similarity: number;
  }>;
}
```

### 4.3 Module Wiring

**File: `backend/src/presentation/threads/threads.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { ThreadsController } from './threads.controller';
import { CreateThreadUseCase } from 'src/application/threads/create-thread.usecase';
import { GetThreadUseCase } from 'src/application/threads/get-thread.usecase';
// ... other use cases

import { PrismaThreadRepository } from 'src/infrastructure/repositories/prisma-thread.repository';
import { PrismaThreadReplyRepository } from 'src/infrastructure/repositories/prisma-thread-reply.repository';
// ... other repositories

import { CohereThreadLLMService } from 'src/infrastructure/ai/cohere/cohere-thread-llm.service';

@Module({
  controllers: [ThreadsController],
  providers: [
    // Use cases
    CreateThreadUseCase,
    GetThreadUseCase,
    PostReplyUseCase,
    // ... other use cases
    
    // Repositories
    { provide: 'ThreadRepository', useClass: PrismaThreadRepository },
    { provide: 'ThreadReplyRepository', useClass: PrismaThreadReplyRepository },
    { provide: 'ThreadLLMService', useClass: CohereThreadLLMService },
  ],
  exports: [
    // Export for websocket gateway
    { provide: 'ThreadRepository', useClass: PrismaThreadRepository },
    { provide: 'ThreadLLMService', useClass: CohereThreadLLMService },
  ],
})
export class ThreadsModule {}
```

---

## Phase 5 – Infrastructure (Repositories & AI Service)

### 5.1 Prisma Repository Implementations

**File: `backend/src/infrastructure/repositories/prisma-thread.repository.ts`**
```typescript
@Injectable()
export class PrismaThreadRepository implements ThreadRepository {
  constructor(private prisma: PrismaService) {}

  async create(thread: Thread): Promise<Thread> {
    const created = await this.prisma.thread.create({
      data: {
        title: thread.title,
        description: thread.description,
        panel: thread.panel,
        status: thread.status,
        authorId: thread.authorId,
      },
    });
    return this.toDomain(created);
  }

  async findById(id: string): Promise<Thread | null> {
    const record = await this.prisma.thread.findUnique({
      where: { id },
      include: {
        author: true,
        replies: { take: 5 },
      },
    });
    return record ? this.toDomain(record) : null;
  }

  async listByPanel(
    panel: ThreadPanel,
    status: ThreadStatus,
    options: { skip: number; take: number; sortBy: string }
  ): Promise<{ threads: Thread[]; total: number }> {
    const [threads, total] = await Promise.all([
      this.prisma.thread.findMany({
        where: { panel, status },
        skip: options.skip,
        take: options.take,
        orderBy: this.getSortBy(options.sortBy),
        include: { author: true },
      }),
      this.prisma.thread.count({ where: { panel, status } }),
    ]);
    return {
      threads: threads.map(t => this.toDomain(t)),
      total,
    };
  }

  private getSortBy(sortBy: string) {
    switch (sortBy) {
      case 'trending':
        return { replyCount: 'desc', viewCount: 'desc' };
      case 'mostReplies':
        return { replyCount: 'desc' };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  private toDomain(record: any): Thread {
    return new Thread(
      record.id,
      record.title,
      record.description,
      record.panel,
      record.status,
      record.authorId,
      record.replyCount,
      record.lastReplyAt,
      record.viewCount,
      record.createdAt,
      record.updatedAt,
    );
  }
}
```

**File: `backend/src/infrastructure/repositories/prisma-thread-reply.repository.ts`**
- Similar pattern for reply CRUD operations

**File: `backend/src/infrastructure/repositories/prisma-thread-similarity.repository.ts`**
- Store and query similar thread pairs

### 5.2 Cohere LLM Service for Threads

**File: `backend/src/infrastructure/ai/cohere/cohere-thread-llm.service.ts`**
```typescript
@Injectable()
export class CohereThreadLLMService implements ThreadLLMService {
  private cohereClient: CohereClient;

  constructor(
    configService: ConfigService,
    @Inject('ThreadRepository') private threadRepository: ThreadRepository,
    @Inject('ThreadSimilarityRepository') private similarityRepository: ThreadSimilarityRepository,
    private logger: Logger,
  ) {
    this.cohereClient = new CohereClient({
      token: configService.get('COHERE_API_KEY'),
    });
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await this.cohereClient.embed({
        texts: [text],
        model: 'embed-english-v3.0',
        inputType: 'search_query',  // or 'search_document' for stored texts
      });
      return response.embeddings[0];
    } catch (error) {
      this.logger.error('Failed to embed text', error);
      throw error;
    }
  }

  async findSimilarThreads(
    text: string,
    panel: ThreadPanel,
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<Array<{ threadId: string; title: string; similarityScore: number }>> {
    // 1. Embed the input text
    const queryEmbedding = await this.embedText(text);

    // 2. Fetch all threads in panel (or use vector search if pgvector available)
    const threads = await this.threadRepository.listByPanel(
      panel,
      ThreadStatus.OPEN,
      { skip: 0, take: 1000, sortBy: 'newest' }  // Fetch recent threads
    );

    // 3. Compute cosine similarity with stored embeddings
    const similarities = await this.computeSimilarities(
      queryEmbedding,
      threads.threads,
    );

    // 4. Filter by threshold and sort
    return similarities
      .filter(s => s.similarityScore >= threshold)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)
      .map(s => ({
        threadId: s.threadId,
        title: s.title,
        similarityScore: s.similarityScore,
      }));
  }

  private async computeSimilarities(
    queryEmbedding: number[],
    threads: Thread[],
  ): Promise<Array<{ threadId: string; title: string; similarityScore: number }>> {
    // For each thread, fetch its embedding and compute cosine similarity
    const results = [];

    for (const thread of threads) {
      // Fetch stored embedding from ThreadEmbedding table
      const storedEmbedding = await this.getThreadEmbedding(thread.id);
      if (!storedEmbedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
      results.push({
        threadId: thread.id,
        title: thread.title,
        similarityScore: similarity,
      });
    }

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async getThreadEmbedding(threadId: string): Promise<number[] | null> {
    // Fetch from ThreadEmbedding table
    // Retrieve embeddingJson or embedding vector
  }

  async embedThreads(threads: Array<{ id: string; text: string }>): Promise<void> {
    // Batch embed threads for initial indexing or re-indexing
    try {
      const texts = threads.map(t => t.text);
      const response = await this.cohereClient.embed({
        texts,
        model: 'embed-english-v3.0',
        inputType: 'search_document',
      });

      // Store embeddings in ThreadEmbedding table
      for (let i = 0; i < threads.length; i++) {
        await this.storeEmbedding(threads[i].id, response.embeddings[i]);
      }
    } catch (error) {
      this.logger.error('Failed to batch embed threads', error);
      throw error;
    }
  }

  private async storeEmbedding(threadId: string, embedding: number[]): Promise<void> {
    // Store in ThreadEmbedding table
  }
}
```

### 5.3 Background Job for Embedding

**File: `backend/src/infrastructure/jobs/embed-thread.job.ts`** (using Bull or similar)
```typescript
@Processor('thread-embedding')
export class EmbedThreadJob {
  constructor(
    private threadRepository: ThreadRepository,
    private llmService: ThreadLLMService,
    private similarityRepository: ThreadSimilarityRepository,
    private logger: Logger,
  ) {}

  @Process()
  async process(job: Job<{ threadId: string }>) {
    const { threadId } = job.data;

    try {
      // 1. Fetch thread
      const thread = await this.threadRepository.findById(threadId);
      if (!thread) return;

      // 2. Extract text
      const text = `${thread.title} ${extractTextFromJson(thread.description)}`;

      // 3. Embed
      const embedding = await this.llmService.embedText(text);

      // 4. Store embedding
      await this.storeEmbedding(threadId, embedding);

      // 5. Recompute similarities with existing threads in same panel
      await this.recomputeSimilarities(threadId, thread.panel);

      this.logger.log(`Embedded thread ${threadId}`);
    } catch (error) {
      this.logger.error(`Failed to embed thread ${threadId}`, error);
      throw error;
    }
  }

  private async recomputeSimilarities(threadId: string, panel: ThreadPanel) {
    // Fetch all threads in panel
    // Compute similarity between new thread and existing ones
    // Store top N similar pairs in ThreadSimilarity table
  }
}
```

---

## Phase 6 – WebSocket Real-Time Transport

### 6.1 Thread WebSocket Gateway

**File: `backend/src/infrastructure/websocket/threads.gateway.ts`**

Room key pattern: `threads:{threadId}`

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/threads',
})
export class ThreadsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Namespace;

  constructor(
    @Inject('ThreadRepository') private threadRepository: ThreadRepository,
    @Inject('TokenService') private tokenService: TokenService,
    private logger: Logger,
  ) {}

  // When user joins a thread room
  @SubscribeMessage('threads:join')
  async onJoinThread(
    @MessageBody() data: { threadId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.extractUserIdFromAuth(client);
      const thread = await this.threadRepository.findById(data.threadId);

      if (!thread) {
        client.emit('error', { message: 'Thread not found' });
        return;
      }

      client.join(`threads:${data.threadId}`);
      client.emit('threads:joined', { threadId: data.threadId });

      // Broadcast user presence
      this.server
        .to(`threads:${data.threadId}`)
        .emit('threads:user-joined', { userId, threadId: data.threadId });
    } catch (error) {
      this.logger.error('Join thread error', error);
      client.emit('error', { message: 'Failed to join thread' });
    }
  }

  // Broadcast new reply to all users in thread room
  @SubscribeMessage('threads:reply-posted')
  async onReplyPosted(
    @MessageBody() data: { threadId: string; reply: any },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.extractUserIdFromAuth(client);
      // Validate user authored reply
      if (data.reply.authorId !== userId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Broadcast to room
      this.server.to(`threads:${data.threadId}`).emit('threads:reply-created', {
        reply: data.reply,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Reply posted error', error);
    }
  }

  // Real-time similarity detection as user types
  @SubscribeMessage('threads:typing-similarity')
  async onTypingSimilarity(
    @MessageBody() data: { panel: ThreadPanel; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const similarThreads = await this.llmService.findSimilarThreads(
        data.text,
        data.panel,
        5,
        0.65,
      );

      client.emit('threads:similarity-results', {
        results: similarThreads,
      });
    } catch (error) {
      this.logger.error('Similarity search error', error);
    }
  }

  @SubscribeMessage('threads:leave')
  onLeaveThread(
    @MessageBody() data: { threadId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.extractUserIdFromAuth(client);
    client.leave(`threads:${data.threadId}`);
    this.server
      .to(`threads:${data.threadId}`)
      .emit('threads:user-left', { userId });
  }

  // ... other event handlers
}
```

---

## Phase 7 – Cohere AI Integration Deep Dive

### 7.1 LLM Embedding Strategy

The Cohere Embed API will power two core features:

#### **A. Real-Time Typing Suggestions (User Experience)**
```
User types: "How to prepare for CS101 midterm?"
   ↓
Frontend: Sends text to POST /threads/search-similar
   ↓
Backend Controller:
  - Input: query text, panel
  - Calls: LLMService.findSimilarThreads()
   ↓
LLMService.findSimilarThreads():
  1. Embed query text with Cohere Embed API
  2. Fetch top 100 threads in panel from DB
  3. For each thread, retrieve stored embedding
  4. Compute cosine similarity: dot(query, thread) / (||query|| * ||thread||)
  5. Filter by threshold (0.65+ for high relevance)
  6. Sort by similarity score
  7. Return top 5 candidates to user
   ↓
Frontend: Displays "3 similar discussions found" with suggestions
```

**Performance Optimization:**
- Cache embeddings in `ThreadEmbedding` table
- Use FAISS (Facebook AI Similarity Search) for in-memory index if scaling
- Alternative: PostgreSQL pgvector extension with IVFFlat indexing for sub-second queries

#### **B. Background Embedding Pipeline (Indexing)**
```
Thread created: "How to find internship at FAANG?"
   ↓
ThreadsController.create() emits: { type: 'thread.created', threadId }
   ↓
Job Queue (Bull/BullMQ):
  1. Extract title + description text
  2. Call Cohere Embed API → get embedding vector
  3. Store vector in ThreadEmbedding table
  4. Query all threads in same panel
  5. Compute similarity scores between new thread and existing ones
  6. Store top 20 similarities in ThreadSimilarity table
   ↓
ThreadSimilarity now enables:
  - "People asking similar questions also asked..."
  - Trending calculations based on reply velocity + similarity overlap
```

### 7.2 Cohere API Integration Points

#### **Endpoint 1: Embed Text** (used 2 ways)

```typescript
// Mode A: Query embedding (user typing)
const response = await cohere.embed({
  texts: ["How to prepare for CS101 midterm?"],
  model: "embed-english-v3.0",
  inputType: "search_query",  // Optimized for search queries
});
// Returns: embedding of dimension 1024

// Mode B: Document embedding (stored threads)
const response = await cohere.embed({
  texts: ["Thread title: How to prepare...\nThread content: ..."],
  model: "embed-english-v3.0",
  inputType: "search_document",  // Optimized for indexed docs
});
// Returns: embedding of dimension 1024
```

**Key Detail:** Cohere's `inputType` parameter optimizes embeddings for either search queries or stored documents. Use `search_query` for user input and `search_document` for thread content.

#### **Endpoint 2: Rerank Results** (optional, Phase 2)

```typescript
// Optional: Use Cohere Rerank to improve ordering
const response = await cohere.rerank({
  model: "rerank-english-v2.0",
  query: "How to prepare for CS101 midterm?",
  documents: [
    { id: "thread-1", text: "Mid-term prep tips for CS101..." },
    { id: "thread-2", text: "CS101 exam strategy..." },
  ],
  topN: 5,
});
// Returns: re-scored and re-ranked results with better relevance
```

This is optional for V1 but valuable for improving suggestion quality.

### 7.3 Similarity Scoring Formula

```
Cosine Similarity = (a · b) / (||a|| × ||b||)

Where:
  a = query embedding (user's typed text)
  b = thread embedding (indexed thread title + description)
  · = dot product
  ||x|| = Euclidean norm (L2 magnitude)

Result: float between -1 and 1
  → 1.0 = identical direction (perfect match)
  → 0.7–0.9 = highly similar
  → 0.5–0.7 = moderately similar
  → < 0.5 = low similarity (filter out)

Recommended thresholds:
  - Real-time suggestions: 0.65+ (catch related topics)
  - Strict deduplication: 0.75+ (only near-duplicates)
  - Trending/grouping: 0.7+ (related discussions)
```

### 7.4 Cost & Rate Limiting

Cohere Embed API pricing (as of 2024):
- **Free tier**: 100 calls/minute for embed + rerank
- **Production**: $0.10 per 1M input tokens for embed-v3

**Optimization strategy:**
```
Cost Control:
1. Embed only on creation (not every keystroke) → ~5 API calls/user/session
2. Batch embed threads → 100 threads in 1 request
3. Cache embeddings in DB → no re-embedding on search
4. Async job queue → don't block user on API latency

Rate Limiting:
- Queue large batch jobs during off-peak hours
- Implement exponential backoff for API failures
- Cache similarity search results for 1 hour
```

### 7.5 Fallback Strategy (if API fails)

```typescript
async findSimilarThreads(...) {
  try {
    // Primary: Cohere embedding + semantic search
    return await cohereSearch();
  } catch (error) {
    this.logger.warn('Cohere API failed, using fallback');
    
    // Fallback 1: Full-text search on title + description
    return await this.fullTextSearch();
    
    // Fallback 2: Simple tag-based matching
    return await this.tagBasedMatching();
  }
}
```

---

## Phase 8 – Thread ↔ Notes Integration

### 8.1 Linking Architecture

**Motivation:** A note on "CS101 Study Strategies" can be referenced in a thread asking for exam prep tips. This contextual linking enhances learning.

### 8.2 Manual Thread-Note Linking (V1)

**Endpoint: `POST /threads/:threadId/link-note/:noteId`**
```typescript
// User manually connects a note to a thread
// This creates ThreadNoteLink with linkType = MANUAL

{
  threadId: "abc123",
  noteId: "xyz789",
  linkType: "MANUAL",  // vs "AI"
  confidence: null,    // Only for AI-generated links
}

// UI: Thread page shows "Related Notes" section
// Users can discover related study materials while reading discussion
```

### 8.3 Future: AI-Powered Auto-Linking (Phase 2)

After embeddings are implemented, a separate job:

```typescript
// When thread is embedded:
async function autoLinkThreadToNotes(threadId) {
  1. Get thread embedding
  2. Fetch all note embeddings
  3. Compute similarities
  4. Filter by threshold (0.7+)
  5. Create ThreadNoteLink with linkType="AI", confidence=score
}

// Result: "People asking this also found these notes helpful"
```

### 8.4 Shared Embedding Infrastructure

Both notes and threads use the same Cohere Embed API:

```
Cohere Embed API
       ↓
  1024-dim vectors
     ↓        ↓
 Note Embedding  Thread Embedding
```

This allows **cross-domain similarity search** in Phase 2:
- "What notes discuss this topic?"
- "What threads reference this note?"

---

## Phase 9 – Frontend Implementation

### 9.1 Pages & Components Structure

```
web/src/
├── pages/
│   ├── ThreadsPage.tsx           # Main threads feed by panel
│   ├── ThreadDetailPage.tsx      # Single thread with replies
│   └── CreateThreadPage.tsx      # Thread creation with live suggestions
│
├── components/threads/
│   ├── ThreadList.tsx            # Paginated thread list
│   ├── ThreadCard.tsx            # Thread summary card
│   ├── ThreadDetail.tsx          # Full thread with replies
│   ├── ReplyForm.tsx             # Create/edit reply form
│   ├── ReplyList.tsx             # Paginated replies
│   ├── SimilarThreadsSidebar.tsx # Real-time suggestions
│   ├── ThreadEditor.tsx          # Rich-text editor (TipTap)
│   └── LinkedNotesSidebar.tsx    # Show linked notes
│
├── hooks/
│   ├── useThreadRoom.ts          # WebSocket room management
│   ├── useThreadList.ts          # Fetch & paginate threads
│   ├── useReplyForm.ts           # Reply submission
│   └── useSimilarThreads.ts      # Real-time similarity search
│
└── api/
    └── threads.api.ts            # REST calls + WebSocket events
```

### 9.2 Real-Time Similarity Feature (Frontend)

**User Flow:**
```
1. User opens "Create Thread" form
2. Starts typing title: "How to prepare for CS101..."
3. After 300ms debounce, emit: 'threads:typing-similarity'
4. Backend returns: [{ threadId, title, similarity: 0.82 }, ...]
5. UI renders: "We found 3 similar discussions"
6. User clicks to view before posting (deduplication)
```

**Implementation:**
```typescript
// hooks/useSimilarThreads.ts
export function useSimilarThreads(panel: ThreadPanel) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const socket = useThreadSocket();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.length > 10) {
        socket.emit('threads:typing-similarity', { panel, text });
      }
    }, 300);  // Debounce

    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    socket.on('threads:similarity-results', (data) => {
      setSuggestions(data.results);
    });
  }, []);

  return { suggestions };
}
```

```tsx
// pages/CreateThreadPage.tsx
export function CreateThreadPage() {
  const [title, setTitle] = useState('');
  const { suggestions } = useSimilarThreads(ThreadPanel.ACADEMIC);

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's your question?"
      />

      {suggestions.length > 0 && (
        <SimilarThreadsSidebar
          threads={suggestions}
          onSelect={(threadId) => {
            // Redirect to thread instead of creating duplicate
          }}
        />
      )}
    </div>
  );
}
```

### 9.3 Real-Time Reply Updates

```tsx
// hooks/useThreadRoom.ts
export function useThreadRoom(threadId: string) {
  const socket = useThreadSocket();
  const [replies, setReplies] = useState([]);

  useEffect(() => {
    socket.emit('threads:join', { threadId });

    socket.on('threads:reply-created', (data) => {
      setReplies((prev) => [data.reply, ...prev]);
    });

    return () => {
      socket.emit('threads:leave', { threadId });
    };
  }, [threadId]);

  return { replies };
}
```

### 9.4 Thread Polling & Pagination

```typescript
// api/threads.api.ts
export const threadsAPI = {
  listThreads: (panel: string, page = 0, sortBy = 'newest') =>
    client.get(`/threads?panel=${panel}&skip=${page * 20}&take=20&sortBy=${sortBy}`),

  getThread: (threadId: string) =>
    client.get(`/threads/${threadId}`),

  getReplies: (threadId: string, page = 0) =>
    client.get(`/threads/${threadId}/replies?skip=${page * 20}&take=20`),

  postReply: (threadId: string, content: unknown) =>
    client.post(`/threads/${threadId}/replies`, { content }),

  getSimilarThreads: (text: string, panel: string) =>
    client.post(`/threads/search-similar`, { text, panel }),
};
```

### 9.5 Thread Panel Access Control

```tsx
// Render based on user role
function ThreadsPage() {
  const user = useAuthContext();

  return (
    <div>
      {/* Academic Panel: STUDENT, PROFESSOR */}
      {['STUDENT', 'PROFESSOR'].includes(user.role) && (
        <ThreadPanel panel={ThreadPanel.ACADEMIC} />
      )}

      {/* Alumni Panel: STUDENT, ALUMNI, PROFESSOR */}
      {['STUDENT', 'ALUMNI', 'PROFESSOR'].includes(user.role) && (
        <ThreadPanel panel={ThreadPanel.ALUMNI} />
      )}
    </div>
  );
}
```

---

## Phase 10 – Testing & Validation

### 10.1 Backend Unit Tests

Tests to implement under `backend/test/threads/`:

```typescript
// Test: Create thread with similarity check
describe('CreateThreadUseCase', () => {
  it('should find similar threads when creating', async () => {
    // 1. Create first thread: "How to study for exams"
    // 2. Create second thread: "Exam preparation tips"
    // 3. Assert: second thread shows first as similar
  });

  it('should prevent non-students from creating in ACADEMIC panel', async () => {
    // Only STUDENT + PROFESSOR should access ACADEMIC
  });

  it('should prevent students from creating in ALUMNI panel', async () => {
    // Only ALUMNI + PROFESSOR should access ALUMNI
  });
});

// Test: Real-time similarity search
describe('ThreadLLMService', () => {
  it('should find similar threads by semantic meaning', async () => {
    // Query: "CS101 midterm"
    // Assert: Returns threads about "101 exam", "CS coursework", etc.
  });
});

// Test: WebSocket gateway
describe('ThreadsGateway', () => {
  it('should broadcast replies to all room members', async () => {
    // 1. Two users join thread room
    // 2. One posts reply
    // 3. Assert: other receives reply-created event
  });

  it('should enforce JWT auth on join', async () => {
    // Unauthenticated socket should not join
  });
});
```

### 10.2 Integration Tests

```typescript
// Test full flow: create thread → get similarity → post reply
describe('Threads E2E', () => {
  it('should create thread and suggest similar threads', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/threads')
      .send({
        title: 'How to prepare for CS101?',
        panel: 'ACADEMIC',
      });

    expect(res1.body.similarThreads).toBeDefined();
  });

  it('should list replies with pagination', async () => {
    const res = await request(app.getHttpServer())
      .get(`/threads/${threadId}/replies?skip=0&take=10`);

    expect(res.body.replies).toHaveLength(10);
    expect(res.body.total).toBeDefined();
  });
});
```

### 10.3 Manual API Tests

Create HTTP test files in `backend/test/threads/`:

```http
# test/threads/create-thread.http
POST http://localhost:3000/threads HTTP/1.1
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "title": "How to prepare for CS101 midterm?",
  "description": { "type": "doc", "content": [...] },
  "panel": "ACADEMIC"
}

###
# Response should include similarThreads array

# test/threads/post-reply.http
POST http://localhost:3000/threads/{{threadId}}/replies HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": { "type": "doc", "content": [...] }
}

###

# test/threads/search-similar.http
POST http://localhost:3000/threads/search-similar HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "How to study for exams",
  "panel": "ACADEMIC",
  "limit": 5
}
```

### 10.4 Frontend Testing Scenarios

```typescript
// Playwright / Cypress tests

describe('Threads Feature', () => {
  it('should suggest similar threads while typing', async () => {
    await page.goto('/create-thread');
    await page.fill('input[name="title"]', 'How to prepare');
    // Wait for suggestions
    await page.waitForSelector('[data-testid="similar-threads"]');
    const threads = await page.$$('[data-testid="thread-suggestion"]');
    expect(threads.length).toBeGreaterThan(0);
  });

  it('should post reply and broadcast to other users', async () => {
    // Multi-browser test with two windows
    const browser1 = await createBrowser();
    const browser2 = await createBrowser();

    // Browser 1: Open thread
    // Browser 2: Open same thread
    // Browser 1: Post reply
    // Browser 2: Assert reply appears

    await browser1.goto(`/threads/${threadId}`);
    await browser2.goto(`/threads/${threadId}`);
    await browser1.fill('textarea[name="content"]', 'My answer is...');
    await browser1.click('button[type="submit"]');
    // Wait for socket event
    await browser2.waitForSelector(`[data-reply-id="${newReplyId}"]`);
  });
});
```

---

## Phase 11 – Performance & Scale Optimization

### 11.1 Database Optimization

```sql
-- Indexes for fast queries
CREATE INDEX idx_threads_panel_status_createdAt ON threads(panel, status, createdAt DESC);
CREATE INDEX idx_threads_lastReplyAt ON threads(last_reply_at DESC);
CREATE INDEX idx_thread_replies_threadId ON thread_replies(thread_id, created_at DESC);
CREATE INDEX idx_thread_embeddings_threadId ON thread_embeddings(thread_id);

-- Vector similarity search (pgvector)
CREATE INDEX idx_thread_embeddings_cosine ON thread_embeddings USING ivfflat(embedding vector_cosine_ops);

-- Full-text search (optional, Phase 2)
ALTER TABLE threads ADD COLUMN search_tsv tsvector;
CREATE INDEX idx_threads_search ON threads USING gin(search_tsv);
```

### 11.2 Caching Strategy

```typescript
// Redis cache
enum CacheKeys {
  THREADS_ACADEMIC = 'threads:academic:latest',
  THREADS_ALUMNI = 'threads:alumni:latest',
  THREAD_DETAIL = 'thread:{}:detail',
  THREAD_REPLIES = 'thread:{}:replies:page:{}',
  SIMILAR_THREADS = 'thread:{}:similar',
}

// Cache invalidation on events
on ThreadCreated → invalidate THREADS_ACADEMIC or THREADS_ALUMNI
on ReplyPosted → invalidate THREAD_DETAIL, THREAD_REPLIES, THREAD_SIMILAR
on ThreadEmbedded → invalidate SIMILAR_THREADS for all affected threads
```

### 11.3 Pagination

```typescript
// Always paginate large result sets
GET /threads?panel=ACADEMIC&skip=0&take=20&sortBy=newest
GET /threads/:id/replies?skip=0&take=30
GET /threads/:id/linked-notes?skip=0&take=10
```

### 11.4 Rate Limiting

```typescript
// Prevent abuse
rate-limit: {
  createThread: 5 per hour per user,
  postReply: 20 per hour per user,
  searchSimilar: 100 per hour per user,  // LLM API calls
  likeReply: 200 per hour per user,
}
```

### 11.5 Monitoring & Metrics

Instrument with:
- **Threads created per hour** (growth metric)
- **Average replies per thread** (engagement)
- **LLM similarity API latency** (p50, p95, p99)
- **WebSocket active connections** (realtime scale)
- **Embedding queue depth** (job backlog)
- **Deduplication rate** (threads prevented due to similarity)

---

## Phase 12 – Security & Compliance

### 12.1 Authorization Checks

```typescript
// Every endpoint must validate:
1. User is authenticated (JWT token valid)
2. User has role access to panel
3. User is thread/reply author for edit/delete
4. No visibility of soft-deleted content unless admin

// Policy examples:
- POST /threads: User.role in ['STUDENT', 'PROFESSOR', 'ALUMNI']
- POST /threads/:id/replies: User.role in ['STUDENT', 'PROFESSOR', 'ALUMNI']
- PATCH /threads/:id: User.id === thread.authorId or User.role === 'ADMIN'
```

### 12.2 Soft Deletes

Never hard-delete content; always soft-delete:
```typescript
// Delete thread
PATCH /threads/:id
{ status: 'DELETED' }

// Delete reply
PATCH /threads/:id/replies/:replyId
{ status: 'DELETED' }

// Admin can still view and restore if needed
```

### 12.3 Content Sanitization

```typescript
// When storing rich-text JSON, sanitize HTML if needed
// Validate content schema before storing
// Never trust client-side HTML; re-validate on backend
```

### 12.4 Audit Logging

```typescript
// Log all write operations
ThreadActivity {
  threadId, userId, action: 'CREATED' | 'EDITED' | 'DELETED', timestamp
}
ReplyActivity {
  replyId, threadId, userId, action, timestamp
}
```

---

## Phase 13 – Documentation & Handoff

### 13.1 API Documentation

- Swagger/OpenAPI spec for all endpoints
- WebSocket event reference
- Error code documentation

### 13.2 Database Schema Documentation

- ER diagram (ThreadPanel, Thread, ThreadReply, etc.)
- Migration guide
- Backup & restore procedures

### 13.3 Deployment Guide

- Environment variables required (Cohere API key, DB, Redis)
- Docker setup
- Database seeding
- Job queue configuration

---

## Implementation Order (Exact Sequence)

This order prevents blockers and enables parallel work:

### Week 1
1. ✅ Phase 0: Scope definition
2. ✅ Phase 1: Prisma schema + migrations
3. ⏳ Phase 2: Domain entities + repositories (parallel with 1)
4. ⏳ Phase 3: Application use cases (after 2)

### Week 2
5. ⏳ Phase 4: API + DTOs + controller (after 3)
6. ⏳ Phase 5: Infrastructure repositories + modules (after 2)
7. ⏳ Phase 7a: Cohere LLM service (basic embed + search)
8. 🚀 Deploy: Basic CRUD + LLM similarity search working

### Week 3
9. ⏳ Phase 6: WebSocket gateway for real-time replies
10. ⏳ Phase 7b: Background embedding jobs
11. ⏳ Phase 8: Thread-Note linking (manual)
12. 🚀 Deploy: Real-time + LLM suggestions + linking

### Week 4
13. ⏳ Phase 9: Frontend pages + components
14. ⏳ Phase 10: Testing (unit + integration)
15. ⏳ Phase 11: Performance optimization
16. 🚀 Deploy: Full feature ready

---

## Definition of Done (V1)

The threads feature is production-ready when all are true:

✅ **Data Model**
- [ ] Prisma schema with Thread, ThreadReply, ThreadSimilarity, ThreadEmbedding models
- [ ] Indexes on all query columns
- [ ] Migrations applied successfully

✅ **Backend Logic**
- [ ] All 10+ use cases implemented
- [ ] Permission policy enforced: STUDENT→ACADEMIC, ALUMNI→ALUMNI panel
- [ ] Soft-deletes for content
- [ ] Activity logging for all writes

✅ **API**
- [ ] POST /threads (create)
- [ ] GET /threads (list by panel, with sorting)
- [ ] GET /threads/:id (detail with replies)
- [ ] POST /threads/:id/replies (post reply)
- [ ] POST /threads/search-similar (real-time suggestions)
- [ ] PATCH /threads/:id/replies/:id (edit)
- [ ] DELETE /threads/:id/replies/:id (soft-delete)
- [ ] POST /threads/:id/link-note/:noteId (manual linking)

✅ **LLM Integration**
- [ ] Cohere Embed API integrated
- [ ] Real-time similarity detection on create (user sees suggestions)
- [ ] Embeddings stored in ThreadEmbedding table
- [ ] Background job for batch embedding working
- [ ] Cosine similarity scoring accurate (0-1 range)
- [ ] Fallback to full-text search if API fails

✅ **Real-Time**
- [ ] WebSocket gateway for replies working
- [ ] Broadcasting to room members on reply post
- [ ] Similarity suggestions emit via socket

✅ **Frontend**
- [ ] Thread list by panel (ACADEMIC, ALUMNI)
- [ ] Create thread with live suggestions sidebar
- [ ] Thread detail with replies
- [ ] Post reply with real-time update
- [ ] Role-based access control (panels hidden for unauthorized users)

✅ **Testing**
- [ ] 80%+ code coverage for use cases
- [ ] Integration tests for full flows
- [ ] Manual API test files (*.http)
- [ ] WebSocket tests

✅ **Performance**
- [ ] Thread list pagination working
- [ ] Similarity search < 500ms (cached embeddings)
- [ ] WebSocket handles 100+ concurrent connections

✅ **Security**
- [ ] JWT auth enforced on all endpoints
- [ ] Soft-deletes prevent visibility of deleted content
- [ ] Rate limiting on LLM API calls
- [ ] No N+1 queries in API responses

---

## Known Limitations & Future Improvements

### Limitation 1: In-Memory Embedding Search
**Current:** Load all thread embeddings into memory for cosine similarity.
**Future:** Implement pgvector IVFFlat indexing for sub-millisecond searches at scale.

### Limitation 2: Manual Thread-Note Linking
**Current:** Only manual linking in V1.
**Future:** AI-powered auto-linking by comparing thread + note embeddings.

### Limitation 3: Simple Sorting
**Current:** newest, trending, mostReplies.
**Future:** Machine-learning ranking (clicks, dwell time, reply diversity).

### Limitation 4: No Moderation
**Current:** All content published immediately.
**Future:** Moderation queue, content flagging, spam detection.

### Limitation 5: No Tags/Labels
**Current:** Free-form titles only.
**Future:** Auto-tag via LLM ("ASSIGNMENT", "CAREER", "MENTAL_HEALTH", etc.).

---

## Summary Table: Threads vs Notes Feature Comparison

| Aspect | Notes | Threads |
|--------|-------|---------|
| **Collaborative** | Yes (multiple editors) | No (single author + replies) |
| **Rich-Text** | Yes (TipTap editor) | Yes (TipTap for content) |
| **Version History** | Yes (checkpoints) | No (edit log only) |
| **Sharing/Permissions** | Yes (VIEWER/EDITOR/OWNER) | No (public by panel) |
| **Real-Time Sync** | Yes (CRDT + Yjs) | Yes (WebSocket replies) |
| **Embeddings** | Future (Phase 8) | Present (Phase 3) |
| **Semantic Search** | Future (Phase 8) | Core feature (Phase 3) |
| **Linking** | Thread links (Phase 8) | Note links (Phase 8) |
| **LLM Use** | Topic extraction (future) | Deduplication (core) |

---

## Quick Reference Checklist

Use this during implementation:

### Database
- [ ] Prisma schema updated with Thread models
- [ ] Migrations applied
- [ ] Indexes created
- [ ] pgvector extension installed (production)

### Backend
- [ ] Domain entities + repositories defined
- [ ] Use cases implemented (10+)
- [ ] Controller with DTOs
- [ ] Module wiring complete
- [ ] Cohere service integrated
- [ ] Background jobs configured
- [ ] WebSocket gateway working

### Frontend
- [ ] Thread list page (both panels)
- [ ] Create thread page with suggestions
- [ ] Thread detail page with replies
- [ ] Real-time reply updates
- [ ] Role-based access control

### Testing & Deployment
- [ ] Unit + integration tests (80%+)
- [ ] Manual API tests
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Environment variables documented
- [ ] Deployment playbook written

---

## Contact & Escalation

For questions during implementation:
1. Refer to NOTES_COLLAB_IMPLEMENTATION_GUIDE.md for WebSocket/real-time patterns
2. Check infrastructure/ai/cohere/cohere.service.ts for LLM integration examples
3. Review existing repositories for Prisma patterns
4. Consult domain/repositories/ for contract definitions

---

**Document Version:** 1.0  
**Last Updated:** March 17, 2026  
**Status:** Ready for Implementation
