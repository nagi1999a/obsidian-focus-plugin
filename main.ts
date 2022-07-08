import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownPreviewEvents } from 'obsidian';

// Remember to rename these classes and interfaces!

interface FocusPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: FocusPluginSettings = {
	mySetting: 'default'
}

export default class FocusPlugin extends Plugin {
	settings: FocusPluginSettings;
	currentFocus: Element | null;
	private findContents(element: Element) {
		const order = ['H1', 'H2', 'H3', 'H4', 'H5'];
		let contents = [element];
		let current = element.nextElementSibling;
		let tagElement = element.firstElementChild?.tagName;
		
		if (!tagElement || !order.includes(tagElement))
			return contents;

		while (current) {
			let tagCurrent = current.firstElementChild?.tagName;
			if (tagCurrent && order.includes(tagCurrent) && order.indexOf(tagCurrent) <= order.indexOf(tagElement))
				break;
			contents.push(current);
			current = current.nextElementSibling;
		}

		return contents;
	}

	// focus() {
	// 	if (!this.currentFocus)
	// 		return;
	// 	const contents = this.findContents(this.currentFocus);
	// 	if 
	// }

	async onload() {
		await this.loadSettings();
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
			// only work under markdown preview
			const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!markdownView || (markdownView.getMode() !== 'preview') || !(evt.target instanceof Element))
				return;
			
			// only work under headings and list
			const element = evt.target;
			const block = element.parentElement;
			console.log(block)
			if (!block || !(element.hasAttribute('data-heading') || element.hasAttribute('data-line')))
				return;

			// only work under multiple headings or list
			const sibilings = block.parentElement?.children;
			if (!sibilings)
				return;

			// restore when clicked again
			// if (block === this.currentFocus)
			// 	focus()
			if (block === this.currentFocus) {
				const dimmedEls = Array.from(document.getElementsByClassName('obsidian-focus-plugin-dimmed'));
				for (let i = 0; i < dimmedEls.length; i++) {
					dimmedEls[i].classList.remove('obsidian-focus-plugin-dimmed');
					dimmedEls[i].classList.add('obsidian-focus-plugin-focus');
				}
				this.currentFocus = null;
				return;
			}

			this.currentFocus = block;
			let contentSiblings = this.findContents(block);
			
			for (let i = 0; i < contentSiblings.length; i++) {
				if (contentSiblings[i].classList.contains('obsidian-focus-plugin-dimmed')) {
					contentSiblings[i].classList.remove('obsidian-focus-plugin-dimmed')
					contentSiblings[i].classList.add('obsidian-focus-plugin-focus');
				}
			}

			// dim all sibiling elements
			if (sibilings) {
				console.log(sibilings)
				for (let i = 0; i < sibilings.length; i++) {
					const sibiling = sibilings[i];
					if (!contentSiblings.includes(sibiling as HTMLElement)) {
						sibiling.classList.add('obsidian-focus-plugin-dimmed');
						sibiling.classList.remove('obsidian-focus-plugin-focus');
					}
				}
			}
		});
		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
		// this.registerMarkdownPostProcessor((element, context) => {
		// 	this.elements.push(element);
		// 	console.log(element);
		// })
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: FocusPlugin;

	constructor(app: App, plugin: FocusPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
