import { describe, expect, it } from 'vitest';
import { classifyLogLines } from './log';

// pot.log lines look like "[date][time][LEVEL][target] message" (tauri-plugin-log).
const logged = (level: string, message: string) => `[2026-10-01][01:45:28][${level}][webview::unknown] ${message}`;

describe('classifyLogLines', () => {
    it('ignores lines that are not errors', () => {
        const lines = [
            '',
            logged('INFO', '[bing]reject:Get Token Failed'),
            logged('DEBUG', 'flushed 139 bytes'),
            logged('TRACE', 'checkout dropped for ("https", fanyi.baidu.com)'),
        ];

        expect(classifyLogLines(lines)).toEqual({ appErrors: [], serviceErrors: [] });
    });

    it('treats a panic as an app error', () => {
        const line = "thread 'tokio-runtime-worker' panicked at src/server.rs:42:9:";

        expect(classifyLogLines([line])).toEqual({ appErrors: [line], serviceErrors: [] });
    });

    it('treats an [ERROR] line that is not a service failure as an app error', () => {
        const line = logged('ERROR', 'failed to read config.json: invalid type: string "x", expected a map');

        expect(classifyLogLines([line])).toEqual({ appErrors: [line], serviceErrors: [] });
    });

    it.each([
        [
            'lingva',
            logged(
                'ERROR',
                '[lingva]happened error: Network Error: error sending request for url ' +
                    '(https://lingva.pot-app.com/api/v1/auto/zh/hello%20world): error trying to connect: ' +
                    'dns error: No such host is known. (os error 11001)'
            ),
        ],
        ['bing', logged('ERROR', '[bing]happened error: Get Token Failed')],
        ['ecdict', logged('ERROR', '[ecdict]happened error: Http Request Error')],
    ])('reports the %s service failing as a warning', (_service, line) => {
        expect(classifyLogLines([line])).toEqual({ appErrors: [], serviceErrors: [line] });
    });

    it('sorts a mixed log, keeping each line and the order they came in', () => {
        const panic = "thread 'main' panicked at src/main.rs:12:5:";
        const appError = logged('ERROR', 'failed to read config.json');
        const bing = logged('ERROR', '[bing]happened error: Get Token Failed');
        const ecdict = logged('ERROR', '[ecdict]happened error: Http Request Error');
        const lines = [logged('INFO', 'started'), bing, panic, logged('INFO', 'translating'), ecdict, appError];

        expect(classifyLogLines(lines)).toEqual({ appErrors: [panic, appError], serviceErrors: [bing, ecdict] });
    });
});
