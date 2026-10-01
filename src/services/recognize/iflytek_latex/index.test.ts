import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { appid: 'test-appid', apikey: 'test-apikey', apisecret: 'test-apisecret' };

// What the endpoint returns: one region per recognized block.
function regions(...contents: string[]) {
    return {
        data: {
            code: 0,
            desc: 'success',
            sid: 'itr-1',
            data: { region: contents.map((content) => ({ recog: { content } })) },
        },
    };
}

describe('iflytek_latex OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts the image as JSON with signed Date, Digest and Authorization headers and returns the text', async () => {
        httpMock.queue(regions('x^2 + y^2 = 1'));

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('x^2 + y^2 = 1');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('signs the headers with HMAC-SHA256 and sends the SHA-256 digest of the body', async () => {
        httpMock.queue(regions('x'));

        await recognize('aW1hZ2U=', 'zh_cn', { config });

        const headers = (httpMock.calls[0].options as any).headers;
        // Worked out with Node's crypto module: the digest is base64(SHA-256(body)), and the signature is
        // base64(HMAC-SHA256('host: rest-api.xfyun.cn\ndate: <Date>\nPOST /v2/itr HTTP/1.1\ndigest: <Digest>', 'test-apisecret')).
        expect(headers.Date).toBe('Fri, 02 Jan 2026 03:04:05 GMT');
        expect(headers.Digest).toBe('SHA-256=VPm21A+m9p44H0XMQqGErWXGWubYb8Vkt/GyAww73c8=');
        expect(headers.Authorization).toBe(
            'api_key="test-apikey", algorithm="hmac-sha256", headers="host date request-line digest", signature="QLu5EwaSXoglKDDlsD0aJrlP54oGyE85nNC46woMkPY="'
        );
        expect((httpMock.calls[0].options as any).body.payload).toBe(
            '{"common":{"app_id":"test-appid"},"business":{"ent":"teach-photo-print","aue":"raw"},"data":{"image":"aW1hZ2U="}}'
        );
    });

    it('joins the regions with newlines', async () => {
        httpMock.queue(regions('first line', 'second line'));

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('first line\nsecond line');
    });

    it('strips the latex markers together with the spaces around them', async () => {
        httpMock.queue(
            regions('Solve ifly-latex-begin x^2 + y^2 = 1 ifly-latex-end now', 'a ifly-latex-begin b ifly-latex-end c')
        );

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('Solvex^2 + y^2 = 1now\nabc');
    });

    it('keeps a marker that lacks a space on either side', async () => {
        httpMock.queue(regions('ifly-latex-begin x ifly-latex-end'));

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).resolves.toBe('ifly-latex-begin x ifly-latex-end');
    });

    it('throws the response as JSON when its data has no region', async () => {
        httpMock.queue({ data: { code: 0, desc: 'success', sid: 'itr-2', data: {} } });

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).rejects.toBe(
            '{"code":0,"desc":"success","sid":"itr-2","data":{}}'
        );
    });

    // Known sharp edge: result.data['region'] is read without checking that data exists, so an
    // error reply such as an authentication failure, which has no data, throws a TypeError.
    it('throws a TypeError when the response has no data', async () => {
        httpMock.queue({ data: { code: 10105, desc: 'illegal access|illegal client_ip', sid: 'itr-3' } });

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).rejects.toThrow(TypeError);
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 401, data: { message: 'HMAC signature cannot be verified' } });

        await expect(recognize('aW1hZ2U=', 'zh_cn', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 401\n{"message":"HMAC signature cannot be verified"}'
        );
    });
});
