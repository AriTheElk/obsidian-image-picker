import React, { FC } from 'react'
import { MAX_THUMBNAIL_ZOOM, MIN_THUMBNAIL_ZOOM } from 'src/constants'

interface PaginationProps {
  total: number
  current: number
  zoom: number
  onNext: () => void
  onPrev: () => void
  onZoom: (zoom: number) => void
}

export const Pagination: FC<PaginationProps> = ({
  total,
  current,
  onNext,
  onPrev,
  zoom,
  onZoom,
}) => {
  return (
    <div className="image-picker-footer">
      <button onClick={onPrev} disabled={current === 1}>
        Previous
      </button>
      <input
        type="range"
        min={MIN_THUMBNAIL_ZOOM}
        max={MAX_THUMBNAIL_ZOOM}
        step={0.025}
        value={zoom}
        onChange={(e) => onZoom(parseFloat(e.target.value))}
      />
      <button onClick={onNext} disabled={current === total}>
        Next
      </button>
    </div>
  )
}
