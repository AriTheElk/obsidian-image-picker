import { debounce, merge } from 'lodash'
import { v4 } from 'uuid'

import {
  fetchImageFile,
  getImageFileSize,
  imageToArrayBuffer,
  makeThumbnail,
} from '../utils'
import { ImagePicker } from '../ImagePicker'

import {
  IndexerNode,
  Thumbnail,
  IndexerRoot,
  AbstractIndexerRoot,
  AbstractIndexerNode,
} from './types'
import { IndexerDB } from './IndexerDB'

export class Indexer {
  private memory: IndexerRoot = {}
  private db: IndexerDB = new IndexerDB()

  constructor(public plugin: ImagePicker) {
    this.getIndex().then((root) => {
      this.log('Loaded index:', root)
    })
    // this.flush()

    this.plugin.backgrounder.createLane({
      type: 'saveIndex',
      sleep: 2000,
      unique: true,
      uniqueKeep: 'first',
    })
  }

  flush = async () => {
    this.memory = {}
    await this.db.index.clear()
  }

  resetDB = async () => {
    await this.db.delete()
    this.db = new IndexerDB()
  }

  log = (...args: unknown[]) => {
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

    this.plugin.backgrounder.lanes.saveIndex.enqueue({
      type: 'saveLatestIndex',
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
      const index = await this.getIndex()
      this.memory = {}
      await this.db.index.bulkPut(Object.values(index))
      this.notifySubscribers()
    } catch (e) {
      console.error('Failed to save index:', e)
    }
  }, 1000)

  setIndex = async (root: IndexerRoot) => {
    const nodes = Object.values(root)
    const acc: IndexerNode[] = []

    for (const node of nodes) {
      acc.push(node)
    }

    this.memory = merge({}, this.memory, root)
    this.plugin.backgrounder.lanes.saveIndex.enqueue({
      type: 'saveLatestIndex',
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
    this.plugin.backgrounder.lanes.saveIndex.enqueue({
      type: 'saveLatestIndex',
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

  notifySubscribers = debounce((index?: IndexerRoot) => {
    this.log('Notifying subscribers:', this.subscribers.length)
    this.subscribers.forEach(async (callback) =>
      callback(index || (await this.getIndex()))
    )
  }, 250)
}
