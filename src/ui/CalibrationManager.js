import { ControllerMappings } from '../input/ControllerMappings.js';

export class CalibrationManager {
    constructor(gamepadManager, inputMapper, onClose) {
        this.gamepadManager = gamepadManager;
        this.inputMapper = inputMapper;
        this.onClose = onClose;

        this.allSteps = [
            { id: 'south', label: 'Bottom Face Button (A/Cross)' },
            { id: 'east', label: 'Right Face Button (B/Circle)' },
            { id: 'west', label: 'Left Face Button (X/Square)' },
            { id: 'north', label: 'Top Face Button (Y/Triangle)' },
            { id: 'lb', label: 'Left Bumper (L1)' },
            { id: 'rb', label: 'Right Bumper (R1)' },
            { id: 'lt', label: 'Left Trigger (L2) - Press Fully', type: 'trigger' },
            { id: 'rt', label: 'Right Trigger (R2) - Press Fully', type: 'trigger' },
            { id: 'select', label: 'Select / Back / View' },
            { id: 'start', label: 'Start / Menu' },
            { id: 'l3', label: 'Left Stick Click (L3)' },
            { id: 'r3', label: 'Right Stick Click (R3)' },
            { id: 'dpad_up', label: 'D-Pad Up' },
            { id: 'dpad_down', label: 'D-Pad Down' },
            { id: 'dpad_left', label: 'D-Pad Left' },
            { id: 'dpad_right', label: 'D-Pad Right' },
            { id: 'lx', label: 'Move Left Stick Left', type: 'axis_neg' },
            { id: 'ly', label: 'Move Left Stick Up', type: 'axis_neg' },
            { id: 'rx', label: 'Move Right Stick Left', type: 'axis_neg' },
            { id: 'ry', label: 'Move Right Stick Up', type: 'axis_neg' }
        ];

        this.queue = [];
        this.skippedQueue = [];
        this.currentStep = null;

        this.calibrationData = { buttons: {}, axes: {} };
        this.isCalibrating = false;

        this.state = 'IDLE';
        this.releaseCode = null;
        this.axisBaselines = [];

        this.modal = document.getElementById('calibration-modal');
        this.prompt = document.getElementById('calibration-prompt');
        this.skipBtn = document.getElementById('cal-skip');
        this.cancelBtn = document.getElementById('cal-cancel');
        this.visuals = document.querySelectorAll('.vis-btn, .vis-stick, .vis-dpad');

        this.skipBtn.addEventListener('click', () => {
            if (this.state === 'INITIAL_RELEASE') {
                this.updateBaselines();
                this.nextStep();
            } else {
                this.skipStep();
            }
        });

        this.cancelBtn.addEventListener('click', () => this.stop());
    }

    start() {
        this.isCalibrating = true;
        this.calibrationData = { buttons: {}, axes: {} };
        this.queue = [...this.allSteps];
        this.skippedQueue = [];
        this.state = 'INITIAL_RELEASE';
        this.releaseCode = null;

        this.updateBaselines();
        this.modal.style.display = 'flex';

        this.visuals.forEach(el => {
            el.className = el.className.replace(/active|skipped|flash-error/g, '').trim();
        });

        this.prompt.textContent = "Checking for stuck inputs...";
        this.updateSkipButton('Force Start');
    }

    updateBaselines() {
        const gp = this.gamepadManager.getActiveGamepad();
        if (gp) {
            this.axisBaselines = gp.axes.map(v => v);
        } else {
            this.axisBaselines = [];
        }
    }

    stop() {
        this.isCalibrating = false;
        this.state = 'IDLE';
        this.modal.style.display = 'none';
        if (this.onClose) this.onClose();
    }

    save() {
        const parts = [];
        const nameMap = {
            south: 'a', east: 'b', west: 'x', north: 'y',
            lb: 'leftshoulder', rb: 'rightshoulder',
            lt: 'lefttrigger', rt: 'righttrigger',
            select: 'back', start: 'start',
            l3: 'leftstick', r3: 'rightstick',
            dpad_up: 'dpup', dpad_down: 'dpdown', dpad_left: 'dpleft', dpad_right: 'dpright',
            lx: 'leftx', ly: 'lefty', rx: 'rightx', ry: 'righty'
        };

        for (const [key, val] of Object.entries(this.calibrationData.buttons)) {
            const sdlName = nameMap[key];
            if (sdlName) parts.push(`${sdlName}:${val}`);
        }
        for (const [key, val] of Object.entries(this.calibrationData.axes)) {
            const sdlName = nameMap[key];
            if (sdlName) parts.push(`${sdlName}:${val}`);
        }

        const mappingString = parts.join(',');
        const gamepad = this.gamepadManager.getActiveGamepad();
        if (gamepad) {
            const id = gamepad.id.toLowerCase();
            const vendorMatch = id.match(/vendor:\s*([0-9a-f]{4})/);
            const productMatch = id.match(/product:\s*([0-9a-f]{4})/);
            let key = 'user-custom';
            if (vendorMatch && productMatch) {
                key = `${vendorMatch[1]}-${productMatch[1]}`;
            }
            localStorage.setItem('custom_gamepad_mapping', JSON.stringify({ key, name: 'User Calibrated', mapping: mappingString }));
            this.inputMapper.mappings.loadFromStorage();
        }

        this.stop();
    }

