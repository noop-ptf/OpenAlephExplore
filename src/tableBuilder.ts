import type {
	OpenAlephGraph,
	OpenAlephGroupedEntities,
	OpenAlephEntity,
} from './types';
import { App, Notice, TFile } from 'obsidian';

function groupEntitiesByInstance(
	graph: OpenAlephGraph,
): OpenAlephGroupedEntities[] {
	const groups = new Map<string, OpenAlephEntity[]>();

	for (const entity of graph.relatedEntities ?? []) {
		const bucket = groups.get(entity.instance);
		if (bucket) {
			bucket.push(entity);
		} else {
			groups.set(entity.instance, [entity]);
		}
	}

	return Array.from(groups, ([instance, relatedEntities]) => ({
		instance,
		relatedEntities,
	}));
}

export async function buildMarkdownTable(
	entities: OpenAlephGraph,
	app: App,
): Promise<void> {
	let lines: string[] = [
		'| Instance | Type | Entity name | Related names |',
		'| :--- | :---: | :---: | ---: |',
	];

	const groupedEntities = groupEntitiesByInstance(entities);

	for (const entitiesGroupedByInstance of groupedEntities) {
		let addedInstanceRow = false;
		for (const relatedEntity of entitiesGroupedByInstance.relatedEntities ??
			[]) {
			const modifiedUrl = relatedEntity.url.replace('/api/2', '');
			if (!relatedEntity.closelyCorrelated) {
				lines.push(
					`| ${addedInstanceRow ? '' : `[${relatedEntity.instanceName}](${relatedEntity.instance})`} | ${relatedEntity.schema} | [${relatedEntity.caption}](${modifiedUrl}) |`,
				);
				addedInstanceRow = true;
			} else {
				for (const closelyCorrelated of relatedEntity.closelyCorrelated) {
					lines.push(
						`| ${addedInstanceRow ? '' : `[${relatedEntity.instanceName}](${relatedEntity.instance})`} | ${relatedEntity.schema} | [${relatedEntity.caption}](${modifiedUrl}) | [${closelyCorrelated.label}](${closelyCorrelated.searchQuery}) |`,
					);
					addedInstanceRow = true;
				}
			}
		}
	}

	const content = lines.join('\n');
	const tableFilePath = `${entities.centralNote} table summary.md`;

	const existing = app.vault.getAbstractFileByPath(tableFilePath);

	try {
		if (existing instanceof TFile) {
			// File already exists — overwrite its contents
			await app.vault.modify(existing, content);
		} else {
			await app.vault.create(tableFilePath, content);
		}
		new Notice(`Saved table to ${tableFilePath}`);
	} catch (err) {
		console.error('Failed to save markdown table:', err);
		new Notice('Failed to save Markdown table. See console for details.');
	}
}
