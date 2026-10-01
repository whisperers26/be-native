import { NextUIProvider } from '@nextui-org/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../../../test/fake-tauri';
import '../../../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import Page from './index';

describe('Service settings page', () => {
    it('shows a tab per service kind and the default translate instances', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        for (const tab of ['Translate', 'Writing', 'Recognize', 'TTS', 'Collection']) {
            expect(await screen.findByRole('tab', { name: tab })).toBeInTheDocument();
        }
        for (const service of ['DeepL', 'Bing', 'Lingva', 'Yandex', 'Google', 'ECDict(Online)']) {
            expect(await screen.findByText(service)).toBeInTheDocument();
        }
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('lists the free writing service by default, and offers the others', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        fireEvent.click(await screen.findByRole('tab', { name: 'Writing' }));

        expect(await screen.findByText('LLM7 (free)')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Add Builtin Service' }));
        for (const service of ['OpenAI', 'Claude Code', 'Codex']) {
            expect(await screen.findByText(service)).toBeInTheDocument();
        }
        expect(fakeTauri.store.get('writing_service_list')).toEqual(['llm7']);
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
