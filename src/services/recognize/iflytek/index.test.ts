import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { appid: 'test-appid', apikey: 'test-apikey', apisecret: 'test-apisecret' };

// The service reads its result from base64-encoded JSON.
function encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64');
}

function recognized(pages: object[]) {
    return { data: { header: { code: 0, message: 'success' }, payload: { result: { text: encode({ pages }) } } } };
}

describe('iflytek OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts the image as JSON to a signed URL and returns the decoded words, lines joined', async () => {
        httpMock.queue(
            recognized([
                { lines: [{ words: [{ content: 'Hello' }, { content: 'World' }] }, { words: [{ content: '你好' }] }] },
            ])
        );

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('Hello World \n你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('puts the authorization, host and date in the query of the URL', async () => {
        httpMock.queue(recognized([]));

        await recognize('aW1hZ2U=', 'zh_cn', { config });

        const url = httpMock.calls[0].url;
        const match = url.match(
            /^https:\/\/api\.xf-yun\.com\/v1\/private\/sf8e6aca1\?authorization=(.*)&host=(.*)&date=(.*)$/
        );
        expect(match).not.toBeNull();
        const [, authorization, host, date] = match!;
        // The authorization is base64 of the api_key, the algorithm, the signed headers and
        // base64(HMAC-SHA256('host: api.xf-yun.com\ndate: Fri, 02 Jan 2026 03:04:05 GMT\nPOST /v1/private/sf8e6aca1 HTTP/1.1',
        // 'test-apisecret')), the last worked out with Node's crypto module. The service does not URL-encode it.
        expect(Buffer.from(authorization, 'base64').toString()).toBe(
            'api_key="test-apikey", algorithm="hmac-sha256", headers="host date request-line", signature="11psQxlErV1byC4FGODFNCxUwy0VutKI7QNnUrmgjuA="'
        );
        expect(host).toBe('api.xf-yun.com');
        expect(date).toBe('Fri%2C%2002%20Jan%202026%2003%3A04%3A05%20GMT');
    });

    it('decodes UTF-8 text from the base64 result', async () => {
        httpMock.queue(recognized([{ lines: [{ words: [{ content: '日本語' }, { content: 'テキスト' }] }] }]));

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('日本語 テキスト');
    });

    it('skips pages without lines, lines without words and words without content', async () => {
        httpMock.queue(
            recognized([
                {},
                {
                    lines: [
                        {},
                        { words: [{ content: 'A' }, {}, { content: '' }, { content: 'B' }] },
                        { words: [] },
                        { words: [{ content: 'C' }] },
                    ],
                },
            ])
        );

        // 'A B ' + newline, an empty line for the line with an empty word list, then 'C ' + newline.
        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('A B \n\nC');
    });

    it('returns an empty string when no page has text', async () => {
        httpMock.queue(recognized([]));

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 401, data: { message: 'HMAC signature cannot be verified' } });

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 401\n{"message":"HMAC signature cannot be verified"}'
        );
    });

    it('throws the whole response when it has no data', async () => {
        httpMock.queue({ data: '' });

        const error = await recognize('aW1hZ2U=', 'zh_cn', { config }).catch((e) => e);

        expect(error).toBe(
            `Result data not found\nResult:\n{"url":"${httpMock.calls[0].url}","status":200,"ok":true,"headers":{},"rawHeaders":{},"data":""}`
        );
    });

    it('throws the whole response when it has no payload', async () => {
        httpMock.queue({ data: { header: { code: 10313, message: 'appid not found' } } });

        const error = await recognize('aW1hZ2U=', 'zh_cn', { config }).catch((e) => e);

        expect(error).toBe(
            `Result payload not found\nResult:\n{"url":"${httpMock.calls[0].url}","status":200,"ok":true,"headers":{},"rawHeaders":{},"data":{"header":{"code":10313,"message":"appid not found"}}}`
        );
    });
});
