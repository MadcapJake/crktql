
import { test, expect, vi } from 'vitest';
import { TypingEngine } from '../src/engine/TypingEngine.js';

// Mock localStorage
global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

test.skip('TypingEngine respects empty string as DEFAULT_VOWEL', () => {
    const engine = new TypingEngine();

    // Mock Mapping with Empty Default Vowel
    engine.mappings = {
        ONSET: {
            DEFAULT_VOWEL: "",
            LEFT: {},
            RIGHT: {}
        },
        RIME: { ORDER: ['VOWELS', 'CODA'] },
        PUNCTUATION: { LEFT: {}, RIGHT: {} }
    };

    // Set internal state to simulate "Just Released"
    engine.state.syllable.onset = 't';
    engine.state.onsetOwner = 'left';
    engine.lastFrameSticks = {
        left: { active: true, sector: 'EAST' }, // active previously
        right: { active: false }
    };

    // Simulate input frame where left stick is released
    const input = {
        sticks: {
            left: { active: false, x: 0, y: 0 },
            right: { active: false, x: 0, y: 0 }
        },
        buttons: { dpad: {} },
        id: "Mock Gamepad",
        axes: [0, 0, 0, 0] // Required by InputMapper
    };

    let typed = "";
    engine.typeCharacter = (char) => { typed = char; };
    engine.clearSyllable = () => { };
    engine.consumeShift = () => { };

    // Run processFrame
    engine.processFrame(input);

    // Expect 't' (onset + empty vowel), NOT 'to' (onset + default fallback 'o')
    expect(typed).toBe('t');
});
