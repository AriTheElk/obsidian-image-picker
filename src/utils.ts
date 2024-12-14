import { readAndCompressImage } from 'browser-image-resizer'
import { ROW_HEIGHT } from './client/ImagePickerView'
import { AbstractIndexerNode, IndexerNode } from './backend/Indexer'

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
