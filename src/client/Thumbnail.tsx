import React, { FC, useCallback, useEffect, useRef, useState } from 'react'

import { AbstractIndexerNode, IndexerNode } from '../Indexer'

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
  enqueueImage: (node: IndexerNode) => void
  /**
   * Callback to for when the thumbnail should be dequeued.
   */
  dequeueImage: (node: IndexerNode) => void
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
  onLoad?: (node: AbstractIndexerNode) => void
}

export const Thumbnail: FC<ThumbnailProps> = ({
  node,
  enqueueImage,
  dequeueImage,
  shouldLoad = false,
  onLoad,
}) => {
  const [abstract, setAbstract] = useState<AbstractIndexerNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const plugin = usePlugin()

  const hasEnqueued = useRef(false)

  useEffect(() => {
    if (!hasEnqueued.current && node) {
      enqueueImage(node)
      hasEnqueued.current = true
    }
  }, [dequeueImage, enqueueImage, node])

  useEffect(() => {
    return () => {
      dequeueImage(node)
    }
  }, [dequeueImage, node])

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
          dequeueImage(node)
          setAbstract(file)
        }

        img.addEventListener('load', handleLoad)
      } catch (error) {
        dequeueImage(node)
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
