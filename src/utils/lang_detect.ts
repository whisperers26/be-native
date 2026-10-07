import { fetch, Body } from '@tauri-apps/api/http';
import { invoke } from '@tauri-apps/api';
import { store } from './store';
import { v4 as uuidv4 } from 'uuid';

// https://fanyi-api.baidu.com/product/113
async function baidu_detect(text: string) {
    const lang_map: Record<string, string> = {
        zh: 'zh_cn',
        cht: 'zh_tw',
        en: 'en',
        jp: 'ja',
        kor: 'ko',
        fra: 'fr',
        spa: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt: 'pt_pt',
        vie: 'vi',
        id: 'id',
        th: 'th',
        may: 'ms',
        ar: 'ar',
        hi: 'hi',
        nob: 'nb_no',
        nno: 'nn_no',
        per: 'fa',
        ukr: 'uk'
    };
    let res = await fetch<{ lan?: string }>('https://fanyi.baidu.com/langdetect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: Body.form({
            query: text,
        }),
    });
    if (res.ok) {
        let result = res.data;
        if (result.lan && result.lan in lang_map) {
            return lang_map[result.lan];
        }
    }
    return null;
}
// 腾讯只支持这么多语言
// https://cloud.tencent.com/document/product/551/15619
async function tencent_detect(text: string) {

    const lang_map: Record<string, string> = {
        zh: 'zh_cn',
        en: 'en',
        ja: 'ja',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt: 'pt_pt',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
    };
    let res = await fetch<{ translate?: { source?: string } }>('https://fanyi.qq.com/api/translate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: Body.form({
            sourceText: text,
        }),
    });
    if (res.ok) {
        let result = res.data;
        if (result.translate && result.translate.source && result.translate.source in lang_map) {
            return lang_map[result.translate.source];
        }
    }
    return null;
}
// https://cloud.google.com/translate/docs/languages?hl=zh-cn
async function google_detect(text: string) {
    const lang_map: Record<string, string> = {
        'zh-CN': 'zh_cn',
        'zh-TW': 'zh_tw',
        ja: 'ja',
        en: 'en',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt: 'pt_pt',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
        mn: 'mn_cy',
        km: 'km',
        fa: 'fa',
        no: 'nb_no',
        uk: 'uk'
    };
    let res = await fetch<[unknown, unknown, string?]>(
        `https://translate.google.com/translate_a/single?dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t`,
        {
            method: 'GET',
            headers: { 'content-type': 'application/json' },
            query: {
                client: 'gtx',
                sl: 'auto',
                tl: 'zh-CN',
                hl: 'zh-CN',
                ie: 'UTF-8',
                oe: 'UTF-8',
                otf: '1',
                ssel: '0',
                tsel: '0',
                kc: '7',
                q: text,
            },
        }
    );
    if (res.ok) {
        const result = res.data;
        if (result[2] && result[2] in lang_map) {
            return lang_map[result[2]];
        }
    }
    return null;
}
// https://niutrans.com/documents/contents/trans_text#languageList
async function niutrans_detect(text: string) {
    const lang_map: Record<string, string> = {
        zh: 'zh_cn',
        cht: 'zh_cn',
        en: 'en',
        ja: 'ja',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt: 'pt_pt',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
        mn: 'mn_cy',
        mo: 'mn_mo',
        km: 'km',
        nb: 'nb_no',
        nn: 'nn_no',
        fa: 'fa',
        uk: 'uk'
    };
    let res = await fetch<{ language?: string }>('https://test.niutrans.com/NiuTransServer/language', {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        query: {
            src_text: text,
            source: 'text',
            time: new String(new Date().getTime()),
        },
    });
    if (res.ok) {
        const result = res.data;
        if (result['language'] && result['language'] in lang_map) {
            return lang_map[result['language']];
        }
    }
    return null;
}
// https://yandex.com/dev/translate/doc/en/concepts/api-overview
async function yandex_detect(text: string) {
    const lang_map: Record<string, string> = {
        zh: 'zh_cn',
        en: 'en',
        ja: 'ja',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt: 'pt_pt',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
        no: 'nb_no',
        fa: 'fa',
        uk: 'uk'
    };

    let res = await fetch<{ lang?: string }>('https://translate.yandex.net/api/v1/tr.json/detect', {
        method: 'GET',
        query: {
            id: uuidv4().replaceAll('-', '') + '-0-0',
            srv: 'android',
            text: text,
        },
    });
    if (res.ok) {
        const result = res.data;
        if (result['lang'] && result['lang'] in lang_map) {
            return lang_map[result['lang']];
        }
    }
    return null;
}
// https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
async function bing_detect(text: string) {
    const lang_map: Record<string, string> = {
        'zh-Hans': 'zh_cn',
        'zh-Hant': 'zh_tw',
        en: 'en',
        ja: 'ja',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        'pt-pt': 'pt_pt',
        pt: 'pt_br',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
        'mn-Cyrl': 'mn_cy',
        'mn-Mong': 'mn_mo',
        km: 'km',
        nb: 'nb_no',
        fa: 'fa',
        uk: 'uk'
    };
    const token_url = 'https://edge.microsoft.com/translate/auth';

    let token = await fetch(token_url, {
        method: 'GET',
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42',
        },
        responseType: 2,
    });
    if (token.ok) {
        const url = 'https://api-edge.cognitive.microsofttranslator.com/detect';

        let res = await fetch<{ language?: string }[]>(url, {
            method: 'POST',
            headers: {
                accept: '*/*',
                'accept-language': 'zh-TW,zh;q=0.9,ja;q=0.8,zh-CN;q=0.7,en-US;q=0.6,en;q=0.5',
                authorization: 'Bearer ' + token.data,
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'sec-ch-ua': '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                Referer: 'https://appsumo.com/',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42',
            },
            query: {
                'api-version': '3.0',
            },
            body: { type: 'Json', payload: [{ Text: text }] },
        });

        if (res.ok) {
            let result = res.data;
            if (result[0].language && result[0].language in lang_map) {
                return lang_map[result[0].language];
            }
        }
    }
    return null;
}

