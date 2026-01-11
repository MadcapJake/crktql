
export class GridOverview {
    constructor(elementId, bookManager) {
        this.container = document.getElementById(elementId);
        this.bookManager = bookManager;
        this.cursor = { x: 0, y: 0 };
        this.zoomLevel = 1.0;
        this.minZoom = 0.2;
        this.maxZoom = 2.0;

        this.lastMove = 0;
        this.lastButtons = {};
        this.holdStartTime = null;
        this.deleteTriggered = false;

        // Visual constants
        this.PART_WIDTH = 200;
        this.PART_HEIGHT = 250;
        this.GAP = 50;
    }

    activate() {
        if (!this.container) return;
        this.container.style.display = 'block';

        // Build World Structure if missing
        if (!this.container.querySelector('#grid-camera')) {
            this.container.innerHTML = `
                <div id="grid-camera">
                    <div id="grid-world"></div>
                </div>
                <div class="grid-info-overlay" id="grid-info"></div>
            `;
        }

        this.camera = document.getElementById('grid-camera');
        this.world = document.getElementById('grid-world');
        this.info = document.getElementById('grid-info');

        this.render(); // Initial Render
    }

    deactivate() {
        if (this.container) this.container.style.display = 'none';
    }

    handleInput(input) {
        if (!input) return;

        const dpad = input.buttons.dpad;
        const now = Date.now();
        const buttons = input.buttons;

        // ZOOM Controls (LB/RB)
        if (buttons.lb && !this.lastButtons.lb) {
            this.adjustZoom(0.2); // Zoom In
        }
        if (buttons.rb && !this.lastButtons.rb) {
            this.adjustZoom(-0.2); // Zoom Out
        }

        // Navigation
        // Modifier (Y) + D-pad -> Edge Jump
        const isMod = buttons.north;

        if (now - this.lastMove > 150) { // Debounce
            let moved = false;

            if (isMod) {
                // Jump to Edge
                if (dpad.left && !this.lastButtons.dpad?.left) { this.jumpToEdge('left'); moved = true; }
                if (dpad.right && !this.lastButtons.dpad?.right) { this.jumpToEdge('right'); moved = true; }
                if (dpad.up && !this.lastButtons.dpad?.up) { this.jumpToEdge('up'); moved = true; }
                if (dpad.down && !this.lastButtons.dpad?.down) { this.jumpToEdge('down'); moved = true; }
            } else {
                // Standard Move
                if (dpad.up) { this.cursor.y++; moved = true; }
                if (dpad.down) { this.cursor.y--; moved = true; }
                if (dpad.left) { this.cursor.x--; moved = true; }
                if (dpad.right) { this.cursor.x++; moved = true; }
            }

            if (moved) {
                this.lastMove = now;
                this.updateView();
            }
        }

        // Actions
        // A (South) -> Enter Part
        if (buttons.south && !this.lastButtons.south) {
            const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
            if (!part) {
                // Create & Enter? Or just Create
                this.bookManager.createPart(this.cursor.x, this.cursor.y);
                this.updateView(true); // Force re-render of content
            }

            // Select and Request Focus
            this.bookManager.selectPart(this.cursor.x, this.cursor.y);
            window.dispatchEvent(new CustomEvent('request-editor-focus'));
        }

        // X (West) -> Delete (Hold)
        if (buttons.west) {
            if (!this.holdStartTime) this.holdStartTime = now;
            if (now - this.holdStartTime > 1000 && !this.deleteTriggered) {
                this.bookManager.deletePart(this.cursor.x, this.cursor.y);
                this.deleteTriggered = true;
                this.updateView(true);
            }
        } else {
            this.holdStartTime = null;
            this.deleteTriggered = false;
        }

        // Y (North) -> Rename handled by mod jump? 
        // Logic: specific Rename trigger on RELEASE if no jump occurred?
        // Or simpler: If "isMod" is true but NO dpad movement happened since pressed?
        // Let's track if mod was used for navigation.
        if (buttons.north && !this.lastButtons.north) {
            this.modUsedForNav = false;
        }

        // Check if movement happened while mod held
        if (buttons.north && (dpad.up || dpad.down || dpad.left || dpad.right)) {
            this.modUsedForNav = true;
        }

        // If Y released and NOT used for nav -> Rename
        if (!buttons.north && this.lastButtons.north && !this.modUsedForNav) {
            const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
            if (part) {
                window.dispatchEvent(new CustomEvent('request-rename', {
                    detail: { x: this.cursor.x, y: this.cursor.y, name: part.name }
                }));
            }
        }

        this.lastButtons = { ...buttons, dpad: { ...dpad } };
    }

