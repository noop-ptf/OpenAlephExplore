/* eslint-disable obsidianmd/ui/sentence-case -- This is all valid sentence case */

import { Plugin, Notice, MarkdownView, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, OpenAlephSettingTab } from './settings';
import { OpenAlephPluginSettings } from './types';
import { ConfirmSendNoteModal, LoadingModal } from './modals';
import { EntityGraphView, VIEW_TYPE_ENTITY_GRAPH } from './graphView';
import {
	saveExploration,
	linkNoteToExploration,
	openTableFile,
} from './storage';
import { explore } from './requests';

export default class OpenAlephPlugin extends Plugin {
	settings!: OpenAlephPluginSettings;

	async onload(): Promise<void> {
		this.registerView(
			VIEW_TYPE_ENTITY_GRAPH,
			(leaf) => new EntityGraphView(leaf, this),
		);

		this.registerObsidianProtocolHandler('openaleph-graph', (params) => {
			const uuid = params.uuid;
			if (!uuid) {
				new Notice('Missing exploration ID in link.');
				return;
			}
			this.openGraphForUuid(uuid).catch((err: unknown) => {
				const message =
					err instanceof Error ? err.message : String(err);
				new Notice(message);
			});
		});

		await this.loadSettings();

		this.addSettingTab(new OpenAlephSettingTab(this.app, this));

		this.addRibbonIcon(
			'telescope',
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

		const noteFile = view.file;
		if (!noteFile) {
			throw new Error('No note is currently open.');
		}

		const noteName = noteFile.basename;
		const content = view.editor.getValue();

		new ConfirmSendNoteModal(
			this.app,
			noteName,
			content,
			(maxPercolatedEntities) => {
				void this.handleExplore(
					content,
					noteName,
					noteFile,
					maxPercolatedEntities,
				);
			},
		).open();
	}

	private async handleExplore(
		content: string,
		noteName: string,
		noteFile: TFile,
		maxPercolatedEntities: number,
	): Promise<void> {
		const loadingModal = new LoadingModal(this.app);
		loadingModal.open();

		try {
			const entities = await explore(
				this.settings,
				this.app,
				content,
				noteName,
				maxPercolatedEntities,
			);

			const record = await saveExploration(this.app, entities);
			await linkNoteToExploration(this.app, noteFile, record);
			await openTableFile(this.app, record);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
		} finally {
			loadingModal.close();
		}
	}

	private async openGraphForUuid(uuid: string): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_ENTITY_GRAPH,
		);
		const leaf = existing[0] ?? this.app.workspace.getLeaf('tab');

		if (existing.length === 0) {
			await leaf.setViewState({
				type: VIEW_TYPE_ENTITY_GRAPH,
				active: true,
				state: { uuid },
			});
		}

		await this.app.workspace.revealLeaf(leaf);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/* eslint-enable obsidianmd/ui/sentence-case -- Done with weird sentnces */
