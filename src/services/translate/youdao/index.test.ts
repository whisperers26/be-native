import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { appkey: 'test-appkey', key: 'test-key' };
const UK_SPEECH = 'https://dict.youdao.com/dictvoice?audio=hello&type=1';
const US_SPEECH = 'https://dict.youdao.com/dictvoice?audio=hello&type=2';

// What the API returns for a word, with only the parts a test varies passed in.
function wordResponse(basic: Record<string, unknown>) {
    return { data: { isWord: true, query: 'hello', translation: ['你好'], basic } };
}

const fullBasic = {
    'uk-phonetic': 'həˈləʊ',
    'uk-speech': UK_SPEECH,
    'us-phonetic': 'həˈloʊ',
    'us-speech': US_SPEECH,
    phonetic: 'həˈləʊ',
    explains: ['int. 喂；你好', 'n. 招呼；问候', '[网络] 哈罗；你好'],
    wfs: [{ wf: { name: '复数', value: 'hellos' } }, { wf: { name: '过去式', value: 'helloed' } }],
    exam_type: ['高中', 'CET4', '考研'],
};

describe('youdao translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('word: fetches both speech files and returns pronunciations, explanations and associations', async () => {
        httpMock.queue(wordResponse(fullBasic), { data: [1, 2, 3] }, { data: [4, 5, 6] });

        await expect(translate('hello', 'en', 'zh-CHS', { config })).resolves.toEqual({
            pronunciations: [
                { region: 'UK', symbol: 'həˈləʊ', voice: [1, 2, 3] },
                { region: 'US', symbol: 'həˈloʊ', voice: [4, 5, 6] },
            ],
            explanations: [
                { trait: 'int.', explains: ['喂', '你好'] },
                { trait: 'n.', explains: ['招呼', '问候'] },
                { trait: '', explains: ['[网络] 哈罗', '你好'] },
            ],
            associations: ['复数 hellos', '过去式 helloed', '高中 CET4 考研'],
            sentence: [],
        });
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('word: leaves the voice empty when a speech request fails', async () => {
        httpMock.queue(wordResponse(fullBasic), { status: 404, data: null }, { data: [4, 5, 6] });

        await expect(translate('hello', 'en', 'zh-CHS', { config })).resolves.toMatchObject({
            pronunciations: [
                { region: 'UK', symbol: 'həˈləʊ', voice: '' },
                { region: 'US', symbol: 'həˈloʊ', voice: [4, 5, 6] },
            ],
        });
    });

    it('word: uses the plain phonetic, without a speech request, when there is no uk or us one', async () => {
        httpMock.queue(wordResponse({ phonetic: 'həˈləʊ', explains: ['int. 喂'] }));

        await expect(translate('hello', 'en', 'zh-CHS', { config })).resolves.toEqual({
            pronunciations: [{ region: '', symbol: 'həˈləʊ', voice: '' }],
            explanations: [{ trait: 'int.', explains: ['喂'] }],
            associations: [],
            sentence: [],
        });
        expect(httpMock.calls).toHaveLength(1);
    });

    it('word: ignores the plain phonetic when a uk or us one was added', async () => {
        httpMock.queue(wordResponse({ 'us-phonetic': 'həˈloʊ', 'us-speech': US_SPEECH, phonetic: 'x', explains: [] }), {
            data: [4],
        });

        await expect(translate('hello', 'en', 'zh-CHS', { config })).resolves.toMatchObject({
            pronunciations: [{ region: 'US', symbol: 'həˈloʊ', voice: [4] }],
        });
    });

    // Known sharp edge: reduce without an initial value throws on an empty array.
    it('word: throws a TypeError when exam_type is an empty array', async () => {
        httpMock.queue(wordResponse({ explains: [], exam_type: [] }));

        await expect(translate('hello', 'en', 'zh-CHS', { config })).rejects.toThrow(TypeError);
    });

    it('sentence: trims the text, signs a truncated form of a long one, and joins the translations', async () => {
        httpMock.queue({ data: { isWord: false, translation: ['敏捷的棕色狐狸', '跳过了懒狗'] } });

        await expect(
            translate('  The quick brown fox jumps over the lazy dog  ', 'en', 'zh-CHS', { config })
        ).resolves.toBe('敏捷的棕色狐狸\n跳过了懒狗');
        expect(httpMock.calls).toMatchSnapshot();
    });

    // sha256(appkey + input + salt + curtime + key), where input is the text up to 20 characters and
    // first 10 + length + last 10 characters beyond that. The expected signs were computed outside the app.
    it('signs a text of 20 characters as it is and a text of 21 characters in truncated form', async () => {
        httpMock.queue({ data: { translation: ['x'] } }, { data: { translation: ['x'] } });

        await translate('12345678901234567890', 'en', 'zh-CHS', { config });
        await translate('123456789012345678901', 'en', 'zh-CHS', { config });
        expect(httpMock.calls.map((call) => (call.options as any).query.sign)).toEqual([
            '0a36f059be0aad10519495f193e765f27c898604128138ec9b73a7c1361ccabe',
            '74be820f4084d06b631a0ae4862633ee6d7f9d1dff84321684d61cee8b96d0b4',
        ]);
    });

    it('throws the response as JSON when there is no translation', async () => {
        httpMock.queue({ data: { errorCode: '108', msg: 'invalid appKey' } });

        await expect(translate('hello', 'en', 'zh-CHS', { config })).rejects.toBe(
            '{"errorCode":"108","msg":"invalid appKey"}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'zh-CHS', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
