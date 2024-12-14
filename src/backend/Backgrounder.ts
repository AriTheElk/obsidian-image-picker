import ImagePicker from 'src/main'
import { v4 } from 'uuid'

export const TIME_BETWEEN_JOBS = 5000

export interface BackgrounderJob {
  id: string
  type: string
  action: () => void | Promise<void>
  /**
   * Only allow one job of this type to be in the queue at a time
   */
  disableDoubleQueue?: boolean
}

export type BackgrounderQueue = BackgrounderJob[]

export class Backgrounder {
  private queue: BackgrounderQueue = []
  private running = false

  constructor(public plugin: ImagePicker) {}

  log = (...args: any[]) => {
    this.plugin.log('Backgrounder -> ', ...args)
  }

  wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
