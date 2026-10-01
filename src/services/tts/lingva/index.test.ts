import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, tts } from './index';

const audio = [73, 68, 51, 4, 0, 0, 0];

describe('lingva TTS', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('requests the audio from the default instance and returns the audio bytes', async () => {
        httpMock.queue({ data: { audio } });

        await expect(tts('hello', 'en', { config: {} })).resolves.toEqual(audio);
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('uses the default instance when requestPath is empty', async () => {
        httpMock.queue({ data: { audio } });

        await tts('hello', 'en', { config: { requestPath: '' } });

        expect(httpMock.calls.map((call) => call.url)).toEqual(['https://lingva.pot-app.com/api/v1/audio/en/hello']);
    });

    it('prefixes https:// to a custom requestPath that does not start with http, and keeps one that does', async () => {
        httpMock.queue({ data: { audio } }, { data: { audio } }, { data: { audio } });

        await tts('hello', 'en', { config: { requestPath: 'lingva.example.com' } });
        await tts('hello', 'en', { config: { requestPath: 'http://localhost:3000' } });
        await tts('hello', 'en', { config: { requestPath: 'httpbin.example' } });

        expect(httpMock.calls.map((call) => call.url)).toEqual([
            'https://lingva.example.com/api/v1/audio/en/hello',
            'http://localhost:3000/api/v1/audio/en/hello',
            // Any host that merely starts with "http" is taken to have a scheme.
            'httpbin.example/api/v1/audio/en/hello',
        ]);
    });

    it('does not strip a trailing slash from requestPath', async () => {
        httpMock.queue({ data: { audio } });

        await tts('hello', 'en', { config: { requestPath: 'https://lingva.example.com/' } });

        expect(httpMock.calls[0].url).toBe('https://lingva.example.com//api/v1/audio/en/hello');
    });

    it('puts the language code and the URL-encoded text in the path', async () => {
        httpMock.queue({ data: { audio } });

        await tts('hello world/你好?', 'zh_HANT', { config: {} });

        expect(httpMock.calls[0].url).toBe(
            'https://lingva.pot-app.com/api/v1/audio/zh_HANT/hello%20world%2F%E4%BD%A0%E5%A5%BD%3F'
        );
    });

    it('sends a plain GET: the URL is the only argument', async () => {
        httpMock.queue({ data: { audio } });

        await tts('hello', 'en', { config: {} });

        expect(httpMock.calls[0].options).toBeUndefined();
    });

    it('returns undefined when the response has no audio', async () => {
        httpMock.queue({ data: {} });

        await expect(tts('hello', 'en', { config: {} })).resolves.toBeUndefined();
    });

    // Known issue: an HTTP error is not reported; the function just returns undefined.
    it('returns undefined instead of throwing on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { error: 'Internal Server Error' } });

        await expect(tts('hello', 'en', { config: {} })).resolves.toBeUndefined();
        expect(httpMock.calls).toHaveLength(1);
    });
});
