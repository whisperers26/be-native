import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const config = { https: true, apikey: 'test-apikey' };

describe('niutrans translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts the key and text as JSON over https and returns the trimmed translation', async () => {
        httpMock.queue({ data: { from: 'en', to: 'zh', tgt_text: ' 你好 ' } });

        await expect(translate('hello', 'en', 'zh', { config })).resolves.toBe('你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('uses http when https is false', async () => {
        httpMock.queue({ data: { tgt_text: 'x' } });

        await translate('hello', 'en', 'zh', { config: { ...config, https: false } });
        expect(httpMock.calls[0].url).toBe('http://api.niutrans.com/NiuTransServer/translation');
    });

    // The settings switch shows a missing https as on (config['https'] ?? true), but translate treats it as off.
    it('uses http when https is missing from the config', async () => {
        httpMock.queue({ data: { tgt_text: 'x' } });

        await translate('hello', 'en', 'zh', { config: { apikey: 'test-apikey' } });
        expect(httpMock.calls[0].url).toBe('http://api.niutrans.com/NiuTransServer/translation');
    });

    it('throws the response as JSON when it has no tgt_text', async () => {
        httpMock.queue({ data: { error_code: '13001', error_msg: 'apikey is empty' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            '{"error_code":"13001","error_msg":"apikey is empty"}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'zh', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
