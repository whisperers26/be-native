import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

describe('lingva translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('encodes "/" in the text as "@@" in the path, then restores it in the translation', async () => {
        httpMock.queue({ data: { translation: 'Hallo/Welt @@ 3/4' } });

        await expect(translate('hello/world & 3/4', 'en', 'de')).resolves.toBe('Hallo/Welt / 3/4');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('returns the translation without trimming it', async () => {
        httpMock.queue({ data: { translation: ' Hallo ' } });

        await expect(translate('hello', 'auto', 'de')).resolves.toBe(' Hallo ');
    });

    // Known issue: the error path calls result.trim() on the response object, so the user
    // sees a TypeError instead of the response.
    it('throws a TypeError when the response has no translation', async () => {
        httpMock.queue({ data: { error: 'Not found' } });

        const failure = translate('hello', 'en', 'de');
        await expect(failure).rejects.toThrow(TypeError);
        await expect(failure).rejects.toThrow('result.trim is not a function');
    });

    it('throws a TypeError when the translation is empty', async () => {
        httpMock.queue({ data: { translation: '' } });

        await expect(translate('hello', 'en', 'de')).rejects.toThrow(TypeError);
    });

    it('throws the trimmed body as a JSON string when the response is a string without translation', async () => {
        httpMock.queue({ data: '  gateway timeout  ' });

        await expect(translate('hello', 'en', 'de')).rejects.toBe('"gateway timeout"');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { error: 'server error' } });

        await expect(translate('hello', 'en', 'de')).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"error":"server error"}'
        );
    });
});
