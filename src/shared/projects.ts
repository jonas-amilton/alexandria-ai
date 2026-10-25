export interface ProjectRecord {
  id: string
  name: string
  path: string
  lastOpenedAt: number
  hasAlexandriaConfig: boolean
}

export interface ProjectsState {
  activeProjectId: string
  activeProject: ProjectRecord | null
  projects: ProjectRecord[]
}