async function local_detect(text: string) {
    return await invoke<string>('lang_detect', { text: text });
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
// A run of letters of any other script: a word
const OTHER_WORD = /[^\P{L}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;
// About how many Chinese, Japanese or Korean characters make a word
const CJK_PER_WORD = 2;

// The part of the text to detect the language of. The engines call a text Chinese (or Japanese, or Korean) even
// when it is mostly in another script with a little Chinese in it, so such a text is detected without that part.
function textToDetect(text: string) {
    const cjkWords = (text.match(CJK)?.length ?? 0) / CJK_PER_WORD;
    const otherWords = text.match(OTHER_WORD)?.length ?? 0;
    if (cjkWords > 0 && otherWords > cjkWords) {
        return text.replace(CJK, '');
    }
    return text;
}

/** A detected language, as an app code. */
export interface Detection {
    language: string;
    /** The web engine could not be asked, or gave no language the app knows; `language` is then `en`. */
    failed: boolean;
}

// The language a web engine found, or null when it found none the app knows
function webDetect(engine: unknown, text: string): Promise<string | null> | null {
    switch (engine) {
        case 'baidu':
            return baidu_detect(text);
        case 'google':
            return google_detect(text);
        case 'tencent':
            return tencent_detect(text);
        case 'niutrans':
            return niutrans_detect(text);
        case 'yandex':
            return yandex_detect(text);
        case 'bing':
            return bing_detect(text);
        default:
            return null;
    }
}

/** Detect the language of a text, and say whether the web engine failed and `en` stands in for its answer. */
export async function detectLanguage(text: string): Promise<Detection> {
    text = textToDetect(text);
    let langDetectEngine = (await store.get('translate_detect_engine')) ?? 'local';

    const web = webDetect(langDetectEngine, text);
    if (web === null) {
        return { language: await local_detect(text), failed: false };
    }
    // A request that cannot be made (no network) is a failure like any other
    const language = await web.catch(() => null);
    return { language: language ?? 'en', failed: language === null };
}

export default async function detect(text: string) {
    return (await detectLanguage(text)).language;
}
