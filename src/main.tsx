import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { appWindow } from '@tauri-apps/api/window';
import { NextUIProvider } from '@nextui-org/react';
import ReactDOM from 'react-dom/client';
import React from 'react';

import { initStore } from './utils/store';
import { initEnv } from './utils/env';
import App from './App';

if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

initStore().then(async () => {
    await initEnv();
    // index.html has the root element.
    const rootElement = document.getElementById('root')!;
    const root = ReactDOM.createRoot(rootElement);
    // The Config window is transparent, and a menu that scales and fades in is drawn as its own layer there: the page
    // behind it flickered in front of it. Without the animation a menu is drawn once, in place.
    root.render(
        <NextUIProvider disableAnimation={appWindow.label === 'config'}>
            <NextThemesProvider attribute='class'>
                <App />
            </NextThemesProvider>
        </NextUIProvider>
    );
});
