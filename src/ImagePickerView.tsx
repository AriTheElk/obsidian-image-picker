import { ItemView, WorkspaceLeaf } from 'obsidian'
import { Root, createRoot } from 'react-dom/client'

import { ImagePickerView as ReactImagePickerView } from './client/ImagePickerView'
import {
  ImagePickerContext,
  ImagePickerContextType,
} from './client/ImagePickerContext'
import { ImagePicker } from './ImagePicker'
import { VIEW_TYPE_IMAGE_PICKER } from './constants'

/**
 * The main view for the image picker.
 */
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

  createRoot = () => {
    this.root = createRoot(this.containerEl.children[1])
  }

  destroyRoot = () => {
    this.root = null
    this.containerEl.children[1].empty()
  }

  mountReact = (context: ImagePickerContextType) => {
    this.root?.render(
      <ImagePickerContext.Provider value={context}>
        <ReactImagePickerView />
      </ImagePickerContext.Provider>
    )
  }

  unmountReact = () => {
    this.root?.unmount()
  }

  async onOpen() {
    this.plugin.log('Opening root:', this.plugin.images.length)
    this.createRoot()
    this.mountReact({
      app: this.app,
      plugin: this.plugin,
      files: Object.values(await this.plugin.indexer.getIndex()),
    })

    this.plugin.indexer.subscribe(async (newIndex) => {
      this.plugin.log('Rerendering root:', Object.keys(newIndex).length)
      this.mountReact({
        app: this.app,
        plugin: this.plugin,
        files: Object.values(newIndex),
      })
    })
  }

  async onClose() {
    this.plugin.log('Closing root')
    this.unmountReact()
    this.destroyRoot()
  }
}
