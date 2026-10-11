import * as _google_tts from './google';
import * as _lingva_tts from './lingva';
import * as _youdao_tts from './youdao';
import type { TtsService } from '../../types/service';

// `satisfies` checks each module against the contract in src/types/service.ts and emits nothing.
export const google_tts = _google_tts satisfies TtsService;
export const lingva_tts = _lingva_tts satisfies TtsService;
export const youdao_tts = _youdao_tts satisfies TtsService;
