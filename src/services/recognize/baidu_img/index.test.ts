import { BaseDirectory } from '@tauri-apps/api/path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { appid: 'test-appid', secret: 'test-secret' };
const screenshot = [137, 80, 78, 71];
// What the caller passes in; the service ignores it and reads the cut screenshot instead.
const base64 = 'bm90LXRoZS1maWxl';

// The payload of the form body of a recorded request.
function formOf(call: { options?: Record<string, unknown> }): any {
    return (call.options as any).body.payload;
}

beforeEach(() => {
    fakeTauri.files.set('AppCache:pot_screenshot_cut.png', screenshot);
});

describe('baidu_img OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('throws when the appid is empty, before reading the screenshot', async () => {
        await expect(recognize(base64, 'en', { config: { appid: '', secret: 'test-secret' } })).rejects.toBe(
            'Please configure appid and secret'
        );
        expect(httpMock.calls).toHaveLength(0);
        expect(fakeTauri.calls.filter((call) => call.args.__tauriModule === 'Fs')).toEqual([]);
    });

    it('throws when the secret is empty, before reading the screenshot', async () => {
        await expect(recognize(base64, 'en', { config: { appid: 'test-appid', secret: '' } })).rejects.toBe(
            'Please configure appid and secret'
        );
        expect(httpMock.calls).toHaveLength(0);
        expect(fakeTauri.calls.filter((call) => call.args.__tauriModule === 'Fs')).toEqual([]);
    });

    it('posts the cut screenshot as a multipart form signed with md5 and returns sumDst', async () => {
        httpMock.queue({ data: { data: { sumSrc: 'Hallo Welt', sumDst: 'Hello World' } } });

        await expect(recognize(base64, 'en', { config })).resolves.toBe('Hello World');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('reads pot_screenshot_cut.png from the app cache and ignores the base64 argument', async () => {
        httpMock.queue({ data: { data: { sumSrc: 'a', sumDst: 'b' } } });

        await recognize(base64, 'en', { config });

        const reads = fakeTauri.calls.filter((call) => call.args.__tauriModule === 'Fs');
        expect(reads.map((call) => call.args.message)).toEqual([
            { cmd: 'readFile', path: 'pot_screenshot_cut.png', options: { dir: BaseDirectory.AppCache } },
        ]);
        expect(formOf(httpMock.calls[0]).image.file).toEqual(new Uint8Array(screenshot));
        expect(JSON.stringify(httpMock.calls)).not.toContain(base64);
    });

    it('signs md5(appid + md5(file) + salt + "APICUIDmac" + secret)', async () => {
        httpMock.queue({ data: { data: { sumSrc: 'a', sumDst: 'b' } } });

        await recognize(base64, 'en', { config });

        // The md5 of the bytes 137, 80, 78, 71 is 3bdaf5969285188ac756c339f69f5c79, so this is
        // md5('test-appid' + '3bdaf5969285188ac756c339f69f5c79' + 'nanoid-fixed-id' + 'APICUIDmac' + 'test-secret'),
        // worked out with Node's crypto module.
        expect(formOf(httpMock.calls[0]).sign).toBe('e2b7dfb574d4a2ad58cd333269cdc7db');
    });

    it('auto: translates to zh and returns sumSrc, the detected source text', async () => {
        httpMock.queue({ data: { data: { sumSrc: ' Hallo Welt ', sumDst: '你好，世界' } } });

        await expect(recognize(base64, 'auto', { config })).resolves.toBe('Hallo Welt');
        expect(formOf(httpMock.calls[0])).toMatchObject({ from: 'auto', to: 'zh' });
    });

    it('other languages: sends the language as the target and returns the trimmed sumDst', async () => {
        httpMock.queue({ data: { data: { sumSrc: 'Hello World', sumDst: ' こんにちは世界 ' } } });

        await expect(recognize(base64, 'jp', { config })).resolves.toBe('こんにちは世界');
        expect(formOf(httpMock.calls[0])).toMatchObject({ from: 'auto', to: 'jp' });
    });

    it('throws the response as JSON when it has no data', async () => {
        httpMock.queue({ data: { error_code: '54000', error_msg: 'PARAM_FROM_TO_OR_Q_EMPTY' } });

        await expect(recognize(base64, 'en', { config })).rejects.toBe(
            '{"error_code":"54000","error_msg":"PARAM_FROM_TO_OR_Q_EMPTY"}'
        );
    });

    it('throws the response as JSON when sumSrc or sumDst is empty, even if the one it would return is there', async () => {
        httpMock.queue(
            { data: { data: { sumSrc: 'Hallo', sumDst: '' } } },
            { data: { data: { sumSrc: '', sumDst: 'Hello' } } }
        );

        await expect(recognize(base64, 'auto', { config })).rejects.toBe('{"data":{"sumSrc":"Hallo","sumDst":""}}');
        await expect(recognize(base64, 'en', { config })).rejects.toBe('{"data":{"sumSrc":"","sumDst":"Hello"}}');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(recognize(base64, 'en', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
