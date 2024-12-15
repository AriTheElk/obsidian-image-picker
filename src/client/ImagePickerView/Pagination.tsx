import React, { FC } from 'react'

interface PaginationProps {
  total: number
  current: number
  onNext: () => void
  onPrev: () => void
}

export const Pagination: FC<PaginationProps> = ({
  total,
  current,
  onNext,
  onPrev,
}) => {
  return (
    <div className="image-picker-pagination">
      <button onClick={onPrev} disabled={current === 1}>
        Previous
      </button>
      <span>
        Page {current} of {total || 1}
      </span>
      <button onClick={onNext} disabled={current === total}>
        Next
      </button>
    </div>
  )
}
