import '../style.css';
import { GamepadMenu } from './ui/GamepadMenu.js';
import { GamepadManager } from './input/GamepadManager.js';

import { TypingEngine } from './engine/TypingEngine.js';
import { Visualizer } from './ui/Visualizer.js';
import { CalibrationManager } from './ui/CalibrationManager.js';
import { SettingsManager } from './ui/SettingsManager.js';
import { logger } from './utils/DebugLogger.js';
import { BookManager } from './data/BookManager.js';
import { FocusManager } from './ui/FocusManager.js';
import { NavigationBar } from './ui/NavigationBar.js';
import { GridOverview } from './ui/GridOverview.js';

document.querySelector('#app').innerHTML = `
  <div class="container">
    <div class="visualizer" id="visualizer-container">
        <div class="joystick" id="left-joy">
            <div class="stick-point"></div>
        </div>
        <div class="joystick" id="right-joy">
            <div class="stick-point"></div>
        </div>
    </div>

    <div id="grid-overview"></div>
    

    
    <div id="confirm-modal" class="modal-overlay" style="display: none; z-index: 200;">
        <div class="modal-content">
            <h2 id="confirm-title">Confirm</h2>
            <p id="confirm-message" style="margin-bottom: 2rem; color: #ccc; text-align: center;">Are you sure?</p>
            <div class="modal-footer">Press START to Confirm, B to Cancel</div>
        </div>
    </div>

    <div id="gamepad-modal" class="modal-overlay" style="display: none; z-index: 151;">
        <div class="modal-content"></div>
    </div>

    <div class="editor-container">
        <div id="editor-view" class="custom-editor" tabindex="0"></div>
    </div>

    <div class="bottom-bar" id="bottom-bar">
        <div id="mode-indicator"><i class="fa-solid fa-border-none"></i></div>
        <div id="case-indicator"><i class="fa-regular fa-circle"></i></div>
        <div class="header-actions">
            <div id="export-logs-btn" class="settings-trigger" title="Export Debug Logs"><i class="fa-solid fa-file-export"></i></div>
            <div id="gamepad-btn" class="settings-trigger" title="Controller Info"><i class="fa-solid fa-gamepad"></i></div>
            <div id="settings-btn" class="settings-trigger"><i class="fa-solid fa-gear"></i></div>
            <div id="new-book-btn" class="settings-trigger" title="New Book"><i class="fa-solid fa-book-medical"></i></div>
            <div id="save-book-btn" class="settings-trigger" title="Save Book"><i class="fa-regular fa-floppy-disk"></i></div>
            <div id="open-book-btn" class="settings-trigger" title="Open Book"><i class="fa-solid fa-book-open"></i></div>
        </div>
        <div id="notification-area"></div>
    </div>
    
    <div id="debug-status"></div>
  </div>
`

// Initialize Managers
const settingsManager = new SettingsManager(); // Keep this for config
const gamepadManager = new GamepadManager();
const typingEngine = new TypingEngine();
const gamepadMenu = new GamepadMenu();

gamepadMenu.onCalibrate = () => {
  const modal = document.getElementById('calibration-modal');
  if (modal) {
    // modal.style.display = 'flex'; // Manager handles this now? Let's check. Yes `start()` does.
    // Actually `start()` sets display flex.

    // We need to set mode to CALIBRATION for the bottom bar status text?
    // User requested specific bottom bar text.
    // Let's implement that via FocusManager or direct update?
    // Best to set focusManager mode to 'CALIBRATION' and handle updateStatusText there.
    focusManager.setMode('CALIBRATION');

    calibrationManager.start();
  }
};

// Handle Connection Events for UI
window.addEventListener("gamepadconnected", (e) => {
  const btn = document.getElementById('gamepad-btn');
  if (btn) {
    btn.classList.remove('shake', 'status-warning');
    btn.classList.add('status-success');
    setTimeout(() => btn.classList.remove('status-success'), 1000);
  }
  showNotification("Game controller connected!", 2000);
  gamepadMenu.setGamepadInfo({ id: e.gamepad.id, index: e.gamepad.index });
});

window.addEventListener("gamepaddisconnected", (e) => {
  const btn = document.getElementById('gamepad-btn');
  if (btn) {
    btn.classList.add('shake', 'status-warning');
  }
  showNotification("No game controller connected", 5000);
  gamepadMenu.setGamepadInfo(null);
});

// Initial State Check
setTimeout(() => {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const btn = document.getElementById('gamepad-btn');
  if (btn && (!gps[0] || !gps[0].connected)) {
    btn.classList.add('shake', 'status-warning');
    showNotification("No game controller connected", 5000);
  }
}, 1000);
const visualizer = new Visualizer('visualizer-container');

// Editor State
let editorLastDpad = { up: false, down: false, left: false, right: false };
let lastEngineTextLength = 0;
let selectionAnchor = null;

const bookManager = new BookManager();
const focusManager = new FocusManager();
const navBar = new NavigationBar('bottom-bar');
const gridOverview = new GridOverview('grid-overview', bookManager);

// Initialize Calibration Manager
const calibrationManager = new CalibrationManager(
  gamepadManager,
  typingEngine.mapper,
  () => {
    // Calibration close callback
    focusManager.setMode('EDITOR');
  }
);

