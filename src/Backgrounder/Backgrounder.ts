import { ImagePicker } from '../ImagePicker'

import { BackgrounderLane } from './BackgrounderLane'
import { BackgrounderLaneProps } from './types'

/**
 * General purpose background job runner :)
 *
 * This is used mostly to alleviate the main thread from
 * doing too much work at once. Things like indexing,
 * image processing, or other long-running tasks can be
 * run in the background.
 *
 * It's a FIFO queue, so jobs are run in the order they
 * are enqueued.
 */
export class Backgrounder {
  public lanes: Record<string, BackgrounderLane> = {}

  constructor(public plugin: ImagePicker) {}

  log = (...args: unknown[]) => {
    this.plugin.log('Backgrounder -> ', ...args)
  }

  createLane = (lane: Omit<BackgrounderLaneProps, 'queue'>) => {
    this.lanes[lane.type] = new BackgrounderLane(this.plugin, lane)
  }

  deleteLane = (type: string) => {
    delete this.lanes[type]
  }

  stop = (type: string) => {
    if (this.lanes[type]) {
      this.lanes[type].clear()
      this.log('Stopped lane:', type)
    } else {
      this.log('Lane not found:', type)
    }
  }

  stopAll = () => {
    for (const lane of Object.values(this.lanes)) {
      lane.clear()
    }
    this.log('Stopped all lanes')
  }
}
