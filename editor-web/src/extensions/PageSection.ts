import { Node, mergeAttributes } from '@tiptap/core'

export const PageSection = Node.create({
  name: 'pageSection',
  group: 'block',
  content: 'block*',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      basePage: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-base-page') === 'true',
        renderHTML: (attributes) =>
          attributes.basePage ? { 'data-base-page': 'true' } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="page-section"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const isBasePage = HTMLAttributes['data-base-page'] === 'true'
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-section',
        class: `note-page-section${isBasePage ? ' note-page-section--base' : ''}`,
      }),
      0,
    ]
  },
})