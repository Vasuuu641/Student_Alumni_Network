import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
       '@10play/tentap-editor/web': path.resolve(
         __dirname,
         'node_modules/@10play/tentap-editor/lib/module/webEditorUtils/index.js',
       ),
     },
    dedupe: [
      'react', 'react-dom',
      '@tiptap/core', '@tiptap/pm', '@tiptap/react',
      'prosemirror-model', 'prosemirror-view', 'prosemirror-state', 'prosemirror-transform',
      'yjs', 'y-protocols', 'y-prosemirror', 'lib0',
    ],
  },
  build: { outDir: 'build' },
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
})