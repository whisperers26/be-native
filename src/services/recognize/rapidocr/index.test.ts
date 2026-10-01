import { beforeEach, describe, expect, it, vi } from 'vitest';

// The models, the WebAssembly runtime and the canvas never run in a test: the service is checked for what it hands
// to the OCR library and what it makes of the answer.
const { init, ocr, loadOrt, loadDictionary } = vi.hoisted(() => ({
    init: vi.fn(),
    ocr: vi.fn(),
    loadOrt: vi.fn(),
    loadDictionary: vi.fn(),
}));
vi.mock('esearch-ocr', () => ({ init }));
vi.mock('./runtime', () => ({
    DET_MODEL: '/rapidocr/det.onnx',
    REC_MODEL: '/rapidocr/rec.onnx',
    loadOrt,
    loadDictionary,
}));

import { info, Language, recognize } from './index';

const ort = { env: { wasm: {} } };

function line(text: string) {
    return { text, mean: 0.9, box: [], style: {} };
}

// What the library's ocr() resolves to, as far as the service reads it: columns of paragraphs of lines.
function recognized(...columns: string[][][]) {
    return {
        columns: columns.map((paragraphs) => ({
            parragraphs: paragraphs.map((lines) => ({ src: lines.map(line), parse: line(lines.join(' ')) })),
        })),
    };
}

// What was drawn on the canvas the service made.
let drawn: unknown[][];

beforeEach(() => {
    init.mockReset().mockResolvedValue({ ocr });
    ocr.mockReset().mockResolvedValue(recognized());
    loadOrt.mockReset().mockResolvedValue(ort);
    loadDictionary.mockReset().mockResolvedValue('abc');
    drawn = [];
    // A 100 x 20 screenshot whose corner pixel is dark grey.
    vi.stubGlobal(
        'Image',
        class {
            src = '';
            naturalWidth = 100;
            naturalHeight = 20;
            decode = async () => {};
        }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        const context = {
            fillStyle: '',
            drawImage: (image: { src: string }, x: number, y: number) => drawn.push(['image', image.src, x, y]),
            getImageData: () => ({ data: [32, 33, 34, 255] }),
            fillRect: (x: number, y: number, w: number, h: number) => drawn.push(['fill', context.fillStyle, x, y, w, h]),
        };
        return context as unknown as CanvasRenderingContext2D;
    } as any);
});

// The service keeps its loaded engine for the life of the module, so the two tests about loading come first, in this
// order: the engine is not loaded before the first, and is loaded after it.
describe('rapidocr OCR', () => {
    it('tries to load again after a failed load, with the bundled models and without the library spacing', async () => {
        loadOrt.mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'));
        ocr.mockResolvedValue(recognized([['ok']]));

        await expect(recognize('aW1hZ2U=', 'auto')).rejects.toThrow('Failed to fetch');
        expect(init).not.toHaveBeenCalled();
        await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('ok');
        expect(init.mock.calls).toEqual([
            [
                {
                    ort,
                    det: { input: '/rapidocr/det.onnx' },
                    rec: { input: '/rapidocr/rec.onnx', decodeDic: 'abc', optimize: { space: false } },
                },
            ],
        ]);
    });

    it('does not load the engine again once it is loaded', async () => {
        await recognize('aW1hZ2U=', 'auto');
        await recognize('aW1hZ2U=', 'auto');

        expect(ocr).toHaveBeenCalledTimes(2);
        expect(init).not.toHaveBeenCalled();
        expect(loadOrt).not.toHaveBeenCalled();
    });

    it('exports its info and the languages its model reads', () => {
        expect(info).toEqual({ name: 'rapidocr', icon: 'logo/paddle.png' });
        expect(Object.keys(Language)).toEqual(['auto', 'zh_cn', 'zh_tw', 'en', 'ja']);
    });

    it('returns one line per line of text, in reading order', async () => {
        ocr.mockResolvedValue(recognized([['Hello', 'world'], ['你好']], [['Second column']]));

        await expect(recognize('aW1hZ2U=', 'auto')).resolves.toBe('Hello\nworld\n你好\nSecond column');
    });

    it('gives the image a margin of its own background colour', async () => {
        await recognize('aW1hZ2U=', 'auto');

        const canvas: HTMLCanvasElement = ocr.mock.calls[0][0];
        expect([canvas.width, canvas.height]).toEqual([132, 52]);
        expect(drawn).toEqual([
            ['image', 'data:image/png;base64,aW1hZ2U=', 16, 16],
            ['fill', 'rgb(32, 33, 34)', 0, 0, 132, 52],
            ['image', 'data:image/png;base64,aW1hZ2U=', 16, 16],
        ]);
    });
});
