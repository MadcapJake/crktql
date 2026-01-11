import { ControllerMappings } from './ControllerMappings.js';

export class InputMapper {
    constructor() {
        this.DEADZONE = 0.5;
        this.TRIGGER_THRESHOLD = 0.1;
        this.mappings = new ControllerMappings();
    }

    /**
     * Normalize gamepad input into a usable state object.
     * @param {Gamepad} gamepad 
     */
    map(gamepad) {
        if (!gamepad) return null;

        const indices = this.mappings.getIndices(gamepad) || this.getDefaultIndices(gamepad);

        // --- Helper for Button/Axis Reading ---
        // Supports: 12 (Button Index), "a0" (Axis 0 > 0.5), "-a1" (Axis 1 < -0.5), "+a1" (Axis 1 > 0.5)

        const readInput = (source) => {
            if (source === undefined || source === null) return false;

            // 1. Digital Button (Number)
            if (typeof source === 'number') {
                const btn = gamepad.buttons[source];
                return btn && (btn.pressed || btn.value > 0.5);
            }

            // 2. String Descriptors
            if (typeof source === 'string') {
                // Hat Switch: "h0.1" (Hat 0, Up) - skipping complex hat parsing for now, reliant on Axis fallback usually.
                if (source.startsWith('h')) return false;

                // Axis as Button
                // Formats: "a0", "+a0", "-a0"
                let axisIdx = 0;
                let sign = 0; // 0 = absolute check, 1 = positive, -1 = negative

                if (source.startsWith('+a')) {
                    axisIdx = parseInt(source.slice(2));
                    sign = 1;
                } else if (source.startsWith('-a')) {
                    axisIdx = parseInt(source.slice(2));
                    sign = -1;
                } else if (source.startsWith('a')) {
                    axisIdx = parseInt(source.slice(1));
                    sign = 0;
                } else {
                    return false;
                }

                const val = gamepad.axes[axisIdx];

                // If using Axes for Triggers (often map to a4, a5), range might be -1 to 1.
                // We typically check > 0.5 for digital activation.

                if (sign === 1) return val > 0.5;
                if (sign === -1) return val < -0.5;
                return Math.abs(val) > 0.5;
            }
            return false;
        };

        // D-Pad Helper: Checks mapping -> Axes 6/7 -> Buttons 12-15
        const readDpad = (dir) => {
            let result = false;

            // 1. Try Mapped Index
            let mapping = indices.buttons.dpad?.[dir];
            if (mapping !== undefined) {
                result = readInput(mapping);
            }

            // 2. Fallback: Axes 6/7 (Linux/SteamOS common)
            if (!result) {
                const axisH = gamepad.axes[6]; // Left/Right
                const axisV = gamepad.axes[7]; // Up/Down
                if (dir === 'left' && axisH < -0.5) result = true;
                if (dir === 'right' && axisH > 0.5) result = true;
                if (dir === 'up' && axisV < -0.5) result = true;
                if (dir === 'down' && axisV > 0.5) result = true;
            }

            // 3. Fallback: Standard Buttons 12-15 (Standard Gamepad)
            // If the custom mapping IS standard but failed for some reason, or user mapped it to standard keys.
            if (!result) {
                if (dir === 'up' && gamepad.buttons[12] && gamepad.buttons[12].value > 0.5) result = true;
                if (dir === 'down' && gamepad.buttons[13] && gamepad.buttons[13].value > 0.5) result = true;
                if (dir === 'left' && gamepad.buttons[14] && gamepad.buttons[14].value > 0.5) result = true;
                if (dir === 'right' && gamepad.buttons[15] && gamepad.buttons[15].value > 0.5) result = true;
            }

            return result;
        }

        const axisValue = (idx) => {
            if (idx !== undefined && gamepad.axes[idx] !== undefined) return gamepad.axes[idx];
            return 0;
        };

        const value = (idxOrString) => {
            // If button index
            if (typeof idxOrString === 'number') {
                return gamepad.buttons[idxOrString]?.value || 0;
            }
            // If axis string? Triggers might be mapped as axes.
            // If "a5", we return raw value?
            // InputMapper logic for triggers is usually simple "a5" -> get axis 5.
            // But if indices.buttons.lt is "a5", we want keys value.
            return 0;
        }


        // Axes
        const lxVal = axisValue(indices.axes.lx);
        const lyVal = axisValue(indices.axes.ly);
        const rxVal = axisValue(indices.axes.rx);
        const ryVal = axisValue(indices.axes.ry);

        // Triggers
        let lt = 0, rt = 0;
        if (indices.axes.lt !== undefined) {
            let raw = axisValue(indices.axes.lt);
            if (raw > -1) lt = (raw + 1) / 2;
        } else if (indices.buttons.lt !== undefined) {
            // If mapped to a button index or string?
            const map = indices.buttons.lt;
            if (typeof map === 'number') lt = gamepad.buttons[map]?.value || 0;
            else if (typeof map === 'string' && map.startsWith('a')) {
                // Mapped to axis
                const idx = parseInt(map.replace(/[^0-9]/g, ''));
                let raw = axisValue(idx);
                if (raw > -1) lt = (raw + 1) / 2;
            }
        }

        if (indices.axes.rt !== undefined) {
            let raw = axisValue(indices.axes.rt);
            if (raw > -1) rt = (raw + 1) / 2;
        } else if (indices.buttons.rt !== undefined) {
            const map = indices.buttons.rt;
            if (typeof map === 'number') rt = gamepad.buttons[map]?.value || 0;
            else if (typeof map === 'string' && map.startsWith('a')) {
                const idx = parseInt(map.replace(/[^0-9]/g, ''));
                let raw = axisValue(idx);
                if (raw > -1) rt = (raw + 1) / 2;
            }
        }

        return {
            mode: {
                raw: { lt, rt },
                leftTrigger: lt > this.TRIGGER_THRESHOLD,
                rightTrigger: rt > this.TRIGGER_THRESHOLD,
                bothTriggers: (lt > this.TRIGGER_THRESHOLD) && (rt > this.TRIGGER_THRESHOLD)
            },
            sticks: {
                left: this.processStick(lxVal, lyVal),
                right: this.processStick(rxVal, ryVal)
            },
            buttons: {
                south: readInput(indices.buttons.south),
                east: readInput(indices.buttons.east),
                west: readInput(indices.buttons.west),
                north: readInput(indices.buttons.north),
                lb: readInput(indices.buttons.lb),
                rb: readInput(indices.buttons.rb),
                select: readInput(indices.buttons.select),
                start: readInput(indices.buttons.start),
                l3: readInput(indices.buttons.l3),
                r3: readInput(indices.buttons.r3),
                dpad: {
                    up: readDpad('up'),
                    down: readDpad('down'),
                    left: readDpad('left'),
                    right: readDpad('right'),
                }
            }
        };
    }

