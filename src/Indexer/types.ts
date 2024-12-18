import { type TFile } from 'obsidian'

export interface IndexerRoot {
  [path: string]: IndexerNode
}

export interface IndexerNode
  extends Pick<TFile, 'basename' | 'extension' | 'stat' | 'path' | 'name'> {
  uri: string
  thumbnail?: string
}

export interface AbstractIndexerRoot {
  [path: string]: AbstractIndexerNode
}

export interface AbstractIndexerNode extends Omit<IndexerNode, 'thumbnail'> {
  thumbnail: Thumbnail
}

export interface Thumbnail {
  id: string
  data: string
}
