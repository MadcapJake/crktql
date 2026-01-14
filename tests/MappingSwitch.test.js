
import { test, expect } from 'vitest';
import { TypingEngine } from '../src/engine/TypingEngine.js';

test('TypingEngine switches mappings correctly', () => {
    const engine = new TypingEngine();

    // Default should be Latin
    expect(engine.currentMappingName).toBe('Latin');
    expect(engine.mappings.ONSET.DEFAULT_VOWEL).toBe('o');

    // Switch to Hisyakui
    engine.setMapping('Hisyakui');

    expect(engine.currentMappingName).toBe('Hisyakui');
    expect(engine.mappings.ONSET.DEFAULT_VOWEL).toBe('');

    // Check RIME VOWELS
    // Latin 'NORTH': 'i'
    // Hisyakui 'NORTH': 'ȷ'
    console.log('Hisyakui RIME NORTH:', engine.mappings.RIME.VOWELS.NORTH);

    expect(engine.mappings.RIME.VOWELS.NORTH).toBe('j');
    expect(engine.mappings.RIME.VOWELS.NORTH).not.toBe('i'); // Should NOT be Latin
});
