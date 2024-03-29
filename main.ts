import { App, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FocusManager } from 'utils/focusManager';
import { getFocusInfo, isHeaderFocusInfo, isIntermediateFocusInfo, isListFocusInfo, toIntermediateFocusInfo } from 'utils/info';
import { FocusPluginLogger } from 'utils/log';
interface FocusPluginSettings {
	clearMethod: 'click-again' | 'click-outside';
	contentBehavior: 'element' | 'content' | 'none';
	focusScope: 'block' | 'content';
	enableList: boolean;
	focusSensitivity: number;
	indicator: boolean;
	isEnabled: boolean;
}

const DEFAULT_SETTINGS: FocusPluginSettings = {
	clearMethod: 'click-again',
	contentBehavior: 'none',
	focusScope: 'content',
	enableList: false,
	focusSensitivity: 1600,
	indicator: true,
	isEnabled: true,
}

interface PaneState {
	mode: string;
	head: Element;
}

export default class FocusPlugin extends Plugin {
	settings: FocusPluginSettings;
	focusManager: FocusManager = new FocusManager();
	lastClick: number = 0;
	indicator: HTMLElement | null = null;
	indicatorEl: HTMLElement = document.createElement("div");

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

		this.addCommand({
			id: 'toggle-focus-mode',
			name: 'Toggle Focus Mode',
			callback: () => {
				this.toggle();
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

		this.registerDomEvent(document, 'pointerdown', (evt: PointerEvent) => {
			this.lastClick = evt.timeStamp;
		})

		this.registerDomEvent(document, 'pointerup', (evt: MouseEvent) => {
			if (!this.settings.isEnabled)
				return;

			if (evt.timeStamp - this.lastClick > this.settings.focusSensitivity)
				return;

			if (!(evt.target instanceof Element))
				return;

			let paneState = this.getPaneState();
			if (!paneState || paneState.mode !== 'preview')
				return;

			let focusInfo = getFocusInfo(evt.target)

			// fallback to intermediate focus if list is disabled
			if (!this.settings.enableList && isListFocusInfo(focusInfo))
				focusInfo = toIntermediateFocusInfo(focusInfo);

			if (isIntermediateFocusInfo(focusInfo) && this.settings.contentBehavior === 'none')
				return;
			
			let currentFocus = this.focusManager.getFocus(paneState.head);
			if (currentFocus !== undefined) {
				switch (this.settings.clearMethod) {
					case 'click-again':
						if (focusInfo && this.focusManager.isSameFocus(paneState.head, focusInfo)) {
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
			else if (focusInfo != null)
				this.focusManager.focus(paneState.head, focusInfo);
		});
	}

	onunload() {
		this.focusManager.destroy();
	}

	private async settingsPreprocessor(settings: FocusPluginSettings) {
		this.focusManager.clearAll();
		this.focusManager.includeBody = settings.focusScope === 'content';

		if (settings.indicator && !this.indicator) {
			this.indicator = this.addStatusBarItem();
			this.indicator.appendChild(this.indicatorEl);
			this.indicator.classList.add('mod-clickable');
			this.indicator.onclick = () => this.toggle();
		}
		else if (!settings.indicator && this.indicator) {
			this.indicator.remove();
			this.indicator = null;
		}

		if (settings.isEnabled){
			this.indicatorEl.innerHTML = 'Focus: on';
			this.focusManager.init();
		}
		else {
			this.indicatorEl.innerHTML = 'Focus: off';
			this.focusManager.destroy();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		await this.settingsPreprocessor(this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.settingsPreprocessor(this.settings);
	}

	async toggle() {
		this.settings.isEnabled = !this.settings.isEnabled;
		await this.saveSettings();
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
			.setName('Enabled Focus Mode')
			.setDesc('Enable the focus feature')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isEnabled)
				.onChange(async (value: FocusPluginSettings["isEnabled"]) => {
					this.plugin.settings.isEnabled = value;
					await this.plugin.saveSettings();
					FocusPluginLogger.log('Debug', 'isEnable changed to ' + value);
				}));

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

		new Setting(containerEl)
		.setName('Enable Status Indicator')
		.setDesc('Show the status indicator in the status bar')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.indicator)
			.onChange(async (value: FocusPluginSettings["indicator"]) => {
				this.plugin.settings.indicator = value;
				await this.plugin.saveSettings();
				FocusPluginLogger.log('Debug', 'indicator changed to ' + value);
			}));

		new Setting(containerEl)
			.setName('Focus Sensitivity')
			.setDesc("Focus only when the mouse is 'not' still for a while (larger means longer)")
			.addSlider(slider => slider
				.setLimits(100, 10100, 500)
				.setValue(this.plugin.settings.focusSensitivity)
				.onChange(async (value: FocusPluginSettings["focusSensitivity"]) => {
					this.plugin.settings.focusSensitivity = value;
					await this.plugin.saveSettings();
					FocusPluginLogger.log('Debug', 'focus delay changed to ' + value);
				}));

	}
}
