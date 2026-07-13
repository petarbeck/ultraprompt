import { defineStore } from 'pinia'
import { select, execute } from '../db'
import { rowToChecklistItem } from '../db/mappers'
import type { ChecklistItem } from '../db/types'

export const useChecklistStore = defineStore('checklist', {
  state: () => ({ itemsByTask: {} as Record<number, ChecklistItem[]> }),
  actions: {
    async loadForTask(taskId: number) {
      const rows = await select<any>('SELECT * FROM checklist_items WHERE task_id=$1 ORDER BY position', [taskId])
      this.itemsByTask[taskId] = rows.map(rowToChecklistItem)
    },
    async addItem(taskId: number, text: string) {
      const items = this.itemsByTask[taskId] ?? []
      await execute('INSERT INTO checklist_items (task_id, text, position) VALUES ($1,$2,$3)', [taskId, text, items.length])
      await this.loadForTask(taskId)
    },
    async updateItem(id: number, patch: Partial<Pick<ChecklistItem,'text'|'isChecked'>>) {
      const cur = Object.values(this.itemsByTask).flat().find(i => i.id === id); if (!cur) return
      await execute('UPDATE checklist_items SET text=$1, is_checked=$2 WHERE id=$3',
        [patch.text ?? cur.text, (patch.isChecked ?? cur.isChecked) ? 1 : 0, id])
      await this.loadForTask(cur.taskId)
    },
    async toggle(id: number) {
      const cur = Object.values(this.itemsByTask).flat().find(i => i.id === id); if (!cur) return
      await this.updateItem(id, { isChecked: !cur.isChecked })
    },
    async remove(id: number) {
      const cur = Object.values(this.itemsByTask).flat().find(i => i.id === id); if (!cur) return
      await execute('DELETE FROM checklist_items WHERE id=$1', [id])
      await this.loadForTask(cur.taskId)
    },
  },
})
