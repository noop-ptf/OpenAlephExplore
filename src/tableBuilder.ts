import type {
	OpenAlephGraph,
	OpenAlephGroupedEntities,
	OpenAlephEntity,
} from './types';

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

export function buildMarkdownTableContent(entities: OpenAlephGraph): string {
	let lines: string[] = [
		'| Instance | Type | Entity name | Related names |',
		'| :--- | :---: | :---: | ---: |',
	];

	const groupedEntities = groupEntitiesByInstance(entities);
	console.log(groupedEntities);

	for (const entitiesGroupedByInstance of groupedEntities) {
		let addedInstanceRow = false;
		for (const relatedEntity of entitiesGroupedByInstance.relatedEntities ??
			[]) {
			console.log(relatedEntity.caption);
			const modifiedUrl = relatedEntity.url.replace('/api/2', '');
			let addedEntityName = false;
			if (relatedEntity.closelyCorrelated.length == 0) {
				lines.push(
					`| ${addedInstanceRow ? '' : `[${relatedEntity.instanceName}](${relatedEntity.instance})`} | ${addedEntityName ? '' : relatedEntity.schema} | ${addedEntityName ? '' : `[${relatedEntity.caption}](${modifiedUrl})`}  |`,
				);
				addedInstanceRow = true;
				addedEntityName = true;
			} else {
				for (const closelyCorrelated of relatedEntity.closelyCorrelated) {
					lines.push(
						`| ${addedInstanceRow ? '' : `[${relatedEntity.instanceName}](${relatedEntity.instance})`} | ${addedEntityName ? '' : relatedEntity.schema} | ${addedEntityName ? '' : `[${relatedEntity.caption}](${modifiedUrl})`} | [${closelyCorrelated.label}](${closelyCorrelated.searchQuery}) |`,
					);
					addedInstanceRow = true;
					addedEntityName = true;
				}
			}
		}
	}

	return lines.join('\n');
}
