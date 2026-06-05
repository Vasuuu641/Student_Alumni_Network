import { requestJson } from '../lib/api';

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'
export type NoteStatus = 'ACTIVE' | 'ARCHIVED'

export interface RelatedThread {
  threadId: string
  title: string
  description: string | null
  panel: 'ACADEMIC' | 'ALUMNI'
  replyCount: number
  voteScore: number
  similarityScore: number
}

export interface Note {
    id: string
    title: string
    content: any          
    ownerId: string
    status: NoteStatus
    createdAt: string
    updatedAt: string
}

export interface NoteCollaborator {
  userId: string
  email: string
  displayName?: string
  role: NoteRole
}

export interface NoteVersion {
  versionNumber: number
  createdAt: string
  createdBy: string     // userId of who triggered the checkpoint
  snapshotJson?: unknown
}

export async function createNote(
  token: string,
  title: string,
): Promise<{ noteId: string }> {
  return requestJson('/notes', { token, method: 'POST', body: { title } });
}

// GET /notes
export async function listUserNotes(
  token: string,
): Promise<{ notes: Note[] }> {
  return requestJson('/notes', { token });
}

// GET /notes/:id
export async function getNote(
  token: string,
  noteId: string,
): Promise<Note> {
  return requestJson(`/notes/${noteId}`, { token });
}
// PATCH /notes/:id
// Both content and metadata are optional — send only what changed
export async function updateNote(
  token: string,
  noteId: string,
  payload: {
    content?: any
    title?: string
    status?: NoteStatus
  },
): Promise<{ success: boolean }> {
  return requestJson(`/notes/${noteId}`, { token, method: 'PATCH', body: payload });
}

// POST /notes/:id/share
export async function shareNote(
  token: string,
  noteId: string,
  collaboratorEmail: string,
  role: 'editor' | 'viewer',
): Promise<{ success: boolean }> {
  return requestJson(`/notes/${noteId}/share`, {
    token,
    method: 'POST',
    body: { collaboratorEmail, role: role.toLowerCase() },
  });
}

// GET /notes/:id/share
export async function listCollaborators(
  token: string,
  noteId: string,
): Promise<{ collaborators: NoteCollaborator[] }> {
  return requestJson(`/notes/${noteId}/share`, { token });
}

// PATCH /notes/:id/share/:userId
export async function updateCollaboratorRole(
  token: string,
  noteId: string,
  userId: string,
  role: 'editor' | 'viewer',
): Promise<{ success: boolean }> {
  return requestJson(`/notes/${noteId}/share/${userId}`, { token, method: 'PATCH', body: { role: role.toLowerCase() } });
}

// DELETE /notes/:id/share/:userId
export async function removeCollaborator(
  token: string,
  noteId: string,
  userId: string,
): Promise<{ success: boolean }> {
  return requestJson(`/notes/${noteId}/share/${userId}`, { token, method: 'DELETE' });
}

// POST /notes/:id/versions  — triggers a checkpoint save on the server
export async function createCheckpoint(
  token: string,
  noteId: string,
): Promise<{ success: boolean }> {
  return requestJson(`/notes/${noteId}/versions`, { token, method: 'POST' });
}

// GET /notes/:id/versions
export async function listVersions(
  token: string,
  noteId: string,
): Promise<{ versions: NoteVersion[] }> {
  return requestJson(`/notes/${noteId}/versions`, { token });
}

// POST /notes/:id/restore/:versionNumber
export async function restoreVersion(
  token: string,
  noteId: string,
  versionNumber: number,
): Promise<{ success: boolean }> {
  return requestJson(`/notes/${noteId}/restore/${versionNumber}`, { token, method: 'POST' });
}
