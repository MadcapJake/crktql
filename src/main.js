import '../style.css'
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

    <div class="editor-container">
        <textarea id="editor" readonly placeholder="Waiting for input..."></textarea>
    </div>

    <div class="bottom-bar" id="bottom-bar">
        <div id="mode-indicator"><i class="fa-solid fa-circle-half-stroke"></i></div>
        <div id="case-indicator"><i class="fa-regular fa-circle"></i></div>
        <div class="header-actions">
            <div id="export-logs-btn" class="settings-trigger" title="Export Debug Logs"><i class="fa-solid fa-file-export"></i></div>
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
const visualizer = new Visualizer('visualizer-container');

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

  if (currentNotificationTimeout) return; // Notification active

  let html = '';
  if (mode === 'OVERVIEW') {
    html = `
            <span class="notification-persistent">
                <i class="fa-solid fa-x icon-blue"></i> Hold 3s: Delete Part&emsp;
                <i class="fa-solid fa-y icon-yellow"></i> Rename Part&emsp;
                <i class="fa-solid fa-a icon-green"></i> Open Part
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
}

settingsManager.onUpdate = (config) => {
  // Apply Settings
  const vContainer = document.getElementById('visualizer-container');
  const dStatus = document.getElementById('debug-status');
  const editor = document.getElementById('editor');

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
};

// Initial Render
settingsManager.render();
settingsManager.onUpdate(settingsManager.config);

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

  // 3. Global Toggles
  const startPressed = frameInput?.buttons.start;
  const selectPressed = frameInput?.buttons.select;

  // Start -> Toggle Bottom Bar
  // If settings is open, we handle close logic inside settings handling block or here.
  // User spec: "Clicking the start menu should close the settings popover"
  if (settingsManager.isOpen) {
    if (startPressed && !gamepadManager.lastStart) {
      settingsManager.toggle(); // Close settings
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
    case 'EDITOR':
      // Save valid text back to book manager periodically or on change
      // Ideally TypingEngine emits change events, but for now we pull it or push it.
      // Let's push on every frame or just when processed.
      const state = typingEngine.processFrame(gamepad);
      if (state) {
        updateEditorUI(state);
        visualizer.update(frameInput, state.mode, typingEngine.mappings, typingEngine.state.syllable);
        // Save content
        bookManager.setCurrentPartContent(state.text);
      }
      break;

    case 'OVERVIEW':
      gridOverview.handleInput(frameInput);
      break;

    case 'BOTTOM_BAR':
      navBar.handleInput(frameInput);
      break;

    case 'RENAMING':
      const rState = typingEngine.processFrame(gamepad);
      if (rState) {
        updateEditorUI(rState);
        visualizer.update(frameInput, rState.mode, typingEngine.mappings, typingEngine.state.syllable);
      }

      // B (EAST) -> Confirm Rename
      if (frameInput.buttons.east && !gamepadManager.lastButtons?.east) {
        const finalName = typingEngine.state.text;
        const target = focusManager.renameTarget;
        if (target) {
          bookManager.renamePart(target.x, target.y, finalName);
        }
        focusManager.setMode('OVERVIEW');
        gridOverview.render();
      }

      // SELECT -> Cancel Rename
      if (frameInput.buttons.select && !gamepadManager.lastSelect) {
        focusManager.setMode('OVERVIEW');
      }

      gamepadManager.lastButtons = { ...frameInput.buttons }; // Need to track for B button debounce
      break;

    case 'DIALOG_CONFIRM':
      // Simple confirmation dialog
      // START -> Confirm
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

  // Update Last State (Moved to end)
  gamepadManager.lastStart = startPressed;
  gamepadManager.lastSelect = selectPressed;

  // Debug UI always updates if visible
  updateDebugUI(frameInput, gamepad, null);
});


function updateEditorUI(state) {
  const editor = document.getElementById('editor');
  if (!editor) return;

  // Show text + pending syllable preview
  let displayText = state.text;
  const s = typingEngine.state.syllable;
  const mode = typingEngine.state.caseMode;

  const applyCase = (str, isStart) => {
    if (!str) return str;
    if (mode === 2) return str.toUpperCase();
    if (mode === 1 && isStart) return str.toUpperCase();
    return str; // Lower
  };

  const onset = s.onset || '';
  const vowel = s.vowel;
  const coda = s.coda || '';

  let pOnset = applyCase(onset, true);
  let pVowel = applyCase(vowel || (state.mode.startsWith('RIME') ? '-' : ''), !onset);
  let pCoda = applyCase(coda, !onset && !vowel);

  if (state.mode === 'ONSET') {
    if (s.onset) {
      displayText += `[${pOnset}-]`;
    }
  } else if (state.mode.startsWith('RIME')) {
    displayText += `[${pOnset}${pVowel}${pCoda}]`;
  } else if (state.mode === 'PUNCTUATION') {
    if (s.onset) {
      displayText += `[${s.onset}]`;
    }
  }

  if (editor.value !== displayText) {
    editor.value = displayText;
    editor.scrollTop = editor.scrollHeight;
  }

  const mInd = document.getElementById('mode-indicator');
  const cInd = document.getElementById('case-indicator');

  if (mInd) {
    let icon = '';
    switch (state.mode) {
      case 'ONSET': icon = '<i class="fa-solid fa-circle-half-stroke"></i>'; break;
      case 'RIME_LEFT': icon = '<i class="fa-solid fa-circle-chevron-left"></i>'; break;
      case 'RIME_RIGHT': icon = '<i class="fa-solid fa-circle-chevron-right"></i>'; break;
      case 'PUNCTUATION': icon = '<i class="fa-solid fa-circle-minus"></i>'; break;
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
