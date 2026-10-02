import { App, Notice, requestUrl } from 'obsidian';
import {
	OpenAlephEntity,
	OpenAlephPluginSettings,
	OpenAlephPercolationApiResult,
	OpenAlephPercolationApiEntity,
	OpenAlephGraph,
	OpenAlephCloselyCorrelatedApiResult,
	OpenAlephCloselyCorrelatedApiTerm,
	OpenAlephInstanceSettings,
} from './types';

async function percolate(
	instanceUrl: string,
	apiKey: string | null,
	bodyText: string,
	maxPercolatedEntities: number,
): Promise<OpenAlephPercolationApiResult> {
	if (!apiKey || apiKey.trim() === '') {
		throw new Error(`API key for ${instanceUrl} is empty.`);
	}

	const firstUrl = new URL('/api/2/beta/percolate', instanceUrl);
	firstUrl.searchParams.set('dehydrate', 'true');
	if (maxPercolatedEntities > 0) {
		firstUrl.searchParams.set('limit', String(maxPercolatedEntities));
	}

	const headers: Record<string, string> = {
		'User-Agent': 'alephclient',
		Authorization: apiKey,
		Pragma: 'no-cache',
	};

	const res = await requestUrl({
		url: firstUrl.toString(),
		method: 'POST',
		contentType: 'application/json',
		headers,
		body: JSON.stringify({ text: bodyText }),
	});

	const firstRes = res.json as unknown as OpenAlephPercolationApiResult;

	if (firstRes.status !== 'ok') {
		return { ...firstRes, complete: true };
	}

	const results = [...firstRes.results];
	let next = firstRes.next;
	let error: unknown;

	while (next) {
		try {
			const nextUrl = new URL(next, instanceUrl);

			const res = await requestUrl({
				url: nextUrl.toString(),
				method: 'POST',
				contentType: 'application/json',
				headers,
				body: JSON.stringify({ text: bodyText }),
			});

			const nextRes =
				res.json as unknown as OpenAlephPercolationApiResult;

			results.push(...nextRes.results);
			next = nextRes.next;
		} catch (e) {
			console.warn(
				`Percolation pagination for ${instanceUrl} stopped early:`,
				e,
			);
			error = e;
			break;
		}
	}

	return {
		...firstRes,
		results,
		complete: error === undefined,
		error,
	};
}

async function getCloselyCorrelated(
	instanceUrl: string,
	apiKey: string | null,
	caption: string,
	maxResults: number | null,
): Promise<OpenAlephCloselyCorrelatedApiResult> {
	if (!apiKey || apiKey.trim() === '') {
		throw new Error(`API key for ${instanceUrl} is empty.`);
	}

	if (!maxResults) {
		maxResults = 20;
	}

	const url = new URL('/api/2/entities', instanceUrl);
	url.searchParams.set('facet_significant', 'names');
	url.searchParams.set('limit', String(maxResults));
	url.searchParams.set('q', caption);

	const headers: Record<string, string> = {
		'User-Agent': 'alephclient',
		Authorization: apiKey,
		// Pragma: 'no-cache',
	};

	const res = await requestUrl({
		url: url.toString(),
		method: 'GET',
		contentType: 'application/json',
		headers,
	});

	const body = res.json as unknown;
	return body as OpenAlephCloselyCorrelatedApiResult;
}

export async function explore(
	settings: OpenAlephPluginSettings,
	app: App,
	content: string,
	noteName: string,
	maxPercolatedEntities: number,
): Promise<OpenAlephGraph> {
	const enabledInstances = settings.instances.filter(
		(instance) => instance.enabled,
	);

	const entities: OpenAlephGraph = {
		centralNote: noteName,
		relatedEntities: [],
	};

	for (const enabledInstance of enabledInstances) {
		const apiKey = app.secretStorage.getSecret(enabledInstance.apiKeyName);
		try {
			// get related entities
			const relatedEntities = await percolate(
				enabledInstance.instanceUrl,
				apiKey,
				content,
				maxPercolatedEntities,
			);

			if (relatedEntities.status !== 'ok') {
				continue;
			}

			const newRelatedEntities =
				relatedEntities.results.flatMap<OpenAlephEntity>(
					(entity: unknown) => {
						if (typeof entity !== 'object' || entity === null) {
							console.warn(
								'Skipping malformed entity:',
								entity,
								'(',
								enabledInstance.instanceUrl,
								')',
							);
							return [];
						}
						const e = entity as OpenAlephPercolationApiEntity;
						return {
							schema: e.schema,
							dataset: e.dataset,
							caption: e.caption,
							id: e.id,
							instance: enabledInstance.instanceUrl,
							instanceName: enabledInstance.name,
							instanceUrl: enabledInstance.instanceUrl,
							url: e.links.self,
							closelyCorrelated: [],
						};
					},
				);

			entities.relatedEntities?.push(...newRelatedEntities);

			for (const relatedEntity of newRelatedEntities) {
				const closelyCorrelatedTerms = await getCloselyCorrelated(
					enabledInstance.instanceUrl,
					apiKey,
					relatedEntity.caption,
					5,
				);

				if (closelyCorrelatedTerms.status !== 'ok') {
					continue;
				}

				relatedEntity.closelyCorrelated.push(
					...(
						closelyCorrelatedTerms.facets?.[
							'names.significant_terms'
						]?.values ?? []
					).flatMap((value: unknown) => {
						if (typeof value !== 'object' || value === null) {
							console.warn(
								'Skipping malformed closely correlated term:',
								value,
								'(',
								enabledInstance.instanceUrl,
								')',
							);
							return [];
						}
						const v = value as OpenAlephCloselyCorrelatedApiTerm;
						const relatedEntityCaptionAsQuery =
							relatedEntity.caption.trim().replace(/\s+/g, '+');
						const relatedTermCaptionAsQuery = v.label
							.trim()
							.replace(/\s+/g, '+');
						return {
							id: v.id,
							label: v.label,
							count: v.count,
							searchQuery: `${enabledInstance.instanceUrl}/search?limit=30&q=${relatedEntityCaptionAsQuery}+"${relatedTermCaptionAsQuery}"`,
						};
					}),
				);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice(message);
		}
	}

	return entities;
}

export async function getEntity(
	id: string,
	instance: OpenAlephInstanceSettings,
	app: App,
): Promise<OpenAlephEntity> {
	const apiKey = app.secretStorage.getSecret(instance.apiKeyName);

	if (!apiKey || apiKey.trim() === '') {
		throw new Error(`API key for ${instance.instanceUrl} is empty.`);
	}

	const url = new URL(
		`/api/2/entities/${encodeURIComponent(id)}`,
		instance.instanceUrl,
	);

	const headers: Record<string, string> = {
		'User-Agent': 'alephclient',
		Authorization: apiKey,
		Pragma: 'no-cache',
	};

	const res = await requestUrl({
		url: url.toString(),
		method: 'GET',
		contentType: 'application/json',
		headers,
	});

	const body = res.json as unknown;
	return body as OpenAlephEntity;
}
