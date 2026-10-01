import * as _lingva_tts from './lingva';
import type { ServiceModule, TtsOptions } from '../../types/service';

// What every module here provides (docs/agents/services.md). `satisfies` checks it and emits nothing.
type TtsService = ServiceModule<{
    Language: Record<string, string>;
    tts: (text: string, lang: string, options: TtsOptions) => Promise<number[] | undefined>;
}>;

export const lingva_tts = _lingva_tts satisfies TtsService;