    nextStep() {
        if (this.queue.length === 0) {
            if (this.skippedQueue.length > 0) {
                alert("Revisiting skipped buttons. Please map them now.");
                this.queue = [...this.skippedQueue];
                this.skippedQueue = [];
            } else {
                this.save();
                return;
            }
        }

        this.currentStep = this.queue.shift();
        this.state = 'WAITING_FOR_INPUT';
        this.updateSkipButton('Skip');
        this.renderStep();
    }

    updateSkipButton(text) {
        if (this.skipBtn) this.skipBtn.textContent = text;
    }

    skipStep() {
        if (!this.currentStep) return;
        const selector = this.getVisSelector(this.currentStep.id);
        if (selector) {
            const el = this.modal.querySelector(selector);
            if (el) {
                el.classList.remove('active');
                el.classList.add('skipped');
            }
        }
        this.skippedQueue.push(this.currentStep);
        this.nextStep();
    }

    renderStep() {
        if (!this.currentStep) return;
        this.prompt.textContent = this.currentStep.label;
        const selector = this.getVisSelector(this.currentStep.id);
        if (selector) {
            const el = this.modal.querySelector(selector);
            el.classList.remove('skipped');
            el.classList.add('active');
        }
    }

    getVisSelector(stepId) {
        const visMap = {
            south: '.vis-a', east: '.vis-b', west: '.vis-x', north: '.vis-y',
            lb: '.vis-l-shoulder', rb: '.vis-r-shoulder',
            lt: '.vis-l-trigger', rt: '.vis-r-trigger',
            select: '.vis-select', start: '.vis-start',
            l3: '.vis-l-stick', r3: '.vis-r-stick',
            dpad_up: '.vis-dpad', dpad_down: '.vis-dpad', dpad_left: '.vis-dpad', dpad_right: '.vis-dpad',
            lx: '.vis-l-stick', ly: '.vis-l-stick', rx: '.vis-r-stick', ry: '.vis-r-stick'
        };
        return visMap[stepId];
    }

    getAxisDelta(gamepad, index) {
        if (!this.axisBaselines[index] && this.axisBaselines[index] !== 0) return 0;
        const current = gamepad.axes[index];
        const base = this.axisBaselines[index];
        return Math.abs(current - base);
    }

