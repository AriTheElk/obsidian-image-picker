import React from 'react'
import { ItemView, WorkspaceLeaf } from 'obsidian'
import { Root, createRoot } from 'react-dom/client'
import { ImagePickerView as ReactImagePickerView } from './client/ImagePickerView'
import { ImagePickerContext } from './client/ImagePickerContext'
import { ImagePicker } from './ImagePicker'
import { VIEW_TYPE_IMAGE_PICKER } from './constants'

// Image picker view class
export class ImagePickerView extends ItemView {
  root: Root | null = null

  constructor(public plugin: ImagePicker, leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType() {
    return VIEW_TYPE_IMAGE_PICKER
  }

  getDisplayText() {
    return 'Image Picker'
  }

  getIcon(): string {
    return 'image'
  }

  mountReact = async () => {
    this.root = createRoot(this.containerEl.children[1])
    this.root.render(
      <ImagePickerContext.Provider
        value={{
          app: this.app,
          plugin: this.plugin,
          files: Object.values(await this.plugin.indexer.getIndex()),
        }}
      >
        <ReactImagePickerView />
      </ImagePickerContext.Provider>
    )
  }

  unmountReact = () => {
    this.root?.unmount()
    this.containerEl.children[1].empty()
  }

  async onOpen() {
    this.plugin.log('Opening root:', this.plugin.images.length)
    await this.mountReact()

    this.plugin.indexer.subscribe(async (newIndex) => {
      this.plugin.log('Rerendering root:', Object.keys(newIndex).length)
      // this.mountReact()
      this.root?.render(
        <ImagePickerContext.Provider
          value={{
            app: this.app,
            plugin: this.plugin,
            files: Object.values(newIndex),
          }}
        >
          <ReactImagePickerView />
        </ImagePickerContext.Provider>
      )
    })
  }

  async onClose() {
    this.root?.unmount()
  }
}
