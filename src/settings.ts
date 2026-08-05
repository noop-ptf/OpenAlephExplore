/* eslint-disable obsidianmd/ui/sentence-case -- This is all valid sentence case */

import {
	App,
	Notice,
	PluginSettingTab,
	SecretComponent,
	Setting,
	requestUrl,
} from 'obsidian';
import {
	OpenAlephInstanceSettings,
	OpenAlephPluginSettings,
} from './types';
import OpenAlephPlugin from './main';

export const DEFAULT_INSTANCE: Omit<OpenAlephInstanceSettings, 'id'> = {
	apiKeyName: '',
	name: 'OpenAleph instance',
	instanceUrl: 'https://search.openaleph.org',
	enabled: true,
	connectionValid: false,
};

export const DEFAULT_SETTINGS: OpenAlephPluginSettings = {
	importFolder: 'followthemarkdown',
	instances: [],
};

// TODO: Migrate to https://docs.obsidian.md/plugins/guides/migrate-declarative-settings at some point.
//
// eslint-disable-next-line obsidianmd/settings-tab/prefer-setting-definitions -- We don't want to migrate now.
export class OpenAlephSettingTab extends PluginSettingTab {
	plugin: OpenAlephPlugin;

	constructor(app: App, plugin: OpenAlephPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('Configure instances.').setHeading();

		new Setting(containerEl)
			.setName('FollowTheMoney entity folder')
			.setDesc(
				'Importing a FollowTheMoney entity from an OpenAleph instance will save it here, as a Markdown note.',
			)
			.addText((text) =>
				text
					.setPlaceholder('followthemarkdown')
					.setValue(this.plugin.settings.importFolder)
					.onChange(async (value) => {
						this.plugin.settings.importFolder =
							value || 'followthemarkdown';
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl('p', {
			text: 'Add the domain URL and API key for OpenAleph instances, in order to allow Obsidian to search scross them simultaneously.',
		});

		this.plugin.settings.instances.forEach((instance, index) => {
			this.renderInstance(containerEl, instance, index);
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('Add instance')
				.setCta()
				.onClick(async () => {
					const instance: OpenAlephInstanceSettings = {
						...DEFAULT_INSTANCE,
						id: crypto.randomUUID(),
					};
					this.plugin.settings.instances.push(instance);
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}

	private renderInstance(
		containerEl: HTMLElement,
		instance: OpenAlephInstanceSettings,
		index: number,
	): void {
		const box = containerEl.createDiv({ cls: 'openaleph-source-box' });

		new Setting(box)
			.setName(instance.name || `Instance ${index + 1}`)
			.setHeading()
			.addToggle((toggle) =>
				toggle.setValue(instance.enabled).onChange(async (value) => {
					instance.enabled = value;
					await this.plugin.saveSettings();
				}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon('trash')
					.setTooltip('Remove instance')
					.onClick(async () => {
						this.plugin.settings.instances.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}),
			)
			.addExtraButton((btn) => {
				const setIdleIcon = () => {
					btn.setIcon(
						instance.connectionValid ? 'badge-check' : 'plug-zap',
					);
					btn.extraSettingsEl.classList.toggle(
						'openaleph-instance-connection-valid',
						instance.connectionValid,
					);
					btn.extraSettingsEl.classList.toggle(
						'openaleph-instance-connection-invalid',
						!instance.connectionValid,
					);
				};

				setIdleIcon();
				btn.setTooltip('Test the connection');

				btn.onClick(async () => {
					btn.setDisabled(true);
					btn.extraSettingsEl.classList.remove(
						'openaleph-instance-connection-valid',
					);
					btn.extraSettingsEl.classList.remove(
						'openaleph-instance-connection-invalid',
					);
					btn.setIcon('loader-2');
					btn.extraSettingsEl.addClass('openaleph-spin');

					try {
						const apiKey = this.app.secretStorage.getSecret(
							instance.apiKeyName,
						);
						instance.connectionValid = await canConnect(
							instance.instanceUrl,
							apiKey,
						);
						await this.plugin.saveSettings();
						new Notice(
							instance.connectionValid
								? 'Connection successful'
								: 'Could not connect to instance. Check the URL and the API key.',
						);
					} finally {
						btn.extraSettingsEl.classList.remove('openaleph-spin');
						btn.setDisabled(false);
						setIdleIcon();
					}
				});

				return btn;
			});

		new Setting(box).setName('Name').addText((text) =>
			text.setValue(instance.name).onChange(async (value) => {
				instance.name = value;
				await this.plugin.saveSettings();
			}),
		);

		new Setting(box).setName('Instance domain').addText((text) =>
			text
				.setPlaceholder('https://search.openaleph.org')
				.setValue(instance.instanceUrl)
				.onChange(async (value) => {
					instance.instanceUrl = value;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(box).setName('API key').addComponent((el) =>
			new SecretComponent(this.app, el)
				.setValue(instance.apiKeyName)
				.onChange(async (value) => {
					instance.apiKeyName = value;
					await this.plugin.saveSettings();
				}),
		);
	}
}

async function canConnect(instanceUrl: string, apiKey: string | null) {
	const url = new URL('/api/2/status', instanceUrl);
	let headers: Record<string, string> = {
		'User-Agent': 'alephclient',
		Pragma: 'no-cache',
	};
	if (apiKey !== null) {
		headers['Authorization'] = apiKey;
	}
	const request = {
		url: url.toString(),
		headers,
	};
	try {
		const res = await requestUrl(request);
		// throws if the body isn't valid JSON
		const body = res.json as unknown;
		// 0, false or "" are valid JSON
		return body !== undefined && body !== null;
	} catch {
		return false;
	}
}

/* eslint-enable obsidianmd/ui/sentence-case -- Done with weird sentnces */
