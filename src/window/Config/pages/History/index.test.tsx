import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../../../test/fake-tauri';
import '../../../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import Page from './index';

function renderPage() {
    render(
        <NextUIProvider>
            <MemoryRouter>
                <Page />
            </MemoryRouter>
        </NextUIProvider>
    );
}

describe('History settings page', () => {
    it('reads the history database', async () => {
        renderPage();

        await vi.waitFor(() =>
            expect(fakeTauri.calls.filter((call) => call.cmd === 'plugin:sql|select').map((call) => call.args.query)).toEqual([
                'SELECT COUNT(*) FROM history',
                'SELECT * FROM history ORDER BY id DESC LIMIT 20 OFFSET $1',
            ])
        );
        expect(fakeTauri.calls.find((call) => call.cmd === 'plugin:sql|load')?.args).toEqual({ db: 'sqlite:history.db' });
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('lists stored translations', async () => {
        fakeTauri.sqlRows = [
            { id: 1, text: 'hello', source: 'en', target: 'zh_cn', service: 'deepl', result: '你好', timestamp: 1767323045678 },
        ];

        renderPage();

        expect(await screen.findByText('hello')).toBeInTheDocument();
        expect(await screen.findByText('你好')).toBeInTheDocument();
    });
});
