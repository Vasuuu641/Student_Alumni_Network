# LLM Panel - Technical Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         NotePage Component                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  State:                                                     │ │
│  │  - showLLMPanel: boolean                                   │ │
│  │  - editorContent: unknown                                  │ │
│  │  - note: { title, content }                               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         │                          ▼
         │              ┌─────────────────────────┐
         │              │ CollaborativeEditor     │
         │              │ (onContentUpdate)       │
         │              └─────────────────────────┘
         │                        │
         │                        │ Emits: onContentUpdate(content)
         │                        ▼
         │              setEditorContent()
         │                        │
         ▼                        ▼
┌──────────────────────────────────────────────┐
│     useNoteRelatedThreads Hook               │
│                                              │
│ Inputs:                                      │
│  - noteId                                    │
│  - title                                     │
│  - contentJson                               │
│  - enabled (showLLMPanel)                    │
└──────────────────────────────────────────────┘
         │
         │ 1. Watch for content changes
         │ 2. Debounce 350ms
         │ 3. Check 20+ char threshold
         │
         ▼
┌──────────────────────────────────────────────┐
│         WebSocket: /notes Namespace          │
│                                              │
│ Emit: 'notes:typing-related-threads'         │
│ Payload: {                                   │
│   noteId,                                    │
│   title,                                     │
│   contentJson                                │
│ }                                            │
└──────────────────────────────────────────────┘
         │
         ▼ (over network)
┌──────────────────────────────────────────────┐
│       Backend: NotesGateway                  │
│  @SubscribeMessage('notes:typing-related-threads') │
│                                              │
│  1. Validate JWT + room access              │
│  2. Call noteLLMService.findRelatedThreads()│
│  3. Use Cohere embeddings                    │
│  4. Return top 5 results (threshold 0.55)   │
└──────────────────────────────────────────────┘
         │
         ▼ (over network)
┌──────────────────────────────────────────────┐
│         WebSocket Response                   │
│                                              │
│ Emit: 'notes:related-threads'                │
│ Payload: {                                   │
│   noteId,                                    │
│   results: RelatedThread[]                   │
│ }                                            │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│     useNoteRelatedThreads Hook               │
│                                              │
│ Listen: socket.on('notes:related-threads')   │
│ Update: setRelatedThreads(results)           │
│ Update: setIsLoading(false)                  │
│                                              │
│ Return: { threads, isLoading }               │
└──────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────┐
│        RelatedThreadsPanel Component               │
│                                                    │
│ Props:                                             │
│  - threads: RelatedThread[]                        │
│  - isLoading: boolean                              │
│  - onClose: () => void                             │
│                                                    │
│ Display States:                                    │
│  - Loading: Spinner animation                      │
│  - Empty: "Write more to find discussions"         │
│  - Loaded: Thread cards with similarity scores     │
│                                                    │
│ Interactions:                                      │
│  - Click card: navigate to thread                  │
│  - Click X: onClose()                              │
└────────────────────────────────────────────────────┘
```

## Data Types

### RelatedThread Interface
```typescript
interface RelatedThread {
  threadId: string              // UUID of the thread
  title: string                 // Thread title
  description: string | null    // Thread description/excerpt
  panel: 'ACADEMIC' | 'ALUMNI'  // Which panel it's in
  replyCount: number            // Number of responses
  voteScore: number             // Net votes (upvotes - downvotes)
  similarityScore: number       // 0-1 (e.g., 0.75 = 75%)
}
```

### Hook Return Value
```typescript
interface UseNoteRelatedThreadsReturn {
  threads: RelatedThread[]  // Current search results
  isLoading: boolean        // Search in progress
}
```

## Event Flow Timeline

```
t=0ms     User types in editor
         └─> CollaborativeEditor.onUpdate fires
            └─> Calls onContentUpdate(snapshot)
               └─> setEditorContent(snapshot)

t=0ms     useNoteRelatedThreads detects content change
         └─> Clears previous debounce timer
         └─> Sets isLoading = true (optional)
         └─> Starts new 350ms timer

t=350ms   Debounce timer fires
         └─> Check content length >= 20 chars
         └─> Emit 'notes:typing-related-threads'
            └─> WebSocket sends to backend

t=400-600ms Backend processes
           └─> Validate user + permissions
           └─> Extract text from content JSON
           └─> Create embeddings via Cohere
           └─> Search similar threads
           └─> Return top 5 (threshold 0.55)

t=500-700ms Frontend receives response
           └─> socket.on('notes:related-threads')
           └─> setRelatedThreads(results)
           └─> setIsLoading(false)

t=501-701ms React re-renders
           └─> RelatedThreadsPanel shows results
           └─> User sees updated discussion suggestions
```

## Performance Considerations

### Debouncing
- **Duration**: 350ms (balances responsiveness vs API load)
- **Benefit**: Prevents 10+ requests per second while typing
- **Trade-off**: 350ms latency between typing and results

### Content Threshold
- **Minimum**: 20 characters combined (title + content)
- **Benefit**: Avoids meaningless searches
- **Efficiency**: Most searches succeed after 2-3 sentences

### Result Limit
- **Max Results**: 5 threads per search
- **Similarity Threshold**: 0.55 (55%)
- **Benefit**: Only highly relevant results shown

### WebSocket Efficiency
- **Only Active When**: Panel is open (showLLMPanel = true)
- **Connection**: Shared with collaborative editing
- **Multiple Listeners**: No duplicate WebSocket connections

## Backend Integration Points

### Required Backend API
```typescript
// WebSocket Event Handler
@SubscribeMessage('notes:typing-related-threads')
async handleTypingRelatedThreads(
  @ConnectedSocket() socket: Socket,
  @MessageBody() data: {
    noteId: string
    title: string
    contentJson: unknown
  }
)
// Emits: 'notes:related-threads'
```

### LLM Service Interface
```typescript
interface NoteLLMService {
  findRelatedThreads(
    title: string,
    contentJson: unknown,
    limit?: number,        // Default: 5
    threshold?: number     // Default: 0.55
  ): Promise<RelatedThread[]>
}
```

## CSS Architecture

### Responsive Breakpoints
- **Desktop (>1024px)**: Fixed right sidebar, 18rem width
- **Tablet (768-1024px)**: Absolute positioned overlay
- **Mobile (<768px)**: 14rem max-width overlay

### Animation Timing
- **Slide In**: 0.3s ease-out from right
- **Hover Effects**: 0.2s smooth transition
- **Spinner**: 1s linear infinite rotation

## Security Considerations

1. **JWT Validation**: Backend verifies token on every WebSocket message
2. **Room Access**: User must have permission to note before searching
3. **Content Filtering**: Backend sanitizes search input before embedding
4. **Rate Limiting**: Debounce prevents DoS-style searching
5. **No Data Leakage**: Search content stays in memory, not logged

## Testing Checklist

- [ ] Panel opens/closes with button click
- [ ] Content updates trigger search after 20+ chars
- [ ] Loading spinner appears during search
- [ ] Thread cards display with correct data
- [ ] Similarity colors are accurate
- [ ] Clicking thread navigates correctly
- [ ] Panel closes when opening History/Share
- [ ] Works with collaborative editing
- [ ] Responsive on mobile/tablet
- [ ] No console errors
