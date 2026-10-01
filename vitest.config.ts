import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Unit and component tests. The app's own build config is vite.config.js.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}'],
    },
});
