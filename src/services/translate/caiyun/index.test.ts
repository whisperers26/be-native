import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { token: 'test-token' };

describe('caiyun translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('throws when the token is empty', async () => {
        await expect(translate('hello', 'auto', 'zh', { config: { token: '' } })).rejects.toBe(
            'Please configure token'
        );
        expect(httpMock.calls).toHaveLength(0);
    });

    it('posts a JSON body with the token header and returns the first target', async () => {
        httpMock.queue({ data: { target: ['你好'] } });

        await expect(translate('hello', 'auto', 'zh', { config })).resolves.toBe('你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('returns the first target as it is, without trimming', async () => {
        httpMock.queue({ data: { target: [' 你好 '] } });

        await expect(translate('hello', 'en', 'zh', { config })).resolves.toBe(' 你好 ');
    });

    // Known issue: the error path calls result.trim() on the response object, so the user
    // sees a TypeError instead of the response.
    it('throws a TypeError when the first target is empty', async () => {
        httpMock.queue({ data: { target: [] } });

        const failure = translate('hello', 'en', 'zh', { config });
        await expect(failure).rejects.toThrow(TypeError);
        await expect(failure).rejects.toThrow('result.trim is not a function');
    });

    it('throws a TypeError when the response has no target', async () => {
        httpMock.queue({ data: { message: 'invalid token' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toThrow(TypeError);
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 401, data: { message: 'invalid token' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 401\n{"message":"invalid token"}'
        );
    });
});
