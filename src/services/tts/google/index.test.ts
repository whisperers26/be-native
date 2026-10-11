import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, tts } from './index';

const audio = [73, 68, 51, 4, 0, 0, 0];

describe('google TTS', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('requests binary audio from translate.google.com and returns the bytes', async () => {
        httpMock.queue({ data: audio });

        await expect(tts('hello', 'en', { config: {} })).resolves.toEqual(audio);
        expect(httpMock.calls).toEqual([
            {
                url: 'https://translate.google.com/translate_tts',
                options: {
                    method: 'GET',
                    responseType: 3,
                    query: { ie: 'UTF-8', client: 'tw-ob', tl: 'en', q: 'hello' },
                },
            },
        ]);
    });

    it('uses a custom URL, prefixing https:// when it has no scheme', async () => {
        httpMock.queue({ data: audio }, { data: audio });

        await tts('hello', 'en', { config: { custom_url: 'tts.example.com' } });
        await tts('hello', 'en', { config: { custom_url: 'http://localhost:3000' } });

        expect(httpMock.calls.map((call) => call.url)).toEqual([
            'https://tts.example.com/translate_tts',
            'http://localhost:3000/translate_tts',
        ]);
    });

    it('throws on an HTTP error', async () => {
        httpMock.queue({ status: 429, data: [] });

        await expect(tts('hello', 'en', { config: {} })).rejects.toBe('Http Request Error\nHttp Status: 429');
    });
});
