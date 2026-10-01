import { fetch } from '@tauri-apps/api/http';
import type { TtsOptions } from '../../../types/service';

interface LingvaAudioResponse {
    audio?: number[];
}

export async function tts(
    text: string,
    lang: string,
    options: TtsOptions = {} as TtsOptions
): Promise<number[] | undefined> {
    const { config } = options;

    let { requestPath = 'lingva.pot-app.com' } = config;

    if (requestPath.length === 0) {
        requestPath = 'lingva.pot-app.com';
    }

    if (!requestPath.startsWith('http')) {
        requestPath = 'https://' + requestPath;
    }
    const res = await fetch<LingvaAudioResponse>(`${requestPath}/api/v1/audio/${lang}/${encodeURIComponent(text)}`);

    if (res.ok) {
        return res.data['audio'];
    }
}

export * from './Config';
export * from './info';
