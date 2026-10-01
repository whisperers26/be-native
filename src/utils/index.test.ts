import { describe, expect, it, vi } from 'vitest';
import { debounce } from './index';

describe('debounce', () => {
    it('calls the function once, with the last arguments, after the delay', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 300);

        debounced('first');
        debounced('second');
        vi.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('second');
    });

    it('waits 500 ms by default', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        debounce(fn)('x');

        vi.advanceTimersByTime(499);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledWith('x');
    });
});
