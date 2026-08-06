import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { OpenAlephGraph } from './types';
import { buildMarkdownTableContent } from './tableBuilder';
import { ExplorationRecord } from './types';

async function ensureFolder(app: App, path: string): Promise<void> {
	const normalized = normalizePath(path);
	const existing = app.vault.getAbstractFileByPath(normalized);
	if (!existing) {
		await app.vault.createFolder(normalized);
	}
}

export async function saveExploration(
	app: App,
	entities: OpenAlephGraph,
): Promise<ExplorationRecord> {
	const uuid = crypto.randomUUID();
	const folderPath = normalizePath(`openaleph/${uuid}`);
	const jsonPath = normalizePath(`${folderPath}/${uuid}.json`);
	const tablePath = normalizePath(`${folderPath}/context-${uuid}.md`);

	await ensureFolder(app, 'openaleph');
	await ensureFolder(app, folderPath);

	await app.vault.create(jsonPath, JSON.stringify(entities, null, 2));

	const graphLink = `## [Open graph](obsidian://openaleph-graph?uuid=${uuid})\n\n`;
	const tableContent = graphLink + buildMarkdownTableContent(entities);
	await app.vault.create(tablePath, tableContent);

	return { uuid, folderPath, jsonPath, tablePath };
}

export async function linkNoteToExploration(
	app: App,
	noteFile: TFile,
	record: ExplorationRecord,
): Promise<void> {
	const tableLinkTarget = record.tablePath.replace(/\.md$/, '');

	await app.fileManager.processFrontMatter(
		noteFile,
		(frontmatter: Record<string, unknown>) => {
			frontmatter['openaleph-uuid'] = record.uuid;
			frontmatter['openaleph-table'] = `[[${tableLinkTarget}]]`;
			frontmatter['openaleph-json'] = record.jsonPath;
		},
	);
}

export async function openTableFile(
	app: App,
	record: ExplorationRecord,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(record.tablePath);
	if (!(file instanceof TFile)) {
		return;
	}

	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file);
}

export async function loadExplorationJson(
	app: App,
	uuid: string,
): Promise<OpenAlephGraph | null> {
	const directPath = normalizePath(`openaleph/${uuid}/${uuid}.json`);
	let file = app.vault.getAbstractFileByPath(directPath);

	if (!(file instanceof TFile)) {
		file = findJsonFileByUuid(app, uuid);
	}

	if (!(file instanceof TFile)) {
		return null;
	}

	const raw = await app.vault.read(file);
	try {
		return JSON.parse(raw) as OpenAlephGraph;
	} catch {
		return null;
	}
}

function findJsonFileByUuid(app: App, uuid: string): TFile | null {
	const root = app.vault.getAbstractFileByPath('openaleph');
	if (!(root instanceof TFolder)) {
		return null;
	}

	const targetName = `${uuid}.json`;
	const stack: TFolder[] = [root];

	while (stack.length > 0) {
		const folder = stack.pop();
		if (!folder) {
			continue;
		}
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				stack.push(child);
			} else if (child instanceof TFile && child.name === targetName) {
				return child;
			}
		}
	}

	return null;
}
