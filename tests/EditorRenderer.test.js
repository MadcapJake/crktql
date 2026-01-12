
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorRenderer } from '../src/ui/EditorRenderer';

// Mock Dependencies
const mockTypingEngine = {
    getFormattedSyllable: vi.fn().mockReturnValue('')
};

const mockSettingsManager = {
    config: { cursorType: 'BAR' }
};

describe('EditorRenderer', () => {
    let renderer;
    let container;

    beforeEach(() => {
        // Setup JSDOM container
        document.body.innerHTML = '<div id="editor-view"></div>';
        container = document.getElementById('editor-view');

        // Reset Mocks
        mockTypingEngine.getFormattedSyllable.mockReturnValue('');
        mockSettingsManager.config.cursorType = 'BAR';

        renderer = new EditorRenderer('editor-view', mockTypingEngine, mockSettingsManager);

        // Mock scrollIntoView
        Element.prototype.scrollIntoView = vi.fn();
    });

    it('renders basic text with bar cursor', () => {
        const part = { content: "Hello World", cursor: 5 }; // "Hello| World"
        renderer.render(part);

        expect(container.innerHTML).toBe('Hello<span class="cursor cursor-bar"></span>&nbsp;World');
    });

    it('escapes HTML in text', () => {
        const part = { content: "<script>", cursor: 8 };
        renderer.render(part);
        expect(container.innerHTML).toBe('&lt;script&gt;<span class="cursor cursor-bar"></span>');
    });

    it('renders citations as pills', () => {
        const part = { content: "Ref {{cite:1,2}} here", cursor: 20 };
        renderer.render(part);
        expect(container.innerHTML).toContain('<span class="citation-pill">⌖ 1, 2</span>');
    });

    it('renders BLOCK cursor correctly', () => {
        mockSettingsManager.config.cursorType = 'BLOCK';
        const part = { content: "ABC", cursor: 1 }; // "A|BC" -> "A[B]C"
        renderer.render(part);

        // Expect: "A" + <span class="cursor cursor-block">B</span> + "C"
        expect(container.innerHTML).toBe('A<span class="cursor cursor-block">B</span>C');
    });

    it('renders UNDERLINE cursor correctly', () => {
        mockSettingsManager.config.cursorType = 'UNDERLINE';
        const part = { content: "ABC", cursor: 1 };
        renderer.render(part);
        expect(container.innerHTML).toBe('A<span class="cursor cursor-underline">B</span>C');
    });

    it('handles pending syllables', () => {
        mockTypingEngine.getFormattedSyllable.mockReturnValue('ing');
        const part = { content: "Test", cursor: 4 };
        renderer.render(part);
        // "Test" + <span class="pending-text">ing</span> + Cursor
        expect(container.innerHTML).toBe('Test<span class="pending-text">ing</span><span class="cursor cursor-bar"></span>');
    });

    it('renders ATOMIC cursor on citations (Block)', () => {
        mockSettingsManager.config.cursorType = 'BLOCK';
        const part = { content: "Link {{cite:10,20}} end", cursor: 5 }; // Cursor at start of {{cite...}}
        renderer.render(part);

        // Expect merged classes on the pill
        expect(container.innerHTML).toContain('Link&nbsp;<span class="citation-pill cursor cursor-block cursor-atomic">⌖ 10, 20</span>&nbsp;end');
    });

    it('renders selection highlight', () => {
        const part = { content: "Selection Test", cursor: 9 }; // "Selection| Test"
        const anchor = 0; // "|Selection| Test"

        renderer.render(part, anchor);

        expect(container.innerHTML).toBe('<span class="selection-highlight">Selection</span>&nbsp;Test');
    });
});
