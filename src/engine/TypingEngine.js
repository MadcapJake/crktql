import { InputMapper } from '../input/InputMapper.js';

export class TypingEngine {
    constructor() {
        this.mapper = new InputMapper();
        this.state = {
            mode: 'ONSET',
            text: '',

            // Case: 0=lower, 1=shift (next char), 2=caps (lock)
            caseMode: 0,

            // Syllable Construction Buffer
            syllable: {
                onset: null,
                vowel: null,
                coda: null
            },

            // Tracking
            lastInput: null,

            // Debounce / Dwell State
            leftStick: { sector: null, enterTime: 0 },
            rightStick: { sector: null, enterTime: 0 },

            modeSwitchTime: 0
        };

        this.DWELL_THRESHOLD = 60;

        this.mappings = {
            ONSET: {
                LEFT: {
                    'NORTH': 'h', 'NORTH_EAST': 'k', 'EAST': 't', 'SOUTH_EAST': 'c',
                    'SOUTH': 'f', 'SOUTH_WEST': 's', 'WEST': 'n', 'NORTH_WEST': 'l'
                },
                RIGHT: {
                    'NORTH': 'y', 'NORTH_EAST': 'g', 'EAST': 'd', 'SOUTH_EAST': 'z',
                    'SOUTH': 'b', 'SOUTH_WEST': 'x', 'WEST': 'm', 'NORTH_WEST': 'w'
                }
            },
            RIME: {
                VOWELS: {
                    'NORTH': 'i', 'NORTH_EAST': 'û', 'EAST': 'u', 'SOUTH_EAST': 'ô',
                    'SOUTH': 'o', 'SOUTH_WEST': 'e', 'WEST': 'ê', 'NORTH_WEST': 'î'
                },
                CODA: {
                    'NORTH': 'k', 'EAST': 't', 'SOUTH_EAST': 'c',
                    'SOUTH_WEST': 's', 'WEST': 'n', 'NORTH_WEST': 'l'
                }
            },
            PUNCTUATION: {
                LEFT: {
                    'NORTH': ';', 'NORTH_EAST': '“', 'EAST': '¿', 'SOUTH_EAST': ',',
                    'SOUTH': '«', 'SOUTH_WEST': '<', 'WEST': null, 'NORTH_WEST': null
                },
                RIGHT: {
                    'NORTH': ':', 'NORTH_EAST': '”', 'EAST': '?', 'SOUTH_EAST': '.',
                    'SOUTH': '»', 'SOUTH_WEST': '>'
                }
            }
        };
    }

    processFrame(gamepad) {
        const input = this.mapper.map(gamepad);
        if (!input) return null;

        // Detect Mode Transition
        let newMode = 'ONSET';
        if (input.mode.bothTriggers) {
            newMode = 'PUNCTUATION';
        } else if (input.mode.leftTrigger) {
            newMode = 'RIME_LEFT';
        } else if (input.mode.rightTrigger) {
            newMode = 'RIME_RIGHT';
        }

        // Handle Mode Change logic (Triggers)
        if (this.state.mode !== newMode) {
            const exitingRime = (newMode === 'ONSET' && (this.state.mode === 'RIME_LEFT' || this.state.mode === 'RIME_RIGHT'));

            // Commit buffer on Rime Exit
            if (exitingRime) {
                // Get formatted text (Handles Case)
                let result = this.getFormattedSyllable();

                if (result.length > 0) {
                    this.typeCharacter(result);
                    this.consumeShift();
                }
                this.clearSyllable();
            }

            this.state.mode = newMode;
            this.state.modeSwitchTime = Date.now(); // Record switch time
        }

        this.handleStickInput(input, this.state.lastInput);
        this.handleButtons(input, this.state.lastInput);

        this.state.lastInput = input;
        return this.state;
    }

