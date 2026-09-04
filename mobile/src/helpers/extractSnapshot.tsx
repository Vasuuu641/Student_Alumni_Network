// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractSnapshotPreview(snapshotJson: unknown): string {
  if (!snapshotJson || typeof snapshotJson !== 'object') return ''
  const chunks: string[] = []
  const walk = (node: any) => {
    if (!node) return
    if (typeof node === 'string') { chunks.push(node); return }
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (typeof node === 'object') {
      if (typeof node.text === 'string') chunks.push(node.text)
      if (node.content) walk(node.content)
    }
  }
  walk(snapshotJson)
  return chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, 300)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}