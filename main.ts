import { App, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface FocusPluginSettings {
	clearMethod: 'click-again' | 'click-outside';
}

const DEFAULT_SETTINGS: FocusPluginSettings = {
	clearMethod: 'click-again'
}

export default class FocusPlugin extends Plugin {
	settings: FocusPluginSettings;
	observer: MutationObserver;
	classes: { [key: string]: string } = {
		'dimmed': 'focus-plugin-dimmed',
		'focus-animation': 'focus-plugin-focus-animation',
		'dim-animation': 'focus-plugin-dim-animation'
	}
	focusHead: Element | null = null;
	focusContents: Array<Element>;
	order = ['H1', 'H2', 'H3', 'H4', 'H5'];

	private findContents(headNode: Element, startNode: Element) {

		let contents: Array<Element> = [];
		let nextNode: Element | null = startNode;
		let headTag = headNode.firstElementChild?.tagName;

		if (!headTag || !this.order.includes(headTag))
			return contents;

		while (nextNode) {
			let currentTag = nextNode.firstElementChild?.tagName;
			if (currentTag && this.order.includes(currentTag) && this.order.indexOf(currentTag) <= this.order.indexOf(headTag))
				break;
			contents.push(nextNode);
			nextNode = nextNode.nextElementSibling;
		}

		return contents;
	}


	private clear() {
		// remove all classes
		for (let className in this.classes) {
			Array.from(document.getElementsByClassName(this.classes[className])).forEach(element => {
				element.classList.remove(this.classes[className]);
			});
		}
		this.focusHead = null;
		this.focusContents = [];
	}

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'clear-focus',
			name: 'Clear Focus',
			callback: () => {
				this.clear();
			}
		});

		this.addSettingTab(new FocusPluginSettingTab(this.app, this));


		this.observer = new MutationObserver(mutations => {
			mutations.forEach(mutation => {
				if (!this.focusHead) {
					this.clear();
					return;
				}
				if (mutation.addedNodes.length > 0) {
					let nextNode = this.focusContents[this.focusContents.length - 1]?.nextElementSibling ?? this.focusHead?.nextElementSibling;
					if (nextNode) {
						let newNodes = this.findContents(this.focusHead, nextNode);
						newNodes.forEach(node => {
							node.classList.remove(this.classes['dimmed']);
						});
						this.focusContents.push(...newNodes);
					}
					const allNodes = Array.from(document.getElementsByClassName('markdown-preview-section')[0].children);
					allNodes.forEach(node => {
						if (!this.focusContents.includes(node) && (node !== this.focusHead))
							node.classList.add(this.classes['dimmed']);
					});
				}
			});
		});

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.clear();
			this.observer.disconnect();
			let markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
			if (markdownView && markdownView.getMode() === 'preview') {
				console.log('focus-plugin: observing');
				this.observer.observe(document.getElementsByClassName('markdown-preview-section')[0], {
					childList: true,
				});
			}
		}));


		this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
			// only work under markdown preview
			const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!markdownView || (markdownView.getMode() !== 'preview') || !(evt.target instanceof Element))
				return;

			// restore
			const element = evt.target;
			if (this.settings.clearMethod === 'click-again') {
				if (element.parentElement && this.focusHead && (element.parentElement == this.focusHead)) {
					this.clear();
					return;
				}
			}
			else if (this.settings.clearMethod === 'click-outside') {
				if (element.classList.contains('markdown-preview-view')) {
					this.clear();
					return;
				}
			}

			// only work under headings for now
			// TODO: add support for lists, code blocks, etc.
			const block = element.parentElement;
			if (!block || !(element.hasAttribute('data-heading')))
				return;
			this.focusHead = block;

			// set nextNode focus
			let contents: Array<Element> = [];
			if (block.nextElementSibling)
				contents = this.findContents(block, block.nextElementSibling);

			[block, ...contents].forEach(content => {
				if (content.classList.contains(this.classes['dimmed'])) {
					content.addEventListener('animationend', () => {
						content.classList.remove(this.classes['focus-animation']);
					}, { once: true });
					content.classList.remove(this.classes['dimmed']);
					content.classList.add(this.classes['focus-animation']);
				}
			});
			this.focusContents = contents;

			// set nextNode dim
			const allNodes = Array.from(document.getElementsByClassName('markdown-preview-section')[0].children);
			allNodes.forEach(node => {
				if (!this.focusContents.includes(node) && (node !== this.focusHead)) {
					if (!node.classList.contains(this.classes['dimmed'])) {
						node.addEventListener('animationend', () => {
							node.classList.remove(this.classes['dim-animation']);
						}, { once: true });
						node.classList.add(this.classes['dim-animation']);
						node.classList.add(this.classes['dimmed']);
					}
				}
			});

		});
	}

	onunload() {
		this.observer.disconnect();
	}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FocusPluginSettingTab extends PluginSettingTab {
	plugin: FocusPlugin;

	constructor(app: App, plugin: FocusPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Focus and Highlight Settings' });

		new Setting(containerEl)
			.setName('Clear Method')
			.setDesc('How to clear the focused elements')
			.addDropdown(dropdown => dropdown.addOptions({
				'click-again': 'Click again',
				'click-outside': 'Click outside',
			})
				.setValue(this.plugin.settings.clearMethod)
				.onChange(async (value: FocusPluginSettings["clearMethod"]) => {
					this.plugin.settings.clearMethod = value;
					await this.plugin.saveSettings();
					console.log('focus-plugin: clear method changed to ' + value);
				}));
	}
}