// Focus Changes
focusManager.onChange = (mode) => {
  console.log("Mode changed to:", mode);

  // Toggle UI visibility based on mode
  if (mode === 'OVERVIEW') {
    gridOverview.activate();
    document.querySelector('.editor-container').style.display = 'none';
    document.getElementById('visualizer-container').style.display = 'none';
  } else if (mode === 'EDITOR' || mode === 'RENAMING') {
    gridOverview.deactivate();
    document.querySelector('.editor-container').style.display = 'flex';
    document.getElementById('visualizer-container').style.display = 'flex';

    // Ensure editor reflects current part content (Only for EDITOR, Renaming handles its own reset)
    if (mode === 'EDITOR') {
      const part = bookManager.getCurrentPart();
      if (part) {
        typingEngine.reset(part.content);
        lastEngineTextLength = part.content.length;
        editorLastDpad = { up: false, down: false, left: false, right: false };
      }
    }
  }

  if (mode === 'BOTTOM_BAR') {
    navBar.activate();
  } else {
    navBar.deactivate();
  }
  updateStatusText(mode);
};

// Persistent Status Helper
let currentNotificationTimeout = null;

function updateStatusText(mode) {
  const area = document.getElementById('notification-area');
  if (!area) return;

  // Icon Updates (Always update)
  const modeIcon = document.getElementById('mode-indicator');
  const caseIcon = document.getElementById('case-indicator');

  if (mode === 'VISUAL_SELECT') {
    if (modeIcon) modeIcon.innerHTML = '<i class="fa-solid fa-eye"></i>';
    if (caseIcon) caseIcon.style.display = 'none';
  } else if (mode === 'EDITOR') {
    if (modeIcon) modeIcon.innerHTML = '<i class="fa-solid fa-border-none"></i>';
    if (caseIcon) caseIcon.style.display = 'flex';
  } else {
    if (caseIcon) caseIcon.style.display = 'flex'; // Default show
  }

  // Text Updates (Blocked by Notification)
  if (currentNotificationTimeout) return;

  let html = '';
  if (mode === 'OVERVIEW') {
    html = `
            <span class="notification-persistent">
                <i class="fa-solid fa-arrows-up-down-left-right icon-blue"></i> Pan&emsp;
                <i class="fa-solid fa-magnifying-glass-plus icon-green"></i> LB Zoom In&emsp;
                <i class="fa-solid fa-magnifying-glass-minus icon-red"></i> RB Zoom Out&emsp;
                <i class="fa-solid fa-y icon-yellow"></i> + Dir: Jump
            </span>
        `;
  } else if (mode === 'RENAMING') {
    const part = bookManager.getCurrentPart();
    const oldName = part ? part.name : 'Unknown';
    html = `
            <span class="notification-persistent">
                <i class="fa-solid fa-b icon-red"></i> Rename Part (Prior Name: ${oldName})&emsp;
                <i class="fa-solid fa-square-caret-left icon-grey"></i> <strong>Select:</strong> Cancel Rename
            </span>
        `;
  } else if (mode === 'EDITOR') {
    const part = bookManager.getCurrentPart();
    if (part) {
      html = `
            <span class="notification-persistent" style="font-family: monospace;">
               ${part.name} <span style="color: #888;">(${part.x}, ${part.y})</span>
            </span>
          `;
    }
  } else if (mode === 'CALIBRATION') {
    html = `
        <span class="notification-persistent">
             <i class="fa-solid fa-asterisk" style="color: violet;"></i> 
             <strong>Hold any button 5 seconds:</strong> Cancel calibration
        </span>
      `;
  } else if (mode === 'VISUAL_SELECT') {
    html = `
        <span class="notification-persistent">
             <i class="fa-solid fa-x icon-blue"></i> Cut&emsp;
             <i class="fa-solid fa-a icon-green"></i> Copy&emsp;
             <i class="fa-solid fa-b icon-red"></i> Cancel
        </span>
      `;
  }

  area.innerHTML = html;
}

// Notification Helper
function showNotification(msg) {
  const area = document.getElementById('notification-area');
  if (!area) return;

  if (currentNotificationTimeout) {
    clearTimeout(currentNotificationTimeout);
    currentNotificationTimeout = null;
  }

  area.innerHTML = ''; // Clear persistent text

  const el = document.createElement('div');
  el.className = 'notification-toast';
  el.innerText = msg;
  area.appendChild(el);

  // Auto remove and restore status
  currentNotificationTimeout = setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
    currentNotificationTimeout = null;
    updateStatusText(focusManager.mode);
  }, 3000);
}

// Confirmation Helper
let confirmCallback = null;
function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-message');
  if (modal && msgEl) {
    msgEl.innerText = message;
    modal.style.display = 'flex';
    confirmCallback = onConfirm;
    focusManager.setMode('DIALOG_CONFIRM'); // New mode to trap input
  }
}

// Settings Integration
settingsManager.onAction = (action) => {
  if (action === 'calibrate') {
    settingsManager.toggle();
    calibrationManager.start();
  }
};

// Button Handlers
document.getElementById('new-book-btn')?.addEventListener('click', () => {
  // New Book
  showConfirmModal('Create new book? Unsaved changes will be lost.', () => {
    bookManager.loadBook({}, "untitled.htz");
    bookManager.createPart(0, 0); // Ensure default part
    focusManager.setMode('EDITOR'); // Will change mode back from DIALOG_CONFIRM
    gridOverview.render();
    showNotification('New Book Created');
  });
});

