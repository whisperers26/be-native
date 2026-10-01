import { describe, expect, it, vi } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

// The body of a recorded request: Body.text / Body.json keep their payload here.
function payloadOf(call: { options?: Record<string, unknown> }): any {
    return (call.options as any).body.payload;
}

describe('deepl translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('free: posts JSON-RPC to www2.deepl.com and returns the trimmed text', async () => {
        httpMock.queue({ data: { result: { texts: [{ text: ' Hallo ' }] } } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).resolves.toBe('Hallo');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('free: throws the response as JSON when it has no texts', async () => {
        httpMock.queue({ data: { error: 'x' } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).rejects.toBe('{"error":"x"}');
    });

    it('free: throws status and message on an HTTP error with an error body', async () => {
        httpMock.queue({ status: 429, data: { error: { message: 'Too many requests' } } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).rejects.toBe(
            'Status Code: 429\nToo many requests'
        );
    });

    it('free: throws status and body on an HTTP error without an error body', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'free' } })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });

    it('free: cuts language codes to two letters and shifts the timestamp by the number of i in the text', async () => {
        httpMock.queue({ data: { result: { texts: [{ text: 'x' }] } } });
        await translate('hi', 'PT-BR', 'PT-PT', { config: { type: 'free' } });
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('free: sends auto as the source language unchanged', async () => {
        httpMock.queue({ data: { result: { texts: [{ text: 'x' }] } } });
        await translate('hello', 'auto', 'DE', { config: { type: 'free' } });
        expect(payloadOf(httpMock.calls[0])).toContain('"source_lang_user_selected":"auto"');
    });

    it('free: puts a space before the colon after "method" for ids that match either check', async () => {
        httpMock.queue(
            { data: { result: { texts: [{ text: 'a' }] } } },
            { data: { result: { texts: [{ text: 'b' }] } } }
        );

        vi.spyOn(Math, 'random').mockReturnValue(2.5 / 99999); // id 100002000: (id + 5) % 29 === 0
        await translate('hello', 'EN', 'DE', { config: { type: 'free' } });
        vi.spyOn(Math, 'random').mockReturnValue(12.5 / 99999); // id 100012000: (id + 3) % 13 === 0
        await translate('hello', 'EN', 'DE', { config: { type: 'free' } });

        const [first, second] = httpMock.calls.map(payloadOf);
        expect(first).toContain('"method" : "LMT_handle_texts"');
        expect(first).toContain('"id":100002000');
        expect(second).toContain('"method" : "LMT_handle_texts"');
        expect(second).toContain('"id":100012000');
    });

    it('api: uses api-free.deepl.com for :fx keys and sends the auth header', async () => {
        httpMock.queue({ data: { translations: [{ text: ' Hallo ' }] } });
        await expect(translate('hello', 'auto', 'DE', { config: { type: 'api', authKey: 'k:fx' } })).resolves.toBe(
            'Hallo'
        );
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('api: uses api.deepl-pro.com for :dp keys and api.deepl.com otherwise', async () => {
        httpMock.queue({ data: { translations: [{ text: 'a' }] } }, { data: { translations: [{ text: 'b' }] } });
        await translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k:dp' } });
        await translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } });
        expect(httpMock.calls.map((c) => c.url)).toEqual([
            'https://api.deepl-pro.com/v2/translate',
            'https://api.deepl.com/v2/translate',
        ]);
    });

    it('api: sends source_lang only when the source language is not auto', async () => {
        httpMock.queue({ data: { translations: [{ text: 'a' }] } }, { data: { translations: [{ text: 'b' }] } });
        await translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } });
        await translate('hello', 'auto', 'DE', { config: { type: 'api', authKey: 'k' } });
        expect(httpMock.calls.map(payloadOf)).toEqual([
            { text: ['hello'], target_lang: 'DE', source_lang: 'EN' },
            { text: ['hello'], target_lang: 'DE' },
        ]);
    });

    it('api: throws the response as JSON when translations is empty', async () => {
        httpMock.queue({ data: { translations: [] } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } })).rejects.toBe(
            '{"translations":[]}'
        );
    });

    // Known issue: the check is `(result.translations, result.translations[0])`, a comma operator,
    // so a response without translations throws a TypeError instead of the response.
    it('api: throws a TypeError when the response has no translations', async () => {
        httpMock.queue({ data: { message: 'x' } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } })).rejects.toThrow(
            TypeError
        );
    });

    it('api: throws status and message on an HTTP error with an error body', async () => {
        httpMock.queue({ status: 403, data: { error: { message: 'Forbidden' } } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } })).rejects.toBe(
            'Status Code: 403\nForbidden'
        );
    });

    it('api: throws status and body on an HTTP error without an error body', async () => {
        httpMock.queue({ status: 456, data: { message: 'Quota exceeded' } });
        await expect(translate('hello', 'EN', 'DE', { config: { type: 'api', authKey: 'k' } })).rejects.toBe(
            'Http Request Error\nHttp Status: 456\n{"message":"Quota exceeded"}'
        );
    });

    it('deeplx: posts to the custom URL and returns data', async () => {
        httpMock.queue({ data: { data: 'Hallo' } });
        await expect(
            translate('hello', 'EN', 'DE', { config: { type: 'deeplx', customUrl: 'http://localhost:1188/translate' } })
        ).resolves.toBe('Hallo');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('deeplx: throws the response as JSON when it has no data', async () => {
        httpMock.queue({ data: { code: 500, message: 'failed' } });
        await expect(
            translate('hello', 'EN', 'DE', { config: { type: 'deeplx', customUrl: 'http://localhost:1188/translate' } })
        ).rejects.toBe('{"code":500,"message":"failed"}');
    });

    it('deeplx: throws status and body on an HTTP error', async () => {
        httpMock.queue({ status: 502, data: 'bad gateway' });
        await expect(
            translate('hello', 'EN', 'DE', { config: { type: 'deeplx', customUrl: 'http://localhost:1188/translate' } })
        ).rejects.toBe('Http Request Error\nHttp Status: 502\n"bad gateway"');
    });

    it('unknown type falls back to the free endpoint', async () => {
        httpMock.queue({ data: { result: { texts: [{ text: 'x' }] } } });
        await translate('hello', 'EN', 'DE', { config: { type: 'other' } });
        expect(httpMock.calls[0].url).toBe('https://www2.deepl.com/jsonrpc');
    });
});
