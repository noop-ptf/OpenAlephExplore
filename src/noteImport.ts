import { stringifyYaml, normalizePath } from 'obsidian';
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
	// / \ : are removed
	// * ? " < > | are rejected by Windows
	// # ^ [ ] | break Obsidian links
	const safeName =
		entity.caption.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || entity.id;
	const dataset = entity.dataset ?? 'unknown';
	const path = normalizePath(`${ftmdFolder}/${instanceFolder}/${dataset}`);
	const filePath = normalizePath(`${path}/${safeName}.md`);
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
