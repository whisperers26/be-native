import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { appid: 'test-access-key', secret: 'test-secret-key' };

// What the endpoint returns: one entry per recognized block.
function recognized(...texts: string[]) {
    return {
        data: {
            code: 10000,
            data: { ocr_infos: texts.map((text) => ({ text, language: 'en', confidence: 0.99 })) },
            message: 'Success',
        },
    };
}

describe('volcengine_multi_lang OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts a signed form body as text and joins the text of ocr_infos', async () => {
        httpMock.queue(recognized('Hello', 'World'));

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('Hello\nWorld');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('URL-encodes the base64 image in the form body', async () => {
        httpMock.queue(recognized('x'));

        await recognize('a+b/c==', 'auto', { config });

        expect((httpMock.calls[0].options as any).body.payload).toBe(
            'image_base64=a%2Bb%2Fc%3D%3D&approximate_pixel=0&mode=default&filter_thresh=80'
        );
    });

    it('trims the whole text and keeps the spaces inside a block', async () => {
        httpMock.queue(recognized(' Hello ', ' World '));

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('Hello \n World');
    });

    it('returns an empty string when there are no blocks', async () => {
        httpMock.queue(recognized());

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('');
    });

    // Known issue: when the response has no data, the helper returns undefined and recognize calls
    // .trim() on it, so the user sees a TypeError instead of the provider's message.
    it('throws a TypeError when the response has no data', async () => {
        httpMock.queue({ data: { code: 50400, message: 'Access Denied', request_id: 'r-1' } });

        await expect(recognize('aW1hZ2U=', 'auto', { config })).rejects.toThrow(TypeError);
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 403, data: { ResponseMetadata: { Error: { Code: 'SignatureDoesNotMatch' } } } });

        await expect(recognize('aW1hZ2U=', 'auto', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 403\n{"ResponseMetadata":{"Error":{"Code":"SignatureDoesNotMatch"}}}'
        );
    });
});
