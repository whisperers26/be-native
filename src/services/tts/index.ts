import * as _lingva_tts from './lingva';
import type { TtsService } from '../../types/service';

// `satisfies` checks each module against the contract in src/types/service.ts and emits nothing.
export const lingva_tts = _lingva_tts satisfies TtsService;
