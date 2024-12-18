import ImagePicker from 'src/main'
import { v4 } from 'uuid'

import {
  BackgrounderQueue,
  BackgrounderLaneProps,
  BackgrounderJob,
} from './types'

export class BackgrounderLane {
  private plugin: ImagePicker
  public type: string
  public running: boolean = false
  public unique: boolean
  public uniqueIgnore: 'first' | 'last'
  private queue: BackgrounderQueue
  private sleepTime: number = 0

  log = (...args: unknown[]) => {
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
