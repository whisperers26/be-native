export const info = {
    name: 'system_tts',
    // The Config window shows the OS logo (logo/<osType>.svg) in its place.
    icon: 'system',
};

// BCP-47 tags; the Rust side picks the installed voice for the tag, or its language. A language the OS has no
// voice for is reported as an error.
export enum Language {
    zh_cn = 'zh-CN',
    zh_tw = 'zh-TW',
    ja = 'ja',
    en = 'en',
    ko = 'ko',
    fr = 'fr',
    es = 'es',
    ru = 'ru',
    de = 'de',
    it = 'it',
    tr = 'tr',
    pt_pt = 'pt-PT',
    pt_br = 'pt-BR',
    vi = 'vi',
    id = 'id',
    th = 'th',
    ms = 'ms',
    ar = 'ar',
    hi = 'hi',
    mn_cy = 'mn',
    km = 'km',
    nb_no = 'nb',
    nn_no = 'nn',
    fa = 'fa',
    sv = 'sv',
    pl = 'pl',
    nl = 'nl',
    uk = 'uk',
    he = 'he',
}
