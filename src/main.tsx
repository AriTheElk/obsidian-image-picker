import {
  App,
  ItemView,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from 'obsidian'
import { Root, createRoot } from 'react-dom/client'
import { ImagePickerView as ReactImagePickerView } from './client/ImagePickerView'
import { ImagePickerContext } from './client/ImagePickerContext'
import { pick } from 'lodash'
import { Indexer } from './backend/Indexer'

const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

// Settings tab to configure the image folder
class ImagePickerSettingTab extends PluginSettingTab {
  plugin: ImagePicker

  constructor(app: App, plugin: ImagePicker) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Image Folder')
      .setDesc(
        'Image picker will look for images in this folder and its subfolders'
      )
      .addText((text) =>
        text
          .setPlaceholder('Image Folder')
          .setValue(this.plugin.settings.imageFolder)
          .onChange(async (value) => {
            this.plugin.settings.imageFolder = value || ''
            await this.plugin.saveSettings()
          })
      )
  }
}

export const VIEW_TYPE_IMAGE_PICKER = 'image-picker-view'

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

interface ImagePickerSettings {
  imageFolder: string
}

const DEFAULT_SETTINGS: ImagePickerSettings = {
  imageFolder: '',
}

// Main plugin class
export default class ImagePicker extends Plugin {
  settings: ImagePickerSettings
  images: TFile[] = []
  indexer: Indexer = new Indexer(this)

  log = (...args: any[]) => {
    return
    console.log('ImagePicker -> ', ...args)
  }

  async onload() {
    await this.loadSettings()

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new ImagePickerSettingTab(this.app, this))

    this.addRibbonIcon('image', 'Open Image Picker', async () => {
      this.activateView()
    })

    this.registerView(
      VIEW_TYPE_IMAGE_PICKER,
      (leaf) => new ImagePickerView(this, leaf)
    )

    this.app.vault.on('create', this.onFileChange)
    this.app.vault.on('modify', this.onFileChange)
    this.app.vault.on('delete', this.onFileChange)
  }

  onunload() {
    this.app.vault.off('create', this.onFileChange)
    this.app.vault.off('modify', this.onFileChange)
    this.app.vault.off('delete', this.onFileChange)
  }

  onFileChange = async (file: TFile) => {
    if (!this.settings.imageFolder) return
    if (file instanceof TFile) {
      if (
        file.path.startsWith(this.settings.imageFolder) &&
        VALID_IMAGE_EXTENSIONS.includes(file.extension)
      ) {
        this.indexer.setIndex({
          [file.path]: {
            ...pick(file, ['basename', 'extension', 'stat', 'path', 'name']),
            uri: this.app.vault.getResourcePath(file),
          },
        })
        this.indexer.notifySubscribers()
      }
    }
  }

  async activateView() {
    const { workspace } = this.app

    let leaf: WorkspaceLeaf | null = null
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_IMAGE_PICKER)

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0]
    } else {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      leaf = workspace.getRightLeaf(false)
      await leaf?.setViewState({ type: VIEW_TYPE_IMAGE_PICKER, active: true })
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    if (leaf) {
      workspace.revealLeaf(leaf)
    }
  }

  async loadSettings() {
    this.log('Loading settings...')
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    this.log('Saving settings:', this.settings)
    await this.saveData(this.settings)
  }
}
