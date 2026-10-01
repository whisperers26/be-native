import { fetch, Body } from '@tauri-apps/api/http';
import type { TranslateOptions, TranslateResult } from '../../../types/service';

interface CaiyunResponse {
    target: string[];
}

export async function translate(
    text: string,
    from: string,
    to: string,
    options: TranslateOptions = {} as TranslateOptions
): Promise<TranslateResult> {
    const { config } = options;

    const { token } = config;

    const url = 'https://api.interpreter.caiyunai.com/v1/translator';

    if (token === '') {
        throw 'Please configure token';
    }

    const body = {
        source: [text],
        trans_type: `${from}2${to}`,
        request_id: 'demo',
        detect: true,
    };

    const headers = {
        'content-type': 'application/json',
        'x-authorization': 'token ' + token,
    };

    let res = await fetch<CaiyunResponse>(url, {
        method: 'POST',
        headers: headers,
        body: Body.json(body),
    });

    if (res.ok) {
        let result = res.data;
        const { target } = result;
        if (target[0]) {
            return target[0];
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
