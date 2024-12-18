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
