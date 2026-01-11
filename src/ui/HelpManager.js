export class HelpManager {
    constructor(focusManager) {
        this.focusManager = focusManager;
        this.isOpen = false;
        this.currentSlideIndex = 0;

        // Define Slides
        this.slides = [
            {
                title: "Welcome to Crktqla",
                text: `
                    <p>Crktqla is a grid-based collaborative writing environment designed for gamified workflows.</p>
                    <p>Use the <strong>Overview Mode</strong> to navigate the infinite grid of 'parts'.</p>
                    <p>Use the <strong>Editor Mode</strong> to write content within a part.</p>
                `
            },
            {
                title: "Navigation (Overview)",
                text: `
                    <h3>Moving Around</h3>
                    <p>Use the <strong>D-Pad</strong> to move the cursor one cell at a time.</p>
                    <p>Hold <strong>Y (North)</strong> + <strong>D-Pad</strong> to jump to the edge of the visible screen.</p>
                    
                    <h3>Zooming</h3>
                    <p>Use <strong>LB</strong> to Zoom In (Enter Editor).</p>
                    <p>Use <strong>RB</strong> to Zoom Out (Return to Overview).</p>
                `
            },
            {
                title: "Editing Text",
                text: `
                    <h3>Dual-Stick Typing</h3>
                    <p><strong>Left Stick</strong>: Selects the consonant/sector.</p>
                    <p><strong>Right Stick</strong>: Selects the vowel/character.</p>
                    <p>Release the right stick to type the character.</p>
                    
                    <h3>Shortcuts</h3>
                    <p><strong>A (South)</strong>: Space</p>
                    <p><strong>B (East)</strong>: Backspace</p>
                    <p><strong>X (West)</strong>: Delete Forward</p>
                    <p><strong>Y (North)</strong>: Shift / Caps Lock (Toggle)</p>
                `
            },
            {
                title: "Citations & Links",
                text: `
                    <h3>Creating Links</h3>
                    <p>In Overview, press <strong>B (Red)</strong> to insert a link to your current location.</p>
                    <p>This creates a <code>{{cite:x,y}}</code> tag.</p>
                    
                    <h3>Following Links</h3>
                    <p>In Editor, hover over a citation.</p>
                    <p>Hold <strong>Y</strong> and press <strong>B</strong> to follow the link.</p>
                    <p>The camera will fly to the target location.</p>
                `
            },
            {
                title: "Visual Select Mode",
                text: `
                    <h3>Selection</h3>
                    <p>Hold <strong>Y</strong> and press <strong>RB</strong> to enter Visual Select Mode.</p>
                    <p>Use <strong>D-Pad</strong> to expand selection.</p>
                    
                    <h3>Actions</h3>
                    <p><strong>A (Green)</strong>: Copy</p>
                    <p><strong>X (Blue)</strong>: Cut / Delete</p>
                    <p><strong>B (Red)</strong>: Cancel</p>
                `
            }
        ];

        this.lastDpad = { up: false, down: false, left: false, right: false };
        this.lastButtons = {};
        this.debounceCounter = 0;
    }

    toggle(initialInput) {
        this.isOpen = !this.isOpen;
        this.render();

        if (this.isOpen) {
            this.focusManager.setMode('HELP');
            this.debounceCounter = 15; // Ignore input for 15 frames
            if (initialInput && initialInput.buttons) {
                this.lastButtons = { ...initialInput.buttons };
            }
        } else {
            this.focusManager.setMode('BOTTOM_BAR'); // Return to where we opened it from
        }
    }

    handleInput(input) {
        if (!this.isOpen || !input) return;

        if (this.debounceCounter > 0) {
            this.debounceCounter--;
            // Capture state during debounce to prevent "just pressed" triggers immediately after
            this.lastButtons = { ...input.buttons };
            this.lastDpad = { ...input.buttons.dpad };
            return;
        }

        const dpad = input.buttons.dpad;
        const buttons = input.buttons;

        // CLOSE: Start or A (South)
        if ((buttons.start && !this.lastButtons.start) || (buttons.south && !this.lastButtons.south)) {
            this.toggle();
            return;
        }

        // NAV: Left/Right (D-pad OR Shoulders)
        const leftInput = dpad.left || buttons.lb;
        const rightInput = dpad.right || buttons.rb;

        if (rightInput && !this.lastNav?.right) {
            this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
            this.renderContent();
        }
        if (leftInput && !this.lastNav?.left) {
            this.currentSlideIndex = (this.currentSlideIndex - 1 + this.slides.length) % this.slides.length;
            this.renderContent();
        }

        // SCROLL: Up/Down
        const scrollAmount = buttons.north ? 20 : 5; // Y = Fast Scroll
        const contentEl = document.getElementById('help-content-text');
        if (contentEl) {
            if (dpad.down) contentEl.scrollTop += scrollAmount;
            if (dpad.up) contentEl.scrollTop -= scrollAmount;
        }

        this.lastNav = { left: leftInput, right: rightInput };
        this.lastDpad = { ...dpad };
        this.lastButtons = { ...buttons };
    }

    render() {
        let modal = document.getElementById('help-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'help-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="help-container">
                    <div class="help-header">
                        <div class="help-nav-hint">< LB</div>
                        <h2 id="help-title">Title</h2>
                        <div class="help-nav-hint">RB ></div>
                    </div>
                    <div class="help-body" id="help-content-text"></div>
                    <div class="help-footer">
                        <span><i class="fa-solid fa-arrows-up-down"></i> Scroll</span>
                        <span><i class="fa-solid fa-y"></i> + <i class="fa-solid fa-arrows-up-down"></i> Fast Scroll</span>
                        <span><i class="fa-solid fa-a"></i> Close</span>
                    </div>
                    <div class="help-dots" id="help-dots"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        modal.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen) {
            this.renderContent();
        }
    }

    renderContent() {
        const slide = this.slides[this.currentSlideIndex];
        document.getElementById('help-title').innerText = slide.title;
        document.getElementById('help-content-text').innerHTML = slide.text;

        // Dots
        const dotsContainer = document.getElementById('help-dots');
        dotsContainer.innerHTML = this.slides.map((_, i) =>
            `<span class="dot ${i === this.currentSlideIndex ? 'active' : ''}"></span>`
        ).join('');
    }
}
