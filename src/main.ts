/* eslint-disable obsidianmd/ui/sentence-case -- This is all valid sentence case */

import { App, Plugin, Notice, MarkdownView, requestUrl } from 'obsidian';
import { DEFAULT_SETTINGS, OpenAlephSettingTab } from './settings';
import {
	OpenAlephPluginSettings,
	OpenAlephPercolationApiResult,
	OpenAlephPercolationApiEntity,
	OpenAlephGraph,
	OpenAlephCloselyCorrelatedApiResult,
	OpenAlephCloselyCorrelatedApiTerm,
} from './types';
import { ConfirmNoteModal } from './modals';
import { EntityGraphView, VIEW_TYPE_ENTITY_GRAPH } from './graphView';
import { buildMarkdownTable } from './tableBuilder';

export default class OpenAlephPlugin extends Plugin {
	settings!: OpenAlephPluginSettings;

	async onload(): Promise<void> {
		this.registerView(
			VIEW_TYPE_ENTITY_GRAPH,
			(leaf) => new EntityGraphView(leaf),
		);

		// this.addCommand({
		// 	id: 'open-aleph-explore',
		// 	name: 'OpenAleph Explore',
		// 	callback: () => {
		// 		// store entities for a note on disk?
		// 		// figure out where to get them before using this
		// 		void this.activateView(entities);
		// 	},
		// });

		await this.loadSettings();

		this.addSettingTab(new OpenAlephSettingTab(this.app, this));

		this.addRibbonIcon(
			'binoculars',
			'OpenAleph Explore',
			(_evt: MouseEvent) => {
				this.activateView().catch((err: unknown) => {
					const message =
						err instanceof Error ? err.message : String(err);
					new Notice(message);
				});
			},
		);
	}

	async loadSettings(): Promise<void> {
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
			// TODO loading animation in the modal until the results come in
			void this.handleExplore(content, noteName);
		}).open();
	}

	private async handleExplore(
		content: string,
		noteName: string,
	): Promise<void> {
		try {
			await explore(this.settings, this.app, content, noteName);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// OpenAleph

async function percolate(
	instanceUrl: string,
	apiKey: string | null,
	bodyText: string,
): Promise<OpenAlephPercolationApiResult> {
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
	});

	// TS throws if the body isn't valid JSON
	const body = res.json as unknown;
	return body as OpenAlephPercolationApiResult;
}

async function getCloselyCorrelated(
	instanceUrl: string,
	apiKey: string | null,
	caption: string,
	maxResults: number | null,
): Promise<OpenAlephCloselyCorrelatedApiResult> {
	if (!apiKey || apiKey.trim() === '') {
		throw new Error(`API key for ${instanceUrl} is empty.`);
	}
	if (!maxResults) {
		maxResults = 5;
	}
	const url = new URL(
		`/api/2/entities?facet_significant=names&limit=${maxResults}&q=${caption}`,
		instanceUrl,
	);
	let headers: Record<string, string> = {
		'User-Agent': 'alephclient',
		Authorization: apiKey,
		// Pragma: 'no-cache',
	};

	const res = await requestUrl({
		url: url.toString(),
		method: 'GET',
		contentType: 'application/json',
		headers,
	});

	// TS throws if the body isn't valid JSON
	const body = res.json as unknown;
	return body as OpenAlephCloselyCorrelatedApiResult;
}

async function explore(
	settings: OpenAlephPluginSettings,
	app: App,
	content: string,
	noteName: string,
) {
	const enabledInstances = settings.instances?.filter(
		(instance) => instance.enabled,
	);

	let entities: OpenAlephGraph = {
		centralNote: noteName,
		relatedEntities: [],
	};

	for (let enabledInstance of enabledInstances) {
		const apiKey = app.secretStorage.getSecret(enabledInstance.apiKeyName);
		try {
			const relatedEntities = await percolate(
				enabledInstance.instanceUrl,
				apiKey,
				content,
			);

			if (relatedEntities.status !== 'ok') {
				continue;
			}

			entities.relatedEntities?.push(
				...relatedEntities.results.map((entity: unknown) => {
					if (typeof entity !== 'object' || entity === null) {
						throw new Error('Malformed entity in response.');
					}
					const e = entity as OpenAlephPercolationApiEntity;
					return {
						schema: e.schema,
						dataset: e.dataset,
						caption: e.caption,
						id: e.id,
						instance: enabledInstance.instanceUrl,
						instanceName: enabledInstance.name,
						url: e.links.self,
						closelyCorrelated: [],
					};
				}),
			);

			for (let relatedEntity of entities.relatedEntities ?? []) {
				const closelyCorrelatedTerms = await getCloselyCorrelated(
					enabledInstance.instanceUrl,
					apiKey,
					relatedEntity.caption,
					5,
				);

				if (closelyCorrelatedTerms.status !== 'ok') {
					continue;
				}

				relatedEntity.closelyCorrelated?.push(
					...(
						closelyCorrelatedTerms.facets?.[
							'names.significant_terms'
						]?.values ?? []
					).map((value: unknown) => {
						if (typeof value !== 'object' || value === null) {
							throw new Error('Malformed entity in response.');
						}
						const v = value as OpenAlephCloselyCorrelatedApiTerm;
						const relatedEntityCaptionAsQuery =
							relatedEntity.caption.trim().replace(/\s+/g, '+');
						const relatedTermCaptionAsQuery = v.label
							.trim()
							.replace(/\s+/g, '+');
						return {
							id: v.id,
							label: v.label,
							count: v.count,
							searchQuery: `${enabledInstance.instanceUrl}/search?limit=30&q=${relatedEntityCaptionAsQuery}+"${relatedTermCaptionAsQuery}"`,
						};
					}),
				);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
		}
	}

	await buildMarkdownTable(entities, app);

	// graphing

	// const existing = workspace.getLeavesOfType(VIEW_TYPE_ENTITY_GRAPH);
	// const leaf: WorkspaceLeaf = existing[0] ?? workspace.getLeaf('tab');

	// if (existing.length === 0) {
	// 	await leaf.setViewState({ type: VIEW_TYPE_ENTITY_GRAPH, active: true });
	// }

	// workspace.revealLeaf(leaf);

	// const view = leaf.view;
	// if (view instanceof EntityGraphView) {
	// 	view.setEntities(entities);
	// }
}

/* eslint-enable obsidianmd/ui/sentence-case -- Done with weird sentnces */
