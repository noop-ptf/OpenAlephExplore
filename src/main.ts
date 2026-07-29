/* eslint-disable obsidianmd/ui/sentence-case -- This is all valid sentence case */

import { App, Plugin, Notice, MarkdownView, requestUrl } from 'obsidian';
import { DEFAULT_SETTINGS, OpenAlephSettingTab } from './settings';
import {
	OpenAlephEntity,
	OpenAlephPluginSettings,
	OpenAlephApiResponseEntity,
} from './types';
import { ConfirmNoteModal } from './modals';

export default class OpenAlephPlugin extends Plugin {
	settings!: OpenAlephPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new OpenAlephSettingTab(this.app, this));

		this.addRibbonIcon(
			'binoculars',
			'OpenAleph Explore',
			(_evt: MouseEvent) => {
				this.activateView().catch((err) => {
					new Notice(err.message);
				});
			},
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<OpenAlephPluginSettings>,
		);
	}

	async activateView(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (!view) {
			throw new Error('No note is currently open.');
		}

		const noteName = view.file?.basename ?? 'Untitled';
		const content = view.editor.getValue();

		new ConfirmNoteModal(this.app, noteName, content, () => {
			explore(this.settings, this.app, content);
		}).open();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

async function percolate(
	instanceUrl: string,
	apiKey: string | null,
	bodyText: string,
): Promise<any> {
	// TODO pagination
	if (!apiKey || apiKey.trim() === '') {
		throw new Error(`API key for ${instanceUrl} is empty.`);
	}

	const url = new URL('/api/2/beta/percolate?dehydrate=true', instanceUrl);
	let headers: Record<string, string> = {
		'User-Agent': 'alephclient',
		Authorization: apiKey,
		// Pragma: 'no-cache',
	};

	const res = await requestUrl({
		url: url.toString(),
		method: 'POST',
		contentType: 'application/json',
		headers,
		body: JSON.stringify({ text: bodyText }),
		throw: false,
	});

	// TS throws if the body isn't valid JSON
	const body = res.json as unknown;
	return body;
}

async function explore(
	settings: OpenAlephPluginSettings,
	app: App,
	content: string,
) {
	const enabledInstances = settings.instances?.filter(
		(instance) => instance.enabled,
	);

	let entities: OpenAlephEntity[] = [];

	for (let enabledInstance of enabledInstances) {
		const apiKey = app.secretStorage.getSecret(enabledInstance.apiKeyName);
		try {
			const relatedEntities = await percolate(
				enabledInstance.instanceUrl,
				apiKey,
				content,
			);

			if (relatedEntities.status === 'ok') {
				entities.push(
					...relatedEntities.results.map((entity: unknown) => {
						if (typeof entity !== 'object' || entity === null) {
							throw new Error('Malformed entity in response.');
						}
						const e = entity as OpenAlephApiResponseEntity;
						return {
							schema: e.schema,
							dataset: e.dataset,
							caption: e.caption,
							id: e.id,
							instance: enabledInstance.instanceUrl,
							url: e.links.self,
						};
					}),
				);
			}

			// TODO remove
			console.log('OpenAleph says', entities);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
		}
	}
}

/* eslint-enable obsidianmd/ui/sentence-case -- Done with weird sentnces */
