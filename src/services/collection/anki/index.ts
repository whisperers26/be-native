import { fetch, Body } from '@tauri-apps/api/http';
import { store } from '../../../utils/store';
import type { CollectionOptions, ServiceConfig } from '../../../types/service';

interface AnkiPronunciation {
    region?: string;
    symbol: string;
    voice?: string | number[];
}

// The part of a dictionary result that this service reads.
interface AnkiEntry {
    pronunciations?: AnkiPronunciation[];
    explanations: { trait: string; explains: string[] }[];
}

interface AnkiAudio {
    data: string;
    filename: string;
    fields: string[];
}

interface AnkiConnectResponse {
    result: unknown;
    error: string | null;
}

export async function collection(
    source: string,
    target: string | AnkiEntry,
    options: CollectionOptions = {} as CollectionOptions
): Promise<void> {
    const { config } = options;

    let ankiConfig: ServiceConfig = (await store.get('anki')) ?? {};
    if (config !== undefined) {
        ankiConfig = config;
    }
    const port = ankiConfig['port'] ?? 8765;

    async function ankiConnect(action: string, version: number, params: Record<string, unknown> = {}) {
        let res = await fetch<AnkiConnectResponse>(`http://127.0.0.1:${port}`, {
            method: 'POST',
            body: Body.json({ action, version, params }),
        });
        return res.data;
    }

    function ankiText(target: string | AnkiEntry) {
        let result = '';
        if (typeof target === 'object') {
            for (let explanation of target.explanations) {
                result += explanation.trait + '. ';
                let index = 0;
                for (let explain of explanation.explains) {
                    index++;
                    if (index !== explanation.explains.length) {
                        result += explain + '; ';
                    } else {
                        result += explain + '<br>';
                    }
                }
            }
        } else {
            return target;
        }

        return result;
    }

    function ankiPronunciation(target: string | AnkiEntry) {
        let results: { regionSymbol: string; audio?: AnkiAudio }[] = [];
        if (typeof target !== 'object' || target.pronunciations === undefined) {
            return results;
        }
        for (let i = 0; i < target.pronunciations.length; i++) {
            let pronunciation = target.pronunciations[i];

            let region = pronunciation.region;
            let symbol = pronunciation.symbol;

            // make pronunciation symbol readable
            region = region ? `[${region}]` : '';
            symbol = symbol[0] === '/' ? symbol : `/${symbol}/`;
            let regionSymbol = `${region} ${symbol}`;

            let audio;
            if (pronunciation.voice) {
                // step1: convert number array to Char String
                // step2: convert Char String to base64
                // @ts-expect-error known bug (known-issues.md): voice can be a URL string, which is not char codes
                let voiceString = String.fromCharCode(...pronunciation.voice);
                let voice = btoa(voiceString);

                let filename = `${region}_${source}.mp3`;
                let fields = [`Voice${i + 1}`];

                audio = { data: voice, filename, fields };
            }
            results.push({ regionSymbol, audio });
        }
        return results;
    }

    await ankiConnect('createDeck', 6, { deck: 'Pot' });

    await ankiConnect('createModel', 6, {
        modelName: 'Pot Card 2',
        inOrderFields: ['Front', 'Back', 'Symbol1', 'Voice1', 'Symbol2', 'Voice2'],
        isCloze: false,
        cardTemplates: [
            {
                Name: 'Pot Card 2',
                Front: '{{Front}}',
                Back: '{{FrontSide}}<br>{{Symbol1}} {{Voice1}}<br>{{Symbol2}} {{Voice2}}<hr id=answer>{{Back}}',
            },
        ],
    });

    let pronunciations = ankiPronunciation(target);
    await ankiConnect('addNote', 6, {
        note: {
            deckName: 'Pot',
            modelName: 'Pot Card 2',
            fields: {
                Front: source,
                Back: ankiText(target),
                Symbol1: pronunciations[0] && pronunciations[0].regionSymbol,
                Symbol2: pronunciations[1] && pronunciations[1].regionSymbol,
            },
            audio: pronunciations.map((pronunciation) => {
                return pronunciation.audio;
            }),
        },
    });
}

export * from './Config';
export * from './info';
