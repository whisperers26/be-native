import { fetch } from '@tauri-apps/api/http';
import type { TtsOptions } from '../../../types/service';

export async function tts(
    text: string,
    lang: string,
    options: TtsOptions = {} as TtsOptions
): Promise<number[] | undefined> {
    const { config } = options;

    let { custom_url } = config;

    if (custom_url === undefined || custom_url === '') {
        custom_url = 'https://translate.google.com';
    }
    if (!custom_url.startsWith('http')) {
        custom_url = 'https://' + custom_url;
    }

    // responseType 3 is binary: the reply is the MP3 bytes as a number array.
    const res = await fetch<number[]>(`${custom_url}/translate_tts`, {
        method: 'GET',
        responseType: 3,
        query: {
            ie: 'UTF-8',
            client: 'tw-ob',
            tl: lang,
            q: text,
        },
    });

    if (res.ok) {
        return res.data;
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}`;
    }
}

export * from './Config';
export * from './info';
