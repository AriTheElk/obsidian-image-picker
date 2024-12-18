import { App, Plugin, PluginManifest, TFile, WorkspaceLeaf } from 'obsidian'
import { pick } from 'lodash'

import { Indexer } from './Indexer'
import {
  ImagePickerSettings,
  ImagePickerSettingTab,
} from './ImagePickerSettings'
import { ImagePickerView } from './ImagePickerView'
import {
  DEFAULT_SETTINGS,
  VALID_IMAGE_EXTENSIONS,
  VIEW_TYPE_IMAGE_PICKER,
} from './constants'
import { Backgrounder } from './Backgrounder'

export class ImagePicker extends Plugin {
  settings: ImagePickerSettings
  images: TFile[] = []
  indexer: Indexer = new Indexer(this)
  _backgrounder: Backgrounder
  get backgrounder() {
    return this._backgrounder || (this._backgrounder = new Backgrounder(this))
  }

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
  }

  log = (...args: unknown[]) => {
    if (this.settings?.debugMode) {
      console.log('ImagePicker -> ', ...args)
    }
  }

  async onload() {
    await this.loadSettings()

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

    this.backgrounder.createLane({
      type: 'saveSettings',
      sleep: 2000,
      unique: true,
      uniqueKeep: 'last',
    })
  }

  onunload() {
    this.app.vault.off('create', this.onFileCreate)
    this.app.vault.off('modify', this.onFileChange)
    this.app.vault.off('delete', this.onFileDelete)
    this.backgrounder.stopAll()
  }
  /**
   * When a file is created, add it to the index and
   * immediately notify subscribers.
   *
   * @param file the new file
   */
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

  /**
   * When a file is deleted, remove it from the index and
   * immediately notify subscribers.
   * @param file the deleted file
   */
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

  /**
   * When a file is modified, update the index and
   * immediately notify subscribers.
   * @param file the modified file
   */
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
      leaf = leaves[0]
    } else {
      leaf = workspace.getRightLeaf(false)
      await leaf?.setViewState({ type: VIEW_TYPE_IMAGE_PICKER, active: true })
    }
    if (leaf) {
      workspace.revealLeaf(leaf)
    }
  }

  loadSettings = async () => {
    this.log('Loading settings...')
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  saveSettings = async () => {
    this.log('Saving settings:', this.settings)
    await this.saveData(this.settings)
  }

  sleepySaveSettings = async () => {
    await this.backgrounder.lanes.saveSettings.enqueue({
      type: 'sleepySaveSettings',
      action: this.saveSettings,
    })
  }
}