    adjustZoom(delta) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
        this.updateView(); // Update scale transform
    }

    jumpToEdge(direction) {
        // Calculate visible range based on Screen Size and Zoom
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Effective Grid Cell Size
        const cellW = (this.PART_WIDTH + this.GAP) * this.zoomLevel;
        const cellH = (this.PART_HEIGHT + this.GAP) * this.zoomLevel;

        // How many fit from center to edge?
        const cols = Math.floor((w / 2) / cellW);
        const rows = Math.floor((h / 2) / cellH);

        if (direction === 'left') this.cursor.x -= cols;
        if (direction === 'right') this.cursor.x += cols;
        if (direction === 'up') this.cursor.y += rows; // Y+ is UP
        if (direction === 'down') this.cursor.y -= rows;
    }

    // Update Transform and Content
    updateView(forceRender = false) {
        if (!this.camera || !this.world) return;

        // 1. Apply Camera Zoom
        this.camera.style.transform = `scale(${this.zoomLevel})`;

        // 2. Apply World Panning (Inverse of Cursor)
        // Coords: world X = cursor.x * (W+Gap)
        // We want to translate such that world X is at center (0,0 relative to camera center)
        const wx = -(this.cursor.x * (this.PART_WIDTH + this.GAP));
        const wy = (this.cursor.y * (this.PART_HEIGHT + this.GAP)); // Y+ is UP, so we translate down (positive) to move world up?
        // Wait. If Cursor Y increases (Up), we want world to move DOWN? No.
        // If I move UP (Y+), the things ABOVE should come into view.
        // So the world should move DOWN?
        // Let's rely on standard Cartesian.
        // To center (1, 1), we translate by (-1, -1).
        // Since HTML Y is down...
        // Let's stick to visual logic:
        // oy positive (up relative to cursor).
        // If cursor y=0. We see y=0 at center.
        // If cursor y=1. We want y=1 at center.
        // y=1 is "above" y=0.
        // So we need to shift world DOWN by 1 unit.

        const tx = wx;
        const ty = wy;

        this.world.style.transform = `translate(${tx}px, ${ty}px)`;

        // 3. Render Visible Chunks (plus buffer)
        // Simple optimization: Always render fixed 9x9 around cursor.
        // Since we translate world to center cursor, the cursor is at local (0,0) of the camera viewport.
        // But the WORLD container is shifted.
        // We cleared innerHTML? No. 
        // Efficient DOM: reusing elements is best, but innerHTML is easier for MVP.
        this.renderWorldContent();

        if (this.info) this.info.innerText = `Pos: ${this.cursor.x}, ${this.cursor.y} | Zoom: ${this.zoomLevel.toFixed(1)}x`;
    }

    // Legacy render entry
    render() {
        this.updateView(true);
    }

    renderWorldContent() {
        if (!this.world) return;
        this.world.innerHTML = ''; // Re-render approach (Simplest for state sync)

        const range = Math.ceil(4 / this.zoomLevel); // Visible range increases when zoomed out

        for (let ox = -range; ox <= range; ox++) {
            for (let oy = -range; oy <= range; oy++) {
                const gx = this.cursor.x + ox;
                const gy = this.cursor.y + oy;

                // Position relative to World Origin (0,0 is at logical cursor 0,0)
                const px = gx * (this.PART_WIDTH + this.GAP);
                const py = -gy * (this.PART_HEIGHT + this.GAP); // Y flipped for CSS (Up is negative Top)

                const part = this.bookManager.getPart(gx, gy);

                const el = document.createElement('div');
                el.className = 'grid-part';
                if (gx === this.cursor.x && gy === this.cursor.y) el.classList.add('selected');

                el.style.left = `${px}px`;
                el.style.top = `${py}px`;
                el.style.marginLeft = `-${this.PART_WIDTH / 2}px`; // Center anchor
                el.style.marginTop = `-${this.PART_HEIGHT / 2}px`;

                if (part) {
                    el.innerHTML = `
                        <div class="grid-part-thumb">${(part.content || "").substring(0, 100)}</div>
                        <div class="grid-part-name">${part.name}</div>
                    `;
                } else {
                    el.className += ' grid-empty-slot';
                    el.innerHTML = '<div style="font-size: 2rem; color:#333;">+</div>';
                }

                this.world.appendChild(el);
            }
        }
    }
}
