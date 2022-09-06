import { FocusInfoBase, FocusInfo, supportTags, IntermediateFocusInfo } from 'utils/types'
import { FocusPluginLogger } from 'utils/log'

export function getFocusInfo(el: Element): IntermediateFocusInfo | FocusInfo | null {
    let focusTarget: Element | null = null;
    let focusBlock: Element | null = null;
    let focusType: string | null = null;

    let cursor: Element | null = el;
    while ((cursor !== null) && !(cursor.hasClass('markdown-preview-section'))) {
        if (supportTags.includes(cursor.tagName)) {
            focusTarget = cursor;
            focusType = cursor.tagName as typeof supportTags[number];
            break;
        }
        cursor = cursor.parentElement;
    }

    if (focusTarget === null || focusType === null)
        cursor = el;

    while ((cursor !== null) && (cursor.parentElement !== null)) {
        if (cursor.parentElement.hasClass('markdown-preview-section')) {
            focusBlock = cursor;
            break;
        }
        cursor = cursor.parentElement;
    }

    if (focusBlock === null)
        return null;

    if (focusTarget === null || focusType === null)
        return {
            before: new Set(),
            after: new Set(),
            target: focusBlock,
            type: 'UNKNOWN',
            metadata: null,
            level: null
        }
    else
        return {
            target: focusTarget,
            block: focusBlock,
            type: focusType,
            body: new Set()
        }
}

export function isFocusInfo(info: FocusInfoBase | null | undefined): info is FocusInfo {
    return info !== null && info !== undefined && supportTags.includes(info.type);
}

export function isIntermediateFocusInfo(info: FocusInfoBase | null | undefined): info is IntermediateFocusInfo {
    return info !== null && info !== undefined && info.type === 'UNKNOWN';
}