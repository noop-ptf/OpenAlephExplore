export interface OpenAlephGraph {
	centralNote: string;
	relatedEntities?: OpenAlephEntity[];
}

export interface OpenAlephEntity {
	schema: string;
	dataset: string;
	caption: string;
	id: string;
	instance: string;
	instanceName: string;
	url: string;
	closelyCorrelated?: OpenAlephCloselyCorrelatedApiTerm[];
}

export interface OpenAlephCloselyCorrelatedApiResult {
	status: string;
	facets: {
		'names.significant_terms'?: {
			values: OpenAlephCloselyCorrelatedApiTerm[];
		};
	};
}

export interface OpenAlephCloselyCorrelatedApiTerm {
	id: string;
	label: string;
	count: number;
	searchQuery?: string;
}

export interface OpenAlephPercolationApiResult {
	status: string;
	results: OpenAlephPercolationApiEntity[];
}

export interface OpenAlephPercolationApiEntity {
	schema: string;
	dataset: string;
	caption: string;
	id: string;
	links: {
		self: string;
	};
}

export interface OpenAlephGroupedEntities {
	instance: string;
	relatedEntities?: OpenAlephEntity[];
}

export interface OpenAlephPluginSettings {
	instances: OpenAlephInstanceSettings[];
}

export interface OpenAlephInstanceSettings {
	id: string;
	name: string;
	instanceUrl: string;
	apiKeyName: string;
	enabled: boolean;
	connectionValid: boolean;
}

export interface ExplorationRecord {
	uuid: string;
	folderPath: string;
	jsonPath: string;
	tablePath: string;
}
