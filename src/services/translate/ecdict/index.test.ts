import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

describe('ecdict translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts only the text as JSON and returns the response data as it is', async () => {
        const dictionary = {
            pronunciations: [{ region: 'us', symbol: '/həˈloʊ/', voice: '' }],
            explanations: [{ trait: 'int.', explains: ['你好'] }],
            associations: ['hellos'],
            sentence: [],
        };
        httpMock.queue({ data: dictionary });

        await expect(translate('hello', 'en', 'zh')).resolves.toBe(dictionary);
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en', 'zh')).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
