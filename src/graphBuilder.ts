import cytoscape from 'cytoscape';
import type { OpenAlephGraph } from './types';

export const CENTRAL_NODE_ID = '__central__';

export function buildCytoscapeElements(
	entities: OpenAlephGraph,
): cytoscape.ElementDefinition[] {
	// see lower TODO
	const seenIds = new Set<string>();
	const elements: cytoscape.ElementDefinition[] = [];

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
		seenIds.add(related.id);
		// RELATED = PERCOLATION
		elements.push({
			data: {
				id: related.id,
				label: related.caption,
				depth: 1,
				type: 'relatedEntity',
				schema: related.schema,
				url: related.url,
			},
		});

		elements.push({
			data: {
				id: `${CENTRAL_NODE_ID}->${related.id}`,
				source: CENTRAL_NODE_ID,
				target: related.id,
			},
		});

		// TODO if a closelyCorrelated was already connected to another related
		// add a connection (one closelyCorrelated can be connected to multiple related)
		// maybe i can even highlight this as it would be interesting!

		if (related.closelyCorrelated) {
			// CORRELATED = CLOSELY CORRELATED
			for (const term of related.closelyCorrelated) {
				// nu ar trebui să existe
				// CORRELATED -> nume chioare, RELATED -> FTM caption
				// diferențiez FTM entities de nume chioare

				// if (elements.some((el) => el.data.id === term.id)) {
				// 	elements.push({
				// 		data: {
				// 			id: `${related.id}->${term.id}`,
				// 			source: related.id,
				// 			target: term.id,
				// 		},
				// 	});
				// 	continue;
				// }

				elements.push({
					data: {
						id: term.id,
						label: term.label,
						depth: 2,
						type: 'correlatedTerm',
						count: term.count,
					},
				});

				elements.push({
					data: {
						id: `${related.id}->${term.id}`,
						source: related.id,
						target: term.id,
					},
				});
			}
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

	const probe = document.createSpan();
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
				'background-color': borderMuted,
				width: 24,
				height: 24,
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
	];
}
