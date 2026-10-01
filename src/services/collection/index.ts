import * as _anki from './anki';
import * as _eudic from './eudic';
import type { CollectionOptions, ServiceModule, TranslateResult } from '../../types/service';

// What every module here provides (docs/agents/services.md); collection services have no Language.
// `satisfies` checks it and emits nothing.
type CollectionService = ServiceModule<{
    collection: (source: string, target: TranslateResult, options: CollectionOptions) => Promise<unknown>;
}>;

export const anki = _anki satisfies CollectionService;
export const eudic = _eudic satisfies CollectionService;
