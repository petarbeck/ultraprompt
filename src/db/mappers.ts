import type { Project, Lane, Task, ChecklistItem } from './types'
/* eslint-disable @typescript-eslint/no-explicit-any */
export const rowToProject = (r:any):Project => ({ id:r.id, name:r.name, workingDir:r.working_dir,
  targetSubpath:r.target_subpath, position:r.position, isFavorite:!!r.is_favorite, archivedAt:r.archived_at,
  workingDirBookmark:r.working_dir_bookmark ?? null })
export const rowToLane = (r:any):Lane => ({ id:r.id, name:r.name, emoji:r.emoji, position:r.position })
export const rowToTask = (r:any):Task => ({ id:r.id, projectId:r.project_id, laneId:r.lane_id, body:r.body,
  position:r.position, isFavorite:!!r.is_favorite, isLocked:!!r.is_locked, sentAt:r.sent_at, sentPath:r.sent_path,
  completedAt:r.completed_at ?? null, archivedAt:r.archived_at, createdAt:r.created_at, updatedAt:r.updated_at })
export const rowToChecklistItem = (r:any):ChecklistItem => ({ id:r.id, taskId:r.task_id, text:r.text,
  isChecked:!!r.is_checked, position:r.position })
