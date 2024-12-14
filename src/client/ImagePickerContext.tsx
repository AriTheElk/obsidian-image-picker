import { createContext, useContext } from 'react'
import { App } from 'obsidian'
import ImagePicker from '../main'
import { IndexerNode } from '../backend/Indexer'

interface ImagePickerContextType {
  app: App
  plugin: ImagePicker
  files: IndexerNode[]
}

export const ImagePickerContext = createContext<ImagePickerContextType | null>(
  {} as ImagePickerContextType
)

export const usePlugin = () => {
  const context = useContext(ImagePickerContext)
  if (!context) {
    throw new Error(
      'usePlugin must be used within an ImagePickerContext.Provider'
    )
  }
  return context.plugin
}

export const useApp = () => {
  const context = useContext(ImagePickerContext)
  if (!context) {
    throw new Error('useApp must be used within an ImagePickerContext.Provider')
  }
  return context.app
}

export const useFiles = () => {
  const context = useContext(ImagePickerContext)
  if (!context) {
    throw new Error(
      'useFiles must be used within an ImagePickerContext.Provider'
    )
  }
  return context.files
}
