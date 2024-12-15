import { App, PluginSettingTab, Setting } from 'obsidian'

import { ImagePicker } from './ImagePicker'

export interface ImagePickerSettings {
  imageFolder: string
  animateGifs: boolean
  debugMode: boolean
}

export class ImagePickerSettingTab extends PluginSettingTab {
  plugin: ImagePicker

  constructor(app: App, plugin: ImagePicker) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    // Input for selecting the image folder
    new Setting(containerEl)
      .setName('Image Folder')
      .setDesc(
        'Image picker will look for images in this folder and its subfolders, by default it will look in the root of the vault'
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

    // Button for resetting the image index
    new Setting(containerEl)
      .setName('Reset Image Index')
      .setDesc(
        'Clears the image index and rebuilds it from the image folder. Obsidian will reload immediately after. Please run this after changing the image folder.'
      )
      .addButton((button) =>
        button.setButtonText('Reset Index').onClick(async () => {
          this.plugin.images = []
          // delete the database and rebuild it
          await this.plugin.indexer.resetDB()
          // reload obsidian
          // @ts-ignore
          this.app.commands.executeCommandById('app:reload')
        })
      )

    // Toggle whether gifs are animated
    new Setting(containerEl)
      .setName('Animate GIFs')
      .setDesc('Warning: large gifs can slow down or crash Obsidian')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.animateGifs)
          .onChange(async (value) => {
            this.plugin.settings.animateGifs = value
            await this.plugin.saveSettings()
          })
      )

    // Toggle whether to log debug messages
    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Log debug messages to the console')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.debugMode)
          .onChange(async (value) => {
            this.plugin.settings.debugMode = value
            await this.plugin.saveSettings()
          })
      )

    containerEl.createEl('hr')

    const credits = containerEl.createEl('div')

    credits
      .createEl('span', {
        text: 'Built with 💚 by ',
      })
      .createEl('a', {
        text: 'ari.the.elk',
        href: 'https://ari.the.elk.wtf',
      })

    credits.createEl('br')

    credits.createEl('a', {
      text: '📖 documentation',
      href: 'https://ari.the.elk.wtf/obsidian/plugins/image-picker',
    })

    credits.createEl('br')

    credits.createEl('a', {
      text: '💝 donate',
      href: 'https://ari.the.elk.wtf/donate',
    })
  }
}
