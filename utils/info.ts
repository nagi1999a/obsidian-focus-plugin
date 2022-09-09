import { FocusPluginLogger } from 'utils/log'
import { CachedMetadata } from "obsidian";
export interface FocusInfoBase {
    block: Element;
    type: string;
}

export interface HeaderFocusInfo extends FocusInfoBase {
    body: Set<Element>;
}

export interface ListFocusInfo extends FocusInfoBase {
    target: Element;
}

export interface IntermediateFocusInfo extends FocusInfoBase {
    before: Set<Element>;
    after: Set<Element>;
    metadata: CachedMetadata | null;
    level: number | null;
}

export function isHeaderFocusInfo(info: FocusInfoBase | undefined | null): info is HeaderFocusInfo {
    return !!info && info.type.startsWith('H');
}

export function isListFocusInfo(info: FocusInfoBase | undefined | null): info is ListFocusInfo {
    return !!info && info.type === 'LI';
}

export function isIntermediateFocusInfo(info: FocusInfoBase | undefined | null): info is IntermediateFocusInfo {
    return !!info && info.type === 'UNKNOWN';
}

export function toIntermediateFocusInfo(info: FocusInfoBase): IntermediateFocusInfo {
    return {
        block: info.block,
        type: 'UNKNOWN',
        before: new Set(),
        after: new Set(),
        metadata: null,
        level: null
    }
}

export function getFocusInfo(el: Element): HeaderFocusInfo | ListFocusInfo | IntermediateFocusInfo | null {
    let focusType: string | null = null;
    let focusBlock: Element | null = null;
    let focusTarget: Element | null = null;

    let cursor: Element | null = el;
    while ((cursor !== null) && !(cursor.hasClass('markdown-preview-section'))) {
        if (cursor.tagName.match(/^H[1-6]$/)) {
            focusType = cursor.tagName;
        }
        else if (cursor.tagName === 'LI') {
            focusType = 'LI';
            focusTarget = cursor;
        }

        if (cursor.parentElement?.hasClass('markdown-preview-section')) {
            focusBlock = cursor;
            break;
        }

        cursor = cursor.parentElement;
    }

    if (focusBlock === null)
        return null;
    
    if (focusType === null) 
        return {
            before: new Set(),
            after: new Set(),
            block: focusBlock,
            type: 'UNKNOWN',
            metadata: null,
            level: null
        }
    else if (focusType.match(/^H[1-6]$/))
        return {
            block: focusBlock,
            type: focusType,
            body: new Set()
        }
    else if (focusType === 'LI')
        return {
            block: focusBlock,
            type: focusType,
            target: focusTarget as Element,
            body: new Set()
        }
    else
        FocusPluginLogger.log('Error', `Unexpected focus type: ${focusType}`);
        return null;
}