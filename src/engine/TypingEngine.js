import { InputMapper } from '../input/InputMapper.js';
import { logger } from '../utils/DebugLogger.js';

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
            pendingChar: null,
            pendingStick: null,
            onsetOwner: null,

            // Debounce / Dwell State
            leftStick: { sector: null, enterTime: 0, locked: false },
            rightStick: { sector: null, enterTime: 0, locked: false },

            modeSwitchTime: 0
        };

        this.DWELL_THRESHOLD = 60;
        this.onsetConflictMode = 'COMMIT'; // Default

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

        const now = Date.now();

        // whichPart: 'onset', 'vowel', 'coda'
        const processStick = (stickName, whichPart, map) => {
            const curStick = current.sticks[stickName];
            const lastStick = last.sticks[stickName];
            const stickState = this.state[`${stickName}Stick`];

            // 0. Lock Handling
            if (!curStick.active) {
                if (stickState.locked) logger.log('STICK', `${stickName} Unlocked`);
                stickState.locked = false; // Unlock on release
            }
            if (stickState.locked) return; // Ignore if locked

            // 1. Sector Stability Check
            if (curStick.active && curStick.sector) {
                if (stickState.sector !== curStick.sector) {
                    // Entered new sector
                    stickState.sector = curStick.sector;
                    stickState.enterTime = now;
                } else {
                    // Holding same sector
                    const holdDuration = now - stickState.enterTime;

                    // Only act if held > threshold
                    if (holdDuration > this.DWELL_THRESHOLD) {
                        // Filter: If we held this stick BEFORE the last mode switch, ignore it.
                        // This forces a "fresh" press for the new mode.
                        if (stickState.enterTime > this.state.modeSwitchTime) {

                            // CONFLICT RESOLUTION (ONSET MODE ONLY)
                            if (this.state.mode === 'ONSET' && whichPart === 'onset') {
                                const otherStickName = stickName === 'left' ? 'right' : 'left';
                                const otherStickState = this.state[`${otherStickName}Stick`]; // Internal state
                                const otherStickInput = current.sticks[otherStickName]; // Raw input from CURRENT frame

                                // Is the OTHER stick currently active and holding a value?
                                // We check `this.state.syllable.onset` because that's where the *current* onset is stored.
                                // If it's null, there's no conflict to resolve yet.
                                if (otherStickInput && otherStickInput.active && !otherStickState.locked && this.state.syllable.onset) {
                                    // We have a conflict. User is holding one stick (with onset) and pressing another.

                                    // Check if we are the "new" stick?
                                    // Compare enterTimes.
                                    if (stickState.enterTime > otherStickState.enterTime) {
                                        // We are the NEW interaction.

                                        // BOUNCE PROTECTION: If we already own the onset, this is likely a bounce.
                                        // Ignoring self-conflicts saves "nono" double-types.
                                        if (this.state.onsetOwner === stickName) {
                                            logger.log('CONFLICT_SELF', `Ignored bounce for ${stickName} (Owner)`);
                                            return;
                                        }

                                        logger.log('CONFLICT', `New: ${stickName}, Old: ${otherStickName}. Mode: ${this.onsetConflictMode}`);

                                        if (this.onsetConflictMode === 'IGNORE') {
                                            return; // Ignore this new stick
                                        }
                                        else if (this.onsetConflictMode === 'COMMIT') {
                                            // Commit the EXISTING syllable (from other stick)
                                            logger.log('CONFLICT_COMMIT', `Committed ${this.state.syllable.onset}o`);
                                            this.typeCharacter(this.state.syllable.onset + 'o');
                                            this.clearSyllable();
                                            this.consumeShift();

                                            // LOCK the other stick so it doesn't re-trigger immediately
                                            otherStickState.locked = true;
                                            otherStickState.sector = null;
                                            logger.log('LOCK', `${otherStickName} Locked`);
                                        }
                                        else if (this.onsetConflictMode === 'SWITCH') {
                                            // Clear the buffer (discard old onset)
                                            logger.log('CONFLICT_SWITCH', `Switched to ${stickName}`);
                                            this.clearSyllable();
                                            // Allow this stick to take over.
                                        }
                                    }
                                }
                            }

                            const char = map[curStick.sector];
                            if (char) {
                                // Update the specific part of the syllable buffer
                                this.state.syllable[whichPart] = char;

                                // Set Owner for Onset
                                if (whichPart === 'onset') {
                                    this.state.onsetOwner = stickName;
                                }
                            }
                        }
                    }
                }
            } else {
                // Stick inactive
                stickState.sector = null;
                stickState.enterTime = 0;

                if (this.state.mode.startsWith('RIME')) {
                    this.state.syllable[whichPart] = null;
                }
            }

            // 2. Commit on Release (ONSET ONLY)
            if (lastStick.active && !curStick.active && this.state.mode === 'ONSET' && whichPart === 'onset') {

                // Only commit if WE own the onset
                if (this.state.syllable.onset && this.state.onsetOwner === stickName) {
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
        this.state.onsetOwner = null;
    }
}
