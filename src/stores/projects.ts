import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { select, execute } from '../db'
import { rowToProject } from '../db/mappers'
import type { Project } from '../db/types'

// A macOS security-scoped bookmark for the working dir (base64), so the pipeline can
// write to it under the Mac App Store sandbox. Null off macOS / unsandboxed builds.
async function bookmarkFor(workingDir: string): Promise<string | null> {
  if (!workingDir) return null
  try { return await invoke<string | null>('create_working_dir_bookmark', { path: workingDir }) }
  catch { return null }
}

export const useProjectsStore = defineStore('projects', {
  state: () => ({ projects: [] as Project[], activeProjectId: null as number | null }),
  getters: { active: (s) => s.projects.find(p => p.id === s.activeProjectId) ?? null },
  actions: {
    async load() {
      const rows = await select<any>('SELECT * FROM projects WHERE archived_at IS NULL ORDER BY position')
      this.projects = rows.map(rowToProject)
      if (this.activeProjectId === null && this.projects.length) this.activeProjectId = this.projects[0].id
    },
    async add(input: { name: string; workingDir: string; targetSubpath?: string }) {
      const pos = this.projects.length
      const bookmark = await bookmarkFor(input.workingDir)
      await execute('INSERT INTO projects (name, working_dir, target_subpath, position, working_dir_bookmark) VALUES ($1,$2,$3,$4,$5)',
        [input.name, input.workingDir, input.targetSubpath ?? '', pos, bookmark])
      await this.load()
    },
    async update(id: number, patch: Partial<Pick<Project,'name'|'workingDir'|'targetSubpath'>>) {
      const cur = this.projects.find(p => p.id === id); if (!cur) return
      const workingDir = patch.workingDir ?? cur.workingDir
      // Re-bookmark only when the working dir actually changes (bookmarking is a native call).
      const bookmark = (patch.workingDir !== undefined && patch.workingDir !== cur.workingDir)
        ? await bookmarkFor(workingDir) : cur.workingDirBookmark
      await execute('UPDATE projects SET name=$1, working_dir=$2, target_subpath=$3, working_dir_bookmark=$4, updated_at=datetime(\'now\') WHERE id=$5',
        [patch.name ?? cur.name, workingDir, patch.targetSubpath ?? cur.targetSubpath, bookmark, id])
      await this.load()
    },
    async remove(id: number) {
      await execute('DELETE FROM projects WHERE id=$1', [id])
      if (this.activeProjectId === id) this.activeProjectId = null
      await this.load()
    },
    async reorder(orderedIds: number[]) {
      for (let i = 0; i < orderedIds.length; i++)
        await execute('UPDATE projects SET position=$1 WHERE id=$2', [i, orderedIds[i]])
      await this.load()
    },
    async toggleFavorite(id: number) {
      const cur = this.projects.find(p => p.id === id); if (!cur) return
      await execute('UPDATE projects SET is_favorite=$1 WHERE id=$2', [cur.isFavorite ? 0 : 1, id])
      await this.load()
    },
    setActive(id: number) { this.activeProjectId = id },
  },
})
