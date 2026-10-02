import { stringifyYaml } from 'obsidian';
import type OpenAlephPlugin from './main';
import { type OpenAlephEntity } from './types';
import { ensureFolder } from './storage';

export function yamlifyEntity(entity: OpenAlephEntity): string {
	const flatEntity: Record<string, string | string[]> = {
		schema: entity.schema,
		id: entity.id,
	};
	for (const [k, v] of Object.entries(entity.properties ?? {})) {
		const strings = v.filter((x): x is string => typeof x === 'string');
		if (strings.length === 0) continue;
		flatEntity[k] = strings.length === 1 ? (strings[0] ?? '') : strings;
	}
	return `---\n${stringifyYaml(flatEntity)}---\n`;
}

export async function writeNote(
	entity: OpenAlephEntity,
	ftmdFolder: string,
	instanceFolder: string,
	plugin: OpenAlephPlugin,
): Promise<void> {
	console.log(entity);
	const dataset = entity.dataset ?? 'unknown';
	console.log('dataset ', dataset);
	console.log('ftmdFolder ', ftmdFolder);
	console.log('instancefolder ', instanceFolder);
	const path = `${ftmdFolder}/${instanceFolder}/${dataset}`;
	console.log('path ', path);
	const filePath = `${path}/${entity.caption.replaceAll(/[/\\:]/g, '')}.md`;
	const fileContent = yamlifyEntity(entity);

	await ensureFolder(plugin.app, path);

	const existingFile = plugin.app.vault.getFileByPath(filePath);
	const targetFile = existingFile
		? await plugin.app.vault
				.modify(existingFile, fileContent)
				.then(() => existingFile)
		: await plugin.app.vault.create(filePath, fileContent);

	const activeLeaf = plugin.app.workspace.getLeaf(false);

	await activeLeaf.openFile(targetFile, { state: { mode: 'source' } });
}
