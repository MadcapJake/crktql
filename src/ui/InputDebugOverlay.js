export class InputDebugOverlay {
    constructor(gamepadManager, inputMapper) {
        this.gamepadManager = gamepadManager;
        this.inputMapper = inputMapper;
        this.element = document.createElement('div');
        this.element.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #0f0;
      font-family: monospace;
      padding: 10px;
      z-index: 9999;
      pointer-events: none;
      font-size: 12px;
      width: 300px;
      white-space: pre;
    `;
        document.body.appendChild(this.element);
        this.visible = false;

        // Subscribe to frame updates instead of polling
        this.gamepadManager.on('frame', (gp) => this.render(gp));
    }

    toggle() {
        this.visible = !this.visible;
        this.element.style.display = this.visible ? 'block' : 'none';
    }

    render(gp) {
        if (!this.visible) return;

        let text = "--- INPUT DEBUG (Settings > Dev Mode) ---\n";

        if (!gp) {
            // Should not happen via frame event usually, unless null emitted
            text += "Waiting for Input...\n";
        } else {
            text += `ID: ${gp.id}\n`;
            text += `Index: ${gp.index}\n`;
            text += `Mapping: ${gp.mapping || 'none'}\n\n`;

            text += "AXES:\n";
            gp.axes.forEach((val, i) => {
                // Highlight active axes
                if (Math.abs(val) > 0.1) {
                    text += `  [${i}]: ${val.toFixed(2)}  <-- ACTIVE\n`;
                } else {
                    text += `  [${i}]: ${val.toFixed(2)}\n`;
                }
            });

            text += "\nBUTTONS:\n";
            gp.buttons.forEach((btn, i) => {
                if (btn.pressed || btn.value > 0.1) {
                    text += `  [${i}]: ${btn.value.toFixed(2)} (PRESSED)\n`;
                }
            });

            const mapped = this.inputMapper.map(gp);
            text += "\nMAPPED INPUT:\n";
            if (mapped && mapped.buttons && mapped.buttons.dpad) {
                if (mapped.buttons.dpad.up) text += "  DPAD: UP\n";
                if (mapped.buttons.dpad.down) text += "  DPAD: DOWN\n";
                if (mapped.buttons.dpad.left) text += "  DPAD: LEFT\n";
                if (mapped.buttons.dpad.right) text += "  DPAD: RIGHT\n";

                Object.entries(mapped.buttons).forEach(([k, v]) => {
                    if (v === true && k !== 'dpad') text += `  BTN: ${k}\n`;
                });
            }
        }

        this.element.textContent = text;
    }
}
