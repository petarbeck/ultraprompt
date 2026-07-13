export interface Project { id:number; name:string; workingDir:string; targetSubpath:string; position:number; isFavorite:boolean; archivedAt:string|null; workingDirBookmark:string|null }
export interface Lane { id:number; name:string; emoji:string; position:number }
export interface Task { id:number; projectId:number; laneId:number|null; body:string; position:number; isFavorite:boolean;
  isLocked:boolean; sentAt:string|null; sentPath:string|null; completedAt:string|null; archivedAt:string|null;
  createdAt:string; updatedAt:string }
export interface ChecklistItem { id:number; taskId:number; text:string; isChecked:boolean; position:number }
