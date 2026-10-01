import { act, renderHook } from '@testing-library/react';
import { atom, useAtom } from 'jotai';
import { describe, expect, it } from 'vitest';
import { useSyncAtom } from './useSyncAtom';

describe('useSyncAtom', () => {
    it('edits a local copy and pushes it to the atom only on sync', () => {
        const textAtom = atom('start');
        const { result } = renderHook(() => ({ local: useSyncAtom(textAtom), shared: useAtom(textAtom) }));

        expect(result.current.local[0]).toBe('start');

        act(() => result.current.local[1]('typed'));
        expect(result.current.local[0]).toBe('typed');
        expect(result.current.shared[0]).toBe('start');

        act(() => result.current.local[2]());
        expect(result.current.shared[0]).toBe('typed');
    });
});
