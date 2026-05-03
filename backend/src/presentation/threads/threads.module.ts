import { Module } from '@nestjs/common';
import { ThreadsController } from './threads.controller';

import { CreateThreadUseCase } from '../../application/threads/create-thread.usecase';
import { GetThreadUseCase } from '../../application/threads/get-thread.usecase';
import { ListThreadsUseCase } from '../../application/threads/list-threads.usecase';
import { PostReplyUseCase } from '../../application/threads/post-reply.usecase';
import { EditReplyUseCase } from '../../application/threads/edit-reply.usecase';
import { DeleteReplyUseCase } from '../../application/threads/delete-reply.usecase';
import { VoteThreadUseCase } from '../../application/threads/vote-thread.usecase';
import { VoteReplyUseCase } from '../../application/threads/vote-reply.usecase';
import { UpdateThreadStatusUseCase } from '../../application/threads/update-thread-status.usecase';
import { ListRepliesUseCase } from '../../application/threads/list-replies.usecase';

import { PrismaThreadRepository } from '../../infrastructure/repositories/prisma-thread.repository';
import { PrismaThreadReplyRepository } from '../../infrastructure/repositories/prisma-thread-reply.repository';
import { PrismaThreadVoteRepository } from '../../infrastructure/repositories/prisma-thread-vote.repository';

import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { ThreadsGateway } from '../../infrastructure/websocket/threads.gateway';

import { CohereThreadLLMService } from '../../infrastructure/ai/cohere/cohere-thread-llm.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [ThreadsController],
  providers: [
    // Use cases
    CreateThreadUseCase,
    GetThreadUseCase,
    ListThreadsUseCase,
    PostReplyUseCase,
    EditReplyUseCase,
    DeleteReplyUseCase,
    VoteThreadUseCase,
    VoteReplyUseCase,
    UpdateThreadStatusUseCase,
    ListRepliesUseCase,

    // Repository implementations
    PrismaThreadRepository,
    PrismaThreadReplyRepository,
    PrismaThreadVoteRepository,

    // LLM service
    CohereThreadLLMService,
    

    // Injection tokens
    { provide: 'ThreadRepository', useClass: PrismaThreadRepository },
    { provide: 'ThreadReplyRepository', useClass: PrismaThreadReplyRepository },
    { provide: 'ThreadVoteRepository', useClass: PrismaThreadVoteRepository },
    { provide: 'ThreadLLMService', useClass: CohereThreadLLMService },

    // Gateway + realtime publisher
    ThreadsGateway,
    { provide: 'ThreadsRealtimePublisher', useExisting: ThreadsGateway },
  ],
})
export class ThreadsModule {}