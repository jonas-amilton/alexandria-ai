export interface RagChunk {
  id: string
  projectId: string
  filePath: string
  startLine: number
  endLine: number
  content: string
  fileHash: string
}

export interface RagSearchResult {
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  score?: number
}

export interface RagIndexStats {
  indexedFiles: number
  totalChunks: number
  lastIndexedAt?: number
}
