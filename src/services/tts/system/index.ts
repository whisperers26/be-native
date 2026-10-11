import { invoke } from '@tauri-apps/api';
import type { TtsOptions } from '../../../types/service';

// Runs the OS speech engine on this machine, so it needs no network and no key. The audio comes back as bytes.
export async function tts(
    text: string,
    lang: string,
    _options: TtsOptions = {} as TtsOptions
): Promise<number[] | undefined> {
    return await invoke<number[]>('system_tts', { text, lang });
}

export * from './Config';
export * from './info';
