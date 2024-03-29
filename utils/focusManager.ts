import { FocusPluginLogger } from 'utils/log'
import { CachedMetadata } from 'obsidian';
import { FocusInfoBase, HeaderFocusInfo, ListFocusInfo, IntermediateFocusInfo, isHeaderFocusInfo, isListFocusInfo, isIntermediateFocusInfo } from 'utils/info';


export class FocusManager {
    paneInfo: WeakMap<Element, FocusInfoBase> = new WeakMap();
    classes: { [key: string]: string } = {
        'enabled': 'focus-plugin-enabled',
        'dimmed': 'focus-plugin-dimmed',
        'focus-animation': 'focus-plugin-focus-animation',
        'dim-animation': 'focus-plugin-dim-animation'
    }
    includeBody: boolean = true;
    observer: MutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                const pane = mutation.target as Element;
                const info = this.paneInfo.get(pane)
                if (!info) {
                    this.clear(pane, false);
                    return;
                }

                if (isIntermediateFocusInfo(info))
                    this.processIntermediate(pane, info, false);
                else
                    this.process(pane, info, false);
            }
        });
    });

    constructor() {
        this.init();
    }

    init() {
        this.clearAll();
        document.body.classList.add(this.classes['enabled']);
    }

    private dim(elements: Array<Element>, animation: boolean) {
        if (animation) {
            elements.forEach(element => {
                if (!element.classList.contains(this.classes['dimmed'])) {
                    element.addEventListener('animationend', () => {
                        element.classList.remove(this.classes['dim-animation']);
                    }, { once: true });
                    element.classList.add(this.classes['dim-animation']);
                }
            });
        }
        elements.forEach(element => element.classList.add(this.classes['dimmed']));
    }

    private undim(elements: Array<Element>, animation: boolean, children: boolean = true) {
        let dimmed_elements: Array<Element> = []
        elements.forEach(element => {
            if (element.classList.contains(this.classes['dimmed'])) 
                dimmed_elements.push(element);
            if (children)
                dimmed_elements.push(...Array.from(element.querySelectorAll(`.${this.classes['dimmed']}`)));

        });
        if (animation) {
            dimmed_elements.forEach(element => {
                if (element.classList.contains(this.classes['dimmed'])) {
                    element.addEventListener('animationend', () => {
                        element.classList.remove(this.classes['focus-animation']);
                    }, { once: true });
                    element.classList.add(this.classes['focus-animation']);
                }
            });
        }
        dimmed_elements.forEach(element => element.classList.remove(this.classes['dimmed']));
    }

    private process(pane: Element, info: FocusInfoBase, animation: boolean) {
        // undim block
        if (isHeaderFocusInfo(info)) {
            this.undim([info.block], animation);
        }
        else if (isListFocusInfo(info)) {
            this.undim([info.block], animation, false);
        }
        else {
            FocusPluginLogger.log('Error', 'Unknown focus info type');
        }

        if (isHeaderFocusInfo(info)) {
            [info.block, ...info.body].forEach(element => {
                let cursor: Element | null = element.nextElementSibling;
                let cursorTag: string | undefined;
                while (cursor !== null) {
                    cursorTag = cursor.firstElementChild?.tagName;
                    // TODO: create a priority and check function for tags
                    if (cursorTag && cursorTag.match(/^H[1-6]$/)) {
                        if (this.includeBody && cursorTag > info.type)
                            info.content.add(cursor);
                        break;
                    }
                    info.body.add(cursor);
                    cursor = cursor.nextElementSibling;
                }
            });
            info.content.forEach(element => {
                let cursor: Element | null = element.nextElementSibling;
                let cursorTag: string | undefined;
                while (cursor !== null) {
                    cursorTag = cursor.firstElementChild?.tagName;
                    if (cursorTag && (cursorTag.match(/^H[1-6]$/) && (cursorTag <= info.type)))
                        break;
                    info.content.add(cursor);
                    cursor = cursor.nextElementSibling;
                }
            });
            this.undim([...info.body, ...info.content], animation);
            this.dim(Array.from(pane.children || []).filter(element => (element !== info.block) && !info.body.has(element) && !(info.content.has(element))), animation);
        }
        else if (isListFocusInfo(info)) {
            // undim target
            this.undim([info.target], animation);
            // dim siblings
            this.dim(Array.from(info.target.parentElement?.children || []).filter(element => (element !== info.target)), animation);
            this.dim(Array.from(pane.children || []).filter(element => (element !== info.block)), animation);
        }
    }
        
    private processIntermediate(pane: Element, info: IntermediateFocusInfo, animation: boolean = true): boolean {
        // undim
        if (info.metadata) {
            const after = [info.block, ...info.after];
            for (const element of after) {
                if (element.nextElementSibling !== null) {
                    let cursor: Element | null = element;
                    while (cursor !== null) {
                        if (cursor.firstElementChild?.tagName.match(/^H[1-6]$/)) {
                            let headings = info.metadata.headings || [];
                            let headingIndex = headings.map(heading => heading.heading).indexOf(cursor.firstElementChild.getAttribute('data-heading') as string);

                            if (headingIndex === -1)
                                FocusPluginLogger.log('Error', `Heading '${cursor.firstElementChild.getAttribute('data-heading')}' not found in metadata`);

                            if (info.level === null) {
                                if (headingIndex === 0)
                                    info.level = 0;
                                else {
                                    let prevHeading = headings[headingIndex - 1];
                                    info.level = prevHeading.level;
                                }
                            }

                            if (headings[headingIndex].level >= info.level) {
                                break;
                            }
                            
                            info.after.add(info.block);
                            break;
                        }
                        info.after.add(cursor);
                        this.undim([cursor], animation);
                        cursor = cursor.nextElementSibling;
                    }
                }
            };
            
            const before = [info.block, ...info.before];
            for (const element of before) {
                if (element.previousElementSibling !== null) {
                    let cursor: Element | null = element.previousElementSibling;
                    while (cursor !== null) {
                        if (cursor.firstElementChild?.hasAttribute('data-heading')) {
                            let focusInfo: HeaderFocusInfo = {
                                type: cursor.firstElementChild.tagName,
                                block: cursor,
                                body: new Set(),
                                content: new Set()
                            };
                            this.focus(pane, focusInfo);
                            return true;
                        }
                        info.before.add(cursor);
                        this.undim([cursor], animation);
                        cursor = cursor.previousElementSibling;
                    }
                    
                }
            }
        }
        
        // dim siblings
        this.dim(Array.from(pane.children || []).filter(element => element !== info.block && !info.before.has(element) && !info.after.has(element)), animation);
        return false
    }

    isSameFocus(pane: Element, info: FocusInfoBase): boolean {
        const currentFocus = this.paneInfo.get(pane);
        if (!currentFocus)
            return false;
        
        else if (isHeaderFocusInfo(currentFocus)) {
            if (isHeaderFocusInfo(info))
                return currentFocus.block === info.block;
            else if (isIntermediateFocusInfo(info))
                return currentFocus.body.has(info.block);
            else
                return false;
        }
        else if (isListFocusInfo(currentFocus))
            return isListFocusInfo(info) && currentFocus.target === info.target;
        else if (isIntermediateFocusInfo(currentFocus) ) 
            return currentFocus.block === info.block || currentFocus.before.has(info.block) || currentFocus.after.has(info.block);
        else
            return false;
    }

    focus(pane: Element, info: FocusInfoBase) {

        if (isIntermediateFocusInfo(info)) {
            if (info.metadata === null) {
                this.undim([info.block], true);
                this.dim(Array.from(info.block.parentElement?.children || []).filter(element => (element !== info.block)), true);
                this.paneInfo.set(pane, info);
            }
            else {
                if (!this.processIntermediate(pane, info))
                    this.paneInfo.set(pane, info);
            }
        }
        else {
            this.process(pane, info, true);
            this.paneInfo.set(pane, info);
        }
        this.observer.observe(pane, { childList: true });
    }

    changePane(pane: Element) {
        if (!this.paneInfo.has(pane))
            return;
        this.observer.observe(pane, { childList: true });   
    }

    getFocus(pane: Element): FocusInfoBase | undefined {
        return this.paneInfo.get(pane);
    }

    clear(pane: Element, animation: boolean = true) {
        this.undim(Array.from(pane.querySelectorAll(`.${this.classes['dimmed']}`)), animation);
        this.paneInfo.delete(pane);
    }

    clearAll(animation: boolean = false) {
        this.undim(Array.from(document.querySelectorAll(`.${this.classes['dimmed']}`)), animation);
        this.paneInfo = new WeakMap();
    }

    destroy() {
        this.clearAll();
        document.body.classList.remove(this.classes['enabled']);
    }
}