// Remembers the editor caret offset per task across modal opens, for the current
// app session only (in-memory; not persisted to the DB).
const caretByTask = new Map<number, number>()
export function saveCaret(taskId: number, offset: number) { caretByTask.set(taskId, offset) }
export function getCaret(taskId: number): number | undefined { return caretByTask.get(taskId) }
