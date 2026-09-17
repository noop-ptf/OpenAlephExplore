import { ItemView, WorkspaceLeaf, Notice, ViewStateResult } from 'obsidian';
import cytoscape from 'cytoscape';
import type { OpenAlephGraph } from './types';
import { buildCytoscapeElements, buildStylesheet } from './graphBuilder';
import { loadExplorationJson } from './storage';

export const VIEW_TYPE_ENTITY_GRAPH = 'entity-graph-view';

export class EntityGraphView extends ItemView {
	private cy: cytoscape.Core | null = null;
	private graphContainerEl: HTMLElement | null = null;
	private entities: OpenAlephGraph | null = null;
	private uuid: string | null = null;

	constructor(leaf: WorkspaceLeaf) {
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
			name: 'concentric',
			concentric: (node: cytoscape.NodeSingular) =>
				100 - (node.data('depth') as number) * 10,
			levelWidth: () => 1,
			minNodeSpacing: 40,
			startAngle: (3 / 2) * Math.PI,
			animate: false,
		}).run();

		cy.fit(undefined, 30);
	}
}
