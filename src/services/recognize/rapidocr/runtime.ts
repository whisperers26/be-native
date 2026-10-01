/**
 * The files under public/rapidocr/: ONNX Runtime's WebAssembly build and the PP-OCRv5 mobile models. They are served
 * as they are and loaded when first needed, so the bundler never sees them (docs/agents/services.md).
 */
const BASE = '/rapidocr';

export const DET_MODEL = `${BASE}/ppocr_v5_mobile_det.onnx`;
export const REC_MODEL = `${BASE}/ppocr_v5_mobile_rec.onnx`;
const DICTIONARY = `${BASE}/ppocrv5_dict.txt`;
const ORT = `${BASE}/ort.wasm.bundle.min.mjs`;

export async function loadOrt(): Promise<typeof import('onnxruntime-web')> {
    // A full URL: given a path, Vite's dev server rewrites the import and then refuses to serve a public file as a
    // module.
    const ort = await import(/* @vite-ignore */ new URL(ORT, window.location.origin).href);
    // More threads need SharedArrayBuffer, which the app's windows do not have.
    ort.env.wasm.numThreads = 1;
    return ort;
}

export async function loadDictionary(): Promise<string> {
    const response = await window.fetch(DICTIONARY);
    if (!response.ok) throw `Failed to load ${DICTIONARY}: ${response.status}`;
    return response.text();
}
