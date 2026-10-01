import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'updater' }], __currentWindow: { label: 'updater' } };
});

import Updater from './index';

describe('Updater window', () => {
    it('shows the release notes of an available update', async () => {
        fakeTauri.update = { version: '3.1.0', body: 'Release notes here', date: '2026-01-01' };

        render(
            <NextUIProvider>
                <Updater />
            </NextUIProvider>
        );

        expect(await screen.findByText('Check Update')).toBeInTheDocument();
        expect(await screen.findByText('Release notes here')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('says the latest version is installed when there is no update', async () => {
        render(
            <NextUIProvider>
                <Updater />
            </NextUIProvider>
        );

        expect(await screen.findByText('The latest version is installed')).toBeInTheDocument();
    });
});
