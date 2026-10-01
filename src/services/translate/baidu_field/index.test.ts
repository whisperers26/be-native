import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

// 'it' is the default the settings form (Config.tsx) writes; translate itself applies no default.
const config = { appid: 'test-appid', secret: 'test-secret', field: 'it' };

describe('baidu_field translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('throws when the appid is empty', async () => {
        await expect(translate('hello', 'en', 'zh', { config: { ...config, appid: '' } })).rejects.toBe(
            'Please configure appid and secret'
        );
        expect(httpMock.calls).toHaveLength(0);
    });

    it('throws when the secret is empty', async () => {
        await expect(translate('hello', 'en', 'zh', { config: { ...config, secret: '' } })).rejects.toBe(
            'Please configure appid and secret'
        );
        expect(httpMock.calls).toHaveLength(0);
    });

    it('sends the md5-signed query with the default field as domain and joins the translated lines', async () => {
        httpMock.queue({ data: { trans_result: [{ dst: 'Hello' }, { dst: 'World' }] } });

        await expect(translate('你好\n世界', 'zh', 'en', { config })).resolves.toBe('Hello\nWorld');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('signs and sends another field the same way', async () => {
        httpMock.queue({ data: { trans_result: [{ dst: 'Hello' }] } });

        await translate('你好', 'zh', 'en', { config: { ...config, field: 'finance' } });
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('applies no default itself: without a field it signs and sends undefined', async () => {
        httpMock.queue({ data: { trans_result: [{ dst: 'Hello' }] } });

        await translate('你好', 'zh', 'en', { config: { appid: 'test-appid', secret: 'test-secret' } });
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('throws the response as JSON when it has no trans_result', async () => {
        httpMock.queue({ data: { error_code: '58001', error_msg: 'Invalid domain' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            '{"error_code":"58001","error_msg":"Invalid domain"}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
