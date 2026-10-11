import { fetch } from '@tauri-apps/api/http';
import type { TtsOptions } from '../../../types/service';

export async function tts(
    text: string,
    lang: string,
    _options: TtsOptions = {} as TtsOptions
): Promise<number[] | undefined> {
    // responseType 3 is binary: the reply is the MP3 bytes as a number array.
    const res = await fetch<number[]>('https://dict.youdao.com/dictvoice', {
        method: 'GET',
        responseType: 3,
        query: {
            audio: text,
            le: lang,
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
