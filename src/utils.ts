import { readAndCompressImage } from 'browser-image-resizer'

import { AbstractIndexerNode, IndexerNode } from './backend/Indexer'
import { ROW_HEIGHT } from './constants'

export const getSizeInKb = (size: number): number => {
  return Math.round(size / 1024)
}

export const fetchImageFile = async (url: string): Promise<File> => {
  const res = await fetch(url)
  const blob = await res.blob()
  return new File([blob], 'image.jpg')
}

/**
 * Saves an image to Base64 format
 */
export const imageToHash = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Converts a Base64 image to an HTMLImageElement
 */
export const hashToImage = (hash: string): HTMLImageElement => {
  const img = new Image()
  img.src = hash
  return img
}

export const imageToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export const getImageFileSize = (data: ArrayBuffer): number => {
  return getSizeInKb(data.byteLength)
}

export const resizeImage = async (
  file: File,
  maxHeight: number
): Promise<File> => {
  const resized = await readAndCompressImage(file, { maxHeight, quality: 0.7 })
  return new File([resized], file.name)
}

export const makeThumbnail = async (file: File): Promise<string> => {
  const resized = await resizeImage(file, ROW_HEIGHT * 2)
  const hash = await imageToHash(resized)
  return hash
}

export const copyToClipboard = (text: string): void => {
  navigator.clipboard.writeText(text)
}

export const nodeToEmbed = (
  node: IndexerNode | AbstractIndexerNode
): string => {
  return `![[${node.path}]]`
}

export const truncate = (text: string, length: number): string => {
  return text.length > length ? `${text.substring(0, length)}...` : text
}

export const setGridHeight = (zoom: number): void => {
  document.documentElement.style.setProperty(
    '--image-picker-grid-height',
    ROW_HEIGHT * zoom + 'px'
  )
}

/**
 * Returns the number of columns and rows that can fit in the container
 *
 * The height is always fixed, so we first calculate the rnumber of
 * columns that can fit in the container, then calculate the number of
 * rows based on the container size and the asset height.
 */
export const calculateGrid = (
  gridRef: React.RefObject<HTMLDivElement | null>,
  containerSize: [number, number],
  assetHeight: number
): [number, number] => {
  if (gridRef.current) {
    const [containerWidth, containerHeight] = containerSize
    const computedStyle = window.getComputedStyle(gridRef.current)
    const gap = parseInt(computedStyle.getPropertyValue('gap'), 10) || 0
    const totalGapsWidth =
      containerWidth < assetHeight * 2 + gap
        ? 0
        : gap * (Math.floor(containerWidth / assetHeight) - 1)
    const columns = Math.floor((containerWidth - totalGapsWidth) / assetHeight)
    const rows = Math.floor(containerHeight / (assetHeight + gap))
    return [columns, rows]
  }
  return [0, 0]
}
