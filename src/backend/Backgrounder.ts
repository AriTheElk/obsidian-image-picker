import { v4 } from 'uuid'

import { ImagePicker } from '../ImagePicker'

export interface BackgrounderJob {
  /**
   * Internally used UUID for the job
   */
  id: string
  /**
   * The type of job, in a small string.
   *
   * This is used as a "unique" identifier for the job.
   * If you run it in a lane with `unique: true`, only
   * one job of this type will be in the queue at a time.
   */
  type: string
  /**
   * The action that will be run when the job is executed
   */
  action: () => void | Promise<void>
  /**
   * If true, the job will be run immediately if the lane is free
   */
  eager?: boolean
}

export type BackgrounderQueue = BackgrounderJob[]

export interface BackgrounderLaneProps {
  type: string
  queue: BackgrounderQueue
  /**
   * The time to wait between jobs in milliseconds
   */
  sleep: number
  /**
   * If true, only one job of this type can be in the queue at a time
   */
  unique: boolean
  /**
   * Determines which job to keep when enqueuing a unique job
   *
   * 'first' keeps the existing job and ignores the new one
   * 'last' keeps the new job and removes the existing one
   *
   * @default 'first'
   */
  uniqueKeep: 'first' | 'last'
}

export class BackgrounderLane {
  private plugin: ImagePicker
  public type: string
  public running: boolean = false
  public unique: boolean
  public uniqueIgnore: 'first' | 'last'
  private queue: BackgrounderQueue
  private sleepTime: number = 0

  log = (...args: any[]) => {
    this.plugin.log(`Lane [${this.type}] -> `, ...args)
  }

  constructor(plugin: ImagePicker, lane: Omit<BackgrounderLaneProps, 'queue'>) {
    this.plugin = plugin
    this.type = lane.type
    this.unique = lane.unique
    this.uniqueIgnore = lane.uniqueKeep
    this.sleepTime = lane.sleep
    this.queue = []
  }

  /**
   * Sleeps between jobs
   *
   * @returns A promise that resolves after the time has passed
   */
  private sleep = () =>
    new Promise((resolve) => setTimeout(resolve, this.sleepTime))

  /**
   * Enqueues a job to be run in the background
   *
   * @param job The job to enqueue
   */
  enqueue = async (job: Omit<BackgrounderJob, 'id'>) => {
    const id = v4()
    if (this.unique) {
      if (
        this.uniqueIgnore === 'first' &&
        this.queue.some((j) => j.type === job.type)
      ) {
        this.log('Unique job already in queue, ignoring:', job.type)
        return
      }
      if (
        this.uniqueIgnore === 'last' &&
        this.queue.some((j) => j.type === job.type)
      ) {
        this.log('Unique job already in queue, removing existing:', job.type)
        this.queue = this.queue.filter((j) => j.type !== job.type)
      }
    }

    this.queue.push({
      ...job,
      id,
    })
    this.log('Enqueued:', job.type)

    this.run(job.eager && this.queue.length === 1)
  }

  /**
   * Runs the next job in the queue and immediately
   * starts the next one.
   */
  run = async (immediate: boolean = false) => {
    if (this.running || this.queue.length === 0) return
    this.running = true

    if (!immediate) {
      this.log('Waiting to run:', this.queue[0].type)
      await this.sleep()
    } else {
      this.log('Running immediately:', this.queue[0].type)
    }

    // Verify that the queue hasn't been cleared while sleeping
    if (!this.running) return

    const job = this.queue.shift()
    this.log('Running:', job?.type)
    if (job) {
      await job.action()
    }

    this.log('Finished:', job?.type)
    this.running = false

    // Subsequent jobs should *never* run immediately
    this.run()
  }

  /**
   * Clears the queue
   */
  clear = () => {
    this.queue = []
    this.running = false
    this.log('Cleared queue')
  }
}

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

  log = (...args: any[]) => {
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
