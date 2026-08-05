import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import cytoscape from 'cytoscape';
import type { OpenAlephGraph } from './types';
import { buildCytoscapeElements, buildStylesheet } from './graphBuilder';

export const VIEW_TYPE_ENTITY_GRAPH = 'entity-graph-view';

export class EntityGraphView extends ItemView {
	private cy: cytoscape.Core | null = null;
	private graphContainerEl: HTMLElement | null = null;
	private entities: OpenAlephGraph | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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
		const container = this.contentEl;
		container.empty();
		container.addClass('openaleph-entity-graph-view-container');

		this.graphContainerEl = container.createDiv({
			cls: 'openaleph-entity-graph-cy-container',
		});

		this.createCy();

		if (this.entities) {
			this.renderGraph();
		}
	}

	async onClose(): Promise<void> {
		this.cy?.destroy();
		this.cy = null;
	}

	setEntities(entities: OpenAlephGraph): void {
		this.entities = entities;

		// Update the tab title to reflect the new central note.
		void this.leaf.setViewState({
			type: VIEW_TYPE_ENTITY_GRAPH,
			active: true,
		});

		if (this.graphContainerEl && this.cy) {
			this.renderGraph();
		}
	}

	createCy() {
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

		// TODO add related + correlated search URL
		// copy to clipboard instead of accessing
		// this.cy.on('tap', 'node[url]', (evt) => {
		// 	const url = evt.target.data('url') as string | undefined;
		// 	if (url) {
		// 		window.open(url, '_blank');
		// 	}
		// });
	}

	private renderGraph(): void {
		if (!this.graphContainerEl) {
			return;
		}

		this.createCy();

		if (!this.cy || !this.entities) {
			new Notice('Failed to render graph');
			return;
		}

		const elements = buildCytoscapeElements(this.entities);

		this.cy.elements().remove();
		this.cy.add(elements);

		this.cy
			.layout({
				name: 'concentric',
				concentric: (node: cytoscape.NodeSingular) =>
					100 - (node.data('depth') as number) * 10,
				levelWidth: () => 1,
				minNodeSpacing: 40,
				startAngle: (3 / 2) * Math.PI,
				animate: false,
			})
			.run();

		this.cy.fit(undefined, 30);
	}
}
