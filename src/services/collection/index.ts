import * as _anki from './anki';
import * as _eudic from './eudic';
import type { CollectionService } from '../../types/service';

// `satisfies` checks each module against the contract in src/types/service.ts and emits nothing.
export const anki = _anki satisfies CollectionService;
export const eudic = _eudic satisfies CollectionService;
