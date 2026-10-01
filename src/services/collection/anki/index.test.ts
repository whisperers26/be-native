import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { fetchMock, httpMock } from '../../../test/http';
import { collection, info } from './index';

// The replies of a working AnkiConnect to createDeck, createModel and addNote.
function ankiAnswers() {
    httpMock.queue(
        { data: { result: 1767323045678, error: null } },
        { data: { result: { id: 1767323045679, name: 'Pot Card 2' }, error: null } },
        { data: { result: 1767323045680, error: null } }
    );
}

// The JSON bodies sent to AnkiConnect, in order.
function sentActions(): { action: string; version: number; params: any }[] {
    return httpMock.calls.map((call) => (call.options as any).body.payload);
}

function sentUrls(): string[] {
    return httpMock.calls.map((call) => call.url);
}

// The URLs of the three requests of one run when AnkiConnect listens on `port`.
function threeRequestsTo(port: number): string[] {
    return Array(3).fill(`http://127.0.0.1:${port}`);
}

describe('anki collection', () => {
    it('exports its info', () => {
        expect({ info }).toMatchSnapshot();
    });

    it('creates the deck and the note type, then adds the note, with three POSTs to AnkiConnect', async () => {
        ankiAnswers();

        await expect(collection('hello', 'hallo', { config: {} })).resolves.toBeUndefined();
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('sends createDeck, createModel and addNote in this order, all as version 6', async () => {
        ankiAnswers();

        await collection('hello', 'hallo', { config: {} });

        expect(sentActions().map(({ action, version }) => [action, version])).toEqual([
            ['createDeck', 6],
            ['createModel', 6],
            ['addNote', 6],
        ]);
    });

    it('uses the port of the config', async () => {
        ankiAnswers();

        await collection('hello', 'hallo', { config: { port: 9000 } });

        expect(sentUrls()).toEqual(threeRequestsTo(9000));
    });

    it('uses port 8765 when the config has no port', async () => {
        ankiAnswers();

        await collection('hello', 'hallo', { config: {} });

        expect(sentUrls()).toEqual(threeRequestsTo(8765));
    });

    describe('without a config (settings saved by an older version)', () => {
        it('reads the settings stored under "anki"', async () => {
            fakeTauri.store.set('anki', { port: 9100 });
            ankiAnswers();

            await collection('hello', 'hallo');

            expect(sentUrls()).toEqual(threeRequestsTo(9100));
        });

        it('uses port 8765 when nothing is stored', async () => {
            ankiAnswers();

            await collection('hello', 'hallo');

            expect(sentUrls()).toEqual(threeRequestsTo(8765));
        });
    });

    it('prefers the config over the stored settings, even a config without a port', async () => {
        fakeTauri.store.set('anki', { port: 9100 });
        ankiAnswers();
        ankiAnswers();

        await collection('hello', 'hallo', { config: { port: 9000 } });
        await collection('hello', 'hallo', { config: {} });

        expect(sentUrls()).toEqual([...threeRequestsTo(9000), ...threeRequestsTo(8765)]);
    });

    it('adds a dictionary entry with its explanations as Back and its pronunciations as symbols and audio', async () => {
        ankiAnswers();

        await collection(
            'hello',
            {
                pronunciations: [
                    // 72, 101, 108 are the character codes of "Hel"
                    { region: 'UK', symbol: 'həˈləʊ', voice: [72, 101, 108] },
                    { region: '', symbol: '/hɛˈloʊ/' },
                ],
                explanations: [
                    { trait: 'interj', explains: ['你好', '喂'] },
                    { trait: 'noun', explains: ['招呼'] },
                ],
            },
            { config: {} }
        );

        expect(sentActions()[2].params).toEqual({
            note: {
                deckName: 'Pot',
                modelName: 'Pot Card 2',
                fields: {
                    Front: 'hello',
                    Back: 'interj. 你好; 喂<br>noun. 招呼<br>',
                    Symbol1: '[UK] /həˈləʊ/',
                    Symbol2: ' /hɛˈloʊ/',
                },
                // btoa('Hel') is 'SGVs'; a pronunciation without a voice leaves an undefined audio entry
                audio: [{ data: 'SGVs', filename: '[UK]_hello.mp3', fields: ['Voice1'] }, undefined],
            },
        });
    });

    it('adds a plain string as Back, with no symbols and no audio', async () => {
        ankiAnswers();

        await collection('hello', 'hallo', { config: {} });

        const { fields, audio } = sentActions()[2].params.note;
        expect(fields.Back).toBe('hallo');
        expect(fields.Symbol1).toBeUndefined();
        expect(fields.Symbol2).toBeUndefined();
        expect(audio).toEqual([]);
    });

    it('adds a dictionary entry without pronunciations with empty symbols and audio', async () => {
        ankiAnswers();

        await collection('hello', { explanations: [{ trait: 'noun', explains: ['招呼'] }] }, { config: {} });

        const { fields, audio } = sentActions()[2].params.note;
        expect(fields.Back).toBe('noun. 招呼<br>');
        expect(fields.Symbol1).toBeUndefined();
        expect(audio).toEqual([]);
    });

    // Known issue: the error field of AnkiConnect's replies is never checked.
    it('resolves when AnkiConnect answers every request with an error', async () => {
        httpMock.queue(
            { data: { result: null, error: 'collection is not available' } },
            { data: { result: null, error: 'collection is not available' } },
            { data: { result: null, error: 'collection is not available' } }
        );

        await expect(collection('hello', 'hallo', { config: {} })).resolves.toBeUndefined();
        expect(httpMock.calls).toHaveLength(3);
    });

    it('resolves when AnkiConnect answers with an HTTP error status', async () => {
        httpMock.queue({ status: 500, data: 'oops' }, { status: 500, data: 'oops' }, { status: 500, data: 'oops' });

        await expect(collection('hello', 'hallo', { config: {} })).resolves.toBeUndefined();
        expect(httpMock.calls).toHaveLength(3);
    });

    it('rejects, without sending the next requests, when AnkiConnect cannot be reached', async () => {
        fetchMock.mockRejectedValueOnce('error sending request: connection refused');

        await expect(collection('hello', 'hallo', { config: {} })).rejects.toBe(
            'error sending request: connection refused'
        );
        // Only the first request, createDeck, was attempted.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
