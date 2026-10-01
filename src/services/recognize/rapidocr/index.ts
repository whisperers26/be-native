import { init } from 'esearch-ocr';
import { DET_MODEL, loadDictionary, loadOrt, REC_MODEL } from './runtime';

type Engine = Awaited<ReturnType<typeof init>>;

// Loading the runtime and the models is most of the work, so a window does it once.
let engine: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
    if (engine === null) {
        engine = (async () => {
            const [ort, decodeDic] = await Promise.all([loadOrt(), loadDictionary()]);
            return init({
                ort,
                det: { input: DET_MODEL },
                // The v5 model reads spaces itself; the library's own spacing would add more.
                rec: { input: REC_MODEL, decodeDic, optimize: { space: false } },
            });
        })();
        // A failed load is not kept, so the next recognition tries again.
        engine.catch(() => {
            engine = null;
        });
    }
    return engine;
}

const MARGIN = 16;

/**
 * Text detection misses text that touches the edge of the image, which is what a tight selection around one word
 * gives. Put the image on a larger canvas of its own background colour. (Enlarging small text as well was tried: it
 * made the model drop the spaces between words.)
 */
async function withMargin(base64: string): Promise<HTMLCanvasElement> {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth + 2 * MARGIN;
    canvas.height = image.naturalHeight + 2 * MARGIN;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, MARGIN, MARGIN);
    // The corner pixel stands for the background.
    const [r, g, b] = context.getImageData(MARGIN, MARGIN, 1, 1).data;
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, MARGIN, MARGIN);
    return canvas;
}

/** Recognize with the bundled PP-OCRv5 models (the ones RapidOCR uses), offline, in this window. */
export async function recognize(base64: string, _language: string): Promise<string> {
    const [ocr, image] = await Promise.all([loadEngine(), withMargin(base64)]);
    const result = await ocr.ocr(image);
    // One line of text per line on screen, in reading order, like the other OCR services. (The library's own
    // paragraphs join lines, and can join ones that only stand close together.)
    return result.columns
        .flatMap((column) => column.parragraphs)
        .flatMap((paragraph) => paragraph.src)
        .map((line) => line.text)
        .join('\n')
        .trim();
}

export * from './Config';
export * from './info';
