export class ControllerMappings {
    constructor() {
        this.mappings = {};

        // SDL Mapping Format: GUID,Name,Mapping
        // We key by a simplified ID string: "VENDOR_PRODUCT" (hex lower)

        this.addMapping('03000000c82d000009600000', '8BitDo Pro 3', 'a:b0,b:b1,x:b2,y:b3,back:b6,start:b7,guide:b8,leftstick:b9,rightstick:b10,leftshoulder:b4,rightshoulder:b5,dpup:h0.1,dpdown:h0.4,dpleft:h0.8,dpright:h0.2,leftx:a0,lefty:a1,rightx:a3,righty:a4,lefttrigger:a2,righttrigger:a5');

        // Also add a fallback for the specific Vendor/Product the user reported if GUID logic fails or varies
        // Vendor: 2dc8, Product: 6009
        // User Feedback: Start=11, RB=7.
        // Hypothesizing Switch-style layout via Bluetooth:
        // B=0, A=1, Y=2, X=3, L=4, R=5, ZL=6, ZR=7, Minus=8, Plus=9, L3=10, R3=11, Home=12, Capture=13
        // BUT user says Start=11.

        this.addMapping('2dc8-6009', '8BitDo Pro 3 (User Config)', 'a:b0,b:b1,x:b2,y:b3,back:b10,start:b11,leftstick:b12,rightstick:b13,leftshoulder:b6,rightshoulder:b7,dpup:h0.1,dpdown:h0.4,dpleft:h0.8,dpright:h0.2,leftx:a0,lefty:a1,rightx:a2,righty:a3,lefttrigger:a4,righttrigger:a5');

        this.loadFromStorage();
    }

    addMapping(guidOrId, name, mappingString) {
        this.mappings[guidOrId.toLowerCase()] = this.parseMapping(mappingString);
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('custom_gamepad_mapping');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.key && data.mapping) {
                    console.log("Loaded custom mapping for:", data.key);
                    this.addMapping(data.key, data.name, data.mapping);
                }
            }
        } catch (e) {
            console.error("Failed to load custom mapping", e);
        }
    }

    findMapping(gamepad) {
        // Try to construct a GUID-like string or ID from the gamepad
        // Browsers don't always give the standard SDL GUID.
        // Chrome/Edge: "Vendor: 2dc8 Product: 6009" in ID string.

        const id = gamepad.id.toLowerCase();

        // Regex to extract Vendor and Product
        const vendorMatch = id.match(/vendor:\s*([0-9a-f]{4})/);
        const productMatch = id.match(/product:\s*([0-9a-f]{4})/);

        if (vendorMatch && productMatch) {
            const key = `${vendorMatch[1]}-${productMatch[1]}`;
            if (this.mappings[key]) return this.mappings[key];
        }

        // Fallback to generic user-custom if exists
        // This handles cases where regex fails (e.g. "XInput Controller") but user calibrated
        if (this.mappings['user-custom']) {
            return this.mappings['user-custom'];
        }

        return null; // No custom mapping found
    }

    parseMapping(str) {
        const map = { buttons: {}, axes: {} };
        const parts = str.split(',');

        parts.forEach(part => {
            if (!part.includes(':')) return;
            const [target, source] = part.split(':');

            // source is like 'b0', 'a1', 'h0.1'
            if (source.startsWith('b')) {
                map.buttons[target] = parseInt(source.substring(1));
            } else if (source.startsWith('a')) {
                map.axes[target] = parseInt(source.substring(1));
            } else if (source.startsWith('h')) {
                // Hat/D-Pad: h0.1, h0.2 etc.
                // We'll treat these specially if needed, or mapping them to virtual buttons?
                // For now, let's store them as special 'hat' entries
                map.buttons[target] = { type: 'hat', val: source };
            }
        });

        return map;
    }

    apply(gamepad, mapping, state) {
        // ... (This method was unused in previous logic, relying on getIndices instead)
        // Leaving it or removing it? getIndices is the primary way InputMapper consumes this.
    }

    getIndices(gamepad) {
        const mapping = this.findMapping(gamepad);
        if (!mapping) return null; // Use standard/fallback

        // Return a map of logical inputs to physical properties
        return {
            axes: {
                lx: mapping.axes.leftx ?? 0,
                ly: mapping.axes.lefty ?? 1,
                rx: mapping.axes.rightx ?? 2,
                ry: mapping.axes.righty ?? 3,
                lt: mapping.axes.lefttrigger, // might be undefined if button
                rt: mapping.axes.righttrigger
            },
            buttons: {
                south: mapping.buttons.a ?? 0,
                east: mapping.buttons.b ?? 1,
                west: mapping.buttons.x ?? 2,
                north: mapping.buttons.y ?? 3,
                lb: mapping.buttons.leftshoulder ?? 4,
                rb: mapping.buttons.rightshoulder ?? 5,
                select: mapping.buttons.back ?? 8,
                start: mapping.buttons.start ?? 9,
                l3: mapping.buttons.leftstick ?? 10,
                r3: mapping.buttons.rightstick ?? 11,
                lt: mapping.buttons.lefttrigger, // might be defined if button
                rt: mapping.buttons.righttrigger
            }
        };
    }
}
