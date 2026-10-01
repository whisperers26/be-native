import { BaseDirectory } from '@tauri-apps/api/path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { httpMock } from '../../../test/http';
import { info, Language, recognize } from './index';

const config = { token: 'test-token' };
const screenshot = [137, 80, 78, 71];
// What the caller passes in; the service ignores it and reads the cut screenshot instead.
const base64 = 'bm90LXRoZS1maWxl';

beforeEach(() => {
    fakeTauri.files.set('AppCache:pot_screenshot_cut.png', screenshot);
});

describe('simple_latex OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('posts the cut screenshot as a multipart file with the token header and returns the trimmed latex', async () => {
        httpMock.queue({ data: { status: true, res: { latex: ' \\frac{a}{b} ', conf: 0.98 }, request_id: 'tr_1' } });

        await expect(recognize(base64, 'zh_cn', { config })).resolves.toBe('\\frac{a}{b}');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('reads pot_screenshot_cut.png from the app cache and ignores the base64 argument', async () => {
        httpMock.queue({ data: { res: { latex: 'x' } } });

        await recognize(base64, 'zh_cn', { config });

        const reads = fakeTauri.calls.filter((call) => call.args.__tauriModule === 'Fs');
        expect(reads.map((call) => call.args.message)).toEqual([
            { cmd: 'readFile', path: 'pot_screenshot_cut.png', options: { dir: BaseDirectory.AppCache } },
        ]);
        expect((httpMock.calls[0].options as any).body.payload.file.file).toEqual(new Uint8Array(screenshot));
        expect(JSON.stringify(httpMock.calls)).not.toContain(base64);
    });

    it('sends the token of the config in the token header', async () => {
        httpMock.queue({ data: { res: { latex: 'x' } } });

        await recognize(base64, 'zh_cn', { config: { token: 'another-token' } });

        expect((httpMock.calls[0].options as any).headers.token).toBe('another-token');
    });

    it('throws the response as JSON when it has no res', async () => {
        httpMock.queue({ data: { status: false, error: 'invalid token', request_id: 'tr_2' } });

        await expect(recognize(base64, 'zh_cn', { config })).rejects.toBe(
            '{"status":false,"error":"invalid token","request_id":"tr_2"}'
        );
    });

    it('throws the response as JSON when res has no latex, or an empty one', async () => {
        httpMock.queue({ data: { status: true, res: { conf: 0 } } }, { data: { status: true, res: { latex: '' } } });

        await expect(recognize(base64, 'zh_cn', { config })).rejects.toBe('{"status":true,"res":{"conf":0}}');
        await expect(recognize(base64, 'zh_cn', { config })).rejects.toBe('{"status":true,"res":{"latex":""}}');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 401, data: { status: false, err_info: { err_code: 'auth' } } });

        await expect(recognize(base64, 'zh_cn', { config })).rejects.toBe(
            'Http Request Error\nHttp Status: 401\n{"status":false,"err_info":{"err_code":"auth"}}'
        );
    });
});
