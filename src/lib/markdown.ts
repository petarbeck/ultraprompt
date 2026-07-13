import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
export function renderMarkdown(body: string): string {
  return DOMPurify.sanitize(md.render(body ?? ''))
}
