/* eslint-disable obsidianmd/ui/sentence-case -- This is all valid sentence case */

import { App, Modal } from 'obsidian';

export class ConfirmNoteModal extends Modal {
	private noteName: string;
	private noteText: string;
	private onConfirm: () => void;

	constructor(
		app: App,
		noteName: string,
		noteText: string,
		onConfirm: () => void,
	) {
		super(app);
		this.noteName = noteName;
		this.noteText = noteText;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: 'Confirm note' });

		contentEl.createEl('p', {
			text: `The note below will be sent to all enabled OpenAleph instances.`,
		});

		const notePreview = contentEl.createDiv({
			cls: 'openaleph-note-preview-container',
		});

		notePreview.createEl('h3', { text: this.noteName });

		const preview =
			this.noteText.length > 300
				? this.noteText.slice(0, 300) + '…'
				: this.noteText;

		notePreview.createEl('pre', {
			text: preview,
			cls: 'openaleph-note-preview',
		});

		const buttonContainer = contentEl.createDiv({
			cls: 'modal-button-container',
		});

		const confirmButton = buttonContainer.createEl('button', {
			text: 'Confirm',
			cls: 'mod-cta',
		});
		confirmButton.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});

		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel',
		});
		cancelButton.addEventListener('click', () => {
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
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

/* eslint-enable obsidianmd/ui/sentence-case -- Done with weird sentnces */
