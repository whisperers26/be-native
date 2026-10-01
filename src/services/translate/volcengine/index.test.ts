import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { appid: 'test-access-key', secret: 'test-secret-key' };

describe('volcengine translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts an HMAC-SHA256 signed JSON body and returns the trimmed translations', async () => {
        httpMock.queue({
            data: {
                TranslationList: [{ Translation: ' 你好', DetectedSourceLanguage: 'en' }, { Translation: '世界 ' }],
            },
        });

        await expect(translate('hello\nworld', 'en', 'zh', { config })).resolves.toBe('你好\n世界');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('does not send the source language', async () => {
        httpMock.queue({ data: { TranslationList: [{ Translation: 'x' }] } });

        await translate('hello', 'ja', 'zh', { config });
        expect((httpMock.calls[0].options as any).body.payload).toBe('{"TargetLanguage":"zh","TextList":["hello"]}');
    });

    it('keeps an empty line for a translation without text', async () => {
        httpMock.queue({ data: { TranslationList: [{ Translation: 'A' }, {}, { Translation: 'B' }] } });

        await expect(translate('a\n\nb', 'en', 'zh', { config })).resolves.toBe('A\n\nB');
    });

    it('throws the response as JSON when it has no TranslationList', async () => {
        httpMock.queue({
            data: { ResponseMetaData: { Error: { Code: 'InvalidParameter', Message: 'bad language' } } },
        });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            '{"ResponseMetaData":{"Error":{"Code":"InvalidParameter","Message":"bad language"}}}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 403, data: { message: 'forbidden' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 403\n{"message":"forbidden"}'
        );
    });
});
