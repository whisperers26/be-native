import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { secret_id: 'test-secret-id', secret_key: 'test-secret-key' };

// What the endpoint returns: one [SourceText, TargetText] pair per recognized line.
function translated(...lines: [string, string][]) {
    return {
        data: {
            Response: {
                ImageRecord: { Value: lines.map(([SourceText, TargetText]) => ({ SourceText, TargetText })) },
                Source: 'en',
                Target: 'zh',
                SessionUuid: 'nanoid-fixed-id',
                RequestId: 'r-1',
            },
        },
    };
}

describe('tencent_img OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts a TC3-HMAC-SHA256 signed ImageTranslate request to tmt and returns the TargetText lines', async () => {
        httpMock.queue(translated(['Hello', '你好'], ['World', '世界']));

        await expect(recognize('aW1hZ2U=', 'zh', { config })).resolves.toBe('你好\n世界');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('auto: translates to zh and returns the SourceText lines', async () => {
        httpMock.queue(translated(['Hello', '你好'], ['World', '世界']));

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('Hello\nWorld');
        expect(JSON.parse((httpMock.calls[0].options as any).body.payload)).toEqual({
            SessionUuid: 'nanoid-fixed-id',
            Scene: 'doc',
            Data: 'aW1hZ2U=',
            Source: 'auto',
            Target: 'zh',
            ProjectId: 0,
        });
    });

    it('other languages: sends the language as the target', async () => {
        httpMock.queue(translated(['你好', 'Hello']));

        await expect(recognize('aW1hZ2U=', 'en', { config })).resolves.toBe('Hello');
        expect(JSON.parse((httpMock.calls[0].options as any).body.payload)).toMatchObject({
            Source: 'auto',
            Target: 'en',
        });
    });

    it('trims the whole text and keeps the spaces inside a line', async () => {
        httpMock.queue(translated([' a ', ' 一 '], [' b ', ' 二 ']), translated([' a ', ' 一 '], [' b ', ' 二 ']));

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('a \n b');
        await expect(recognize('aW1hZ2U=', 'zh', { config })).resolves.toBe('一 \n 二');
    });

    it('returns an empty string when no text was recognized', async () => {
        httpMock.queue(translated(), translated());

        await expect(recognize('aW1hZ2U=', 'auto', { config })).resolves.toBe('');
        await expect(recognize('aW1hZ2U=', 'zh', { config })).resolves.toBe('');
    });

    it('throws the response as JSON when the image record has no Value', async () => {
        httpMock.queue({ data: { Response: { ImageRecord: {}, RequestId: 'r-2' } } });

        await expect(recognize('aW1hZ2U=', 'zh', { config })).rejects.toBe(
            '{"Response":{"ImageRecord":{},"RequestId":"r-2"}}'
        );
    });

    // Known sharp edge: Response.ImageRecord.Value is read without checking that ImageRecord exists, so an
    // error reply such as an authentication failure throws a TypeError instead of the provider's error.
    it('throws a TypeError when the response carries an error and no image record', async () => {
        httpMock.queue({
            data: {
                Response: {
                    Error: { Code: 'AuthFailure.SecretIdNotFound', Message: 'The SecretId is not found.' },
                    RequestId: 'r-3',
                },
            },
        });

        await expect(recognize('aW1hZ2U=', 'zh', { config })).rejects.toThrow(TypeError);
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 502, data: 'Bad Gateway' });

        await expect(recognize('aW1hZ2U=', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 502\n"Bad Gateway"'
        );
    });
});
