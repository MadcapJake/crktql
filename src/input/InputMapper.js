export class InputMapper {
    constructor() {
        this.DEADZONE = 0.5; // Increased to prevent snap-back inputs on release
        this.TRIGGER_THRESHOLD = 0.1;
    }

    /**
     * Normalize gamepad input into a usable state object.
     * @param {Gamepad} gamepad 
     */
    map(gamepad) {
        if (!gamepad) return null;

        const pressed = (btn) => btn && (btn.pressed || btn.value > 0.5);
        const value = (btn) => btn ? btn.value : 0;

        // Standard: Axes 0/1 (Left), 2/3 (Right)
        // User Reported Non-Standard: Axes 0/1 (Left), 3/4 (Right)

        let lx = 0, ly = 1, rx = 2, ry = 3;

        if (gamepad.mapping !== 'standard' && gamepad.axes.length >= 5) {
            // Heuristic for the reported controller
            rx = 3;
            ry = 4;
        }

        const leftTriggerValue = value(gamepad.buttons[6]);
        const rightTriggerValue = value(gamepad.buttons[7]);

        // Fallback for axes-based triggers (Common on Linux/DirectInput)
        // Usually Axis 2 and 5 (or 4/5) are triggers.
        // We only override if buttons are 0 to avoid conflict.
        let altLt = 0, altRt = 0;
        if (gamepad.axes.length >= 6) {
            // Try Axis 2 and 5 (often used for L2/R2)
            if (leftTriggerValue === 0 && Math.abs(gamepad.axes[2]) > 0.1) altLt = (gamepad.axes[2] + 1) / 2; // Normalize -1..1 to 0..1? Or just 0..1?
            // Often triggers are -1 to 1.
            // Let's assume standard 0..1 for axes if they are triggers? 
            // Actually, triggers as axes often rest at -1 and press to 1.
            if (leftTriggerValue === 0 && gamepad.buttons[6] && !gamepad.buttons[6].pressed) {
                // Check Axis 2
                // If Axis 2 is -1, value is 0. If 1, value is 1.
                // We'll read raw value.
            }
        }

        // Actually, let's keep it simple first. If the user saw 0.00 for LT/RT, maybe they ARE on axes.
        // Let's map normalized trigger values.

        let lt = leftTriggerValue;
        let rt = rightTriggerValue;

        // Linux 8BitDo often uses Axis 2 (LT) and Axis 5 (RT)
        if (lt === 0 && gamepad.axes[2] !== undefined && gamepad.axes[2] > -0.9) {
            // Check if it looks like a trigger (Rest at -1?)
            if (gamepad.axes[2] > -1) lt = (gamepad.axes[2] + 1) / 2;
        }
        if (rt === 0 && gamepad.axes[5] !== undefined && gamepad.axes[5] > -0.9) {
            if (gamepad.axes[5] > -1) rt = (gamepad.axes[5] + 1) / 2;
        }

        // Default indices
        let l3Idx = 10;
        let r3Idx = 11;

        if (gamepad.mapping !== 'standard' && gamepad.axes.length >= 5) {
            // Heuristic: User's 8BitDo/Linux controller
            // L3=9, R3=10
            l3Idx = 9;
            r3Idx = 10;
        }

        return {
            mode: {
                raw: {
                    lt: lt,
                    rt: rt,
                },
                leftTrigger: lt > this.TRIGGER_THRESHOLD,
                rightTrigger: rt > this.TRIGGER_THRESHOLD,
                bothTriggers: (lt > this.TRIGGER_THRESHOLD) && (rt > this.TRIGGER_THRESHOLD)
            },
            sticks: {
                left: this.processStick(gamepad.axes[lx], gamepad.axes[ly]),
                right: this.processStick(gamepad.axes[rx], gamepad.axes[ry])
            },
            buttons: {
                south: pressed(gamepad.buttons[0]), // A / Cross
                east: pressed(gamepad.buttons[1]),  // B / Circle
                west: pressed(gamepad.buttons[2]),  // X / Square
                north: pressed(gamepad.buttons[3]), // Y / Triangle
                lb: pressed(gamepad.buttons[4]),
                rb: pressed(gamepad.buttons[5]),
                select: pressed(gamepad.buttons[8]),
                start: pressed(gamepad.buttons[9]),
                l3: pressed(gamepad.buttons[l3Idx]),
                r3: pressed(gamepad.buttons[r3Idx]),
                dpad: {
                    up: pressed(gamepad.buttons[12]),
                    down: pressed(gamepad.buttons[13]),
                    left: pressed(gamepad.buttons[14]),
                    right: pressed(gamepad.buttons[15]),
                }
            }
        };
    }

    processStick(x, y) {
        // Apply deadzone
        const magnitude = Math.sqrt(x * x + y * y);
        if (magnitude < this.DEADZONE) {
            return { x: 0, y: 0, angle: 0, magnitude: 0, active: false, sector: null };
        }

        // Calculate angle in degrees (0 = North, 90 = East, 180 = South, 270 = West)
        // Math.atan2(y, x) returns radians where 0 is East, PI/2 is South, etc.
        // We want 0 to be North (negative Y).

        // Standard Atan2: 0=East, 90=South, 180=West, -90=North
        // Let's normalize to 0-360 starting from North clockwise.
        let angleRad = Math.atan2(y, x);
        let degrees = angleRad * (180 / Math.PI); // (-180 to 180)

        // Rotate so North is 0
        // Atan2: North is -90. 
        // -90 + 90 = 0.
        degrees += 90;

        if (degrees < 0) degrees += 360;

        return {
            x,
            y,
            angle: degrees,
            magnitude,
            active: true,
            sector: this.getSector(degrees)
        };
    }

    getSector(degrees) {
        // 8 sectors, 45 degrees each.
        // North is 0 (337.5 to 22.5)
        // NE is 45 (22.5 to 67.5)
        // E is 90 (67.5 to 112.5)
        // etc.
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
