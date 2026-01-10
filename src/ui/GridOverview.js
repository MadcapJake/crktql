
export class GridOverview {
    constructor(elementId, bookManager) {
        this.container = document.getElementById(elementId);
        this.bookManager = bookManager;
        this.cursor = { x: 0, y: 0 };
        this.lastMove = 0;
        this.lastButtons = {};
        this.holdStartTime = null;
        this.deleteTriggered = false;
    }

    activate() {
        if (this.container) this.container.style.display = 'block';
        this.render();
    }

    deactivate() {
        if (this.container) this.container.style.display = 'none';
    }

    handleInput(input) {
        if (!input) return;

        const dpad = input.buttons.dpad;
        const now = Date.now();

        // D-Pad Navigation (Debounced slightly for grid comfort)
        if (now - this.lastMove > 150) {
            let moved = false;

            if (dpad.up) { this.cursor.y++; moved = true; }
            if (dpad.down) { this.cursor.y--; moved = true; }
            if (dpad.left) { this.cursor.x--; moved = true; }
            if (dpad.right) { this.cursor.x++; moved = true; }

            if (moved) {
                this.lastMove = now;
                this.render();
            }
        }

        // Actions
        // A -> Enter / Create
        if (input.buttons.south && !this.lastButtons.south) {
            const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
            if (!part) {
                // Create new
                this.bookManager.createPart(this.cursor.x, this.cursor.y);
                this.render();
            } else {
                // Enter
                this.bookManager.selectPart(this.cursor.x, this.cursor.y);
                // We need to signal main.js to switch mode.
                // Disadvantage of loose coupling.
                // We'll dispatch a custom event or rely on main loop polling?
                // Better: GridOverview takes a callback or triggers event.
                window.dispatchEvent(new CustomEvent('request-editor-focus'));
            }
        }

        // X -> Delete (Press and Hold)
        if (input.buttons.west) {
            if (!this.holdStartTime) this.holdStartTime = now;
            if (now - this.holdStartTime > 1000 && !this.deleteTriggered) {
                this.bookManager.deletePart(this.cursor.x, this.cursor.y);
                this.deleteTriggered = true;
                this.render();
            }
        } else {
            this.holdStartTime = null;
            this.deleteTriggered = false;
        }

        // Y -> Rename (North)
        if (input.buttons.north && !this.lastButtons.north && !this.holdStartTime) {
            const part = this.bookManager.getPart(this.cursor.x, this.cursor.y);
            if (part) {
                window.dispatchEvent(new CustomEvent('request-rename', {
                    detail: { x: this.cursor.x, y: this.cursor.y, name: part.name }
                }));
            }
        }

        this.lastButtons = { ...input.buttons };
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const centerX = this.container.clientWidth / 2;
        const centerY = this.container.clientHeight / 2;
        const partWidth = 140;
        const partHeight = 180;
        const gap = 40;

        // Render 5x5 grid around cursor
        const range = 2;

        for (let ox = -range; ox <= range; ox++) {
            for (let oy = -range; oy <= range; oy++) {
                const gx = this.cursor.x + ox;
                const gy = this.cursor.y - oy; // Y inverted visually? Let's keep logic Y up = Up

                // Screen Position relative to center
                const sx = centerX + (ox * (partWidth + gap)) - (partWidth / 2);
                const sy = centerY + (oy * (partHeight + gap)) - (partHeight / 2); // oy positive is DOWN in screen coords usually.
                // If cursor.y increases (UP), we want higher world Y to be higher on screen (lower screen Y).
                // So if ox=0, oy=+1 (one row below cursor visually), wait.
                // Standard: Y+ is Up.
                // Screen: Y+ is Down.
                // To visualize Y+ as Up, we subtract world Y from center.

                const part = this.bookManager.getPart(gx, gy); // Note: using gy (world Y)

                const el = document.createElement('div');
                el.className = 'grid-part';
                el.style.left = `${sx}px`;
                el.style.top = `${sy}px`;

                if (ox === 0 && oy === 0) {
                    el.classList.add('selected');
                }

                if (part) {
                    el.innerHTML = `
                        <div class="grid-part-thumb">${part.content.substring(0, 50)}...</div>
                        <div class="grid-part-name">${part.name}</div>
                    `;
                } else {
                    el.className += ' grid-empty-slot';
                    el.innerHTML = '<div style="color:#444; font-size: 2rem;">+</div>';
                }

                this.container.appendChild(el);
            }
        }

        // Debug Info
        const info = document.createElement('div');
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.left = '10px';
        info.style.color = '#666';
        info.innerText = `Pos: ${this.cursor.x}, ${this.cursor.y}`;
        this.container.appendChild(info);
    }
}
