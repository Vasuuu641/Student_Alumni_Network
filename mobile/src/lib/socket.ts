// src/lib/socket.ts
import { io, Socket } from 'socket.io-client'
import Constants from 'expo-constants'
import { getValidAccessToken } from './auth-session'

const RAW_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:3000'

const URL = RAW_URL.replace(/\/$/, '')

export const socket: Socket = io(`${URL}/notes`, {
  autoConnect: false,
  // Keep polling as a fallback so local dev still works behind proxies.
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  auth: async (cb) => {
  const token = await getValidAccessToken()
  cb({ token })
},
})