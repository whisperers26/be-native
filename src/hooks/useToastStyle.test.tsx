import { renderHook } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useToastStyle } from './useToastStyle';

function withTheme(theme: 'light' | 'dark') {
    return ({ children }: { children: ReactNode }) => (
        <ThemeProvider
            attribute='class'
            defaultTheme={theme}
            enableSystem={false}
            storageKey={`toast-test-${theme}`}
        >
            {children}
        </ThemeProvider>
    );
}

describe('useToastStyle', () => {
    it('uses the light content colours under the light theme', () => {
        const { result } = renderHook(() => useToastStyle(), { wrapper: withTheme('light') });

        expect(result.current).toEqual({
            background: '#FFFFFF',
            color: '#11181C',
            wordBreak: 'break-all',
            select: 'text',
        });
    });

    it('uses the dark content colours under the dark theme', () => {
        const { result } = renderHook(() => useToastStyle(), { wrapper: withTheme('dark') });

        expect(result.current).toEqual({
            background: '#18181b',
            color: '#ECEDEE',
            wordBreak: 'break-all',
            select: 'text',
        });
    });
});
