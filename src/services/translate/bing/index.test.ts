import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

describe('bing translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('fetches a text token, then posts the text with it and returns the trimmed translation', async () => {
        httpMock.queue({ data: 'TOKEN' }, { data: [{ translations: [{ text: ' 你好 ', to: 'zh-Hans' }] }] });

        await expect(translate('hello', 'en', 'zh-Hans')).resolves.toBe('你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('sends an empty source language for auto detection', async () => {
        httpMock.queue({ data: 'TOKEN' }, { data: [{ translations: [{ text: '你好' }] }] });

        await translate('hello', '', 'zh-Hans');
        expect((httpMock.calls[1].options as any).query).toEqual({
            from: '',
            to: 'zh-Hans',
            'api-version': '3.0',
            includeSentenceLength: 'true',
        });
    });

    it('throws "Get Token Failed" when the token request fails, without translating', async () => {
        httpMock.queue({ status: 500, data: '' });

        await expect(translate('hello', 'en', 'zh-Hans')).rejects.toBe('Get Token Failed');
        expect(httpMock.calls.map((call) => call.url)).toEqual(['https://edge.microsoft.com/translate/auth']);
    });

    it('throws the status and body on an HTTP error from the translation request', async () => {
        httpMock.queue({ data: 'TOKEN' }, { status: 400, data: { error: { code: 400023, message: 'bad language' } } });

        await expect(translate('hello', 'en', 'xx')).rejects.toBe(
            'Http Request Error\nHttp Status: 400\n{"error":{"code":400023,"message":"bad language"}}'
        );
    });

    it('throws the response as JSON when the first item has no translations', async () => {
        httpMock.queue({ data: 'TOKEN' }, { data: [{ detectedLanguage: { language: 'en', score: 1 } }] });

        await expect(translate('hello', 'en', 'zh-Hans')).rejects.toBe(
            '[{"detectedLanguage":{"language":"en","score":1}}]'
        );
    });
});
