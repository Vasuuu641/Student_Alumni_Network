// A page holds 297mm minus 24mm padding top and bottom.
const MM = 96 / 25.4
export const PAGE_CONTENT_PX = (297 - 48) * MM // ~941px
const SECTION_PADDING_PX = 48 * MM

/** True when the LAST page is already taller than one page of content. */
export function isLastPageFull(root: HTMLElement): boolean {
  const sections = root.querySelectorAll<HTMLElement>(':scope > .note-page-section')
  if (sections.length === 0) {
    return root.getBoundingClientRect().height > PAGE_CONTENT_PX
  }
  const last = sections[sections.length - 1]
  if (!(last.textContent ?? '').trim()) return false // blank page never counts as full
  const isBase = last.classList.contains('note-page-section--base')
  const inner = last.getBoundingClientRect().height - (isBase ? 0 : SECTION_PADDING_PX)
  return inner > PAGE_CONTENT_PX
}