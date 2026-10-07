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

    it.each(['1.1.5', '1.0.9', '0.9.0'])('recommends a reinstall from GitHub on version %s', async (version) => {
        fakeTauri.appVersion = version;
        fakeTauri.update = { version: '1.1.7', body: 'Release notes here', date: '2026-01-01' };

        render(
            <NextUIProvider>
                <Updater />
            </NextUIProvider>
        );

        expect(await screen.findByText('Old version: please reinstall')).toBeInTheDocument();
        expect(screen.getByText(/github.com\/whisperers26\/be-native/)).toBeInTheDocument();
        expect(screen.getByText('Download from GitHub')).toBeInTheDocument();
    });

    it('updates in place from version 1.1.6', async () => {
        fakeTauri.appVersion = '1.1.6';
        fakeTauri.update = { version: '1.1.7', body: 'Release notes here', date: '2026-01-01' };

        render(
            <NextUIProvider>
                <Updater />
            </NextUIProvider>
        );

        expect(await screen.findByText('Release notes here')).toBeInTheDocument();
        expect(screen.queryByText('Old version: please reinstall')).not.toBeInTheDocument();
        expect(screen.getByText('Update')).toBeInTheDocument();
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
