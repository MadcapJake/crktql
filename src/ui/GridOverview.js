
export class GridOverview {
    constructor(elementId, bookManager, historyManager) {
        this.container = document.getElementById(elementId);
        this.bookManager = bookManager;
        this.historyManager = historyManager; // Store it
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
        this.isActive = false;
        this.container.style.display = 'none';
    }

    setZoom(level) {
        this.zoomLevel = level;
    }

    getPageSize(zoomLevel) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const cellW = (this.PART_WIDTH + this.GAP) * zoomLevel;
        const cellH = (this.PART_HEIGHT + this.GAP) * zoomLevel;
        return {
            cols: Math.floor((w / 2) / cellW),
            rows: Math.floor((h / 2) / cellH)
        };
    }



    setCursor(x, y) {
        // Simple direct jump for MVP. Animation can be added to updateView if we use transition CSS.
        // updateView uses CSS transition on #grid-world transform, so it will animate automatically!
        this.cursor.x = x;
        this.cursor.y = y;
        this.updateView();
    }

    setLinkTarget(target) {
        this.linkTarget = target; // {x, y} or null
        this.updateView(true);
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

                // Cursor Selection (Grid Cursor)
                if (gx === this.cursor.x && gy === this.cursor.y) el.classList.add('selected');

                // Active Part (The part we are currently editing/viewing)
                const current = this.bookManager.getCurrentPart();
                if (current && current.x === gx && current.y === gy) {
                    el.classList.add('active-part');
                }

                // Link Target (The destination we are currently linking TO or updating)
                if (this.linkTarget && this.linkTarget.x === gx && this.linkTarget.y === gy) {
                    el.classList.add('link-target');
                }

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