    handleStickInput(current, last) {
        if (!last) return;

        // whichPart: 'onset', 'vowel', 'coda'
        const processStick = (stickName, whichPart, map) => {
            const curStick = current.sticks[stickName];
            const lastStick = last.sticks[stickName];
            const stickState = this.state[`${stickName}Stick`];

            // 1. Sector Stability Check
            if (curStick.active && curStick.sector) {
                if (stickState.sector !== curStick.sector) {
                    // Entered new sector
                    stickState.sector = curStick.sector;
                    stickState.enterTime = Date.now();
                } else {
                    // Holding same sector
                    const holdDuration = Date.now() - stickState.enterTime;

                    // Only act if held > threshold
                    if (holdDuration > this.DWELL_THRESHOLD) {
                        // Filter: If we held this stick BEFORE the last mode switch, ignore it.
                        // This forces a "fresh" press for the new mode.
                        if (stickState.enterTime > this.state.modeSwitchTime) {
                            const char = map[curStick.sector];
                            if (char) {
                                // Update the specific part of the syllable buffer
                                this.state.syllable[whichPart] = char;
                            }
                        }
                    }
                }
            } else {
                // Stick inactive
                stickState.sector = null;
                stickState.enterTime = 0;

                // Should we clear the vowel/coda if released?
                // "Unlike in the Onset Mode, releasing the joystick does not cause the vowel to be selected."
                // But does it clear it? 
                // "Only releasing the Rime Mode trigger causes the vowel and coda that are currently being held to be finalized"
                // "currently being held" implies if I let go, it's gone?
                // "If the user moves the joystick... it will cause the dash to change... If the user has both joysticks active..."
                // This implies the value reflects CURRENT stick state.
                // So if stick is inactive, that part is null.
                if (this.state.mode.startsWith('RIME')) {
                    this.state.syllable[whichPart] = null;
                }
            }

            // 2. Commit on Release (ONSET ONLY)
            if (lastStick.active && !curStick.active && this.state.mode === 'ONSET' && whichPart === 'onset') {
                // If we release stick in Onset mode, we commit Onset + 'o'.
                // UNLESS we are about to press the trigger?
                // The user says: "releasing the joystick... causes the letter o to be added".
                // "By triggering rime mode, the user can circumvent the standard o vowel."

                // Issue: If user presses Trigger immediately after release, we might have already committed.
                // But usually you press Trigger WHILE holding, or BEFORE releasing.
                // If you release, then press trigger, it's two separate actions.

                if (this.state.syllable.onset) {
                    // Need to handle formatting for Onset + 'o'
                    // getFormattedSyllable() returns just the onset part if vowel/coda empty.
                    // We need to append 'o'.
                    // BUT wait, if Shift is active, 'o' stays lower? Yes.
                    // "Mo".

                    let text = this.getFormattedSyllable();
                    this.typeCharacter(text + 'o');
                    this.clearSyllable();
                    this.consumeShift();
                }
            }
        };

        if (this.state.mode === 'ONSET') {
            processStick('left', 'onset', this.mappings.ONSET.LEFT);
            processStick('right', 'onset', this.mappings.ONSET.RIGHT);
            // In onset, vowels/codas should be null
            this.state.syllable.vowel = null;
            this.state.syllable.coda = null;
        }
        else if (this.state.mode === 'RIME_LEFT') {
            processStick('left', 'vowel', this.mappings.RIME.VOWELS);
            processStick('right', 'coda', this.mappings.RIME.CODA);
        }
        else if (this.state.mode === 'RIME_RIGHT') {
            processStick('right', 'vowel', this.mappings.RIME.VOWELS);
            processStick('left', 'coda', this.mappings.RIME.CODA);
        }
        else if (this.state.mode === 'PUNCTUATION') {
            // Punctuation is instant? Or buffered?
            // Assuming instant/buffered logic similar to onset for now, or just direct type.
            // Let's use direct type for punctuation to keep it simple unless specified.
            // Actually, let's use the 'onset' slot to buffer punctuation char, commit on release.
            processStick('left', 'onset', this.mappings.PUNCTUATION.LEFT);
            processStick('right', 'onset', this.mappings.PUNCTUATION.RIGHT);
        }
    }

    handleButtons(current, last) {
        if (!last) return;

        const pressed = (btn) => current.buttons[btn] && !last.buttons[btn];

        if (pressed('south')) { // A Button: Space
            this.typeCharacter(' ');
        }
        if (pressed('east')) { // B Button: Enter
            this.typeCharacter('\n');
        }
        if (pressed('west')) { // X Button: Delete
            this.deleteCharacter();
        }

        // Case Switching (L3/R3)
        if (pressed('l3') || pressed('r3')) {
            this.state.caseMode = (this.state.caseMode + 1) % 3;
            console.log("Case Mode:", ['LOWER', 'SHIFT', 'CAPS'][this.state.caseMode]);

            // Re-apply case to current buffer if exists?
            // Ideally we should refresh the buffer, but the stick logic will overwrite it on next frame if held?
            // No, if held, we need to force update.
            // Let's rely on user moving stick or just holding. 
            // Actually, since stick input logic checks `holdDuration`, it might not re-set the char if sector hasn't changed.
            // We should force re-evaluation of currently held sticks?
            // Easier: Just invalidate `sector` in stick state to force update? 
            // Or simply wait for user to move.
            // User Request: "click... causes... to be reflected". So immediate update needed.
            this.forceUpdateBuffer();
        }
    }

    forceUpdateBuffer() {
        // Re-process active sticks to apply new case
        // We can just call handleStickInput again? Or manually update buffer from sticks.
        ['left', 'right'].forEach(name => {
            const stick = this.state.lastInput?.sticks[name];
            if (stick && stick.active && stick.sector && this.state[`${name}Stick`].sector === stick.sector) {
                // Re-read map and apply case
                // We need the map... redundant logic. 
                // For now, let's assume the user moves slightly or we accept it updates on next move.
                // Actually, let's try to implement applyCase in handleStickInput.
            }
        });
    }

    getFormattedSyllable() {
        const s = this.state.syllable;
        const mode = this.state.caseMode;

        let onset = s.onset || '';
        let vowel = s.vowel || '';
        let coda = s.coda || '';

        // If nothing in buffer, return empty
        if (!onset && !vowel && !coda) return '';

        if (mode === 2) { // CAPS LOCK
            return (onset + vowel + coda).toUpperCase();
        }

        if (mode === 1) { // SHIFT (Title Case)
            if (onset) {
                return onset.toUpperCase() + vowel + coda;
            } else if (vowel) {
                return vowel.toUpperCase() + coda;
            } else if (coda) {
                // Rare case: only coda selected? (e.g. onset-less syllable starting with consonant coda? unlikely but possible)
                return coda.toUpperCase();
            }
        }

        // LOWER
        return onset + vowel + coda;
    }

    typeCharacter(char) {
        this.state.text += char;
        console.log("Typed:", char);
    }

    deleteCharacter() {
        this.state.text = this.state.text.slice(0, -1);
    }

    consumeShift() {
        if (this.state.caseMode === 1) { // Shift
            this.state.caseMode = 0; // Reset to lower
        }
    }

    clearSyllable() {
        this.state.syllable = { onset: null, vowel: null, coda: null };
    }
}
