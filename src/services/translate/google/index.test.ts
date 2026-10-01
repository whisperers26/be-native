import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { custom_url: '' };
const DT = 'dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t';

// What the endpoint returns for a sentence: translated segments, then a transliteration entry.
const sentenceResponse = [
    [
        ['你好，', 'Hello, ', null, null, 3],
        ['世界！ ', 'world! ', null, null, 3],
        [null, null, 'Nǐ hǎo, shìjiè!'],
    ],
    null,
    'en',
];

// What it returns for a word: the same first entry, then dictionary entries, and examples at index 13.
function wordResponse(parts: { translit?: boolean; examples?: boolean } = {}) {
    const response: any[] = [
        [['你好', 'hello', null, null, 10], ...(parts.translit === false ? [] : [[null, null, 'Nǐ hǎo', 'həˈləʊ']])],
        [
            [
                '感叹词',
                ['你好', '喂'],
                [
                    ['你好', ['hello', 'hi'], null, 0.5],
                    ['喂', ['hey'], null, 0.1],
                ],
                'hello',
                9,
            ],
            ['名词', ['招呼'], [['招呼', ['greeting'], null, 0.2]], 'hello', 9],
        ],
        'en',
    ];
    if (parts.examples !== false) {
        response[13] = [
            [
                ['<b>Hello</b> there!', null, null, null, 1],
                ['Say <b>hello</b> to her', null, null, null, 1],
            ],
        ];
    }
    return response;
}

describe('google translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('sentence: sends a GET to translate.google.com and joins the translated segments', async () => {
        httpMock.queue({ data: sentenceResponse });

        await expect(translate('Hello, world!', 'en', 'zh-CN', { config })).resolves.toBe('你好，世界！');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('word: returns the pronunciation, explanations and example sentences as a dictionary object', async () => {
        httpMock.queue({ data: wordResponse() });

        await expect(translate('hello', 'en', 'zh-CN', { config })).resolves.toEqual({
            pronunciations: [{ symbol: 'həˈləʊ', voice: '' }],
            explanations: [
                { trait: '感叹词', explains: ['你好', '喂'] },
                { trait: '名词', explains: ['招呼'] },
            ],
            associations: [],
            sentence: [{ source: '<b>Hello</b> there!' }, { source: 'Say <b>hello</b> to her' }],
        });
    });

    it('word: leaves pronunciations and sentences empty when the response has no symbol or examples', async () => {
        const response = wordResponse({ examples: false });
        response[0][1] = [null, null, 'Nǐ hǎo', null];
        httpMock.queue({ data: response });

        await expect(translate('hello', 'en', 'zh-CN', { config })).resolves.toEqual({
            pronunciations: [],
            explanations: [
                { trait: '感叹词', explains: ['你好', '喂'] },
                { trait: '名词', explains: ['招呼'] },
            ],
            associations: [],
            sentence: [],
        });
    });

    // Known sharp edge: result[0][1][3] is read without checking that result[0][1] exists.
    it('word: throws a TypeError when the response has dictionary entries but no transliteration entry', async () => {
        httpMock.queue({ data: wordResponse({ translit: false }) });

        await expect(translate('hello', 'en', 'zh-CN', { config })).rejects.toThrow(TypeError);
    });

    it('uses translate.google.com when the custom URL is empty or missing', async () => {
        httpMock.queue({ data: sentenceResponse }, { data: sentenceResponse });

        await translate('hi', 'en', 'de', { config: { custom_url: '' } });
        await translate('hi', 'en', 'de', { config: {} });

        expect(httpMock.calls.map((call) => call.url)).toEqual([
            `https://translate.google.com/translate_a/single?${DT}`,
            `https://translate.google.com/translate_a/single?${DT}`,
        ]);
    });

    it('prefixes https:// to a custom URL that does not start with http, and keeps one that does', async () => {
        httpMock.queue({ data: sentenceResponse }, { data: sentenceResponse }, { data: sentenceResponse });

        await translate('hi', 'en', 'de', { config: { custom_url: 'translate.example.com' } });
        await translate('hi', 'en', 'de', { config: { custom_url: 'http://localhost:9000' } });
        await translate('hi', 'en', 'de', { config: { custom_url: 'httpbin.example' } });

        expect(httpMock.calls.map((call) => call.url)).toEqual([
            `https://translate.example.com/translate_a/single?${DT}`,
            `http://localhost:9000/translate_a/single?${DT}`,
            // Any host that merely starts with "http" is taken to have a scheme.
            `httpbin.example/translate_a/single?${DT}`,
        ]);
    });

    it('does not strip a trailing slash from the custom URL', async () => {
        httpMock.queue({ data: sentenceResponse });

        await translate('hi', 'en', 'de', { config: { custom_url: 'https://translate.example.com/' } });

        expect(httpMock.calls[0].url).toBe(`https://translate.example.com//translate_a/single?${DT}`);
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 429, data: 'Too Many Requests' });

        await expect(translate('hello', 'en', 'de', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 429\n"Too Many Requests"'
        );
    });
});
