import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, tts } from './index';

const audio = [73, 68, 51, 4, 0, 0, 0];

describe('youdao TTS', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('requests binary audio from dict.youdao.com and returns the bytes', async () => {
        httpMock.queue({ data: audio });

        await expect(tts('hello', 'en', { config: {} })).resolves.toEqual(audio);
        expect(httpMock.calls).toEqual([
            {
                url: 'https://dict.youdao.com/dictvoice',
                options: { method: 'GET', responseType: 3, query: { audio: 'hello', le: 'en' } },
            },
        ]);
    });

    it('throws on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: [] });

        await expect(tts('hello', 'en', { config: {} })).rejects.toBe('Http Request Error\nHttp Status: 500');
    });
});
