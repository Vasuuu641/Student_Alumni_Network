const PAGE_CHAR_LIMIT = 2200
const AUTO_PAGE_THRESHOLD = Math.floor(PAGE_CHAR_LIMIT * 0.85)

export function createAutoPager(editor: any) {
  let prevLen = 0
  let busy = false

  const countBreaks = () => {
    let n = 0
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'horizontalRule') n += 1
    })
    return n
  }
  const hasSection = () => {
    let found = false
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'pageSection') found = true
      return !found
    })
    return found
  }
  const blankPage = () => [
    { type: 'horizontalRule' },
    { type: 'pageSection', attrs: { basePage: false }, content: [{ type: 'paragraph' }] },
  ]
  const appendPage = () => {
    if (!editor.schema.nodes.horizontalRule || !editor.schema.nodes.pageSection) return
    if (!hasSection()) {
      const content = editor.getJSON().content ?? [{ type: 'paragraph' }]
      editor.chain().setContent({
        type: 'doc',
        content: [{ type: 'pageSection', attrs: { basePage: true }, content }, ...blankPage()],
      }).focus('end').run()
      return
    }
    editor.chain().insertContentAt(editor.state.doc.content.size, blankPage()).focus('end').run()
  }

  return function afterLocalChange(canAutoPage: boolean) {
    const len = editor.getText().length
    const prev = prevLen
    prevLen = len
    if (!canAutoPage || busy) return
    if (Math.abs(len - prev) > 80) return
    if (len < AUTO_PAGE_THRESHOLD) return
    if (Math.floor(len / PAGE_CHAR_LIMIT) <= countBreaks()) return
    busy = true
    setTimeout(() => { try { appendPage() } finally { busy = false } }, 0)
  }
}