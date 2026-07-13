import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { select, execute } from '../db'
import { rowToTask } from '../db/mappers'
import { slugifyFirstLine } from '../lib/slugify'
import { useProjectsStore } from './projects'
import { useLanesStore } from './lanes'
import type { Task } from '../db/types'

const bodyTimers: Record<number, ReturnType<typeof setTimeout>> = {}
let pollInFlight = false

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    boardTasks: [] as Task[], archivedTasks: [] as Task[], pipelined: [] as Task[],
    processing: [] as string[], // basenames the harness has moved to .ultraprompt/processing/
  }),
  actions: {
    async loadForProject(projectId: number) {
      const rows = await select<any>(
        'SELECT * FROM tasks WHERE project_id=$1 AND archived_at IS NULL ORDER BY lane_id, position', [projectId])
      this.boardTasks = rows.map(rowToTask)
    },
    async loadArchived(projectId: number) {
      const rows = await select<any>(
        'SELECT * FROM tasks WHERE project_id=$1 AND archived_at IS NOT NULL ORDER BY sent_at DESC', [projectId])
      this.archivedTasks = rows.map(rowToTask)
    },
    async create(projectId: number, laneId: number, body = '') {
      const [{ n }] = await select<any>(
        'SELECT COALESCE(MAX(position)+1,0) AS n FROM tasks WHERE lane_id=$1 AND project_id=$2 AND archived_at IS NULL',
        [laneId, projectId])
      const res = await execute('INSERT INTO tasks (project_id, lane_id, body, position) VALUES ($1,$2,$3,$4)',
        [projectId, laneId, body, n])
      await this.loadForProject(projectId)
      return Number((res as any).lastInsertId)
    },
    updateBody(id: number, body: string) {
      const t = this.boardTasks.find(x => x.id === id); if (t) t.body = body
      clearTimeout(bodyTimers[id])
      bodyTimers[id] = setTimeout(() => {
        execute('UPDATE tasks SET body=$1, updated_at=datetime(\'now\') WHERE id=$2 AND is_locked=0', [body, id])
      }, 250)
    },
    flushBody(id: number) {
      if (!bodyTimers[id]) return
      clearTimeout(bodyTimers[id])
      delete bodyTimers[id]
      const t = this.boardTasks.find(x => x.id === id); if (!t) return
      execute('UPDATE tasks SET body=$1, updated_at=datetime(\'now\') WHERE id=$2 AND is_locked=0', [t.body, id])
    },
    // Persist a lane's full order after a drag: set lane_id (handles cross-lane moves)
    // and sequential position for every id in `orderedIds`.
    async reorderLane(projectId: number, laneId: number, orderedIds: number[]) {
      for (let i = 0; i < orderedIds.length; i++)
        await execute('UPDATE tasks SET lane_id=$1, position=$2 WHERE id=$3', [laneId, i, orderedIds[i]])
      await this.loadForProject(projectId)
    },
    // Move a task to another lane, appending it to the end (used by the task modal's
    // per-lane quick-move buttons). No-op if it's already in that lane.
    async moveToLane(task: Task, laneId: number) {
      if (task.laneId === laneId) return
      const [{ n }] = await select<any>(
        'SELECT COALESCE(MAX(position)+1,0) AS n FROM tasks WHERE lane_id=$1 AND project_id=$2 AND archived_at IS NULL',
        [laneId, task.projectId])
      await execute('UPDATE tasks SET lane_id=$1, position=$2 WHERE id=$3', [laneId, n, task.id])
      await this.loadForProject(task.projectId)
    },
    // Delete a task, returning a snapshot (row + its checklist) so an Undo toast
    // can restore it. Checklist rows are cascade-deleted, so we capture them first.
    async remove(id: number) {
      const task = this.boardTasks.find(x => x.id === id) ?? this.archivedTasks.find(x => x.id === id) ?? null
      const checklist = await select<any>('SELECT * FROM checklist_items WHERE task_id=$1 ORDER BY position', [id])
      await execute('DELETE FROM tasks WHERE id=$1', [id])
      const projects = useProjectsStore()
      if (projects.activeProjectId) await this.loadForProject(projects.activeProjectId)
      return task ? { task, checklist } : null
    },
    // Re-insert one or many snapshots (from remove()/removeLaneTasks()) with their
    // original ids/positions. Accepts a single snapshot or an array (for undo).
    async restore(payload: { task: Task; checklist: any[] } | { task: Task; checklist: any[] }[]) {
      const snaps = Array.isArray(payload) ? payload : [payload]
      if (!snaps.length) return
      for (const { task: t, checklist } of snaps) {
        await execute(
          `INSERT INTO tasks (id, project_id, lane_id, body, position, is_favorite, is_locked, sent_at, sent_path, completed_at, archived_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [t.id, t.projectId, t.laneId, t.body, t.position, t.isFavorite ? 1 : 0, t.isLocked ? 1 : 0,
           t.sentAt, t.sentPath, t.completedAt, t.archivedAt, t.createdAt, t.updatedAt])
        for (const c of checklist)
          await execute('INSERT INTO checklist_items (id, task_id, text, is_checked, position) VALUES ($1,$2,$3,$4,$5)',
            [c.id, c.task_id, c.text, c.is_checked, c.position])
      }
      await this.loadForProject(snaps[0].task.projectId)
    },
    // Delete every board task in a lane (active project), returning snapshots for undo.
    async removeLaneTasks(projectId: number, laneId: number) {
      const targets = this.boardTasks.filter(t => t.laneId === laneId)
      const snapshots: { task: Task; checklist: any[] }[] = []
      for (const t of targets) {
        const checklist = await select<any>('SELECT * FROM checklist_items WHERE task_id=$1 ORDER BY position', [t.id])
        snapshots.push({ task: { ...t }, checklist })
      }
      for (const t of targets) await execute('DELETE FROM tasks WHERE id=$1', [t.id])
      await this.loadForProject(projectId)
      return snapshots
    },
    // Archive every board task in a lane (active project) — bypass the harness. Returns
    // {id, laneId, position} so a batch Undo can restore each to its lane.
    async archiveLaneTasks(projectId: number, laneId: number) {
      const targets = this.boardTasks.filter(t => t.laneId === laneId)
      const snaps = targets.map(t => ({ id: t.id, laneId: t.laneId, position: t.position }))
      for (const t of targets) await execute('UPDATE tasks SET archived_at=datetime(\'now\') WHERE id=$1', [t.id])
      await this.loadForProject(projectId)
      await this.loadArchived(projectId)
      return snaps
    },
    // Undo a batch archive: clear archived_at and restore each task's lane + position.
    async restoreArchivedToLanes(items: { id: number; laneId: number | null; position: number }[]) {
      for (const it of items)
        await execute('UPDATE tasks SET archived_at=NULL, lane_id=$1, position=$2 WHERE id=$3', [it.laneId, it.position, it.id])
      const projects = useProjectsStore()
      if (projects.activeProjectId) { await this.loadForProject(projects.activeProjectId); await this.loadArchived(projects.activeProjectId) }
    },
    // Archive a task WITHOUT pipelining it (bypass the harness): drop it from the
    // board and surface it in the Archive view. sent_at stays null so it never
    // appears in the pipeline feed; is_locked stays 0 so unarchive can restore it.
    async archive(task: Task) {
      await execute('UPDATE tasks SET archived_at=datetime(\'now\') WHERE id=$1', [task.id])
      await this.loadForProject(task.projectId)
      await this.loadArchived(task.projectId)
    },
    // Import every .md file in `dir` (via the Rust command) as a new task in the
    // project's FIRST lane. Bodies = file contents. Returns the count imported.
    async importFromDir(projectId: number, dir: string) {
      const bodies = await invoke<string[]>('import_markdown_dir', { dir })
      const lanes = useLanesStore()
      const first = [...lanes.lanes].sort((a, b) => a.position - b.position)[0]
      if (!first) return { imported: 0, skipped: 0 }
      let imported = 0, skipped = 0
      for (const body of bodies) {
        // Dedupe: skip any file whose exact content already exists as a task in this
        // project (any lane, including archived/sent) — safe to re-import a folder.
        const [{ c }] = await select<any>('SELECT COUNT(*) AS c FROM tasks WHERE project_id=$1 AND body=$2', [projectId, body])
        if (Number(c) > 0) { skipped++; continue }
        const [{ n }] = await select<any>(
          'SELECT COALESCE(MAX(position)+1,0) AS n FROM tasks WHERE lane_id=$1 AND project_id=$2 AND archived_at IS NULL',
          [first.id, projectId])
        await execute('INSERT INTO tasks (project_id, lane_id, body, position) VALUES ($1,$2,$3,$4)',
          [projectId, first.id, body, n])
        imported++
      }
      const projectsStore = useProjectsStore()
      if (projectsStore.activeProjectId) await this.loadForProject(projectsStore.activeProjectId)
      return { imported, skipped }
    },
    // Return an archived/pipelined task to the board: append to the first lane
    // and clear all sent/completed/archived state so it's editable again.
    async unarchive(task: Task) {
      const lanes = useLanesStore()
      const first = [...lanes.lanes].sort((a, b) => a.position - b.position)[0]
      if (!first) return
      const [{ n }] = await select<any>(
        'SELECT COALESCE(MAX(position)+1,0) AS n FROM tasks WHERE lane_id=$1 AND project_id=$2 AND archived_at IS NULL',
        [first.id, task.projectId])
      await execute(
        'UPDATE tasks SET archived_at=NULL, is_locked=0, completed_at=NULL, sent_at=NULL, sent_path=NULL, lane_id=$1, position=$2 WHERE id=$3',
        [first.id, n, task.id])
      await this.loadForProject(task.projectId)
      await this.loadArchived(task.projectId)
      await this.loadAllPipelined()
    },
    // Revoke a still-queued pipelined task: delete its queue file so the harness
    // never processes it, then return it to the LAST (rightmost) lane at the top of
    // the non-favorite section (lowest position). Clears all sent/archived state.
    async revoke(task: Task) {
      const projects = useProjectsStore()
      const project = projects.projects.find(p => p.id === task.projectId)
      if (project && task.sentPath) {
        const baseName = task.sentPath.split(/[/\\]/).pop()!
        await invoke('revoke_queued', { workingDir: project.workingDir, baseName, bookmark: project.workingDirBookmark })
      }
      const lanes = useLanesStore()
      const last = [...lanes.lanes].sort((a, b) => a.position - b.position).pop()
      if (!last) return
      const [{ n }] = await select<any>(
        'SELECT COALESCE(MIN(position),0)-1 AS n FROM tasks WHERE lane_id=$1 AND project_id=$2 AND archived_at IS NULL',
        [last.id, task.projectId])
      await execute(
        'UPDATE tasks SET archived_at=NULL, is_locked=0, completed_at=NULL, sent_at=NULL, sent_path=NULL, lane_id=$1, position=$2 WHERE id=$3',
        [last.id, n, task.id])
      await this.loadForProject(task.projectId)
      await this.loadArchived(task.projectId)
      await this.loadAllPipelined()
    },
    async toggleFavorite(id: number) {
      const t = this.boardTasks.find(x => x.id === id); if (!t) return
      await execute('UPDATE tasks SET is_favorite=$1 WHERE id=$2', [t.isFavorite ? 0 : 1, id])
      const projects = useProjectsStore()
      if (projects.activeProjectId) await this.loadForProject(projects.activeProjectId)
    },
    async pipeline(task: Task) {
      const projects = useProjectsStore()
      const project = projects.projects.find(p => p.id === task.projectId)
      if (!project) throw new Error('project not found')
      const baseName = slugifyFirstLine(task.body)
      const writtenPath = await invoke<string>('pipeline_task', {
        workingDir: project.workingDir, baseName, body: task.body, bookmark: project.workingDirBookmark,
      })
      await execute(
        'UPDATE tasks SET is_locked=1, sent_at=datetime(\'now\'), sent_path=$1, archived_at=datetime(\'now\'), lane_id=NULL WHERE id=$2',
        [writtenPath, task.id])
      await this.loadForProject(task.projectId)
      await this.loadAllPipelined()
      return writtenPath
    },
    // Global history feed source: every pipelined task across all projects, newest first.
    async loadAllPipelined() {
      const rows = await select<any>('SELECT * FROM tasks WHERE sent_at IS NOT NULL ORDER BY sent_at DESC')
      this.pipelined = rows.map(rowToTask)
    },
    // Poll each project's .ultraprompt/done/ dir; when a sent task's file appears
    // there, mark it completed. Called on an interval while the app is open.
    async pollDone() {
      if (pollInFlight) return // don't overlap slow polls on the interval
      pollInFlight = true
      try {
        const projects = useProjectsStore()
        let changed = false
        const processing: string[] = []
        for (const p of projects.projects) {
          const pending = this.pipelined.filter(t => t.projectId === p.id && t.sentPath && !t.completedAt)
          if (!pending.length) continue
          const status = await invoke<{ processing: string[]; done: string[] }>('list_queue_status', { workingDir: p.workingDir, bookmark: p.workingDirBookmark })
          const doneSet = new Set(status.done)
          const procSet = new Set(status.processing)
          for (const t of pending) {
            const base = t.sentPath!.split(/[/\\]/).pop()! // tolerate \ paths on Windows
            if (doneSet.has(base)) {
              await execute('UPDATE tasks SET completed_at=datetime(\'now\') WHERE id=$1', [t.id])
              changed = true
            } else if (procSet.has(base)) {
              processing.push(base)
            }
          }
        }
        this.processing = processing // drives the Queued/Processing split in the feed
        if (changed) {
          await this.loadAllPipelined()
          // keep the Archive table's Sent/Completed pill in sync too
          if (projects.activeProjectId) await this.loadArchived(projects.activeProjectId)
        }
      } finally {
        pollInFlight = false
      }
    },
  },
})
