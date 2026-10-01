import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { secret_id: 'test-secret-id', secret_key: 'test-secret-key' };

describe('tencent translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts a TC3-HMAC-SHA256 signed JSON body and returns the trimmed translation', async () => {
        httpMock.queue({
            data: { Response: { TargetText: ' 你好 ', Source: 'en', Target: 'zh', UsedAmount: 5, RequestId: 'r-1' } },
        });

        await expect(translate('hello', 'en', 'zh', { config })).resolves.toBe('你好');
        expect(httpMock.calls).toMatchSnapshot();
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

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            '{"Response":{"Error":{"Code":"AuthFailure.SecretIdNotFound","Message":"The SecretId is not found."},"RequestId":"r-2"}}'
        );
    });

    it('throws the response as JSON when the translation has no Source', async () => {
        httpMock.queue({ data: { Response: { TargetText: '你好' } } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe('{"Response":{"TargetText":"你好"}}');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 502, data: 'Bad Gateway' });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 502\n"Bad Gateway"'
        );
    });
});
