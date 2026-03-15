import axios from 'axios';
import { getAccessToken } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config
})

export type NoteRole = 'OWNER' | 'EDITOR' | 'VIEWER'
export type NoteStatus = 'ACTIVE' | 'ARCHIVED'

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
  role: NoteRole
}

export interface NoteVersion {
  versionNumber: number
  createdAt: string
  createdBy: string     // userId of who triggered the checkpoint
}

export async function createNote(title: string): Promise<{ noteId: string }> {
  const { data } = await api.post<{ noteId: string }>('/notes', { title })
  return data
}

// GET /notes
export async function listUserNotes(): Promise<{ notes: Note[] }> {
  const { data } = await api.get<{ notes: Note[] }>('/notes')
  return data
}

// GET /notes/:id
export async function getNote(noteId: string): Promise<{ note: Note }> {
  const { data } = await api.get<{ note: Note }>(`/notes/${noteId}`)
  return data
}

// PATCH /notes/:id
// Both content and metadata are optional — send only what changed
export async function updateNote(
  noteId: string,
  payload: {
    content?: any        // Tiptap JSON — send on autosave
    title?: string
    status?: NoteStatus
  },
): Promise<{ success: boolean }> {
  const { data } = await api.patch<{ success: boolean }>(`/notes/${noteId}`, payload)
  return data
}

// POST /notes/:id/share
export async function shareNote(
  noteId: string,
  collaboratorEmail: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/notes/${noteId}/share`, {
    collaboratorEmail,
    role,
  })
  return data
}

// GET /notes/:id/share
export async function listCollaborators(
  noteId: string,
): Promise<{ collaborators: NoteCollaborator[] }> {
  const { data } = await api.get<{ collaborators: NoteCollaborator[] }>(`/notes/${noteId}/share`)
  return data
}

// PATCH /notes/:id/share/:userId
export async function updateCollaboratorRole(
  noteId: string,
  userId: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<{ success: boolean }> {
  const { data } = await api.patch<{ success: boolean }>(`/notes/${noteId}/share/${userId}`, { role })
  return data
}

// DELETE /notes/:id/share/:userId
export async function removeCollaborator(
  noteId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/notes/${noteId}/share/${userId}`)
  return data
}

// POST /notes/:id/versions  — triggers a checkpoint save on the server
export async function createCheckpoint(
  noteId: string,
): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/notes/${noteId}/versions`)
  return data
}

// GET /notes/:id/versions
export async function listVersions(
  noteId: string,
): Promise<{ versions: NoteVersion[] }> {
  const { data } = await api.get<{ versions: NoteVersion[] }>(`/notes/${noteId}/versions`)
  return data
}

// POST /notes/:id/restore/:versionNumber
export async function restoreVersion(
  noteId: string,
  versionNumber: number,
): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/notes/${noteId}/restore/${versionNumber}`)
  return data
}
