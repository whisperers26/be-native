import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { accesskey_id: 'test-id', accesskey_secret: 'test-secret' };

describe('alibaba translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('throws when the AccessKey ID is empty', async () => {
        await expect(
            translate('hello', 'en', 'zh', { config: { accesskey_id: '', accesskey_secret: 'test-secret' } })
        ).rejects.toBe('Please configure AccessKey ID and AccessKey Secret');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('throws when the AccessKey Secret is empty', async () => {
        await expect(
            translate('hello', 'en', 'zh', { config: { accesskey_id: 'test-id', accesskey_secret: '' } })
        ).rejects.toBe('Please configure AccessKey ID and AccessKey Secret');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('sends a signed GET with the timestamp, nonce and escaped text, and returns the trimmed result', async () => {
        httpMock.queue({ data: { Code: '200', Data: { Translated: ' 你好 ' } } });

        await expect(translate("Hi! (it's *great*), 1+1", 'en', 'zh', { config })).resolves.toBe('你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('throws the response as JSON when Code is not 200', async () => {
        httpMock.queue({ data: { Code: '400', Message: 'bad request' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe('{"Code":"400","Message":"bad request"}');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { Message: 'server error' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"Message":"server error"}'
        );
    });
});
