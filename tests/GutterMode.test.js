
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GutterMode } from '../src/modes/GutterMode';

describe('GutterMode', () => {
    let gutterMode;
    let mockGutter;

    beforeEach(() => {
        mockGutter = {
            activate: vi.fn(),
            deactivate: vi.fn(),
            setSelectedIndex: vi.fn(),
            triggerAction: vi.fn(),
            getItemCount: vi.fn().mockReturnValue(5)
        };

        gutterMode = new GutterMode({ gutter: mockGutter });
    });

    it('activates and selects last item (Book Menu)', () => {
        gutterMode.activate();
        expect(mockGutter.activate).toHaveBeenCalled();
        expect(gutterMode.selectedIndex).toBe(4); // 5 items, index 4
        expect(mockGutter.setSelectedIndex).toHaveBeenCalledWith(4);
    });

    it('navigates right with wraparound', () => {
        gutterMode.activate(); // Index 4

        // Right -> Wrap to 0
        const input = { buttons: { dpad: { right: true }, north: false } };
        gutterMode.handleInput(input);

        expect(gutterMode.selectedIndex).toBe(0);
        expect(mockGutter.setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('navigates left with wraparound', () => {
        gutterMode.activate(); // Index 4
        gutterMode.selectedIndex = 0; // Force to start

        // Left -> Wrap to 4
        const input = { buttons: { dpad: { left: true }, north: false } };
        gutterMode.handleInput(input);

        expect(gutterMode.selectedIndex).toBe(4);
        expect(mockGutter.setSelectedIndex).toHaveBeenCalledWith(4);
    });

    it('triggers action on South press', () => {
        const input = { buttons: { south: true, dpad: {} } };
        gutterMode.activate(); // Index 4

        gutterMode.handleInput(input);

        expect(mockGutter.triggerAction).toHaveBeenCalledWith(4, input);
    });
});
