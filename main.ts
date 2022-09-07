import { App, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FocusManager } from 'utils/focusManager';
import { getFocusInfo, isHeaderFocusInfo, isIntermediateFocusInfo, isListFocusInfo } from 'utils/info';
import { FocusPluginLogger } from 'utils/log';
interface FocusPluginSettings {
	clearMethod: 'click-again' | 'click-outside';
	contentBehavior: 'element' | 'content' | 'none';
	focusScope: 'block' | 'content';
	enableList: boolean;
}

const DEFAULT_SETTINGS: FocusPluginSettings = {
	clearMethod: 'click-again',
	contentBehavior: 'none',
	focusScope: 'content',
	enableList: false,
}

interface PaneState {
	mode: string;
	head: Element;
}

export default class FocusPlugin extends Plugin {
	settings: FocusPluginSettings;
	focusManager: FocusManager = new FocusManager();

	private getPaneState(): PaneState | null {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
			return null;

		return {
			mode: view.getMode(),
			head: view.contentEl.querySelector('.markdown-preview-section') as Element
		}
	}

	async onload() {

		await this.loadSettings();

		this.addCommand({
			id: 'clear-focus',
			name: 'Clear Focus',
			callback: () => {
				this.focusManager.clearAll();
			}
		});

		this.addSettingTab(new FocusPluginSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('layout-change', () => {

			let paneState = this.getPaneState();
			if (!paneState || paneState.mode !== 'preview')
				return;

			this.focusManager.clear(paneState.head);
		}));

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {

			let paneState = this.getPaneState();
			if (!paneState || paneState.mode !== 'preview')
				return;

			this.focusManager.changePane(paneState.head);
		}));

		this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {

			if (!(evt.target instanceof Element))
				return;

			let paneState = this.getPaneState();
			if (!paneState || paneState.mode !== 'preview')
				return;

			let focusInfo = getFocusInfo(evt.target)
			if (!focusInfo)
				return;

			let currentFocus = this.focusManager.getFocus(paneState.head);
			if (currentFocus !== undefined) {
				switch (this.settings.clearMethod) {
					case 'click-again':
						if (this.focusManager.isSameFocus(focusInfo, currentFocus)) {
							this.focusManager.clear(paneState.head);
							return;
						}
						break;
					case 'click-outside':
						if (evt.target.classList.contains('markdown-preview-view')) {
							this.focusManager.clear(paneState.head);
							return;
						}
						break;
				}
			}

			if (isIntermediateFocusInfo(focusInfo)) {
				let activeFile = this.app.workspace.getActiveFile();
				let metadata = activeFile !== null ? this.app.metadataCache.getFileCache(activeFile) : null;
				if (metadata) {
					switch (this.settings.contentBehavior) {
						case 'content':
							focusInfo.metadata = metadata;
						case 'element':
							this.focusManager.focus(paneState.head, focusInfo);
							break;
						default:
							break;
					}
				}
				else {
					FocusPluginLogger.log('Error', 'No metadata found for active file');
				}
			}
			else if (isHeaderFocusInfo(focusInfo))
				this.focusManager.focus(paneState.head, focusInfo);
			else if (isListFocusInfo(focusInfo) && this.settings.enableList)
				this.focusManager.focus(paneState.head, focusInfo);
		});


	}

	onunload() {
		this.focusManager.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.focusManager.includeBody = this.settings.focusScope === 'content';
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.focusManager.includeBody = this.settings.focusScope === 'content';
		this.focusManager.clearAll();
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
					FocusPluginLogger.log('Debug', 'clear method changed to ' + value);
				}));

		new Setting(containerEl)
			.setName('Focus Scope')
			.setDesc('What to focus when clicking')
			.addDropdown(dropdown => dropdown.addOptions({
				'block': 'Only one block',
				'content': 'Also the content'
			})
				.setValue(this.plugin.settings.focusScope)
				.onChange(async (value: FocusPluginSettings["focusScope"]) => {
					this.plugin.settings.focusScope = value;
					await this.plugin.saveSettings();
					FocusPluginLogger.log('Debug', 'focus scope changed to ' + value);
				}));

		new Setting(containerEl)
			.setName('Content Behavior')
			.setDesc('What to do when clicking on the content elements, e.g. pure text, callout block')
			.addDropdown(dropdown => dropdown.addOptions({
				'element': 'Only focus on the element',
				'content': 'Focus related contents',
				'none': 'Do nothing'

			})
				.setValue(this.plugin.settings.contentBehavior)
				.onChange(async (value: FocusPluginSettings["contentBehavior"]) => {
					this.plugin.settings.contentBehavior = value;
					await this.plugin.saveSettings();
					FocusPluginLogger.log('Debug', 'content behavior changed to ' + value);
				}));

		new Setting(containerEl)
			.setName('Enable List')
			.setDesc('Focus on the list item (experimental, only works on the first level list)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableList)
				.onChange(async (value: FocusPluginSettings["enableList"]) => {
					this.plugin.settings.enableList = value;
					await this.plugin.saveSettings();
					FocusPluginLogger.log('Debug', 'enable list changed to ' + value);
				}));
	}
}
