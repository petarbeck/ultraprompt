import { defineStore } from 'pinia'
import { select, execute } from '../db'
import { rowToLane } from '../db/mappers'
import { reindex } from '../lib/reorder'
import type { Lane } from '../db/types'

export const useLanesStore = defineStore('lanes', {
  state: () => ({ lanes: [] as Lane[] }),
  actions: {
    async load() {
      const rows = await select<any>('SELECT * FROM lanes ORDER BY position')
      this.lanes = rows.map(rowToLane)
    },
    async add(input: { name: string; emoji: string }) {
      await execute('INSERT INTO lanes (name, emoji, position) VALUES ($1,$2,$3)',
        [input.name, input.emoji, this.lanes.length])
      await this.load()
    },
    async update(id: number, patch: Partial<Pick<Lane,'name'|'emoji'>>) {
      const cur = this.lanes.find(l => l.id === id); if (!cur) return
      await execute('UPDATE lanes SET name=$1, emoji=$2 WHERE id=$3', [patch.name ?? cur.name, patch.emoji ?? cur.emoji, id])
      await this.load()
    },
    async reorder(orderedIds: number[]) {
      for (const { id, position } of reindex(orderedIds))
        await execute('UPDATE lanes SET position=$1 WHERE id=$2', [position, id])
      await this.load()
    },
    async deleteWithMigration(id: number, targetLaneId: number) {
      // append this lane's tasks (all projects) to the end of the target lane, per project
      const tasks = await select<any>('SELECT id, project_id FROM tasks WHERE lane_id=$1 AND archived_at IS NULL', [id])
      for (const t of tasks) {
        const [{ n }] = await select<any>(
          'SELECT COALESCE(MAX(position)+1,0) AS n FROM tasks WHERE lane_id=$1 AND project_id=$2 AND archived_at IS NULL',
          [targetLaneId, t.project_id])
        await execute('UPDATE tasks SET lane_id=$1, position=$2 WHERE id=$3', [targetLaneId, n, t.id])
      }
      await execute('DELETE FROM lanes WHERE id=$1', [id])
      await this.load()
    },
  },
})
