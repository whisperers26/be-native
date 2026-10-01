import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { client_id: 'test-client-id', client_secret: 'test-client-secret' };

describe('baidu_accurate OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('fetches an access token, posts the image as a form with it and joins the lines', async () => {
        httpMock.queue(
            { data: { access_token: 'TOKEN', expires_in: 2592000 } },
            { data: { words_result: [{ words: 'Hello' }, { words: 'World' }], words_result_num: 2 } }
        );

        await expect(recognize('aW1hZ2U=', 'auto_detect', { config })).resolves.toBe('Hello\nWorld');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('trims the whole text and keeps the spaces inside a line', async () => {
        httpMock.queue(
            { data: { access_token: 'TOKEN' } },
            { data: { words_result: [{ words: ' Hello ' }, { words: ' World ' }] } }
        );

        await expect(recognize('aW1hZ2U=', 'ENG', { config })).resolves.toBe('Hello \n World');
    });

    it('returns an empty string when there are no lines', async () => {
        httpMock.queue({ data: { access_token: 'TOKEN' } }, { data: { words_result: [], words_result_num: 0 } });

        await expect(recognize('aW1hZ2U=', 'ENG', { config })).resolves.toBe('');
    });

    it('throws "Get Access Token Failed!" when the token response has no access_token, without recognizing', async () => {
        httpMock.queue({ data: { error: 'invalid_client', error_description: 'unknown client id' } });

        await expect(recognize('aW1hZ2U=', 'ENG', { config })).rejects.toBe('Get Access Token Failed!');
        expect(httpMock.calls.map((call) => call.url)).toEqual(['https://aip.baidubce.com/oauth/2.0/token']);
    });

    it('throws the status and body on an HTTP error from the token request, without recognizing', async () => {
        httpMock.queue({ status: 500, data: { error: 'server_error' } });

        await expect(recognize('aW1hZ2U=', 'ENG', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"error":"server_error"}'
        );
        expect(httpMock.calls).toHaveLength(1);
    });

    it('throws the response as JSON when it has no words_result', async () => {
        httpMock.queue(
            { data: { access_token: 'TOKEN' } },
            { data: { error_code: 110, error_msg: 'Access token invalid or no longer valid' } }
        );

        await expect(recognize('aW1hZ2U=', 'ENG', { config })).rejects.toBe(
            '{"error_code":110,"error_msg":"Access token invalid or no longer valid"}'
        );
    });

    it('throws the status and body on an HTTP error from the recognition request', async () => {
        httpMock.queue({ data: { access_token: 'TOKEN' } }, { status: 403, data: { error_msg: 'forbidden' } });

        await expect(recognize('aW1hZ2U=', 'ENG', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 403\n{"error_msg":"forbidden"}'
        );
    });
});