    handleInput(gamepad) {
        if (!this.isCalibrating) return;

        // --- 0. INITIAL RELEASE CHECK ---
        if (this.state === 'INITIAL_RELEASE') {
            let stuckInput = null;
            // Check Buttons
            for (let i = 0; i < gamepad.buttons.length; i++) {
                if (gamepad.buttons[i].pressed) {
                    stuckInput = `Button ${i}`; break;
                }
            }
            // Check Axes (Delta > 0.5)
            if (!stuckInput) {
                for (let i = 0; i < gamepad.axes.length; i++) {
                    const delta = this.getAxisDelta(gamepad, i);
                    if (delta > 0.5) {
                        stuckInput = `Axis ${i} Moved`; break;
                    }
                }
            }

            if (!stuckInput) {
                this.nextStep();
            } else {
                this.prompt.textContent = `Input Detected: [${stuckInput}]. Release or press 'Force Start'.`;
            }
            return;
        }

        if (!this.currentStep) return;

        // --- 1. WAIT FOR RELEASE ---
        if (this.state === 'WAITING_FOR_RELEASE') {
            this.prompt.textContent = "Release Button...";
            let isStillPressed = false;

            if (this.releaseCode.includes('b')) {
                // Handle pure button code (b4)
                if (this.releaseCode.startsWith('b')) {
                    const idx = parseInt(this.releaseCode.substring(1));
                    if (gamepad.buttons[idx] && gamepad.buttons[idx].pressed) isStillPressed = true;
                }
            } else if (this.releaseCode.includes('a')) {
                // Handle axis code (a0, +a7, -a7)
                const clean = this.releaseCode.replace(/[+-]/g, '');
                const idx = parseInt(clean.substring(1));

                // If signed (+a7), check if still in that zone
                if (this.releaseCode.startsWith('+')) {
                    if (gamepad.axes[idx] > 0.3) isStillPressed = true;
                } else if (this.releaseCode.startsWith('-')) {
                    if (gamepad.axes[idx] < -0.3) isStillPressed = true;
                } else {
                    // Absolute / Baseline logic
                    const delta = this.getAxisDelta(gamepad, idx);
                    if (delta > 0.3) isStillPressed = true;
                }
            }

            if (!isStillPressed) {
                this.nextStep();
            }
            return;
        }

        // --- 2. WAITING FOR INPUT ---
        if (this.state === 'WAITING_FOR_INPUT') {
            let detectedCode = null;

            // Check Buttons
            for (let i = 0; i < gamepad.buttons.length; i++) {
                if (gamepad.buttons[i].pressed) {
                    detectedCode = `b${i}`;
                    break;
                }
            }

            // Check Axes (Delta)
            if (!detectedCode) {
                for (let i = 0; i < gamepad.axes.length; i++) {
                    const delta = this.getAxisDelta(gamepad, i);
                    if (delta > 0.6) {
                        // Is this a SIGNED step (Button type like D-Pad, Trigger when mapped to buttons) 
                        // or a FULL AXIS step (stick)?
                        let code = `a${i}`; // default

                        // Determine Sign if detecting for Button steps
                        if (!this.currentStep.type || this.currentStep.type === 'trigger') {
                            const val = gamepad.axes[i];
                            if (val > 0.5) code = `+a${i}`;
                            else if (val < -0.5) code = `-a${i}`;
                        } else if (this.currentStep.type === 'axis_neg') {
                            // Stick calibration usually wants raw axis index
                            code = `a${i}`;
                        }

                        detectedCode = code;
                        break;
                    }
                }
            }

            if (detectedCode) {
                const dup = this.checkDuplicate(detectedCode);
                if (dup) {
                    this.flashError(dup);
                    return;
                }
                this.record(this.currentStep, detectedCode);
            }
        }
    }

    checkDuplicate(code) {
        // Advanced Duplicate Check
        // Conflicting:
        //  Exact match: a7 == a7, -a7 == -a7
        //  Partial overlap: a7 (whole) conflicts with +a7 or -a7
        //  Partial overlap: +a7 or -a7 conflicts with a7 (whole)

        // HOWEVER: +a7 vs -a7 is ALLOWED (Different directions on same axis)

        const isConflict = (existing, incoming) => {
            if (existing === incoming) return true;

            // Normalize
            const eClean = existing.replace(/[+-]/g, '');
            const iClean = incoming.replace(/[+-]/g, '');
            const eIdx = eClean.startsWith('a') ? eClean : null;
            const iIdx = iClean.startsWith('a') ? iClean : null;

            // If strictly different axes/buttons, no conflict
            if (eClean !== iClean) return false;

            // Same ID.
            // If both are buttons (b1, b1), caught by exact match.
            // If both are axes...
            if (eIdx && iIdx) {
                // If one is "whole" (a7) and other is "signed" (+a7), conflict.
                const eSigned = existing.includes('+') || existing.includes('-');
                const iSigned = incoming.includes('+') || incoming.includes('-');

                if (!eSigned || !iSigned) return true; // One is whole -> Conflict

                // Both signed.
                // +a7 vs -a7 -> Valid.
                // +a7 vs +a7 -> Conflict.
                return existing === incoming;
            }
            return false;
        };

        const all = { ...this.calibrationData.buttons, ...this.calibrationData.axes };
        for (const [key, val] of Object.entries(all)) {
            if (isConflict(val, code)) return key;
        }
        return null;
    }

    flashError(stepId) {
        const selector = this.getVisSelector(stepId);
        if (selector) {
            const el = this.modal.querySelector(selector);
            if (el) {
                el.classList.remove('flash-error');
                void el.offsetWidth;
                el.classList.add('flash-error');
            }
        }
    }

    record(step, code) {
        const selector = this.getVisSelector(step.id);
        if (selector) {
            this.modal.querySelector(selector)?.classList.remove('active');
        }

        if (step.type === 'trigger') {
            const isAxis = code.includes('a');
            if (isAxis) this.calibrationData.axes[step.id] = code;
            else this.calibrationData.buttons[step.id] = code.replace(/[+-]/g, ''); // buttons usually just bX
        } else if (step.type === 'axis_neg') {
            // Stick
            this.calibrationData.axes[step.id] = code.replace(/[+-]/g, ''); // Sticks usually mapped as whole axis a0
        } else {
            // Buttons/D-Pad
            // Store signed if axis (+a7), or plain if button (b12)
            this.calibrationData.buttons[step.id] = code;
        }

        this.state = 'WAITING_FOR_RELEASE';
        this.releaseCode = code;
    }
}
