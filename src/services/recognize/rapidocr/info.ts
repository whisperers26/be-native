export const info = {
    name: 'rapidocr',
    icon: 'logo/paddle.png',
};

// One model reads all of these, so there is nothing to choose; the other languages need models that are not bundled.
export enum Language {
    auto = 'auto',
    zh_cn = 'zh_cn',
    zh_tw = 'zh_tw',
    en = 'en',
    ja = 'ja',
}
