import Tesseract from 'tesseract.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { info, Language, recognize } from './index';

// The service only calls Tesseract.recognize(image, language, options); the library's own
// worker, WebAssembly core and language downloads never run in a test.
vi.mock('tesseract.js', () => ({ default: { recognize: vi.fn() } }));

const tesseractRecognize = vi.mocked(Tesseract.recognize);

// What Tesseract.recognize resolves to: the recognized text and a lot of detail the service ignores.
function recognized(text: string) {
    return { data: { text, confidence: 90, words: [] } } as any;
}

beforeEach(() => {
    tesseractRecognize.mockReset();
});

describe('tesseract OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('recognizes the image as a PNG data URL with the app-hosted worker and core and the remote language data', async () => {
        tesseractRecognize.mockResolvedValue(recognized('Hello World\n'));

        await expect(recognize('aW1hZ2U=', 'eng')).resolves.toBe('Hello World');
        expect(tesseractRecognize.mock.calls).toMatchSnapshot();
    });

    it('trims the text and keeps the spaces of non-Chinese languages', async () => {
        tesseractRecognize.mockResolvedValue(recognized('\n こ ん に ち は \n\n'));

        await expect(recognize('aW1hZ2U=', 'jpn')).resolves.toBe('こ ん に ち は');
    });

    it.each([
        ['chi_sim', Language.zh_cn],
        ['chi_tra', Language.zh_tw],
    ])('removes the spaces from %s text', async (language, fromTable) => {
        tesseractRecognize.mockResolvedValue(recognized(' 你 好 ， 世 界 \n'));

        expect(fromTable).toBe(language);
        await expect(recognize('aW1hZ2U=', language)).resolves.toBe('你好，世界');
        expect(tesseractRecognize.mock.calls.map(([, lang]) => lang)).toEqual([language]);
    });

    it('passes the error of the library on', async () => {
        tesseractRecognize.mockRejectedValue(new Error('Network error while fetching language data'));

        await expect(recognize('aW1hZ2U=', 'eng')).rejects.toThrow('Network error while fetching language data');
    });
});
