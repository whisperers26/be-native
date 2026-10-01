import { fetch } from '@tauri-apps/api/http';
import { nanoid } from 'nanoid';
import md5 from 'md5';
import type { TranslateOptions, TranslateResult } from '../../../types/service';

interface BaiduFieldResponse {
    trans_result?: { dst: string }[];
}

export async function translate(
    text: string,
    from: string,
    to: string,
    options: TranslateOptions = {} as TranslateOptions
): Promise<TranslateResult> {
    const { config } = options;

    const { appid, secret, field } = config;

    const url = 'https://fanyi-api.baidu.com/api/trans/vip/fieldtranslate';

    const salt = nanoid();
    if (appid === '' || secret === '') {
        throw 'Please configure appid and secret';
    }

    const str = appid + text + salt + field + secret;
    const sign = md5(str);

    // @ts-expect-error Tauri's FetchOptions requires a method, but fetch defaults to GET without one
    let res = await fetch<BaiduFieldResponse>(url, {
        query: {
            q: text,
            from: from,
            to: to,
            appid: appid,
            salt: salt,
            sign: sign,
            domain: field,
        },
    });

    if (res.ok) {
        let result = res.data;
        let target = '';

        const { trans_result } = result;
        if (trans_result) {
            for (let i in trans_result) {
                target = target + trans_result[i]['dst'] + '\n';
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
