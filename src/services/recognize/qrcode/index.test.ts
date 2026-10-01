import jsQR from 'jsqr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { info, Language, recognize } from './index';

// jsdom cannot draw or decode pixels, so jsQR is replaced and the tests decide what it finds.
vi.mock('jsqr', () => ({ default: vi.fn() }));

const decode = vi.mocked(jsQR);

const pixels = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);

// jsdom has no canvas and does not load images: give the service a canvas context that returns
// `pixels`, and an Image whose load event fires once the caller has set its handlers (or, with
// loads: false, whose error event does). Returns what the service created and called.
function stubBrowser({ width = 40, height = 30, loads = true } = {}) {
    const canvases: HTMLCanvasElement[] = [];
    const images: { src: string }[] = [];
    const context = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: pixels })),
    };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
        this: HTMLCanvasElement
    ) {
        canvases.push(this);
        return context as any;
    });

    class FakeImage {
        width = width;
        height = height;
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private source = '';

        constructor() {
            images.push(this);
        }

        get src(): string {
            return this.source;
        }

        set src(value: string) {
            this.source = value;
            queueMicrotask(() => (loads ? this.onload?.() : this.onerror?.()));
        }
    }
    vi.stubGlobal('Image', FakeImage);

    return { canvases, images, context, getContext };
}

// True when the promise has still not settled once everything queued behind it has run.
async function isPending(promise: Promise<unknown>): Promise<boolean> {
    let settled = false;
    promise.then(
        () => (settled = true),
        () => (settled = true)
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    return !settled;
}

beforeEach(() => {
    decode.mockReset();
});

describe('qrcode OCR', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('draws the image on a canvas of its size, decodes the pixels and returns the data of the code', async () => {
        const { canvases, images, context, getContext } = stubBrowser();
        decode.mockReturnValue({ data: 'https://example.com/pot' } as any);

        await expect(recognize('aW1hZ2U=', '')).resolves.toBe('https://example.com/pot');

        expect(images.map((image) => image.src)).toEqual(['data:image/png;base64,aW1hZ2U=']);
        expect(getContext).toHaveBeenCalledTimes(1);
        expect(getContext).toHaveBeenCalledWith('2d');
        expect([canvases[0].width, canvases[0].height]).toEqual([40, 30]);
        expect(context.drawImage).toHaveBeenCalledWith(images[0], 0, 0);
        expect(context.getImageData).toHaveBeenCalledWith(0, 0, 40, 30);
        expect(decode).toHaveBeenCalledWith(pixels, 40, 30);
    });

    it('throws a message when jsQR finds no code', async () => {
        stubBrowser();
        decode.mockReturnValue(null);

        await expect(recognize('aW1hZ2U=', '')).rejects.toBe('QR code not recognized or multiple QR codes exist');
    });

    // Known issue: the loader has no onerror, so an image that cannot be read never settles.
    it('never settles when the image fails to load', async () => {
        stubBrowser({ loads: false });

        expect(await isPending(recognize('aW1hZ2U=', ''))).toBe(true);
        expect(decode).not.toHaveBeenCalled();
    });

    // The promise is only resolved for an image with both a width and a height.
    it.each([
        [0, 30],
        [40, 0],
        [0, 0],
    ])('never settles for an image of %i x %i', async (width, height) => {
        stubBrowser({ width, height });

        expect(await isPending(recognize('aW1hZ2U=', ''))).toBe(true);
        expect(decode).not.toHaveBeenCalled();
    });
});
