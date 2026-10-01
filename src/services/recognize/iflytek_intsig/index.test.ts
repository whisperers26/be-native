import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { appid: 'test-appid', apikey: 'test-apikey', apisecret: 'test-apisecret' };

// The service reads its result from base64-encoded JSON.
function encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64');
}

function recognized(result: object) {
    return {
        data: { header: { code: 0, message: 'success' }, payload: { recognizeDocumentRes: { text: encode(result) } } },
    };
}

describe('iflytek_intsig OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts the image as JSON to a signed URL and returns the trimmed whole_text', async () => {
        httpMock.queue(recognized({ whole_text: 'Hello World\n你好\n' }));

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('Hello World\n你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('puts the authorization, host and date in the query of the URL', async () => {
        httpMock.queue(recognized({ whole_text: 'x' }));

        await recognize('aW1hZ2U=', 'auto', { config });

        const url = httpMock.calls[0].url;
        const match = url.match(
            /^https:\/\/api\.xf-yun\.com\/v1\/private\/hh_ocr_recognize_doc\?authorization=(.*)&host=(.*)&date=(.*)$/
        );
        expect(match).not.toBeNull();
        const [, authorization, host, date] = match!;
        // The authorization is base64 of the api_key, the algorithm, the signed headers and
        // base64(HMAC-SHA256('host: api.xf-yun.com\ndate: Fri, 02 Jan 2026 03:04:05 GMT\nPOST /v1/private/hh_ocr_recognize_doc HTTP/1.1',
        // 'test-apisecret')), the last worked out with Node's crypto module. The service does not URL-encode it.
        expect(Buffer.from(authorization, 'base64').toString()).toBe(
            'api_key="test-apikey", algorithm="hmac-sha256", headers="host date request-line", signature="dElMaW0NG1rN4HXX0ieZztQ07ZsH50AnJOs1sgm02E0="'
        );
        expect(host).toBe('api.xf-yun.com');
        expect(date).toBe('Fri%2C%2002%20Jan%202026%2003%3A04%3A05%20GMT');
    });

    it('returns an empty string when the result has no whole_text', async () => {
        httpMock.queue(recognized({ pages: [] }), recognized({ whole_text: '' }));

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('');
        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 401, data: { message: 'HMAC signature cannot be verified' } });

        await expect(recognize('aW1hZ2U=', 'auto', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 401\n{"message":"HMAC signature cannot be verified"}'
        );
    });

    it('throws the whole response when it has no data', async () => {
        httpMock.queue({ data: '' });

        const error = await recognize('aW1hZ2U=', 'auto', { config }).catch((e) => e);

        expect(error).toBe(
            `Result data not found\nResult:\n{"url":"${httpMock.calls[0].url}","status":200,"ok":true,"headers":{},"rawHeaders":{},"data":""}`
        );
    });

    it('throws the whole response when it has no payload', async () => {
        httpMock.queue({ data: { header: { code: 10313, message: 'appid not found' } } });

        const error = await recognize('aW1hZ2U=', 'auto', { config }).catch((e) => e);

        expect(error).toBe(
            `Result payload not found\nResult:\n{"url":"${httpMock.calls[0].url}","status":200,"ok":true,"headers":{},"rawHeaders":{},"data":{"header":{"code":10313,"message":"appid not found"}}}`
        );
    });
});
