import fs from 'node:fs'
const html = fs.readFileSync('build/index.html', 'utf8')
fs.mkdirSync('../mobile/src/editor', { recursive: true })
fs.writeFileSync(
  '../mobile/src/editor/editorHtml.ts',
  `export const editorHtml = ${JSON.stringify(html)}\n`,
)