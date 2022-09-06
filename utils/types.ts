import { CachedMetadata } from "obsidian";

// ref: https://github.com/microsoft/TypeScript/issues/28046
export const supportTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'];

export interface FocusInfoBase {
    target: Element;
    type: string;
}

export interface FocusInfo extends FocusInfoBase {
    block: Element;
    body: Set<Element>;
}

export interface IntermediateFocusInfo extends FocusInfoBase {
    before: Set<Element>;
    after: Set<Element>;
    metadata: CachedMetadata | null;
    type: 'UNKNOWN';
    level: number | null;
}