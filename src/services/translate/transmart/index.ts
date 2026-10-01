import { fetch, Body } from '@tauri-apps/api/http';
import type { TranslateOptions, TranslateResult } from '../../../types/service';

interface TransmartResponse {
    auto_translation?: string[];
}

export async function translate(
    text: string,
    from: string,
    to: string,
    options: TranslateOptions = {} as TranslateOptions
): Promise<TranslateResult> {
    const { config } = options;

    const { username: user, token } = config;

    let header: Record<string, string> = {};
    if (user !== '' && token !== '') {
        header['user'] = user;
        header['token'] = token;
    }

    const url = 'https://transmart.qq.com/api/imt';

    const res = await fetch<TransmartResponse>(url, {
        method: 'POST',
        body: Body.json({
            header: {
                fn: 'auto_translation',
                ...header,
            },
            type: 'plain',
            source: {
                lang: from,
                text_list: [text],
            },
            target: {
                lang: to,
            },
        }),
    });
    if (res.ok) {
        const result = res.data;
        if (result['auto_translation']) {
            let target = '';
            for (let line of result['auto_translation']) {
                target += line;
                target += '\n';
            }
            return target.trim();
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
