import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	ViewStateResult,
	Menu,
} from 'obsidian';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type OpenAlephPlugin from './main';
import type { OpenAlephEntity, OpenAlephGraph } from './types';
import { buildCytoscapeElements, buildStylesheet } from './graphBuilder';
import { loadExplorationJson } from './storage';
import { writeNote } from './noteImport';
import { getEntity } from './requests';

cytoscape.use(fcose);

export const VIEW_TYPE_ENTITY_GRAPH = 'entity-graph-view';

export class EntityGraphView extends ItemView {
	private cy: cytoscape.Core | null = null;
	private graphContainerEl: HTMLElement | null = null;
	private entities: OpenAlephGraph | null = null;
	private uuid: string | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: OpenAlephPlugin,
	) {
		super(leaf);
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), uuid: this.uuid };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);

		const uuid =
			typeof state === 'object' && state !== null && 'uuid' in state
				? (state as { uuid?: unknown }).uuid
				: undefined;

		if (typeof uuid !== 'string' || uuid === this.uuid) {
			return;
		}

		this.uuid = uuid;
		this.entities = await loadExplorationJson(this.app, uuid);

		if (!this.entities) {
			new Notice('Could not find exploration data for this graph.');
			return;
		}

		this.renderGraph();
	}

	getViewType(): string {
		return VIEW_TYPE_ENTITY_GRAPH;
	}

	getDisplayText(): string {
		return this.entities?.centralNote ?? 'Entity graph';
	}

	getIcon(): string {
		return 'network';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('openaleph-entity-graph-view-container');

		this.graphContainerEl = this.contentEl.createDiv({
			cls: 'openaleph-entity-graph-cy-container',
		});

		this.cy = cytoscape({
			container: this.graphContainerEl,
			elements: [],
			style: buildStylesheet(),
		});

		const cy = this.cy;

		// tapping a node fades everything else
		cy.on('tap', 'node', (evt) => {
			cy.elements().addClass('faded');
			const node = evt.target as cytoscape.NodeSingular;
			node.closedNeighborhood().removeClass('faded');
		});

		// tapping the background reverts the fade
		cy.on('tap', (evt) => {
			if (evt.target === cy) {
				cy.elements().removeClass('faded');
			}
		});

		cy.on('cxttap', 'node[type="relatedEntity"]', (evt) => {
			this.showRelatedEntityMenu(evt);
		});

		this.registerEvent(
			this.app.workspace.on('css-change', () => {
				this.cy?.style(buildStylesheet());
			}),
		);

		if (this.entities) {
			this.renderGraph();
		}
	}

	async onClose(): Promise<void> {
		this.cy?.destroy();
		this.cy = null;
		this.graphContainerEl = null;
	}

	onResize(): void {
		this.cy?.resize();
		this.cy?.fit(undefined, 30);
	}

	private showRelatedEntityMenu(evt: cytoscape.EventObject): void {
		const node = evt.target as cytoscape.NodeSingular;
		const nodeId = node.id();
		const entity = this.entities?.relatedEntities?.find(
			(related) => related.id === nodeId,
		);

		if (!entity) {
			return;
		}

		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('Import into Obsidian')
				.setIcon('download')
				.onClick(() => {
					void this.importEntity(entity);
				}),
		);

		const original = evt.originalEvent;
		if (original.instanceOf(MouseEvent)) {
			menu.showAtMouseEvent(original);
		} else if (this.graphContainerEl) {
			const rect = this.graphContainerEl.getBoundingClientRect();
			const pos = node.renderedPosition();
			menu.showAtPosition({ x: rect.left + pos.x, y: rect.top + pos.y });
		}
	}

	private async importEntity(entity: OpenAlephEntity): Promise<void> {
		const instance = this.plugin.settings.instances.find(
			(i) => i.instanceUrl === entity.instanceUrl,
		);

		if (!instance) {
			new Notice(
				`No configured instance for ${entity.instanceUrl}. Check the settings.`,
			);
			return;
		}
		try {
			const fullEntity = await getEntity(entity.id, instance, this.app);
			const instanceHostname = new URL(entity.instanceUrl).hostname;
			await writeNote(
				fullEntity,
				this.plugin.settings.importFolder,
				instanceHostname,
				this.plugin,
			);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			new Notice(`Importing entity ${entity.caption} failed: ${message}`);
			return;
		}
	}

	private renderGraph(): void {
		const { cy, entities } = this;

		if (!cy || !entities) {
			return;
		}

		cy.batch(() => {
			cy.elements().remove();
			cy.add(buildCytoscapeElements(entities));
		});

		cy.layout({
			name: 'fcose',
			quality: 'proof',
			animate: false,
			nodeRepulsion: 6500,
			idealEdgeLength: 70,
			nodeSeparation: 75,
		} as cytoscape.LayoutOptions).run();

		cy.fit(undefined, 30);
	}
}
