import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, OpenAlephSettingTab } from './settings';
import type { OpenAlephPluginSettings } from './openaleph';

export default class OpenAlephPlugin extends Plugin {
	// openAlephClient!: OpenAlephClient;
	settings!: OpenAlephPluginSettings;

	async onload() {
		await this.loadSettings();
		// await this.initOpenAleph();

		this.addSettingTab(new OpenAlephSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<OpenAlephPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
