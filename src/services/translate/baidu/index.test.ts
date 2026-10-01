import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { appid: 'test-appid', secret: 'test-secret' };

describe('baidu translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('throws when the appid is empty', async () => {
        await expect(translate('hello', 'en', 'zh', { config: { appid: '', secret: 'test-secret' } })).rejects.toBe(
            'Please configure appid and secret'
        );
        expect(httpMock.calls).toHaveLength(0);
    });

    it('throws when the secret is empty', async () => {
        await expect(translate('hello', 'en', 'zh', { config: { appid: 'test-appid', secret: '' } })).rejects.toBe(
            'Please configure appid and secret'
        );
        expect(httpMock.calls).toHaveLength(0);
    });

    it('sends the md5-signed query and joins the translated lines', async () => {
        httpMock.queue({ data: { trans_result: [{ dst: 'Hello' }, { dst: 'World' }] } });

        await expect(translate('你好\n世界', 'zh', 'en', { config })).resolves.toBe('Hello\nWorld');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('throws the response as JSON when it has no trans_result', async () => {
        httpMock.queue({ data: { error_code: '54001', error_msg: 'Invalid Sign' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            '{"error_code":"54001","error_msg":"Invalid Sign"}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
