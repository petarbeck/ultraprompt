export function slugifyFirstLine(body: string): string {
  const firstLine = body.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? ''
  const stripped = firstLine.replace(/^#+\s*/, '')
  const slug = stripped.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || 'task'
}