    getDefaultIndices(gamepad) {
        let map = {
            axes: { lx: 0, ly: 1, rx: 2, ry: 3, lt: undefined, rt: undefined },
            buttons: { south: 0, east: 1, west: 2, north: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 10, r3: 11, dpad: { up: 12, down: 13, left: 14, right: 15 } }
        };
        return map;
    }

    processStick(x, y) {
        const magnitude = Math.sqrt(x * x + y * y);
        if (magnitude < this.DEADZONE) {
            return { x: 0, y: 0, angle: 0, magnitude: 0, active: false, sector: null };
        }
        let angleRad = Math.atan2(y, x);
        let degrees = angleRad * (180 / Math.PI);
        degrees += 90;
        if (degrees < 0) degrees += 360;
        return {
            x, y, angle: degrees, magnitude, active: true,
            sector: this.getSector(degrees)
        };
    }

    getSector(degrees) {
        const sectorSize = 45;
        const offset = sectorSize / 2;
        if (degrees >= 360 - offset || degrees < 0 + offset) return 'NORTH';
        if (degrees >= 45 - offset && degrees < 45 + offset) return 'NORTH_EAST';
        if (degrees >= 90 - offset && degrees < 90 + offset) return 'EAST';
        if (degrees >= 135 - offset && degrees < 135 + offset) return 'SOUTH_EAST';
        if (degrees >= 180 - offset && degrees < 180 + offset) return 'SOUTH';
        if (degrees >= 225 - offset && degrees < 225 + offset) return 'SOUTH_WEST';
        if (degrees >= 270 - offset && degrees < 270 + offset) return 'WEST';
        if (degrees >= 315 - offset && degrees < 315 + offset) return 'NORTH_WEST';
        return null;
    }
}
