export class GamepadManager {
    constructor() {
        this.controllers = {};
        this.animationFrameId = null;
        this.listeners = {
            'frame': [],
            'connect': [],
            'disconnect': []
        };

        window.addEventListener("gamepadconnected", this.onGamepadConnected.bind(this));
        window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected.bind(this));

        // Polling for initial connection (some browsers don't fire event if already connected)
        this.checkInterval = setInterval(this.scanGamepads.bind(this), 500);

        // Also check on user interaction
        window.addEventListener('click', () => this.scanGamepads());
        window.addEventListener('keydown', () => this.scanGamepads());
    }

    scanGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && !this.controllers[gamepads[i].index]) {
                // Manually trigger connect
                this.onGamepadConnected({ gamepad: gamepads[i] });
            }
        }
    }

    onGamepadConnected(e) {
        console.log("Gamepad connected", e.gamepad);
        this.controllers[e.gamepad.index] = e.gamepad;
        this.emit('connect', e.gamepad);

        // Start polling if this is the first controller
        if (Object.keys(this.controllers).length === 1 && !this.animationFrameId) {
            this.startPolling();
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    }

    onGamepadDisconnected(e) {
        console.log("Gamepad disconnected", e.gamepad);
        delete this.controllers[e.gamepad.index];
        this.emit('disconnect', e.gamepad);

        if (Object.keys(this.controllers).length === 0) {
            this.stopPolling();
        }
    }

    startPolling() {
        const loop = () => {
            this.poll();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    stopPolling() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    poll() {
        // Gamepad objects are snapshots, we need to query them again each frame
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);

        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.controllers[gamepads[i].index] = gamepads[i];
                this.emit('frame', gamepads[i]);
                // Ideally we only support the first active controller for now
                break;
            }
        }
    }

    // Simple event emitter
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}
