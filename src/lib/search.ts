export function matchesQuery(text: string, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  if (!q.includes('*') && !q.includes('?')) return text.toLowerCase().includes(q.toLowerCase())
  // escape every regex special EXCEPT * and ?, then translate those to regex
  const escaped = q.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const pattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  try { return new RegExp(pattern, 'is').test(text) }
  catch { return text.toLowerCase().includes(q.toLowerCase()) }
}
