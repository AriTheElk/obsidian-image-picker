import Dexie from 'dexie'

import { IndexerNode, Thumbnail } from './types'

export class IndexerDB extends Dexie {
  index: Dexie.Table<IndexerNode, string>
  thumbnails: Dexie.Table<Thumbnail, string>

  constructor() {
    super('ImagePicker')
    this.version(1).stores({
      index: 'path',
      thumbnails: 'id',
    })
    this.index = this.table('index')
    this.thumbnails = this.table('thumbnails')
  }
}
