import { describe, expect, it } from 'vitest';
import { isReady, servicesInProgress } from './progress';

describe('what the Translate window waits for', () => {
    it('waits while the source text is being recognized or prepared', () => {
        expect(isReady('image', '', {}, 1)).toBe(false);
        expect(isReady('text', 'hello', {}, 1)).toBe(false);
    });

    it('waits until the services are known', () => {
        expect(isReady(null, '', {}, null)).toBe(false);
    });

    it('has nothing to wait for without text', () => {
        expect(isReady(null, ' ', {}, 2)).toBe(true);
    });

    it('waits for every card to finish', () => {
        const done = { service: 'google', state: 'done' } as const;
        expect(isReady(null, 'hello', {}, 2)).toBe(false);
        expect(isReady(null, 'hello', { 0: done }, 2)).toBe(false);
        expect(isReady(null, 'hello', { 0: done, 1: { service: 'deepl', state: 'loading' } }, 2)).toBe(false);
        expect(isReady(null, 'hello', { 0: done, 1: { service: 'deepl', state: 'idle' } }, 2)).toBe(false);
        expect(isReady(null, 'hello', { 0: done, 1: { service: 'deepl', state: 'done' } }, 2)).toBe(true);
    });

    it('shows the services that are translating', () => {
        expect(
            servicesInProgress({
                0: { service: 'google', state: 'done' },
                1: { service: 'deepl', state: 'loading' },
                2: { service: 'bing', state: 'loading' },
                3: { service: 'yandex', state: 'idle' },
            })
        ).toEqual(['deepl', 'bing']);
    });

    it('shows the services that are about to translate while none is', () => {
        expect(
            servicesInProgress({ 0: { service: 'google', state: 'idle' }, 1: { service: 'deepl', state: 'done' } })
        ).toEqual(['google']);
    });
});
