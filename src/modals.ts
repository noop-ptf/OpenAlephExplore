import { App, ButtonComponent, Modal, Setting } from 'obsidian';

const PREVIEW_MAX_LENGTH = 300;
const NON_NEGATIVE_INTEGER = /^\d+$/;

export abstract class ConfirmModal<TResult = void> extends Modal {
	private confirmButton: ButtonComponent | null = null;

	protected constructor(
		app: App,
		protected readonly noteName: string,
		protected readonly noteText: string,
		private readonly onConfirm: (result: TResult) => void,
	) {
		super(app);
	}

	protected abstract getTitle(): string;

	protected abstract getDescription(): string;

	protected abstract getResult(): TResult;

	protected renderBody(_containerEl: HTMLElement): void {}

	protected canConfirm(): boolean {
		return true;
	}

	protected refreshConfirmState(): void {
		this.confirmButton?.setDisabled(!this.canConfirm());
	}

	onOpen(): void {
		const { contentEl } = this;

		this.setTitle(this.getTitle());
		contentEl.createEl('p', { text: this.getDescription() });

		this.renderPreview(contentEl);
		this.renderBody(contentEl);
		this.renderButtons(contentEl);
		this.refreshConfirmState();
	}

	onClose(): void {
		this.confirmButton = null;
		this.contentEl.empty();
	}

	private renderPreview(containerEl: HTMLElement): void {
		const previewEl = containerEl.createDiv({
			cls: 'openaleph-note-preview-container',
		});

		previewEl.createEl('h3', { text: this.noteName });

		const preview =
			this.noteText.length > PREVIEW_MAX_LENGTH
				? `${this.noteText.slice(0, PREVIEW_MAX_LENGTH)}…`
				: this.noteText;

		previewEl.createEl('pre', {
			text: preview,
			cls: 'openaleph-note-preview',
		});
	}

	private renderButtons(containerEl: HTMLElement): void {
		const buttonContainer = containerEl.createDiv({
			cls: 'modal-button-container',
		});

		this.confirmButton = new ButtonComponent(buttonContainer)
			.setButtonText('Confirm')
			.setCta()
			.onClick(() => {
				if (!this.canConfirm()) {
					return;
				}
				const result = this.getResult();
				this.close();
				this.onConfirm(result);
			});

		new ButtonComponent(buttonContainer)
			.setButtonText('Cancel')
			.onClick(() => this.close());
	}
}

export class ConfirmImportModal extends ConfirmModal {
	constructor(
		app: App,
		noteName: string,
		private readonly notePath: string,
		noteText: string,
		onConfirm: () => void,
	) {
		super(app, noteName, noteText, onConfirm);
	}

	protected getTitle(): string {
		return 'Confirm entity import';
	}

	protected getDescription(): string {
		return `The entity below will be imported into your vault as a note at ${this.notePath}.`;
	}

	protected getResult(): void {}
}

export class ConfirmSendNoteModal extends ConfirmModal<number> {
	private maxPercolatedEntities: number;
	private isValid = true;

	constructor(
		app: App,
		noteName: string,
		noteText: string,
		onConfirm: (maxPercolatedEntities: number) => void,
		defaultMaxPercolatedEntities = 0,
	) {
		super(app, noteName, noteText, onConfirm);
		this.maxPercolatedEntities = defaultMaxPercolatedEntities;
	}

	protected getTitle(): string {
		return 'Confirm note';
	}

	protected getDescription(): string {
		return 'The note below will be sent to all enabled OpenAleph instances.';
	}

	protected getResult(): number {
		return this.maxPercolatedEntities;
	}

	protected canConfirm(): boolean {
		return this.isValid;
	}

	protected renderBody(containerEl: HTMLElement): void {
		const settingsEl = containerEl.createDiv({
			cls: 'openaleph-max-entities-setting-container',
		});

		new Setting(settingsEl)
			.setName('Maximum related entities')
			.setDesc(
				'Leaving this setting at 0 will not put a cap on the total number of related entities.',
			)
			.setClass('openaleph-max-entities-setting')
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.step = '1';
				text.setValue(String(this.maxPercolatedEntities));

				text.onChange((value) => {
					const trimmed = value.trim();
					this.isValid = NON_NEGATIVE_INTEGER.test(trimmed);

					if (this.isValid) {
						this.maxPercolatedEntities = Number.parseInt(
							trimmed,
							10,
						);
					}

					this.refreshConfirmState();
				});
			});
	}
}

export class LoadingModal extends Modal {
	constructor(
		app: App,
		private message: string = 'Exploring…',
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('openaleph-loading-modal');
		contentEl.createDiv({ cls: 'openaleph-spinner' });
		contentEl.createEl('p', { text: this.message });
	}

	onClose() {
		this.contentEl.empty();
	}
}