document.getElementById('open-book-btn')?.addEventListener('click', () => {
  // Open Book File Dialog
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.htz,.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        bookManager.loadBook(e.target.result, file.name);
        focusManager.setMode('EDITOR'); // Or Overview?

        // If the book has parts, load the first one?
        // BookManager handles default currentPart logic.
        const part = bookManager.getCurrentPart();
        if (part) {
          typingEngine.reset(part.content);
        } else {
          // Should technically have one from loadBook's default logic
          typingEngine.reset("");
        }
        gridOverview.render();

      } catch (err) {
        showNotification("Failed to load book: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

document.getElementById('save-book-btn')?.addEventListener('click', () => {
  // Save Book Logic
  const content = bookManager.exportBook();
  const filename = bookManager.filename || "my_book.htz";

  // Create Blob and Link
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification(`Book saved as ${filename}`);
});

const gearBtn = document.getElementById('settings-btn');
if (gearBtn) {
  gearBtn.addEventListener('click', () => {
    if (!settingsManager.isOpen) settingsManager.toggle();
  });

  const gamepadBtn = document.getElementById('gamepad-btn');
  gamepadBtn.addEventListener('click', () => {
    if (!gamepadMenu.isOpen) gamepadMenu.toggle();
  });
}

settingsManager.onUpdate = (config) => {
  // Apply Settings
  const vContainer = document.getElementById('visualizer-container');
  const dStatus = document.getElementById('debug-status');
  const editor = document.getElementById('editor-view');

  if (vContainer) {
    vContainer.style.opacity = config.visualizer ? '1' : '0';

    // Apply Placement Class
    vContainer.className = 'visualizer'; // Reset
    const placement = config.visualizerPlacement || 'BOTTOM_CENTER';

    if (placement === 'BOTTOM_CENTER') vContainer.classList.add('vis-bottom-center');
    else if (placement === 'BOTTOM_OUTER') vContainer.classList.add('vis-bottom-outer');
    else if (placement === 'TOP_CENTER') vContainer.classList.add('vis-top-center');
    else if (placement === 'TOP_OUTER') vContainer.classList.add('vis-top-outer');

    // Smart Scroll Padding
    if (editor) {
      editor.style.paddingTop = '2rem';
      editor.style.paddingBottom = '2rem';

      if (placement.startsWith('TOP')) {
        editor.style.paddingTop = '320px';
      } else {
        editor.style.paddingBottom = '320px';
      }
    }
  }

  const exportBtn = document.getElementById('export-logs-btn');

  if (dStatus) {
    dStatus.style.display = config.debug ? 'block' : 'none';
    if (exportBtn) exportBtn.style.display = config.debug ? 'flex' : 'none';

    // Dynamic Placement
    dStatus.className = ''; // Reset
    // Default to bottom right if Vis is OFF or Vis is TOP
    let placement = 'debug-bottom-right';

    if (config.visualizer) {
      if (config.visualizerPlacement && config.visualizerPlacement.startsWith('BOTTOM')) {
        placement = 'debug-top-right';
      }
    }

    dStatus.classList.add(placement);
  }

  typingEngine.mapper.DEADZONE = config.deadzone;
  typingEngine.onsetConflictMode = config.onsetConflict;

  // Refresh Editor to reflect cursor changes immediately
  if (focusManager.mode === 'EDITOR' || focusManager.mode === 'BOTTOM_BAR' || settingsManager.isOpen) {
    const part = bookManager.getCurrentPart();
    if (part) renderCustomEditor(part);
  }
};

// Initial Render
settingsManager.render();
settingsManager.onUpdate(settingsManager.config);
updateStatusText(focusManager.mode); // Ensure initial status text is shown

// Handle Gamepad Connection
window.addEventListener("gamepadconnected", (e) => {
  const gp = e.gamepad;
  gamepadManager.handleConnect(gp);
  console.log(`Gamepad connected at index ${gp.index}: ${gp.id}.`);
});

window.addEventListener("gamepaddisconnected", (e) => {
  gamepadManager.handleDisconnect(e.gamepad);
  console.log("Gamepad disconnected.");
});

window.addEventListener('request-editor-focus', () => {
  focusManager.setMode('EDITOR');
});

window.addEventListener('request-rename', (e) => {
  const { x, y, name } = e.detail;
  // Previously opened modal. Now we switch to RENAMING mode inline.
  // We need to know WHICH part we are renaming to block movement?
  // GridOverview handles the "selected" logic. We just need to capture input.

  // Actually, GridOverview dispatches this.
  // We should switch TypingEngine to the name content.
  typingEngine.reset(name ? name.trim() : '');

  // Store target coordinates in focusManager or a temp var? 
  // Let's attach it to focusManager for convenience
  focusManager.renameTarget = { x, y, oldName: name };

  focusManager.setMode('RENAMING');
});

// --- Main Loop ---
gamepadManager.on('frame', (gamepad) => {
  // 1. Calibration takes priority
  if (calibrationManager.isCalibrating) {
    calibrationManager.handleInput(gamepad);
    return;
  }

  // 2. Map Input
  const frameInput = typingEngine.mapper.map(gamepad);

  // 2a. Gamepad Menu (Priority)
  if (gamepadMenu.isOpen) {
    // Check for Start button here to manage focus callback
    if (frameInput?.buttons.start && !gamepadManager.lastStart) {
      gamepadMenu.close();
      focusManager.setMode('EDITOR');
      gamepadManager.lastStart = true; // Consumed
      return;
    }

    gamepadMenu.handleInput(frameInput);
    return;
  }

  // 3. Global Toggles
  const startPressed = frameInput?.buttons.start;
  const selectPressed = frameInput?.buttons.select;

  // Start -> Toggle Bottom Bar
  // If settings is open, we handle close logic inside settings handling block or here.
  // User spec: "Clicking the start menu should close the settings popover"
  if (settingsManager.isOpen) {
    if (startPressed && !gamepadManager.lastStart) {
      settingsManager.toggle(); // Close settings
      focusManager.setMode('EDITOR');
    } else {
      settingsManager.handleInput(frameInput);
    }
    gamepadManager.lastStart = startPressed;
    gamepadManager.lastSelect = selectPressed;
    return;
  }

  // Start -> Toggle Bottom Bar (Only if not in Dialog)
  if (focusManager.mode !== 'DIALOG' && startPressed && !gamepadManager.lastStart) {
    focusManager.toggleBottomBar();
  }

  // Select -> Toggle Overview (Only if not in Dialog or Renaming)
  if (focusManager.mode !== 'DIALOG' && focusManager.mode !== 'RENAMING' && selectPressed && !gamepadManager.lastSelect) {
    focusManager.toggleOverview();
  }



  // 5. Route Input based on Focus
  switch (focusManager.mode) {
    case 'OVERVIEW':
      // Route all input to GridOverview
      gridOverview.handleInput(frameInput);

      // Update Debug Info
      updateDebugUI(frameInput, gamepad, null);
      break;

    case 'EDITOR':
      // Switch to Overview: Right Shoulder (Zoom Out)
      // Check for simple press
      if (frameInput.buttons.rb && !gamepadManager.lastButtons.rb) {
        // If NOT in Visual Select? Visual Select uses Y+RB.
        // This check is simple button press.
        // But wait, Y+RB check triggers Visual Select.
        // If we press only RB -> Zoom Out?
        // If we are holding Y, we enter Visual Select.
        // So check !isModifierHeld.
        if (!frameInput.buttons.north) {
          focusManager.setMode('OVERVIEW');
          updateStatusText('OVERVIEW');
          return; // Skip rest
        }
      }

      // D-Pad Cursor Movement (One press per frame or throttled? Let's use simple press check for now)
      // Actually per-frame pressed check is too fast. Need simple one-shot or repeat.
      // GamepadManager doesn't give "just pressed" for D-pad easily without tracking lastDpad relative to this specific loop?
      // Actually frameInput.buttons.dpad has state.
      // We need to track lastDpad for editor movement specifically or use a throttle.
      // Let's use a simple frame-based throttle or "pressed & !lastPressed".

      const dpad = frameInput.buttons.dpad;
      const lastDpad = gamepadManager.lastDpad || { up: false, down: false, left: false, right: false }; // We need to track this somewhere? 
      // gamepadManager stores lastDpad? No, settingsManager tracks its own.
      // Let's track it locally in a static way or attach to focusManager?
      // Simpler: Just check edge detection here.
      // Limitation: No key repeat for now (User didn't explicitly ask, but good UX requires it. Sticking to single press for MVP).

      const part = bookManager.getCurrentPart();
      if (!part) break;

      let cursor = part.cursor || 0;
      const content = part.content || "";
      let handledNav = false;

      // Safe access helper
      const justPressed = (btn) => dpad[btn] && !editorLastDpad[btn];

      // Modifier State (Y / North)
      const isModifierHeld = frameInput.buttons.north;

      if (justPressed('left')) {
        if (isModifierHeld) {
          // Ctrl+Left (Word Left)
          // find previous space/punctuation?
          // Simple heuristic: Move left until space, then move left until non-space.
          let target = cursor - 1;
          while (target > 0 && /\s/.test(content[target - 1])) target--; // Skip trailing spaces
          while (target > 0 && !/\s/.test(content[target - 1])) target--; // Skip word
          cursor = target;
        } else {
          cursor = Math.max(0, cursor - 1);
        }
        handledNav = true;
      }
      if (justPressed('right')) {
        if (isModifierHeld) {
          // Ctrl+Right (Word Right)
          let target = cursor;
          while (target < content.length && !/\s/.test(content[target])) target++; // Skip Word
          while (target < content.length && /\s/.test(content[target])) target++; // Skip Spaces
          cursor = target;
        } else {
          cursor = Math.min(content.length, cursor + 1);
        }
        handledNav = true;
      }
      if (justPressed('up')) {
        if (isModifierHeld) {
          // Page Up (Approx 10 lines? or just move back arbitrary amount)
          // hard to know lines without rendering. Let's start with moving back 100 chars or finding newlines?
          // Simple: Move back 10 newlines.
          let newLinesFound = 0;
          let target = cursor;
          while (target > 0 && newLinesFound < 10) {
            target--;
            if (content[target] === '\n') newLinesFound++;
          }
          cursor = target;
        } else {
          // Standard Up (Previous Line)
          // Go to last newline
          const lastNewline = content.lastIndexOf('\n', cursor - 1);
          if (lastNewline !== -1) {
            // Find column of current cursor
            const currentLineStart = content.lastIndexOf('\n', cursor - 1);
            const col = cursor - currentLineStart - 1;

            // Find start of previous line
            const prevLineEnd = currentLineStart;
            const prevLineStart = content.lastIndexOf('\n', prevLineEnd - 1);

            // Target is prevLineStart + col (clamped to prevLineEnd)
            const lineLen = prevLineEnd - prevLineStart - 1;
            const targetCol = Math.min(col, lineLen);
            cursor = (prevLineStart + 1) + targetCol;
          } else {
            cursor = 0; // Top of file
          }
        }
        handledNav = true;
      }
      if (justPressed('down')) {
        if (isModifierHeld) {
          // Page Down (10 lines down)
          let newLinesFound = 0;
          let target = cursor;
          while (target < content.length && newLinesFound < 10) {
            if (content[target] === '\n') newLinesFound++;
            target++;
          }
          cursor = target;
        } else {
          // Standard Down
          const nextNewline = content.indexOf('\n', cursor);
          if (nextNewline !== -1) {
            // Current Col
            const currentLineStart = content.lastIndexOf('\n', cursor - 1);
            const col = cursor - (currentLineStart + 1);

            // Length of next line
            const nextLineStart = nextNewline + 1;
            const nextLineEnd = content.indexOf('\n', nextLineStart);
            const actualEnd = nextLineEnd === -1 ? content.length : nextLineEnd;
            const nextLineLen = actualEnd - nextLineStart;

            const targetCol = Math.min(col, nextLineLen);
            cursor = nextLineStart + targetCol;
          } else {
            cursor = content.length;
          }
        }
        handledNav = true;
      }

      // Update persistent cursor
      if (handledNav) {
        bookManager.setPartCursor(cursor);
        renderCustomEditor(part);
      }

      // Update tracking for next frame
      editorLastDpad = { ...dpad };

      // VISUAL SELECT TRIGGER: Hold Y + Press RB
      // Redefine modifier check locally to ensure scope
      const modPressed = frameInput.buttons.north;

      // DEBUG:
      if (modPressed && frameInput.buttons.rb) {
        console.log("Trigger Attempt:", {
          north: modPressed,
          rb: frameInput.buttons.rb,
          lastRb: gamepadManager.lastButtons?.rb
        });
      }

      if (modPressed && frameInput.buttons.rb && !gamepadManager.lastButtons?.rb) {
        console.log("Trigger Success! Switching to VISUAL_SELECT");
        showNotification("Visual Select Mode Entered");

        selectionAnchor = cursor; // Global anchor
        focusManager.setMode('VISUAL_SELECT');
        gamepadManager.lastButtons = { ...frameInput.buttons };
        return; // Exit frame to prevent RB from typing TAB
      }

      // PASTE TRIGGER: Hold Y + L3/R3 Click
      // Condition: Onset Mode + No Action?
      // User said: "When in Onset Mode and no joystick is in Selected Consonant mode"
      // Simplification: Just check inputs. If Y + Click, do paste.
      // InputMapper names are 'l3' and 'r3', NOT leftStick/rightStick
      if (isModifierHeld && (frameInput.buttons.l3 || frameInput.buttons.r3)) {
        // Debounce sticks?
        const lastBtns = gamepadManager.lastButtons || {};
        if ((frameInput.buttons.l3 && !lastBtns.l3) ||
          (frameInput.buttons.r3 && !lastBtns.r3)) {

          if (typingEngine.state.mode === 'ONSET') {
            handlePaste();
          }
        }
        gamepadManager.lastButtons = { ...frameInput.buttons };
      }

      gamepadManager.lastButtons = { ...frameInput.buttons }; // General tracking for EDITOR too

      // Typing Logic
      const state = typingEngine.processFrame(gamepad);
      if (state) {
        // 1. Handle Explicit Actions
        if (state.action) {
          let newContent = content;
          let newCursor = cursor;

          if (state.action === 'DELETE_FORWARD') {
            if (cursor < content.length) {
              newContent = content.slice(0, cursor) + content.slice(cursor + 1);
            }
          } else if (state.action === 'DELETE_WORD_LEFT') {
            // Delete until start of previous word
            let target = cursor - 1;
            while (target > 0 && /\s/.test(content[target - 1])) target--;
            while (target > 0 && !/\s/.test(content[target - 1])) target--;
            newContent = content.slice(0, target) + content.slice(cursor);
            newCursor = target;
          }

          if (newContent !== content) {
            bookManager.setCurrentPartContent(newContent);
            bookManager.setPartCursor(newCursor);

            // Update local object for immediate render
            part.content = newContent;
            part.cursor = newCursor;

            // Reset Engine Text to prevent sync issues?
            // TypingEngine text is just a buffer, usually empty or growing.
            // If we delete via action, we ignore state.text this frame?
            typingEngine.reset(newContent); // Sync engine (optional but safer)
            lastEngineTextLength = newContent.length;
          }

          // Render Update
          renderCustomEditor(part);
          visualizer.update(frameInput, state.mode, typingEngine.mappings, typingEngine.state.syllable);
          break; // Skip delta logic this frame
        }

        // 2. Handle Delta Text (Inserts / Backspaces)
        const currentEngineText = state.text;
        const diff = currentEngineText.length - lastEngineTextLength;

        if (diff !== 0) {
          let newContent = content;
          let newCursor = cursor;

          if (diff > 0) {
            // Insertion
            const added = currentEngineText.slice(lastEngineTextLength);
            newContent = content.slice(0, cursor) + added + content.slice(cursor);
            newCursor = cursor + diff;
          } else {
            // Backspace (Standard, from Engine slice)
            // Engine did `text.slice(0, -1)`.
            // We map this to "Backspace at Cursor"
            const amount = -diff;
            const start = Math.max(0, cursor - amount);
            newContent = content.slice(0, start) + content.slice(cursor);
            newCursor = start;
          }

          bookManager.setCurrentPartContent(newContent);
          bookManager.setPartCursor(newCursor);

          // Update local object for immediate render
          part.content = newContent;
          part.cursor = newCursor;

        }

        // Render (Always, to show pending syllable)
        renderCustomEditor(part);

        // Sync Length
        lastEngineTextLength = currentEngineText.length;
        visualizer.update(frameInput, state.mode, typingEngine.mappings, typingEngine.state.syllable);
      }
      break; // EDITOR case end

    case 'VISUAL_SELECT':
      // D-pad Navigation (Expand Selection)
      const vDpad = frameInput.buttons.dpad;
      const vPart = bookManager.getCurrentPart();

      if (vPart) {
        let vCursor = vPart.cursor;
        const vContent = vPart.content;
        let vNavigated = false;

        // Re-use logic or duplicate simple nav? 
        // We need to support modifiers too.
        const isMod = frameInput.buttons.north;
        const jp = (btn) => vDpad[btn] && !editorLastDpad[btn];

        if (jp('left')) {
          if (isMod) {
            let target = vCursor - 1;
            while (target > 0 && /\s/.test(vContent[target - 1])) target--;
            while (target > 0 && !/\s/.test(vContent[target - 1])) target--;
            vCursor = target;
          } else {
            vCursor = Math.max(0, vCursor - 1);
          }
          vNavigated = true;
        }
        if (jp('right')) {
          if (isMod) {
            let target = vCursor;
            while (target < vContent.length && !/\s/.test(vContent[target])) target++;
            while (target < vContent.length && /\s/.test(vContent[target])) target++;
            vCursor = target;
          } else {
            vCursor = Math.min(vContent.length, vCursor + 1);
          }
          vNavigated = true;
        }
        if (jp('up')) {
          // ... reusing up logic ...
          // Simplified for brevity: just standard up
          // Go to last newline
          const lastNewline = vContent.lastIndexOf('\n', vCursor - 1);
          if (lastNewline !== -1) {
            const currentLineStart = vContent.lastIndexOf('\n', vCursor - 1);
            const col = vCursor - currentLineStart - 1;
            const prevLineEnd = currentLineStart;
            const prevLineStart = vContent.lastIndexOf('\n', prevLineEnd - 1);
            const lineLen = prevLineEnd - prevLineStart - 1;
            const targetCol = Math.min(col, lineLen);
            vCursor = (prevLineStart + 1) + targetCol;
          } else {
            vCursor = 0;
          }
          vNavigated = true;
        }
        if (jp('down')) {
          const nextNewline = vContent.indexOf('\n', vCursor);
          if (nextNewline !== -1) {
            const currentLineStart = vContent.lastIndexOf('\n', vCursor - 1);
            const col = vCursor - (currentLineStart + 1);
            const nextLineStart = nextNewline + 1;
            const nextLineEnd = vContent.indexOf('\n', nextLineStart);
            const actualEnd = nextLineEnd === -1 ? vContent.length : nextLineEnd;
            const nextLineLen = actualEnd - nextLineStart;
            const targetCol = Math.min(col, nextLineLen);
            vCursor = nextLineStart + targetCol;
          } else {
            vCursor = vContent.length;
          }
          vNavigated = true;
        }

        if (vNavigated) {
          // Update cursor but KEEP anchor
          bookManager.setPartCursor(vCursor);
          vPart.cursor = vCursor; // Local update
          renderCustomEditor(vPart);
        }
        editorLastDpad = { ...vDpad };
      }

      // Actions
      // A (South) -> Copy
      if (frameInput.buttons.south && !gamepadManager.lastButtons.south) {
        const rangeText = getSelectionText(vPart);
        if (rangeText) {
          navigator.clipboard.writeText(rangeText).catch(e => console.error("Copy failed", e));
          showNotification("Copied to Clipboard");
        }
        exitVisualSelect();
      }

      // X (West) -> Cut
      if (frameInput.buttons.west && !gamepadManager.lastButtons.west) {
        const rangeText = getSelectionText(vPart);
        if (rangeText) {
          // Capture indices synchronously before anchor is cleared
          const sStart = Math.min(selectionAnchor, vPart.cursor);
          const sEnd = Math.max(selectionAnchor, vPart.cursor);
          const originalContent = vPart.content; // Capture content too just in case

          navigator.clipboard.writeText(rangeText).then(() => {
            // Delete content using captured indices
            const newContent = originalContent.slice(0, sStart) + originalContent.slice(sEnd);

            bookManager.setCurrentPartContent(newContent);
            bookManager.setPartCursor(sStart);

            // Sync Engine
            typingEngine.reset(newContent);
            lastEngineTextLength = newContent.length;

            showNotification("Cut to Clipboard");

            // Force re-render to show deletion
            const updatedPart = bookManager.getCurrentPart();
            if (updatedPart) renderCustomEditor(updatedPart);

          }).catch(e => console.error("Cut failed", e));
        }
        exitVisualSelect();
      }

      // B (East) -> Cancel
      if (frameInput.buttons.east && !gamepadManager.lastButtons.east) {
        exitVisualSelect();
      }

      gamepadManager.lastButtons = { ...frameInput.buttons };
      break;


    case 'DIALOG_CONFIRM':
      // ... existing code ...
      if (startPressed && !gamepadManager.lastStart) {
        if (confirmCallback) confirmCallback();
        document.getElementById('confirm-modal').style.display = 'none';
        confirmCallback = null;
      }

      // B (East) -> Cancel
      if (frameInput.buttons.east) {
        document.getElementById('confirm-modal').style.display = 'none';
        confirmCallback = null;
        focusManager.setMode(focusManager.previousMode || 'EDITOR');
      }
      break;
  }

  // Helper Functions for Visual Select
  function getSelectionText(part) {
    if (!part || selectionAnchor === null) return "";
    const start = Math.min(selectionAnchor, part.cursor);
    const end = Math.max(selectionAnchor, part.cursor);
    return part.content.slice(start, end);
  }

  function deleteSelection(part) {
    if (selectionAnchor === null) return;
    const start = Math.min(selectionAnchor, part.cursor);
    const end = Math.max(selectionAnchor, part.cursor);
    const newContent = part.content.slice(0, start) + part.content.slice(end);

    bookManager.setCurrentPartContent(newContent);
    bookManager.setPartCursor(start); // Move cursor to start of deletion
    // Sync Engine
    typingEngine.reset(newContent);
    lastEngineTextLength = newContent.length;
  }

  function exitVisualSelect() {
    const part = bookManager.getCurrentPart();
    selectionAnchor = null; // Clear global
    if (part) {
      renderCustomEditor(part);
    }

    // Sync Engine Input to prevent "A" or "B" from triggering typing actions immediately
    if (typeof gamepad !== 'undefined') {
      typingEngine.resetInputState(gamepad);
    }

    focusManager.setMode('EDITOR');
  }

  // Update Last State (Moved to end)
  gamepadManager.lastStart = startPressed;
  gamepadManager.lastSelect = selectPressed;

  // Debug UI always updates if visible
  updateDebugUI(frameInput, gamepad, null);
  updateIndicators();
});


// Helper to handle clipboard paste
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const part = bookManager.getCurrentPart();
      if (part) {
        const c = part.content || "";
        const idx = part.cursor || 0;
        const newContent = c.slice(0, idx) + text + c.slice(idx);
        bookManager.setCurrentPartContent(newContent);
        bookManager.setPartCursor(idx + text.length);

        // Sync
        typingEngine.reset(newContent);
        lastEngineTextLength = newContent.length;
        part.content = newContent;
        part.cursor = idx + text.length;
        renderCustomEditor(part);
        showNotification("Pasted from Clipboard");
      }
    }
  } catch (err) {
    console.error("Paste failed:", err);
    showNotification("Paste Failed: " + err.message);
  }
}


