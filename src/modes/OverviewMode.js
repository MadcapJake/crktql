
export class OverviewMode {
    constructor(deps) {
        this.gridOverview = deps.gridOverview; // UI / Renderer
        this.bookManager = deps.bookManager;
        this.historyManager = deps.historyManager;
        this.focusManager = deps.focusManager; // To Request focus on A

        // Internal State
        this.cursor = { x: 0, y: 0 };
        this.zoomLevel = 1.0;
        this.minZoom = 0.2;
        this.maxZoom = 2.0;

        // Input Tracking
        this.lastButtons = {};
        this.lastMove = 0;
        this.holdStartTime = null;
        this.deleteTriggered = false;

        // Navigation Constants
        this.moveDelay = 150;
    }

    activate() {
        this.gridOverview.activate();
        this.syncView();
    }

    deactivate() {
        this.gridOverview.deactivate();
    }

    setCursor(x, y) {
        this.cursor.x = x;
        this.cursor.y = y;
        this.syncView();
    }

    syncView() {
        // Push state to UI
        this.gridOverview.setCursor(this.cursor.x, this.cursor.y);
        this.gridOverview.setZoom(this.zoomLevel);
        this.gridOverview.updateView(); // Renders
    }

    handleInput(input) {
        if (!input) return;

        const dpad = input.buttons.dpad;
        const now = Date.now();
        const buttons = input.buttons;

        // 1. Zoom Controls (LB/RB)
        if (buttons.lb && !this.lastButtons.lb) this.adjustZoom(0.2);
        if (buttons.rb && !this.lastButtons.rb) this.adjustZoom(-0.2);

        // 2. Navigation
        const isMod = buttons.north;
        if (now - this.lastMove > this.moveDelay) {
            let moved = false;
            let dx = 0;
            let dy = 0;

            if (dpad.left) dx = -1;
            if (dpad.right) dx = 1;
            if (dpad.up) dy = 1;
            if (dpad.down) dy = -1;

            if (dx !== 0 || dy !== 0) {
                if (isMod) {
                    // Edge Jump
                    this.jumpToEdge(dx, dy);
                    moved = true;
                } else {
                    // Step
                    this.cursor.x += dx;
                    this.cursor.y += dy;
                    moved = true;
                }
            }

            if (moved) {
                this.lastMove = now;
                this.syncView();
            }
        }

        // 3. Enter Part (A / South)
        if (buttons.south && !this.lastButtons.south) {
            const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
            if (!part) {
                this.bookManager.createPart(this.cursor.x, this.cursor.y);
                this.historyManager.push({
                    type: 'ADD_PART',
                    partKey: `${this.cursor.x},${this.cursor.y}`,
                    data: { x: this.cursor.x, y: this.cursor.y }
                });
                this.syncView(); // Update UI to show new part
            }

            // Select and Focus
            this.bookManager.selectPart(this.cursor.x, this.cursor.y);
            // We use FocusManager instead of dispatching global event, 
            // OR dispatch request-editor-focus if main handles it.
            // Plan: Delegate to FocusManager if possible, or trigger callback?
            // Existing logic dispatch event. Let's replicate or improve.
            // Main.js listens to event. Let's start with event.
            window.dispatchEvent(new CustomEvent('request-editor-focus'));
        }

        // 4. Delete Part (X / West) - Hold
        if (buttons.west) {
            if (!this.holdStartTime) this.holdStartTime = now;
            if (now - this.holdStartTime > 1000 && !this.deleteTriggered) {
                const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
                if (part) {
                    this.bookManager.deletePart(this.cursor.x, this.cursor.y);
                    this.historyManager.push({
                        type: 'DELETE_PART',
                        partKey: `${this.cursor.x},${this.cursor.y}`,
                        data: {
                            x: this.cursor.x,
                            y: this.cursor.y,
                            content: part.content,
                            name: part.name
                        }
                    });
                    this.deleteTriggered = true;
                    this.syncView();
                }
            }
        } else {
            this.holdStartTime = null;
            this.deleteTriggered = false;
        }

        // 5. Rename (Y / North) - Release
        // Logic: specific Rename trigger on RELEASE if no jump occurred?
        if (buttons.north && !this.lastButtons.north) {
            this.modUsedForNav = false;
        }
        if (buttons.north && (dpad.up || dpad.down || dpad.left || dpad.right)) {
            this.modUsedForNav = true;
        }
        if (!buttons.north && this.lastButtons.north && !this.modUsedForNav) {
            if (this.ignoreNextRename) {
                this.ignoreNextRename = false;
            } else {
                const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
                if (part) {
                    window.dispatchEvent(new CustomEvent('request-rename', {
                        detail: { x: this.cursor.x, y: this.cursor.y, name: part.name }
                    }));
                }
            }
        }

        // 6. Citation Insert (B / East)
        if (buttons.east && !this.lastButtons.east && !buttons.north) {
            window.dispatchEvent(new CustomEvent('request-citation-insert', {
                detail: { x: this.cursor.x, y: this.cursor.y }
            }));
        }

        this.lastButtons = { ...buttons, dpad: { ...dpad } };
    }

    adjustZoom(delta) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
        this.syncView();
    }

    jumpToEdge(dx, dy) {
        // We need viewport info. gridOverview can provide it?
        // Or we duplicate the calculation. 
        // Ideally, gridOverview returns the 'screen capacity'.
        // For MVP, allow gridOverview to handle "jumpToEdge"? 
        // No, we want logic here. 
        // Let's ask gridOverview for page size.
        const pageSize = this.gridOverview.getPageSize(this.zoomLevel);
        // We will implement getPageSize in GridOverview.

        if (dx === -1) this.cursor.x -= pageSize.cols;
        if (dx === 1) this.cursor.x += pageSize.cols;
        if (dy === 1) this.cursor.y += pageSize.rows;
        if (dy === -1) this.cursor.y -= pageSize.rows;
    }

    // Support sync from main loop restore
    syncInputState(input) {
        if (input && input.buttons) {
            this.lastButtons = { ...input.buttons };
        }
    }
}
