import { fetch, Body } from '@tauri-apps/api/http';
import type { TranslateResult } from '../../../types/service';

interface LingvaResponse {
    translation?: string;
}

export async function translate(text: string, from: string, to: string): Promise<TranslateResult> {
    let plain_text = text.replaceAll('/', '@@');
    let encode_text = encodeURIComponent(plain_text);
    const res = await fetch<LingvaResponse>(`https://lingva.pot-app.com/api/v1/${from}/${to}/${encode_text}`, {
        method: 'GET',
    });

    if (res.ok) {
        let result = res.data;
        const { translation } = result;
        if (translation) {
            return translation.replaceAll('@@', '/');
        } else {
            // @ts-expect-error known bug (known-issues.md): result is the response object, which has no trim
            throw JSON.stringify(result.trim());
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
