import { describe, expect, it } from 'vitest';
import { customResults, defaultResults, enabledServices, toneResults } from './results';

const tones = [
    { name: 'Casual', instruction: 'Casual: relaxed.' },
    { name: 'Concise', instruction: 'Concise: short.' },
];

describe('enabledServices', () => {
    it('keeps the order of the list and leaves out what is switched off', () => {
        const configs = { 'openai@a': { enable: false }, 'codex@b': { enable: true } };
        expect(enabledServices(['llm7', 'openai@a', 'codex@b'], configs)).toEqual(['llm7', 'codex@b']);
    });
});

describe('defaultResults', () => {
    it('is one plain request per service', () => {
        expect(defaultResults(['llm7', 'openai@a'])).toEqual([
            { id: 'default/llm7', service: 'llm7' },
            { id: 'default/openai@a', service: 'openai@a' },
        ]);
    });
});

describe('toneResults', () => {
    it('goes tone by tone: every service for the first tone, then every service for the next', () => {
        const results = toneResults(tones, ['llm7', 'openai@a']);

        expect(results.map((result) => `${result.label}/${result.service}`)).toEqual([
            'Casual/llm7',
            'Casual/openai@a',
            'Concise/llm7',
            'Concise/openai@a',
        ]);
        expect(results[2]).toEqual({ id: 'tone/1/llm7', service: 'llm7', label: 'Concise', style: 'Concise: short.' });
    });

    it('gives two tones of the same name their own boxes', () => {
        const ids = toneResults([tones[0], tones[0]], ['llm7']).map((result) => result.id);
        expect(new Set(ids).size).toBe(2);
    });
});

describe('customResults', () => {
    it('sends the request to each service and labels the boxes with it', () => {
        expect(customResults('shorter', ['llm7', 'openai@a'], 0)).toEqual([
            { id: 'custom/0/llm7', service: 'llm7', label: 'shorter', request: 'shorter' },
            { id: 'custom/0/openai@a', service: 'openai@a', label: 'shorter', request: 'shorter' },
        ]);
    });

    it('makes the same request asked again a new box', () => {
        expect(customResults('shorter', ['llm7'], 0)[0].id).not.toBe(customResults('shorter', ['llm7'], 1)[0].id);
    });
});
