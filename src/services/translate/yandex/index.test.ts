import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

describe('yandex translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts a form with a uuid-based id in the query and returns the first text as it is', async () => {
        httpMock.queue({ data: { code: 200, lang: 'en-de', text: [' Hallo Welt ', 'ignored'] } });

        await expect(translate('hello world', 'en', 'de')).resolves.toBe(' Hallo Welt ');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('throws the response as JSON when it has no text', async () => {
        httpMock.queue({ data: { code: 401, message: 'Invalid api key' } });

        await expect(translate('hello', 'en', 'de')).rejects.toBe('{"code":401,"message":"Invalid api key"}');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'de')).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
