import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const anonymous = { username: '', token: '' };
const signedIn = { username: 'test-user', token: 'test-token' };

// The header object inside the JSON body of the recorded request.
function bodyHeader(): unknown {
    return (httpMock.calls[0].options as any).body.payload.header;
}

describe('transmart translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts the text as JSON without credentials when username and token are empty', async () => {
        httpMock.queue({ data: { auto_translation: ['你好'] } });

        await expect(translate('hello', 'en', 'zh', { config: anonymous })).resolves.toBe('你好');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('adds user and token to the header when both are set', async () => {
        httpMock.queue({ data: { auto_translation: ['你好'] } });

        await translate('hello', 'en', 'zh', { config: signedIn });
        expect(bodyHeader()).toEqual({ fn: 'auto_translation', user: 'test-user', token: 'test-token' });
    });

    it('adds neither when only one of them is set', async () => {
        httpMock.queue({ data: { auto_translation: ['你好'] } }, { data: { auto_translation: ['你好'] } });

        await translate('hello', 'en', 'zh', { config: { username: 'test-user', token: '' } });
        await translate('hello', 'en', 'zh', { config: { username: '', token: 'test-token' } });
        expect(httpMock.calls.map((call) => (call.options as any).body.payload.header)).toEqual([
            { fn: 'auto_translation' },
            { fn: 'auto_translation' },
        ]);
    });

    it('adds user and token as undefined when the config has neither', async () => {
        httpMock.queue({ data: { auto_translation: ['你好'] } });

        await translate('hello', 'en', 'zh', { config: {} });
        expect(Object.keys(bodyHeader() as object)).toEqual(['fn', 'user', 'token']);
    });

    it('joins the translated lines and trims the result', async () => {
        httpMock.queue({ data: { auto_translation: [' 你好', '世界 ', ''] } });

        await expect(translate('hello\nworld', 'en', 'zh', { config: anonymous })).resolves.toBe('你好\n世界');
    });

    it('throws the response as JSON when it has no auto_translation', async () => {
        httpMock.queue({ data: { header: { ret_code: 'fail' }, message: 'bad token' } });

        await expect(translate('hello', 'en', 'zh', { config: anonymous })).rejects.toBe(
            '{"header":{"ret_code":"fail"},"message":"bad token"}'
        );
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'zh', { config: anonymous })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
