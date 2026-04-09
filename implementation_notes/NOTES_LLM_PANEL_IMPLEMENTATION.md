# LLM Notes-to-Threads Panel Implementation

## Overview
Successfully implemented the LLM side panel for the notes feature that links related threads in real-time as users write notes. The backend API was already in place, so this implementation focused on the frontend integration and styling.

## Components Created

### 1. **RelatedThreadsPanel Component** (`web/src/components/notes/RelatedThreadsPanel.tsx`)
- Displays related discussions based on note content
- Shows thread cards with:
  - **Similarity Score**: Color-coded badge (green 80%+, blue 70%+, amber 60%+)
  - **Thread Title & Description**: Truncated for readability
  - **Engagement Stats**: Reply count and vote score
  - **Panel Badge**: Indicates ACADEMIC or ALUMNI panel
  - **External Link Indicator**: Shows on hover
- Click any thread to navigate to the thread detail page
- Loading state with spinner
- Empty state when insufficient content

### 2. **useNoteRelatedThreads Hook** (`web/src/hooks/useNoteRelatedThreads.ts`)
- Listens to note content changes from the editor
- **Debounced Search**: 350ms debounce to avoid excessive API calls
- **Content Threshold**: Requires minimum 20 characters before searching
- **WebSocket Integration**: Emits `notes:typing-related-threads` event
- **Real-time Updates**: Listens for `notes:related-threads` responses
- Controllable via `enabled` prop to only search when panel is open

### 3. **Type Definition** (`web/src/api/notes.api.ts`)
Added `RelatedThread` interface:
```typescript
export interface RelatedThread {
  threadId: string
  title: string
  description: string | null
  panel: 'ACADEMIC' | 'ALUMNI'
  replyCount: number
  voteScore: number
  similarityScore: number
}
```

## Integration

### NotePage Updates
- Added "AI Insights" button in the note header (next to History button)
- Toggle shows/hides the LLM panel
- Passes editor content to the hook in real-time
- Content updates trigger automatic search when panel is open

### CollaborativeEditor Enhancement
- Added `onContentUpdate` callback prop
- Notifies parent component of every content change
- Allows parent to pass content to the LLM hook

## Styling Features

### CSS Classes Created
- `.notes-llm-panel`: Main container with slide-in animation
- `.notes-llm-header`: Header with title and close button
- `.notes-llm-thread-card`: Individual thread card with hover effects
- `.notes-llm-similarity`: Color-coded similarity badge
- `.notes-llm-stats`: Thread engagement metrics
- `.notes-llm-panel-badge`: Panel type indicator
- Responsive design for tablets and mobile

### Design Highlights
- **Smooth Animations**: Slide-in from right on open
- **Hover Effects**: Cards brighten and shadow appears
- **Color Coding**: Similarity scores use intuitive color scheme
- **Responsive**: Adjusts width on smaller screens
- **Accessibility**: Proper button titles and semantic HTML

## Backend API Connection

The implementation uses the existing WebSocket endpoint:
```
Socket Event: 'notes:typing-related-threads'
Message Payload: { noteId, title, contentJson }
Response Event: 'notes:related-threads'
Response: { noteId, results: RelatedThread[] }
```

Backend Requirements:
- Minimum 20 characters of combined content
- Returns up to 5 threads with similarity threshold of 0.55 (55%)
- Uses Cohere embeddings for semantic search

## User Experience Flow

1. User opens a note and clicks "AI Insights" button
2. Panel slides in from the right showing "Write more to find similar discussions"
3. As user types, the hook debounces and searches after 350ms of inactivity
4. Once 20+ characters exist, backend searches for related threads
5. Panel populates with up to 5 most similar discussions
6. Similarity scores show relevance (80%+ in green is highly relevant)
7. User can click any thread card to view the full discussion
8. Panel closes when:
   - User clicks the X button
   - User opens History or Share panels
   - User clicks the "AI Insights" button again

## Files Modified
- `/web/src/pages/NotePage.tsx` - Main integration
- `/web/src/components/notes/CollaborativeEditor.tsx` - Content tracking
- `/web/src/api/notes.api.ts` - Type definitions
- `/web/src/styles.css` - Styling and animations

## Files Created
- `/web/src/components/notes/RelatedThreadsPanel.tsx` - UI Component
- `/web/src/hooks/useNoteRelatedThreads.ts` - Data fetching hook
