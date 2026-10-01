import { describe, expect, it } from 'vitest';
import { LanguageFlag, languageList } from './language';

describe('language tables', () => {
    it('match the snapshot', () => {
        expect({ languageList, LanguageFlag }).toMatchSnapshot();
    });

    it('list 30 languages, each with a flag', () => {
        expect(languageList).toHaveLength(30);
        for (const code of languageList) {
            expect(LanguageFlag[code as keyof typeof LanguageFlag], code).toMatch(/^[a-z]{2}$/);
        }
    });
});
