import * as _system from './system';
import * as _tesseract from './tesseract';
import * as _baidu_ocr from './baidu';
import * as _baidu_accurate_ocr from './baidu_accurate';
import * as _baidu_img_ocr from './baidu_img';
import * as _iflytek_ocr from './iflytek';
import * as _iflytek_intsig_ocr from './iflytek_intsig';
import * as _iflytek_latex_ocr from './iflytek_latex';
import * as _simple_latex_ocr from './simple_latex';
import * as _tencent_ocr from './tencent';
import * as _tencent_accurate_ocr from './tencent_accurate';
import * as _tencent_img_ocr from './tencent_img';
import * as _volcengine_ocr from './volcengine';
import * as _volcengine_multi_lang_ocr from './volcengine_multi_lang';
import * as _qrcode from './qrcode';
import type { RecognizeOptions, ServiceModule } from '../../types/service';

// What every module here provides (docs/agents/services.md). `satisfies` checks it and emits nothing.
type RecognizeService = ServiceModule<{
    Language: Record<string, string>;
    recognize: (base64: string, language: string, options: RecognizeOptions) => Promise<string | undefined>;
}>;

export const system = _system satisfies RecognizeService;
export const tesseract = _tesseract satisfies RecognizeService;
export const baidu_ocr = _baidu_ocr satisfies RecognizeService;
export const baidu_accurate_ocr = _baidu_accurate_ocr satisfies RecognizeService;
export const baidu_img_ocr = _baidu_img_ocr satisfies RecognizeService;
export const iflytek_ocr = _iflytek_ocr satisfies RecognizeService;
export const iflytek_intsig_ocr = _iflytek_intsig_ocr satisfies RecognizeService;
export const iflytek_latex_ocr = _iflytek_latex_ocr satisfies RecognizeService;
export const simple_latex_ocr = _simple_latex_ocr satisfies RecognizeService;
export const tencent_ocr = _tencent_ocr satisfies RecognizeService;
export const tencent_accurate_ocr = _tencent_accurate_ocr satisfies RecognizeService;
export const tencent_img_ocr = _tencent_img_ocr satisfies RecognizeService;
export const volcengine_ocr = _volcengine_ocr satisfies RecognizeService;
export const volcengine_multi_lang_ocr = _volcengine_multi_lang_ocr satisfies RecognizeService;
export const qrcode = _qrcode satisfies RecognizeService;
