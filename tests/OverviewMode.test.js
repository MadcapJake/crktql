
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverviewMode } from '../src/modes/OverviewMode';

describe('OverviewMode', () => {
    let overviewMode;
    let mocks;

    beforeEach(() => {
        mocks = {
            gridOverview: {
                activate: vi.fn(),
                deactivate: vi.fn(),
                setCursor: vi.fn(),
                setZoom: vi.fn(),
                updateView: vi.fn(),
                getPageSize: vi.fn().mockReturnValue({ cols: 5, rows: 3 })
            },
            bookManager: {
                getPart: vi.fn(),
                createPart: vi.fn(),
                deletePart: vi.fn(),
                selectPart: vi.fn()
            },
            historyManager: {
                push: vi.fn()
            },
            focusManager: {
                setMode: vi.fn()
            }
        };

        overviewMode = new OverviewMode(mocks);
        // Seed initial state
        overviewMode.syncInputState({ buttons: { dpad: {} } });
    });

    it('activates and syncs view', () => {
        overviewMode.activate();
        expect(mocks.gridOverview.activate).toHaveBeenCalled();
        expect(mocks.gridOverview.setCursor).toHaveBeenCalledWith(0, 0);
    });

    it('navigates with d-pad', () => {
        const input = { buttons: { dpad: { right: true }, north: false } };

        // Wait for delay
        overviewMode.lastMove = 0; // Force immediate
        overviewMode.moveDelay = 0; // Disable delay for test

        overviewMode.handleInput(input);

        expect(overviewMode.cursor.x).toBe(1);
        expect(mocks.gridOverview.setCursor).toHaveBeenCalledWith(1, 0);
    });

    it('jumps to edge with modifier', () => {
        const input = { buttons: { dpad: { right: true }, north: true } };
        overviewMode.moveDelay = 0;

        overviewMode.handleInput(input);

        // Page Size is 5 cols. 0 + 5 = 5.
        expect(overviewMode.cursor.x).toBe(5);
        expect(mocks.gridOverview.setCursor).toHaveBeenCalledWith(5, 0);
    });

    it('creates and enters part on A (South)', () => {
        mocks.bookManager.getPart.mockReturnValue(null); // No part exists
        const input = { buttons: { south: true, dpad: {}, north: false } };

        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        overviewMode.handleInput(input);

        expect(mocks.bookManager.createPart).toHaveBeenCalledWith(0, 0);
        expect(mocks.historyManager.push).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_PART' }));
        expect(mocks.bookManager.selectPart).toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it('deletes part on X (West) Hold', () => {
        mocks.bookManager.getPart.mockReturnValue({ content: 'foo', name: 'Part 1' });

        // Mock Date.now to simulate hold
        const now = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(now);

        // 1. Press Start
        overviewMode.handleInput({ buttons: { west: true, dpad: {} } });
        expect(overviewMode.holdStartTime).toBe(now);

        // 2. Advance Time
        vi.spyOn(Date, 'now').mockReturnValue(now + 1500);

        // 3. Still Holding
        overviewMode.handleInput({ buttons: { west: true, dpad: {} } });

        expect(mocks.bookManager.deletePart).toHaveBeenCalled();
        expect(mocks.historyManager.push).toHaveBeenCalledWith(expect.objectContaining({ type: 'DELETE_PART' }));
    });
});
