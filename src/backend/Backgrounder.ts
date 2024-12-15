import { v4 } from 'uuid'

import { ImagePicker } from '../ImagePicker'
import { TIME_BETWEEN_JOBS } from '../constants'

export interface BackgrounderJob {
  /**
   * Internally used UUID for the job
   */
  id: string
  /**
   * The type of job, in a small string.
   *
   * This is used as a "unique" identifier for the job.
   * If you run with disableDoubleQueue, it will remove
   * all jobs with the same type before enqueuing.
   */
  type: string
  /**
   * The action that will be run when the job is executed
   */
  action: () => void | Promise<void>
  /**
   * Only allow one job of this type to be in the queue at a time
   */
  disableDoubleQueue?: boolean
}

export type BackgrounderQueue = BackgrounderJob[]

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
  private queue: BackgrounderQueue = []
  private running = false

  constructor(public plugin: ImagePicker) {}

  log = (...args: any[]) => {
    this.plugin.log('Backgrounder -> ', ...args)
  }

  /**
   * Waits for a certain amount of time
   *
   * @param ms The number of milliseconds to wait
   * @returns A promise that resolves after the time has passed
   */
  wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  /**
   * Enqueues a job to be run in the background
   *
   * @param job The job to enqueue
   */
  enqueue = async (job: Omit<BackgrounderJob, 'id'>) => {
    if (job.disableDoubleQueue) {
      this.log('Disabling double queue:', job.type)
      this.queue = this.queue.filter((j) => j.type !== job.type)
    }
    this.queue.push({
      ...job,
      id: v4(),
    })
    this.log('Enqueued:', job.type)
    this.run()
  }

  /**
   * Runs the next job in the queue and immediately
   * starts the next one.
   */
  run = async () => {
    if (this.running || this.queue.length === 0) return
    this.running = true
    this.log('Waiting to run:', this.queue[0].type)
    await this.wait(TIME_BETWEEN_JOBS)

    const job = this.queue.shift()
    this.log('Running:', job?.type)
    if (job) {
      await job.action()
    }

    this.log('Finished:', job?.type)
    this.running = false
    this.run()
  }
}
