import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { secret_id: 'test-secret-id', secret_key: 'test-secret-key' };

// What the endpoint returns: one detection per line of text.
function detected(...lines: string[]) {
    return {
        data: {
            Response: {
                TextDetections: lines.map((DetectedText) => ({ DetectedText, Confidence: 99 })),
                Language: 'zh',
                RequestId: 'r-1',
            },
        },
    };
}

describe('tencent_accurate OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts a TC3-HMAC-SHA256 signed JSON body and joins the detected lines', async () => {
        httpMock.queue(detected('Hello', 'World'));

        await expect(recognize('aW1hZ2U=', 'zh', { config })).resolves.toBe('Hello\nWorld');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('does not send the language', async () => {
        httpMock.queue(detected('x'));

        await recognize('aW1hZ2U=', 'zh_rare', { config });

        expect((httpMock.calls[0].options as any).body.payload).toBe('{"ImageBase64":"aW1hZ2U="}');
    });

    it('trims the whole text and keeps the spaces inside a line', async () => {
        httpMock.queue(detected(' Hello ', ' World '));

        await expect(recognize('aW1hZ2U=', 'zh', { config })).resolves.toBe('Hello \n World');
    });

    it('returns an empty string when no text was detected', async () => {
        httpMock.queue(detected());

        await expect(recognize('aW1hZ2U=', 'zh', { config })).resolves.toBe('');
    });

    it('throws the response as JSON when it carries an error', async () => {
        httpMock.queue({
            data: {
                Response: {
                    Error: { Code: 'AuthFailure.SecretIdNotFound', Message: 'The SecretId is not found.' },
                    RequestId: 'r-2',
                },
            },
        });

        await expect(recognize('aW1hZ2U=', 'zh', { config })).rejects.toBe(
            '{"Response":{"Error":{"Code":"AuthFailure.SecretIdNotFound","Message":"The SecretId is not found."},"RequestId":"r-2"}}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 502, data: 'Bad Gateway' });

        await expect(recognize('aW1hZ2U=', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 502\n"Bad Gateway"'
        );
    });
});
