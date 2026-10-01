import { describe, expect, it } from 'vitest';
import { uncommittedPaths } from './dirty';

describe('uncommittedPaths', () => {
    it('lists modified, staged and untracked paths from git status --porcelain', () => {
        expect(uncommittedPaths(' M src/utils/env.ts\nA  src/new.ts\n?? src/probe.ts\n')).toEqual([
            'src/utils/env.ts',
            'src/new.ts',
            'src/probe.ts',
        ]);
    });

    it('keeps a rename as git prints it', () => {
        expect(uncommittedPaths('R  src/a.jsx -> src/a.tsx\n')).toEqual(['src/a.jsx -> src/a.tsx']);
    });

    it('reads Windows line endings', () => {
        expect(uncommittedPaths(' M src/a.ts\r\n M src/b.ts\r\n')).toEqual(['src/a.ts', 'src/b.ts']);
    });

    it('returns nothing for a clean tree', () => {
        expect(uncommittedPaths('')).toEqual([]);
    });
});
