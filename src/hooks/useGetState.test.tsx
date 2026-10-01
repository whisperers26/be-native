import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGetState } from './useGetState';

describe('useGetState', () => {
    it('returns state, a setter, and a getter that reads the latest value', () => {
        const { result } = renderHook(() => useGetState(1));
        const getState = result.current[2];

        act(() => result.current[1](2));

        expect(result.current[0]).toBe(2);
        expect(getState()).toBe(2);
    });

    it('keeps the same getter across renders', () => {
        const { result, rerender } = renderHook(() => useGetState('a'));
        const getState = result.current[2];

        rerender();

        expect(result.current[2]).toBe(getState);
    });
});
