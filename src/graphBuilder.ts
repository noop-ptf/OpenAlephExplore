import cytoscape from 'cytoscape';
import type { OpenAlephGraph } from './types';

export const CENTRAL_NODE_ID = '__central__';

const INSTANCE_PALETTE: [cssVar: string, fallback: string][] = [
	['--color-blue', '#61afef'],
	['--color-green', '#98c379'],
	['--color-purple', '#c678dd'],
	['--color-red', '#e06c75'],
	['--color-yellow', '#e5c07b'],
	['--color-cyan', '#56b6c2'],
	['--color-pink', '#ff79c6'],
];

export function buildCytoscapeElements(
	entities: OpenAlephGraph,
): cytoscape.ElementDefinition[] {
	const nodeIds = new Set<string>([CENTRAL_NODE_ID]);
	const edgeIds = new Set<string>();
	const elements: cytoscape.ElementDefinition[] = [];

	const instanceColorIndex = new Map<string, number>();
	const getColorIndex = (instance: string): number => {
		let index = instanceColorIndex.get(instance);
		if (index === undefined) {
			index = instanceColorIndex.size % INSTANCE_PALETTE.length;
			instanceColorIndex.set(instance, index);
		}
		return index;
	};

	const addNode = (data: { id: string; [key: string]: unknown }): boolean => {
		if (nodeIds.has(data.id)) {
			return false;
		}
		nodeIds.add(data.id);
		elements.push({ data });
		return true;
	};

	const addEdge = (source: string, target: string): void => {
		const id = `${source}->${target}`;
		if (source === target || edgeIds.has(id)) {
			return;
		}
		edgeIds.add(id);
		elements.push({ data: { id, source, target } });
	};

	elements.push({
		data: {
			id: CENTRAL_NODE_ID,
			label: entities.centralNote,
			depth: 0,
			type: 'central',
		},
	});

	if (!entities.relatedEntities) {
		return elements;
	}

	for (const related of entities.relatedEntities) {
		// RELATED = PERCOLATION
		addNode({
			id: related.id,
			label: related.caption,
			depth: 1,
			type: 'relatedEntity',
			schema: related.schema,
			url: related.url,
			instance: related.instance,
			instanceName: related.instanceName,
			colorIndex: getColorIndex(related.instance),
		});
		addEdge(CENTRAL_NODE_ID, related.id);

		// CORRELATED = CLOSELY CORRELATED

		for (const term of related.closelyCorrelated ?? []) {
			// if the current closely correlated term already exists
			// in the graph, connect it to the
			// FTM entity (related obj) (percolation result)
			addNode({
				id: term.id,
				label: term.label,
				depth: 2,
				type: 'correlatedTerm',
				count: term.count,
			});
			addEdge(related.id, term.id);
		}
	}

	return elements;
}

// Cytoscape's stylesheet engine parses color values itself — it does not
// hand them off to the browser's CSS engine — so `var(--text-normal)` etc.
// is never valid here. Instead, resolve each Obsidian theme variable to its
// current literal value, then build the stylesheet from those resolved
// strings.
//
// Reading the custom property directly via
// getComputedStyle(el).getPropertyValue('--foo') is NOT enough: custom
// properties store raw, unevaluated tokens. If a variable is defined in
// terms of calc()/hsl() (as Obsidian's accent colors often are, e.g. for
// hue/saturation adjustments), getPropertyValue returns that literal
// calc()/hsl() expression rather than a final color — which Cytoscape can't
// parse. calc() is only actually evaluated by the browser when assigned to
// a real CSS property, not a custom one. So instead, assign the variable to
// a real `color` property on a throwaway element and read *that* property's
// computed value, which forces full resolution down to a plain rgb() string.

function getCssVar(name: string, fallback: string): string {
	const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
	if (!raw) {
		return fallback;
	}

	// eslint-disable-next-line obsidianmd/prefer-create-el -- document.createSpan() internally tries to do the equivalent of document.appendChild(newSpanElement) the browser throws a native DOM error
	const probe = document.createElement('span');
	probe.style.color = `var(${name})`;
	document.body.appendChild(probe);
	const resolved = getComputedStyle(probe).color;
	document.body.removeChild(probe);

	return resolved.length > 0 ? resolved : fallback;
}

export function buildStylesheet(): cytoscape.StylesheetJsonBlock[] {
	const textNormal = getCssVar('--text-normal', '#dcddde');
	const accent = getCssVar('--interactive-accent', '#7f6df2');
	const textAccent = getCssVar('--text-accent', '#61afef');
	const colorBlue = getCssVar('--color-blue', '#61afef');
	const colorOrange = getCssVar('--color-orange', '#e69138');
	const borderMuted = getCssVar('--background-modifier-border', '#4b4b4b');

	return [
		{
			selector: 'node',
			style: {
				label: 'data(label)',
				'font-size': '10px',
				color: textNormal,

				'text-valign': 'bottom',
				'text-halign': 'center',
				'text-margin-y': 4,

				// 'text-valign': 'center',
				// 'text-halign': 'right',
				// 'text-margin-x': 6,

				'background-color': borderMuted,
				width: 24,
				height: 24,

				'text-wrap': 'ellipsis',
				'text-max-width': '120px',
				'min-zoomed-font-size': 8,
			},
		},
		{
			selector: 'node[type="central"]',
			style: {
				'background-color': accent,
				width: 44,
				height: 44,
				'font-size': '14px',
				'font-weight': 'bold',
			},
		},
		{
			selector: 'node[type="relatedEntity"]',
			style: {
				'background-color': colorBlue,
				width: 30,
				height: 30,
			},
		},
		...INSTANCE_PALETTE.map(
			([cssVar, fallback], index): cytoscape.StylesheetJsonBlock => ({
				selector: `node[type="relatedEntity"][colorIndex = ${index}]`,
				style: { 'background-color': getCssVar(cssVar, fallback) },
			}),
		),
		{
			selector: 'node[type="correlatedTerm"]',
			style: {
				'background-color': colorOrange,
				// Scale node size gently with correlation count, floor/ceiling to
				// keep very small/large counts from producing unreadable nodes.
				width: 'mapData(count, 0, 30, 8, 24)',
				height: 'mapData(count, 0, 30, 8, 24)',
				'font-size': '8px',
			},
		},
		{
			selector: 'node[type="correlatedTerm"][[degree > 1]]',
			style: { 'border-width': 4, 'border-color': textAccent },
		},
		{
			selector: 'node[type="relatedEntity"][[degree <= 1]]',
			style: { width: 14, height: 14 },
		},
		{
			selector: 'edge',
			style: {
				width: 1,
				'line-color': borderMuted,
				'curve-style': 'bezier',
				'target-arrow-shape': 'none',
			},
		},
		{
			selector: 'node:selected',
			style: {
				'border-width': 2,
				'border-color': textAccent,
			},
		},
		{
			selector: '.faded',
			style: { opacity: 0.15 },
		},
	];
}
