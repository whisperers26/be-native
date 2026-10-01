import { beforeEach, describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { initEnv } from '../../../utils/env';
import { info, Language, recognize } from './index';

const WINDOWS = 'Windows_NT';
const LINUX = 'Linux';
const MACOS = 'Darwin';

// The service reads the OS that initEnv stored, so each test picks one.
async function useOs(osType: string): Promise<void> {
    fakeTauri.os.osType = osType;
    await initEnv();
}

// Answers system_ocr with `text`, and returns what the service asked for.
function ocrReturns(text: string): { requested: unknown[] } {
    const requested: unknown[] = [];
    fakeTauri.command('system_ocr', (args) => {
        requested.push(args);
        return text;
    });
    return { requested };
}

// Makes the local language detector answer `detected`.
function detectAs(detected: string): void {
    fakeTauri.command('lang_detect', () => detected);
}

function detectCalls() {
    return fakeTauri.calls.filter((call) => call.cmd === 'lang_detect').map((call) => call.args);
}

beforeEach(() => {
    // Detection for 'auto' uses the Rust detector instead of a web service.
    fakeTauri.store.set('translate_detect_engine', 'local');
});

describe('system OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('maps every language of the table to the language code of each OS', async () => {
        const table: Record<string, Record<string, unknown>> = {};
        for (const osType of [LINUX, MACOS, WINDOWS]) {
            await useOs(osType);
            const { requested } = ocrReturns('');
            for (const language of Object.keys(Language)) {
                await recognize('', language);
            }
            table[osType] = Object.fromEntries(
                Object.keys(Language).map((language, index) => [language, (requested[index] as any).lang])
            );
        }

        expect(table).toMatchSnapshot();
    });

    describe('Windows', () => {
        beforeEach(() => useOs(WINDOWS));

        it('asks system_ocr for the Windows language tag and returns the trimmed text', async () => {
            const { requested } = ocrReturns('  Hello World \n');

            await expect(recognize('aW1hZ2U=', 'en')).resolves.toBe('Hello World');
            expect(requested).toEqual([{ lang: 'en-US' }]);
        });

        it('does not send the image: the Rust command reads the screenshot it saved in the cache', async () => {
            const { requested } = ocrReturns('x');

            await recognize('aW1hZ2U=', 'en');

            expect(JSON.stringify(requested)).not.toContain('aW1hZ2U=');
        });

        it.each([
            ['zh_cn', 'zh-CN', '你 好 世 界', '你好世界'],
            ['zh_tw', 'zh-TW', '你 好 世 界', '你好世界'],
            ['ja', 'ja-JP', 'こ ん に ち は 世 界', 'こんにちは世界'],
        ])('removes the spaces from %s text', async (language, tag, text, expected) => {
            const { requested } = ocrReturns(text);

            await expect(recognize('aW1hZ2U=', language)).resolves.toBe(expected);
            expect(requested).toEqual([{ lang: tag }]);
            expect(detectCalls()).toEqual([]);
        });

        it('keeps the spaces of other languages, such as Korean', async () => {
            ocrReturns('안 녕 하 세 요');

            await expect(recognize('aW1hZ2U=', 'ko')).resolves.toBe('안 녕 하 세 요');
        });

        it('auto: detects the language of the raw result and removes the spaces when it is zh_cn', async () => {
            const { requested } = ocrReturns(' 你 好 世 界 ');
            detectAs('zh_cn');

            await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('你好世界');
            expect(requested).toEqual([{ lang: 'auto' }]);
            expect(detectCalls()).toEqual([{ text: ' 你 好 世 界 ' }]);
        });

        it('auto: keeps the spaces when the detected language is not zh_cn', async () => {
            ocrReturns(' こ ん に ち は ');
            detectAs('ja');

            await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('こ ん に ち は');
        });

        it('passes the error of system_ocr on', async () => {
            fakeTauri.command('system_ocr', () => {
                throw 'OCR failed';
            });

            await expect(recognize('aW1hZ2U=', 'en')).rejects.toBe('OCR failed');
        });
    });

    describe('Linux', () => {
        beforeEach(() => useOs(LINUX));

        it('asks system_ocr for the tesseract language code and returns the trimmed text', async () => {
            const { requested } = ocrReturns('  Hello World \n');

            await expect(recognize('aW1hZ2U=', 'en')).resolves.toBe('Hello World');
            expect(requested).toEqual([{ lang: 'eng' }]);
        });

        it.each([
            ['zh_cn', 'chi_sim'],
            ['zh_tw', 'chi_tra'],
        ])('removes the spaces from %s text', async (language, code) => {
            const { requested } = ocrReturns('你 好 世 界');

            await expect(recognize('aW1hZ2U=', language)).resolves.toBe('你好世界');
            expect(requested).toEqual([{ lang: code }]);
            expect(detectCalls()).toEqual([]);
        });

        it('keeps the spaces of Japanese text, unlike Windows', async () => {
            const { requested } = ocrReturns('こ ん に ち は');

            await expect(recognize('aW1hZ2U=', 'ja')).resolves.toBe('こ ん に ち は');
            expect(requested).toEqual([{ lang: 'jpn' }]);
        });

        it('auto: removes the spaces when the detected language is zh_cn', async () => {
            const { requested } = ocrReturns('你 好 世 界');
            detectAs('zh_cn');

            await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('你好世界');
            expect(requested).toEqual([{ lang: 'auto' }]);
        });

        it('auto: keeps the spaces when the detected language is not zh_cn', async () => {
            ocrReturns('Hello World');
            detectAs('en');

            await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('Hello World');
        });
    });

    describe('macOS', () => {
        beforeEach(() => useOs(MACOS));

        it('asks system_ocr for the macOS language tag and returns the trimmed text', async () => {
            const { requested } = ocrReturns('  Hello World \n');

            await expect(recognize('aW1hZ2U=', 'en')).resolves.toBe('Hello World');
            expect(requested).toEqual([{ lang: 'en-US' }]);
        });

        it('never removes spaces, even from Chinese text', async () => {
            const { requested } = ocrReturns(' 你 好 世 界 ');

            await expect(recognize('aW1hZ2U=', 'zh_cn')).resolves.toBe('你 好 世 界');
            expect(requested).toEqual([{ lang: 'zh-Hans' }]);
        });

        it('auto: does not detect the language and keeps the spaces', async () => {
            const { requested } = ocrReturns('你 好 世 界');
            detectAs('zh_cn');

            await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('你 好 世 界');
            expect(requested).toEqual([{ lang: 'auto' }]);
            expect(detectCalls()).toEqual([]);
        });
    });

    // Known issue: the OS tables key Portuguese as pt, but the language table maps it to pt_pt, so
    // Portuguese is sent as undefined (Tauri then drops the argument, and the Rust command fails).
    it.each([LINUX, MACOS, WINDOWS])('%s: sends lang undefined for pt_pt', async (osType) => {
        await useOs(osType);
        const { requested } = ocrReturns('Olá');

        await expect(recognize('aW1hZ2U=', 'pt_pt')).resolves.toBe('Olá');
        expect(requested).toHaveLength(1);
        expect((requested[0] as any).lang).toBeUndefined();
    });

    it('returns undefined without calling system_ocr on an unknown OS', async () => {
        await useOs('FreeBSD');
        const { requested } = ocrReturns('Hello');

        await expect(recognize('aW1hZ2U=', 'en')).resolves.toBeUndefined();
        expect(requested).toEqual([]);
    });
});
