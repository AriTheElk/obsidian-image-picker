import { TFile } from 'obsidian'
import { debounce, merge } from 'lodash'
import { v4 } from 'uuid'
import Dexie from 'dexie'

import {
  fetchImageFile,
  getImageFileSize,
  imageToArrayBuffer,
  makeThumbnail,
} from '../utils'
import ImagePicker from '../main'

import { Backgrounder } from './Backgrounder'

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

class IndexerDB extends Dexie {
  index: Dexie.Table<IndexerNode, string>
  thumbnails: Dexie.Table<Thumbnail, string>

  constructor() {
    super('IndexerDB')
    this.version(1).stores({
      index: 'path',
      thumbnails: 'id',
    })
    this.index = this.table('index')
    this.thumbnails = this.table('thumbnails')
  }
}

export class Indexer {
  private memory: IndexerRoot = {}
  private db: IndexerDB = new IndexerDB()
  private backgrounder: Backgrounder

  constructor(public plugin: ImagePicker) {
    this.backgrounder = new Backgrounder(this.plugin)
    this.getIndex().then((root) => {
      this.log('Loaded index:', root)
    })
    // this.flush()
  }

  flush = async () => {
    this.memory = {}
    await this.db.index.clear()
  }

  resetDB = async () => {
    await this.db.delete()
    this.db = new IndexerDB()
  }

  log = (...args: any[]) => {
    this.plugin.log('Indexer -> ', ...args)
  }

  hasThumbnail = async (node: IndexerNode): Promise<boolean> => {
    return (await this.db.index.get(node.path))?.thumbnail !== undefined
  }

  getThumbnail = async (node: IndexerNode): Promise<Thumbnail> => {
    if (node.extension === 'gif' && this.plugin.settings?.animateGifs) {
      return {
        id: 'gif',
        data: node.uri,
      }
    }

    const cachedThumbnail =
      node.thumbnail &&
      (await this.db.thumbnails.where('id').equals(node.thumbnail).first())

    if (cachedThumbnail) {
      this.log('Using cached thumbnail:', node.name)
      return cachedThumbnail
    }

    this.log('Generating thumbnail:', node.path)

    const id = v4()

    const data = await makeThumbnail(await fetchImageFile(node.uri))
    this.db.thumbnails.put({
      id,
      data,
    })
    this.memory[node.path] = { ...node, thumbnail: id }
    this.log('Generated thumbnail:', id)

    this.backgrounder.enqueue({
      type: 'saveIndex',
      disableDoubleQueue: true,
      action: this.saveIndex,
    })

    return { id, data }
  }

  needsThumbnail = async (node: IndexerNode): Promise<boolean> => {
    const image = await fetchImageFile(node.uri)
    const data = await imageToArrayBuffer(image)
    const size = getImageFileSize(data)

    this.log('Image size:', size)

    return size > 100
  }

  saveIndex = debounce(async () => {
    try {
      const prev = await this.getIndex()
      await this.db.index.bulkPut(Object.values(merge({}, prev, this.memory)))
      this.memory = {}
      this.notifySubscribers()
    } catch (e) {
      console.error('Failed to save index:', e)
    }
  }, 1000)

  setIndex = async (root: IndexerRoot) => {
    const nodes = Object.values(root)
    const acc: IndexerNode[] = []

    for (const node of nodes) {
      // const thumbnail = await this.getThumbnail(node)
      acc.push(node)
    }

    this.memory = merge({}, this.memory, root)
    this.backgrounder.enqueue({
      type: 'saveIndex',
      disableDoubleQueue: true,
      action: this.saveIndex,
    })
  }

  /**
   * Immediately remove an index from the database.
   */
  removeIndex = async (path: string) => {
    this.log('Removing index:', path)
    const node = await this.db.index.get(path)
    delete this.memory[path]
    await this.db.index.delete(path)
    if (node?.thumbnail) {
      await this.db.thumbnails.delete(node.thumbnail)
    }
    this.notifySubscribers()
    this.backgrounder.enqueue({
      type: 'saveIndex',
      disableDoubleQueue: true,
      action: this.saveIndex,
    })
  }

  getIndex = async (): Promise<IndexerRoot> => {
    const indexNodes = await this.db.index.toArray()
    const memoryNodes = Object.values(this.memory)
    let root: IndexerRoot = {}
    const nodes = [...indexNodes, ...memoryNodes]
    for (const node of nodes) {
      root = merge(root, { [node.path]: node })
    }

    return root
  }

  getAbstractIndex = async (): Promise<AbstractIndexerRoot> => {
    const nodes = await this.db.index.toArray()
    const root: AbstractIndexerRoot = {}

    for (const node of nodes) {
      const memoryNode = this.memory[node.path] || {}
      const combined = { ...node, ...memoryNode }
      root[node.path] = {
        ...combined,
        thumbnail: await this.getThumbnail(combined),
      }
    }

    return root
  }

  getAbstractNode = async (node: IndexerNode): Promise<AbstractIndexerNode> => {
    const cachedNode = this.memory[node.path] || {}
    const combined = { ...node, ...cachedNode }

    return {
      ...combined,
      thumbnail: await this.getThumbnail(combined),
    }
  }

  private subscribers: ((index: IndexerRoot) => void)[] = []

  subscribe(callback: (index: IndexerRoot) => void) {
    this.subscribers = [callback]
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback)
    }
  }

  notifySubscribers = (index?: IndexerRoot) => {
    this.log('Notifying subscribers:', this.subscribers.length)
    this.subscribers.forEach(async (callback) =>
      callback(index || (await this.getIndex()))
    )
  }
}
