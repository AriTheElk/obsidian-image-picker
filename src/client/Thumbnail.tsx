import React, { FC, useCallback, useEffect, useRef, useState } from 'react'

import { AbstractIndexerNode, IndexerNode } from '../backend/Indexer'

import { usePlugin } from './ImagePickerContext'

interface ThumbnailProps {
  /**
   * The node to render the thumbnail for.
   */
  node: IndexerNode
  /**
   * Callback to for when the thumbnail mounts.
   * @returns {void}
   */
  onEnqueue: () => void
  /**
   * Callback to for when the thumbnail should be dequeued.
   */
  dequeueImage: () => void
  /**
   * Whether or not the thumbnail should load.
   */
  shouldLoad?: boolean

  /**
   * Callback to for when the thumbnail loads.
   *
   * @param {AbstractIndexerNode} file - The file that was loaded.
   * @returns {void}
   */
  onLoad?: (file: AbstractIndexerNode) => void
}

export const Thumbnail: FC<ThumbnailProps> = ({
  node,
  onEnqueue,
  dequeueImage,
  shouldLoad = false,
  onLoad,
}) => {
  const [abstract, setAbstract] = useState<AbstractIndexerNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const plugin = usePlugin()

  const hasEnqueued = useRef(false)

  useEffect(() => {
    if (!hasEnqueued.current) {
      onEnqueue()
      hasEnqueued.current = true
    }
  }, [onEnqueue])

  const loadImage = useCallback(
    async (node: IndexerNode) => {
      try {
        if (isLoading) return
        const file = await plugin.indexer.getAbstractNode(node)
        const img = new Image()
        img.src = file.thumbnail.data

        const handleLoad = () => {
          img.removeEventListener('load', handleLoad)
          setIsLoading(false)
          onLoad?.(file)
          dequeueImage()
          setAbstract(file)
        }

        img.addEventListener('load', handleLoad)
      } catch (error) {
        dequeueImage()
        setIsLoading(false)
        console.error('Failed to load image:', error)
      }
    },
    [dequeueImage, isLoading, onLoad, plugin.indexer]
  )

  useEffect(() => {
    if (shouldLoad && !isLoading && !abstract) {
      setIsLoading(true)
      loadImage(node)
    }
  }, [abstract, isLoading, loadImage, node, shouldLoad])

  return abstract ? (
    <img
      src={abstract.thumbnail.data}
      alt={node.name}
      style={{ width: '100%', height: '100%' }}
      loading="lazy"
    />
  ) : (
    <div className="image-placeholder">⏳</div>
  )
}
