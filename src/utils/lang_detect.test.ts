import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../test/fake-tauri';
import { httpMock } from '../test/http';
import detect, { detectLanguage } from './lang_detect';

function useEngine(engine: string): void {
    fakeTauri.store.set('translate_detect_engine', engine);
}

describe('language detection', () => {
    it('detects locally when no engine is set', async () => {
        fakeTauri.command('lang_detect', () => 'zh_cn');

        await expect(detect('你好')).resolves.toBe('zh_cn');
        expect(httpMock.calls).toEqual([]);
    });

    it('baidu: posts the text as a form and maps its code', async () => {
        useEngine('baidu');
        httpMock.queue({ data: { lan: 'jp' } });

        await expect(detect('こんにちは')).resolves.toBe('ja');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('google: reads the detected code from the third element', async () => {
        useEngine('google');
        httpMock.queue({ data: [null, null, 'zh-CN'] });

        await expect(detect('你好')).resolves.toBe('zh_cn');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('tencent: reads translate.source', async () => {
        useEngine('tencent');
        httpMock.queue({ data: { translate: { source: 'ko' } } });

        await expect(detect('안녕')).resolves.toBe('ko');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('niutrans: sends the time and reads language', async () => {
        useEngine('niutrans');
        httpMock.queue({ data: { language: 'nb' } });

        await expect(detect('hei')).resolves.toBe('nb_no');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('yandex: sends a uuid-based id and reads lang', async () => {
        useEngine('yandex');
        httpMock.queue({ data: { lang: 'uk' } });

        await expect(detect('привіт')).resolves.toBe('uk');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('bing: fetches a token, then detects with it', async () => {
        useEngine('bing');
        httpMock.queue({ data: 'TOKEN' }, { data: [{ language: 'zh-Hant' }] });

        await expect(detect('你好')).resolves.toBe('zh_tw');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('bing: falls back to en when the token request fails', async () => {
        useEngine('bing');
        httpMock.queue({ status: 500, data: '' });

        await expect(detect('你好')).resolves.toBe('en');
        expect(httpMock.calls).toHaveLength(1);
    });

    it('local: asks the Rust detector', async () => {
        useEngine('local');
        fakeTauri.command('lang_detect', ({ text }) => (text === 'bonjour' ? 'fr' : 'en'));

        await expect(detect('bonjour')).resolves.toBe('fr');
        expect(fakeTauri.calls.find((call) => call.cmd === 'lang_detect')?.args).toEqual({ text: 'bonjour' });
        expect(httpMock.calls).toHaveLength(0);
    });

    it('falls back to the Rust detector for an unknown engine', async () => {
        useEngine('no-such-engine');
        fakeTauri.command('lang_detect', () => 'de');

        await expect(detect('hallo')).resolves.toBe('de');
    });

    it('asks about the other script alone when it outweighs the Chinese, Japanese or Korean in the text', async () => {
        useEngine('google');
        httpMock.queue({ data: [null, null, 'en'] });

        await expect(detect('这个 function returns the user object. 如果 request 失败 it throws an error.')).resolves.toBe(
            'en'
        );
        expect(httpMock.calls[0].options).toMatchObject({
            query: { q: ' function returns the user object.  request  it throws an error.' },
        });
    });

    it('asks about the whole text when the Chinese, Japanese or Korean in it weighs as much or more', async () => {
        useEngine('google');
        httpMock.queue({ data: [null, null, 'zh-CN'] });
        const text = 'pnpm tauri dev # 以开发模式运行应用';

        await expect(detect(text)).resolves.toBe('zh_cn');
        expect(httpMock.calls[0].options).toMatchObject({ query: { q: text } });
    });

    it('returns en when the request fails', async () => {
        useEngine('baidu');
        httpMock.queue({ status: 500, data: {} });

        await expect(detect('你好')).resolves.toBe('en');
    });

    it('returns en for a code it does not map', async () => {
        useEngine('baidu');
        httpMock.queue({ data: { lan: 'xx' } });

        await expect(detect('???')).resolves.toBe('en');
    });

    it('says that a web engine failed, and falls back to en', async () => {
        useEngine('baidu');
        httpMock.queue({ status: 500, data: {} });
        await expect(detectLanguage('你好')).resolves.toEqual({ language: 'en', failed: true });

        httpMock.queue({ data: { lan: 'xx' } });
        await expect(detectLanguage('???')).resolves.toEqual({ language: 'en', failed: true });
    });

    it('takes a request that cannot be made for a failure', async () => {
        useEngine('google');
        // Nothing queued: the request rejects, as it does without a network

        await expect(detectLanguage('你好')).resolves.toEqual({ language: 'en', failed: true });
    });

    it('does not call a detected language a failure, English included', async () => {
        useEngine('baidu');
        httpMock.queue({ data: { lan: 'en' } });
        await expect(detectLanguage('hello')).resolves.toEqual({ language: 'en', failed: false });

        useEngine('local');
        fakeTauri.command('lang_detect', () => 'en');
        await expect(detectLanguage('hello')).resolves.toEqual({ language: 'en', failed: false });
    });
});
