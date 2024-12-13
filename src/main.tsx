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
import { ImagePickerView as ReactImagePickerView } from './ImagePickerView'
import { ImagePickerContext } from './ImagePickerContext'
import { debounce, pick } from 'lodash'
import { Indexer } from './Indexer'

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
    console.log('Opening root:', this.plugin.images.length)
    await this.mountReact()

    this.plugin.subscribe(() => {
      console.log('Rerendering root:', this.plugin.images.length)
      this.mountReact()
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

  getAllImageFiles = (folder: TFolder) => {
    console.log('Getting all image files...')
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    const files: TFile[] = []

    const addFiles = (abstractFile: TFile | TFolder) => {
      if (abstractFile instanceof TFile) {
        const ext = abstractFile.extension.toLowerCase()
        if (imageExtensions.includes(ext)) {
          files.push(abstractFile)
          this.indexer.setIndex({
            [abstractFile.path]: {
              ...pick(abstractFile, [
                'basename',
                'extension',
                'stat',
                'path',
                'name',
              ]),
              uri: this.app.vault.getResourcePath(abstractFile),
            },
          })
        }
      } else {
        abstractFile.children.forEach(addFiles)
      }
    }

    addFiles(folder)
    return files
  }

  private subscribers: ((images: TFile[]) => void)[] = []

  subscribe(callback: (images: TFile[]) => void) {
    this.subscribers = [callback]
  }

  notifySubscribers = debounce(() => {
    this.subscribers.forEach((callback) => callback(this.images))
  }, 2000)

  // loadImages = debounce(async () => {
  //   console.log('Loading images...')
  //   const folderPath = this.app.vault.getAbstractFileByPath(
  //     this.settings.imageFolder
  //   )

  //   if (!folderPath || !(folderPath instanceof TFolder)) {
  //     console.warn('Image folder not found: ' + this.settings.imageFolder)
  //     return
  //   }

  //   const files = await this.getAllImageFiles(folderPath)
  //   this.images = files
  //   console.log('Images loaded:', files.length)
  //   this.notifySubscribers()
  // }, 500)

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
        this.notifySubscribers()
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
    console.log('Loading settings...')
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    console.log('Saving settings:', this.settings)
    await this.saveData(this.settings)
  }
}
