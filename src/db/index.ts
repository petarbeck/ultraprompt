import Database from '@tauri-apps/plugin-sql'
let _db: Database | null = null
export async function getDb(): Promise<Database> {
  if (!_db) _db = await Database.load('sqlite:ultraprompt.db')
  return _db
}
export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb(); return db.select<T[]>(sql, params)
}
export async function execute(sql: string, params: unknown[] = []) {
  const db = await getDb(); return db.execute(sql, params)
}