function renderCustomEditor(part, currentAnchor = selectionAnchor) {
  const container = document.getElementById('editor-view');
  if (!container || !part) return;

  const content = part.content || "";
  const cursor = part.cursor || 0;

  // Pending Syllable Logic
  const pending = typingEngine.getFormattedSyllable();
  // We can assume TypingEngine.state.caseMode is current for styling pending chars if needed,
  // but getFormattedSyllable applies upper/lower case already.

  // Construct HTML
  // Strategy: 
  // 1. Text BEFORE cursor
  // 2. Pending Text (AT cursor) -> wrapped in specialized span?
  // 3. Cursor Effect (depends on type)
  //    - BAR: insert <span class="cursor-bar"></span> between pending and post.
  //    - BLOCK: The first char of POST is wrapped in <span class="cursor-block">C</span>. If post empty, space.
  //    - UNDERLINE: Same as block logic but class cursor-underline.

  const safeEscape = (str) => {
    // Basic escape to prevent HTML injection
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/ /g, '&nbsp;'); // Use non-breaking space for visual alignment? 
    // Actually textarea handles wrapping. 
    // Using div with whitespace: pre-wrap is better in CSS.
  };

  // Selection Logic
  // const anchor = part.selectionAnchor; 
  const anchor = currentAnchor; // Use passed or global anchor
  const isSelectionActive = (anchor !== undefined && anchor !== null && anchor !== cursor);

  let pre, sel, post;

  if (isSelectionActive) {
    // Range Selection
    const start = Math.min(anchor, cursor);
    const end = Math.max(anchor, cursor);

    pre = safeEscape(content.slice(0, start));
    const selText = safeEscape(content.slice(start, end));
    post = safeEscape(content.slice(end));

    // No cursor effect usually inside selection, or cursor is at one end.
    // Standard is to just highlight the range. 
    // User didn't specify cursor behavior in selection, but typically cursor is hidden or at edge.
    // We will render cursor at the "cursor" end if needed, but for visual clarity, just highlighting the block is often enough.
    // Let's render the highlight.

    // If cursor is at 'end', it's after the selection block. If at 'start', before.
    // Actually, standard editors show cursor at the active edge. 
    // For simplicity and clarity in this custom UI:
    // Just wrap the selected text in .selection-highlight.
    // And we can optionally show the cursor indicator at the `cursor` position.

    sel = `<span class="selection-highlight">${selText}</span>`;

    // We need to inject the cursor indicator.
    // If cursor > anchor, cursor is at start of 'post'.
    // If cursor < anchor, cursor is at end of 'pre' (before 'sel').

    const cursorHtml = `<span class="cursor cursor-bar"></span>`; // Always use bar in select mode for visibility? Or keep user preference.
    // Actually, let's stick to user preference but standard text selection usually hides the block cursor.
    // Let's just highlight.

    container.innerHTML = pre + sel + post;

  } else {
    // Standard Cursor Logic
    pre = safeEscape(content.slice(0, cursor));
    const postRaw = content.slice(cursor);
    const postEscaped = safeEscape(postRaw);

    const pendingHtml = pending ? `<span class="pending-text">${safeEscape(pending)}</span>` : '';

    let cursorHtml = '';
    const cursorType = settingsManager.config.cursorType || 'BAR';

    if (cursorType === 'BAR') {
      cursorHtml = `<span class="cursor cursor-bar"></span>`;
      container.innerHTML = pre + pendingHtml + cursorHtml + postEscaped;
    } else {
      let targetChar = postRaw.length > 0 ? postRaw[0] : ' ';
      let rest = postRaw.length > 0 ? postRaw.slice(1) : '';
      const targetHtml = safeEscape(targetChar);
      const restHtml = safeEscape(rest);
      const cursorClass = cursorType === 'BLOCK' ? 'cursor-block' : 'cursor-underline';
      cursorHtml = `<span class="cursor ${cursorClass}">${targetHtml}</span>`;
      container.innerHTML = pre + pendingHtml + cursorHtml + restHtml;
    }
  }

  // Scroll to cursor?
  // Simple view follow: find .cursor element and scrollIntoView?
  const cursorEl = container.querySelector('.cursor');
  if (cursorEl) {
    cursorEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

// Keep old indicators update? Or move to standard update status?
// indicators (case/mode) are outside editor-view usually.
updateIndicators();

function updateIndicators() {
  const mInd = document.getElementById('mode-indicator');
  const cInd = document.getElementById('case-indicator');
  const state = typingEngine.state;

  if (mInd) {
    let icon = '';
    const leftLocked = state.leftStick?.locked;
    const rightLocked = state.rightStick?.locked;
    const isSelectionActive = leftLocked || rightLocked || state.syllable?.onset; // "Selected Consonant" mode

    switch (state.mode) {
      case 'ONSET':
        icon = isSelectionActive
          ? '<i class="fa-regular fa-square"></i>'
          : '<i class="fa-solid fa-border-none"></i>';
        break;
      case 'RIME_LEFT': icon = '<i class="fa-solid fa-square-caret-left"></i>'; break;
      case 'RIME_RIGHT': icon = '<i class="fa-solid fa-square-caret-right"></i>'; break;
      case 'PUNCTUATION': icon = '<i class="fa-solid fa-square-minus"></i>'; break;
      default: icon = state.mode;
    }
    mInd.innerHTML = icon;
  }

  if (cInd) {
    let icon = '';
    switch (state.caseMode) {
      case 0: icon = '<i class="fa-regular fa-circle"></i>'; break; // Lower
      case 1: icon = '<i class="fa-regular fa-circle-up"></i>'; break; // Shift
      case 2: icon = '<i class="fa-solid fa-circle-up"></i>'; break; // Caps
    }
    cInd.innerHTML = icon;
  }
}

function updateDebugUI(frameInput, gamepad, state) {
  const dStatus = document.getElementById('debug-status');
  if (!dStatus || dStatus.style.display === 'none') return;

  if (frameInput) {
    const rawAxes = gamepad.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(' ');
    const activeButtons = gamepad.buttons
      .map((b, i) => b.pressed ? i : null)
      .filter(i => i !== null)
      .join(', ');

    dStatus.innerHTML = `
              Buttons: [${activeButtons}] <br>
              Raw Axes: ${rawAxes} <br>
              LT: ${frameInput.mode.raw.lt.toFixed(2)} | RT: ${frameInput.mode.raw.rt.toFixed(2)} <br>
              L-Stick: ${frameInput.sticks.left.active ? frameInput.sticks.left.sector : 'Center'} (${Math.round(frameInput.sticks.left.angle)}°)<br>
              R-Stick: ${frameInput.sticks.right.active ? frameInput.sticks.right.sector : 'Center'} (${Math.round(frameInput.sticks.right.angle)}°)
          `;
  }
}

// --- Robust Export Logic ---
const exportBtn = document.getElementById('export-logs-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const logs = logger.export();

    // 1. Always log to console as backup
    console.log("--- DEBUG LOG EXPORT ---");
    console.log(logs);
    console.log("------------------------");

    // 2. Try Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(logs).then(() => {
        alert('Debug logs copied to clipboard!');
      }).catch(err => {
        console.error('Clipboard API failed', err);
        fallbackCopy(logs);
      });
    } else {
      fallbackCopy(logs);
    }
  });
}

function fallbackCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) alert('Debug logs copied to clipboard (Fallback)!');
    else alert('Failed to copy. Check Console.');
  } catch (err) {
    console.error('Fallback copy failed', err);
    alert('Failed to copy. Check Console.');
  }

  document.body.removeChild(textArea);
}
