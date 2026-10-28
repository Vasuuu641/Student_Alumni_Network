import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    dedupe: [
      'react', 'react-dom',
      '@tiptap/core', '@tiptap/pm', '@tiptap/react',
      'prosemirror-model', 'prosemirror-view', 'prosemirror-state', 'prosemirror-transform',
      'yjs', 'y-protocols', 'y-prosemirror', 'lib0',
    ],
  },
  build: { outDir: 'build' },
})