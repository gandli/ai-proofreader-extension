import { describe, it, expect } from 'vitest';
import { translations } from '../i18n';

describe('translations', () => {
    const supportedLanguages = ['中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español'];
    const requiredKeys = Object.keys(translations['English']);

    it('should support all defined languages', () => {
        expect(Object.keys(translations)).toEqual(expect.arrayContaining(supportedLanguages));
    });

    supportedLanguages.forEach(lang => {
        it(`should have all keys for language: ${lang}`, () => {
            const keys = Object.keys(translations[lang]);
            requiredKeys.forEach(key => {
                expect(keys).toContain(key);
            });
        });
    });
});
