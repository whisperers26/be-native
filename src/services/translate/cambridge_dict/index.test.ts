import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

// The page builders are compact on purpose: jsdom's innerText is textContent,
// so whitespace between tags would end up in the result.
function pronunciation(region: string, symbol: string, src: string): string {
    return (
        `<span class="${region} dpron-i"><span class="region dreg">${region}</span>` +
        `<span class="daud"><audio><source type="audio/mpeg" src="${src}"></audio></span>` +
        `<span class="pron dpron">${symbol}</span></span>`
    );
}

function definition(heading: string, translation: string): string {
    return (
        '<div class="def-block ddef_block">' +
        `<div class="ddef_h"><div class="def ddef_d db">${heading}</div></div>` +
        `<div class="def-body ddef_b"><span class="trans dtrans dtrans-se break-cj">${translation}</span></div>` +
        '</div>'
    );
}

function entry(parts: { pos?: string; pronunciations?: string[]; definitions: string[] }): string {
    const pos = parts.pos === undefined ? '' : `<span class="posgram dpos-g hdib lmr-5">${parts.pos}</span>`;
    return (
        '<div class="pr entry-body__el">' +
        pos +
        (parts.pronunciations ?? []).join('') +
        `<div class="sense-body dsense_b">${parts.definitions.join('')}</div>` +
        '</div>'
    );
}

function page(...entries: string[]): string {
    return `<html><body>${entries.join('')}</body></html>`;
}

const UK_SRC = '/media/english/uk_pron/u/ukh/ukhel/ukhello00.mp3';
const UK_VOICE = 'https://dictionary.cambridge.org/media/english/uk_pron/u/ukh/ukhel/ukhello00.mp3';
const US_SRC = 'tauri://localhost/media/english/us_pron/h/hel/hello/hello.mp3';

describe('cambridge_dict translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('parses a one-entry page into pronunciations with their audio, and explanations', async () => {
        httpMock.queue(
            {
                data: page(
                    entry({
                        pos: 'noun',
                        pronunciations: [
                            pronunciation('uk', '/həˈləʊ/', UK_SRC),
                            pronunciation('us', '/heˈloʊ/', US_SRC),
                        ],
                        definitions: [definition('used as a greeting', '你好;喂')],
                    })
                ),
            },
            { data: [1, 2, 3] },
            { data: [4, 5, 6] }
        );

        await expect(translate('hello', 'english', 'chinese-simplified')).resolves.toEqual({
            pronunciations: [
                { region: 'uk', symbol: '/həˈləʊ/', voice: [1, 2, 3] },
                { region: 'us', symbol: '/heˈloʊ/', voice: [4, 5, 6] },
            ],
            explanations: [{ trait: 'noun', explains: ['你好', '喂'] }],
        });
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('keeps the audio URL as the voice when the audio request fails', async () => {
        httpMock.queue(
            {
                data: page(
                    entry({
                        pos: 'noun',
                        pronunciations: [pronunciation('uk', '/həˈləʊ/', UK_SRC)],
                        definitions: [definition('used as a greeting', '你好')],
                    })
                ),
            },
            { status: 404, data: null }
        );

        await expect(translate('hello', 'english', 'chinese-simplified')).resolves.toEqual({
            pronunciations: [{ region: 'uk', symbol: '/həˈləʊ/', voice: UK_VOICE }],
            explanations: [{ trait: 'noun', explains: ['你好'] }],
        });
    });

    it('takes pronunciations from the first entry that has any and explanations from every entry', async () => {
        httpMock.queue(
            {
                data: page(
                    entry({ pos: 'noun', definitions: [definition('a greeting', '问候')] }),
                    entry({
                        pos: 'verb',
                        pronunciations: [pronunciation('uk', '/həˈləʊ/', UK_SRC)],
                        definitions: [definition('to greet', '打招呼'), definition('to say hello', '说你好;喊')],
                    }),
                    entry({
                        pos: 'exclamation',
                        pronunciations: [pronunciation('us', '/heˈloʊ/', US_SRC)],
                        definitions: [definition('used for surprise', '咦')],
                    })
                ),
            },
            { data: [7] }
        );

        await expect(translate('hello', 'english', 'chinese-simplified')).resolves.toEqual({
            pronunciations: [{ region: 'uk', symbol: '/həˈləʊ/', voice: [7] }],
            explanations: [
                { trait: 'noun', explains: ['问候'] },
                { trait: 'verb', explains: ['打招呼'] },
                { trait: 'verb', explains: ['说你好', '喊'] },
                { trait: 'exclamation', explains: ['咦'] },
            ],
        });
        expect(httpMock.calls.map((call) => call.url)).toEqual([
            'https://dictionary.cambridge.org/search/direct/?datasetsearch=english-chinese-simplified&q=hello',
            UK_VOICE,
        ]);
    });

    it('uses the whitespace-collapsed definition heading as the trait when the entry has no part of speech', async () => {
        httpMock.queue({
            data: page(entry({ definitions: [definition('  used   as\n a   greeting ', '你好')] })),
        });

        await expect(translate('hello', 'english', 'chinese-simplified')).resolves.toEqual({
            pronunciations: [],
            explanations: [{ trait: 'used as a greeting', explains: ['你好'] }],
        });
    });

    it('throws "Words not yet included" when the page has no entries', async () => {
        httpMock.queue({ data: '<html><body><p>nothing here</p></body></html>' });

        await expect(translate('asdfgh', 'english', 'chinese-simplified')).rejects.toThrow(
            new Error('Words not yet included: asdfgh')
        );
    });

    it('throws an Error with the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 503, data: 'unavailable' });

        await expect(translate('hello', 'english', 'chinese-simplified')).rejects.toThrow(
            new Error('Http Request Error\nHttp Status: 503\n"unavailable"')
        );
    });

    it('detects English from a leading Latin letter when from is auto', async () => {
        httpMock.queue({ data: '<html><body></body></html>' });

        await expect(translate('hello', 'auto', 'chinese-simplified')).rejects.toThrow('Words not yet included: hello');
        expect(httpMock.calls[0].url).toBe(
            'https://dictionary.cambridge.org/search/direct/?datasetsearch=english-chinese-simplified&q=hello'
        );
    });

    it('returns an empty string without a request when auto cannot detect English', async () => {
        await expect(translate('你好', 'auto', 'english')).resolves.toBe('');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('returns an empty string without a request for several words', async () => {
        await expect(translate('hello world', 'english', 'chinese-simplified')).resolves.toBe('');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('returns an empty string without a request when the source is not English', async () => {
        await expect(translate('你好', 'chinese-simplified', 'english')).resolves.toBe('');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('returns an empty string without a request when the target is the source', async () => {
        await expect(translate('hello', 'english', 'english')).resolves.toBe('');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('returns an empty string without a request when the target is undefined', async () => {
        await expect(translate('hello', 'english', undefined as any)).resolves.toBe('');
        expect(httpMock.calls).toHaveLength(0);
    });
});
