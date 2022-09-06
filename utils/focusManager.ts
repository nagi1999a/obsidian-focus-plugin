import { FocusInfoBase, FocusInfo, supportTags, IntermediateFocusInfo } from 'utils/types'
import { FocusPluginLogger } from 'utils/log'
import { CachedMetadata } from 'obsidian';
import { isFocusInfo, isIntermediateFocusInfo } from 'utils/info';


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
                if (!this.paneInfo.has(pane)) {
                    this.clear(pane);
                    return;
                }

                const info = this.paneInfo.get(pane);
                
                if (isFocusInfo(info)) {
                    switch (info.type) {
                        case 'H1':
                        case 'H2':
                        case 'H3':
                        case 'H4':
                        case 'H5':
                        case 'H6':
                            // undim
                            [info.block, ...info.body].forEach(element => {
                                if (element.nextElementSibling !== null) {
                                    let newNodes = this.findBody(info.type, element.nextElementSibling);
                                    this.undim(newNodes, false);
                                    newNodes.forEach(el => info.body.add(el));
                                }
                            })

                            break;
                        
                        case 'LI':
                            // no need to undim, since the all the body elements will be children of the target element
                            
                            // dim siblings
                            this.dim(Array.from(info.target.parentElement?.children || []).filter(element => element !== info.target), false);

                            break;
                        default:
                            FocusPluginLogger.log('Error', 'Unknown focus type');
                            break;
                    }
                    // dim other blocks

                    this.dim(Array.from(pane.children || []).filter(element => (element !== info.block) && !(info.body.has(element))), false);
                }
                else if (isIntermediateFocusInfo(info)) {
                    this.processIntermediate(pane, info, false);
                }
                else
                    return
                
                
            }
        });
    });

    constructor() {
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

    private findBody(headTag: string, startElement: Element): Array<Element> {
        let body: Array<Element> = [];
        let cursor: Element | null = startElement;
        let cursorTag: string | undefined;
        while (cursor !== null) {
            cursorTag = cursor.firstElementChild?.tagName;
            if (this.includeBody && cursorTag && supportTags.includes(cursorTag) && supportTags.indexOf(cursorTag) <= supportTags.indexOf(headTag))
                break;
            else if (!this.includeBody && cursorTag && supportTags.includes(cursorTag))
                break;
            body.push(cursor);
            cursor = cursor.nextElementSibling;
        }

        return body;
    }

    private processIntermediate(pane: Element, info: IntermediateFocusInfo, animation: boolean = true) {
        // undim
        [info.target, ...info.after].forEach(element => {
            if (element.nextElementSibling !== null) {
                let cursor: Element | null = element.nextElementSibling;
                while (cursor !== null) {
                    if (cursor.firstElementChild?.hasAttribute('data-heading')) {
                        let headings = info.metadata?.headings || [];
                        let headingIndex = headings.map(heading => heading.heading).indexOf(cursor.firstElementChild.getAttribute('data-heading') as string);

                        if (headingIndex === -1)
                            FocusPluginLogger.log('Error', 'Heading not found in metadata');

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
                        
                        info.after.add(info.target);
                        break;
                    }
                    info.after.add(cursor);
                    this.undim([cursor], true);
                    cursor = cursor.nextElementSibling;
                }
            }
        });

        [info.target, ...info.before].forEach(element => {
            if (element.previousElementSibling !== null) {
                let cursor: Element | null = element.previousElementSibling;
                while (cursor !== null) {
                    if (cursor.firstElementChild?.hasAttribute('data-heading')) {
                        let focusInfo: FocusInfo = {
                            type: cursor.firstElementChild.tagName,
                            block: cursor,
                            target: cursor.firstElementChild,
                            body: new Set()
                        };
                        console.log(focusInfo);

                        this.focus(pane, focusInfo);
                        break;
                    }
                    info.before.add(cursor);
                    this.undim([cursor], true);
                    cursor = cursor.previousElementSibling;
                }
                
            }
        });
        // dim siblings
        if (isIntermediateFocusInfo(this.paneInfo.get(pane)))
            this.dim(Array.from(pane.children || []).filter(element => element !== info.target && !info.before.has(element) && !info.after.has(element)), true);
    }

    focus(pane: Element, info: FocusInfo) {
        let body: Array<Element> = [];
        switch (info.type) {
            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6':
                // undim
                body = (info.block.nextElementSibling) ? this.findBody(info.type, info.block.nextElementSibling) : [];
                this.undim([info.block, ...body], true);
                info.body = new Set(body);

                break;

            case 'LI':
                // undim
                this.undim([info.target], true);
                this.undim([info.block], true, false);

                // dim siblings
                this.dim(Array.from(info.target.parentElement?.children || []).filter(element => element !== info.target), true);

                break;

            default:
                FocusPluginLogger.log('Error', 'Unknown focus type');
                break;
        }

        // dim other blocks
        this.dim(Array.from(pane.children || []).filter(element => (element !== info.block) && !(info.body.has(element))), true);
        
        this.paneInfo.set(pane, info);
        this.observer.observe(pane, { childList: true });
    }

    focusContent(pane: Element, content: IntermediateFocusInfo) {
        if (content.metadata === null) {
            this.undim([content.target], true);
            this.dim(Array.from(content.target.parentElement?.children || []).filter(element => (element !== content.target)), true);
            this.paneInfo.set(pane, content);
        }
        else {
            this.processIntermediate(pane, content);
            this.paneInfo.set(pane, content);
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

    clear(pane: Element) {
        this.undim(Array.from(pane.querySelectorAll(`.${this.classes['dimmed']}`)), true);
        this.paneInfo.delete(pane);
    }

    clearAll() {
        this.paneInfo = new WeakMap();
    }

    destroy() {
        this.clearAll();
        document.body.classList.remove(this.classes['enabled']);
    }
}