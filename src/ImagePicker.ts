import { Plugin, TFile, WorkspaceLeaf } from 'obsidian'
import { pick } from 'lodash'
import { Indexer } from './backend/Indexer'
import {
  DEFAULT_SETTINGS,
  ImagePickerSettings,
  ImagePickerSettingTab,
} from './ImagePickerSettings'
import { ImagePickerView } from './ImagePickerView'
import { VALID_IMAGE_EXTENSIONS, VIEW_TYPE_IMAGE_PICKER } from './constants'

export class ImagePicker extends Plugin {
  settings: ImagePickerSettings
  images: TFile[] = []
  indexer: Indexer = new Indexer(this)

  log = (...args: any[]) => {
    if (this.settings?.debugMode) {
      console.log('ImagePicker -> ', ...args)
    }
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

    this.app.vault.on('create', this.onFileCreate)
    this.app.vault.on('modify', this.onFileChange)
    this.app.vault.on('delete', this.onFileDelete)
  }

  onunload() {
    this.app.vault.off('create', this.onFileCreate)
    this.app.vault.off('modify', this.onFileChange)
    this.app.vault.off('delete', this.onFileDelete)
  }

  onFileCreate = async (file: TFile) => {
    if (file instanceof TFile) {
      if (
        file.path.startsWith(this.settings.imageFolder) &&
        VALID_IMAGE_EXTENSIONS.includes(file.extension)
      ) {
        this.log('onFileCreate:', file.path)
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

  onFileDelete = async (file: TFile) => {
    if (file instanceof TFile) {
      if (
        file.path.startsWith(this.settings.imageFolder) &&
        VALID_IMAGE_EXTENSIONS.includes(file.extension)
      ) {
        this.log('onFileDelete:', file.path)
        this.indexer.removeIndex(file.path)
        this.indexer.notifySubscribers()
      }
    }
  }

  onFileChange = async (file: TFile) => {
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
