import { fetch } from '@tauri-apps/api/http';
import { Language } from './info';
import type { TranslateResult } from '../../../types/service';

// `declare` fields are type-only: a plain field declaration would be emitted as a class field.
class Pronunciation {
    declare region: string;
    declare symbol: string;
    declare voice: string | number[];
    constructor(region: string, symbol: string, voice: string) {
        this.region = region;
        this.symbol = symbol;
        this.voice = voice;
    }
}

class Explanation {
    declare trait: string;
    declare explains: string[];
    constructor(trait: string, explains: string[]) {
        this.trait = trait;
        this.explains = explains;
    }
}

class WordTranslateResult {
    declare pronunciations: Pronunciation[];
    declare explanations: Explanation[];
    constructor(pronunciations: Pronunciation[], explanations: Explanation[]) {
        this.pronunciations = pronunciations;
        this.explanations = explanations;
    }
}

function tryDetectLanguage(text: string): Language | null {
    if (/^[A-Za-z]/.test(text)) {
        return Language.en;
    }
    return null;
}

// 翻译服务商：https://dictionary.cambridge.org/
export async function translate(text: string, from: string, to: string): Promise<TranslateResult> {
    if (Language.auto === from) {
        from = tryDetectLanguage(text) ?? from;
    }
    // only supports English word translation
    if (from !== Language.en || to === undefined || to === from || text.split(' ').length > 1) {
        return '';
    }

    const url = `https://dictionary.cambridge.org/search/direct/?datasetsearch=${from}-${to}&q=${text}`;
    let res = await fetch<string>(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
        },
        responseType: 2,
    });

    if (!res.ok) {
        throw new Error(`Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`);
    }
    const doc = new DOMParser().parseFromString(res.data, 'text/html');
    const entryNodes = doc.querySelectorAll('.pr.entry-body__el');
    if (entryNodes.length === 0) {
        throw new Error(`Words not yet included: ${text}`);
    }

    const resultMap = [...entryNodes].reduce<Record<string, WordTranslateResult>>((dict, entryNode) => {
        const wordTranslateResult = dict['result'] || new WordTranslateResult([], []);

        if (wordTranslateResult.pronunciations.length === 0) {
            const pronunciationNodes = entryNode.querySelectorAll('.dpron-i');
            const pronunciations = [...pronunciationNodes].map((pronunciationNode) => {
                const region = pronunciationNode.querySelector<HTMLElement>('.region')!.innerText;
                const symbol = pronunciationNode.querySelector<HTMLElement>('.pron')!.innerText;
                let voice = pronunciationNode.querySelector<HTMLSourceElement>('.daud source')!.src;
                voice = voice.replace(/^https?:\/\/[^/]+/, 'https://dictionary.cambridge.org');
                voice = voice.replace(/^tauri:\/\/[^/]+/, 'https://dictionary.cambridge.org');
                return new Pronunciation(region, symbol, voice);
            });
            wordTranslateResult.pronunciations.push(...pronunciations);
        }

        const wordPos = entryNode.querySelector<HTMLElement>('.posgram')?.innerText;
        const defBlockNodes = entryNode.querySelectorAll('.sense-body.dsense_b .def-block.ddef_block');
        const explanations = [...defBlockNodes].map((defBlockNode) => {
            const trait =
                wordPos ??
                defBlockNode
                    .querySelector<HTMLElement>('.ddef_h .def.ddef_d.db')!
                    .innerText.replace(/\s+/g, ' ')
                    .trim();
            const explains =
                defBlockNode.querySelector<HTMLElement>('.def-body.ddef_b .trans.dtrans.dtrans-se.break-cj')!.innerText;
            return new Explanation(trait, explains.split(';'));
        });
        wordTranslateResult.explanations.push(...explanations);

        dict['result'] = wordTranslateResult;
        return dict;
    }, {});
    for (let i of resultMap.result.pronunciations) {
        // @ts-expect-error Tauri's FetchOptions requires a method, but fetch defaults to GET without one
        const res = await fetch<number[]>(i.voice as string, { responseType: 3 });
        if (res.ok) {
            i.voice = res.data;
        }
    }
    return resultMap.result;
}

export * from './Config';
export * from './info';
