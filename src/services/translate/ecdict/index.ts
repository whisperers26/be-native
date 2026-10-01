import { fetch, Body } from '@tauri-apps/api/http';
import type { DictionaryResult, TranslateResult } from '../../../types/service';

export async function translate(text: string, _from: string, _to: string): Promise<TranslateResult> {
    const res = await fetch<DictionaryResult>(`https://pot-app.com/api/dict`, {
        method: 'POST',
        body: Body.json({ text }),
    });

    if (res.ok) {
        let result = res.data;
        return result;
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
