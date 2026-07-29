export interface OpenAlephEntity {
	schema: string;
	dataset: string;
	caption: string;
	id: string;
	instance: string;
	url: string;
}

export interface OpenAlephApiResponseEntity {
	schema: string;
	dataset: string;
	caption: string;
	id: string;
	links: {
		self: string;
	};
}

export interface OpenAlephPluginSettings {
	importFolder: string;
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
