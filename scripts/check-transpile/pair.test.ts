import { describe, expect, it } from 'vitest';
import { pairRenames, type Change } from './pair';

const change = (status: string, oldPath: string, newPath = oldPath): Change => ({ status, oldPath, newPath });

describe('pairRenames', () => {
    it('pairs a deleted and an added file whose paths differ only in extension', () => {
        expect(pairRenames([change('D', 'src/utils/index.js'), change('A', 'src/utils/index.ts')])).toEqual([
            change('R', 'src/utils/index.js', 'src/utils/index.ts'),
        ]);
    });

    it('pairs .jsx with .tsx and with .ts', () => {
        expect(
            pairRenames([
                change('D', 'src/a/Config.jsx'),
                change('D', 'src/hooks/useVoice.jsx'),
                change('A', 'src/a/Config.tsx'),
                change('A', 'src/hooks/useVoice.ts'),
            ])
        ).toEqual([
            change('R', 'src/a/Config.jsx', 'src/a/Config.tsx'),
            change('R', 'src/hooks/useVoice.jsx', 'src/hooks/useVoice.ts'),
        ]);
    });

    it('leaves renames git already found, modifications, and unrelated files alone', () => {
        const input = [
            change('R087', 'src/x.js', 'src/x.ts'),
            change('M', 'src/y.ts'),
            change('D', 'src/gone.js'),
            change('A', 'src/types/service.ts'),
        ];
        expect(pairRenames(input)).toEqual(input);
    });

    it('does not pair across directories or different names', () => {
        const input = [change('D', 'src/a/index.js'), change('A', 'src/b/index.ts'), change('A', 'src/a/main.ts')];
        expect(pairRenames(input)).toEqual(input);
    });
});
