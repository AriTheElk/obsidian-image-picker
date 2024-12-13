import { TFile } from 'obsidian'
import ImagePicker from './main'
import { debounce, merge } from 'lodash'
import Dexie from 'dexie'

export interface IndexerRoot {
  [path: string]: IndexerNode
}

export interface IndexerNode
  extends Pick<TFile, 'basename' | 'extension' | 'stat' | 'path' | 'name'> {
  uri: string
}

class IndexerDB extends Dexie {
  index: Dexie.Table<IndexerNode, string>

  constructor() {
    super('IndexerDB')
    this.version(1).stores({
      index: 'path',
    })
    this.index = this.table('index')
  }
}

export class Indexer {
  private memory: IndexerRoot = {}
  private db: IndexerDB

  constructor(public plugin: ImagePicker) {
    this.db = new IndexerDB()

    this.getIndex().then((root) => {
      console.log('Loaded index:', root)
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

  log = (...args: any[]) => {
    console.log('INDEXER:', ...args)
  }

  saveIndex = debounce(async () => {
    try {
      await this.db.index.bulkPut(Object.values(this.memory))
      console.log('Saved index:', Object.keys(this.memory).length)
      this.memory = {}
      this.plugin.notifySubscribers()
    } catch (e) {
      console.error('Failed to save index:', e)
    }
  }, 1000)

  setIndex = async (root: IndexerRoot) => {
    this.memory = merge({}, this.memory, root)
    this.saveIndex()
  }

  /**
   * Immediately remove an index from the database.
   */
  removeIndex = async (path: string) => {
    console.log('Removing index:', path)
    await this.db.index.delete(path)
    this.plugin.notifySubscribers()
  }

  getIndex = async (): Promise<IndexerRoot> => {
    const nodes = await this.db.index.toArray()
    const root: IndexerRoot = {}
    nodes.forEach((node) => {
      root[node.path] = node
    })
    return root
  }
}
