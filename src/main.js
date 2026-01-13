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

import { Gutter } from './ui/Gutter.js';
import { GutterMode } from './modes/GutterMode.js';
import { GridOverview } from './ui/GridOverview.js';
import { HistoryManager } from './data/HistoryManager.js';
import { EditorRenderer } from './ui/EditorRenderer.js';
import { RenamingMode } from './modes/RenamingMode.js';
import { EditorMode } from './modes/EditorMode.js';
import { VisualSelectMode } from './modes/VisualSelectMode.js';
import { OverviewMode } from './modes/OverviewMode.js';

import { InputRouter } from './input/InputRouter.js';
import { InputDebugOverlay } from './ui/InputDebugOverlay.js'; // Moved up

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
            <div class="modal-footer"><i class="fa-solid fa-b icon-red"></i> Confirm&emsp;<i class="fa-solid fa-square-caret-right icon-grey"></i> <strong>Start</strong> to Cancel</div>
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
            <div id="help-btn" class="settings-trigger" title="Help"><i class="fa-solid fa-circle-question"></i></div>
            <div id="book-menu-btn" class="settings-trigger" title="Book Menu"><i class="fa-solid fa-book"></i></div>
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
const editorRenderer = new EditorRenderer('editor-view', typingEngine, settingsManager);
const gamepadMenu = new GamepadMenu();
// --- DEBUG OVERLAY ---
const debugOverlay = new InputDebugOverlay(gamepadManager, typingEngine.mapper);


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
const updateGamepadUI = (gp) => {
  const btn = document.getElementById('gamepad-btn');
  if (btn) {
    btn.classList.remove('shake', 'status-warning');
    btn.classList.add('status-success');
    setTimeout(() => btn.classList.remove('status-success'), 1000);
  }
  let gpName = gp.id.split('(')[0].trim()
  if (gpName.length > 20) {
    gpName = gpName.slice(0, 20) + '...';
  }
  showNotification(`🎮️ ${gpName}`, 2000); // Shorter msg, indicating switch
  gamepadMenu.setGamepadInfo({ id: gp.id, index: gp.index });
};

gamepadManager.on('active-change', (gp) => {
  updateGamepadUI(gp);
});

window.addEventListener("gamepadconnected", (e) => {
  // Always update UI on new connection to ensure immediate feedback
  updateGamepadUI(e.gamepad);
  // showNotification("Game controller connected!", 2000);
});

window.addEventListener("gamepaddisconnected", (e) => {
  // Only show warning if the *Active* one disconnected.
  // We can't easily know if 'e.gamepad' was the active one here without checking state.
  // logic: if no controllers left, then warn.

  if (Object.keys(gamepadManager.controllers).length === 0) {
    const btn = document.getElementById('gamepad-btn');
    if (btn) {
      btn.classList.add('shake', 'status-warning');
    }
    showNotification("No game controller connected", 5000);
    gamepadMenu.setGamepadInfo(null);
  }
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
let currentNotificationTimeout = null;

const bookManager = new BookManager();
const historyManager = new HistoryManager(bookManager);

const focusManager = new FocusManager();
import { HelpManager } from './ui/HelpManager.js';
const helpManager = new HelpManager(focusManager);
import { BookMenu } from './ui/BookMenu.js';
const bookMenu = new BookMenu();



const gutter = new Gutter('bottom-bar');
const gutterMode = new GutterMode({ gutter });
const gridOverview = new GridOverview('grid-overview', bookManager, historyManager);
const overviewMode = new OverviewMode({
  gridOverview,
  bookManager,
  historyManager,
  focusManager
});

// Hook Menu Close Events
gamepadMenu.onClose = () => {
  if (focusManager.mode === 'GAMEPAD_MENU') focusManager.setMode(focusManager.previousMode || 'EDITOR');
};
settingsManager.onClose = () => {
  if (focusManager.mode === 'SETTINGS_MENU') focusManager.setMode(focusManager.previousMode || 'EDITOR');
};
bookMenu.onClose = () => {
  if (focusManager.mode === 'BOOK_MENU') {
    const mode = focusManager.previousMode || 'EDITOR';
    focusManager.setMode(mode);
    if (mode === 'GUTTER') {
      try {
        const gp = gamepadManager.getActiveGamepad();
        if (gp && typingEngine.mapper) {
          const mapped = typingEngine.mapper.map(gp);
          gutterMode.syncInputState(mapped);
        }
      } catch (e) { console.warn("Failed to sync gutter input", e); }
    }
  }
};

const editorMode = new EditorMode({
  typingEngine,
  bookManager,
  historyManager,
  focusManager,
  gridOverview,
  overviewMode,
  visualizer,
  gamepadManager,
  renderer: editorRenderer,
  showNotification: (msg) => showNotification(msg),
  onVisualSelect: (cursor) => {
    visualSelectMode.enter(cursor);
    focusManager.setMode('VISUAL_SELECT');
  }
});

const visualSelectMode = new VisualSelectMode({
  bookManager,
  renderer: editorRenderer,
  historyManager,
  focusManager,
  typingEngine,
  gamepadManager,
  showNotification: (msg) => showNotification(msg)
});

const renamingMode = new RenamingMode({
  typingEngine,
  bookManager,
  historyManager,
  focusManager,
  gridOverview,
  overviewMode,
  editorRenderer
});

const inputRouter = new InputRouter({
  focusManager,
  gutterMode,
  overviewMode,
  editorMode,
  visualSelectMode,
  renamingMode,
  settingsManager,
  gamepadMenu,
  bookMenu,
  helpManager,
  gridOverview,
  gamepadManager,
  typingEngine,
  bookManager,
  editorRenderer,
  historyManager
});

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
    overviewMode.activate();
    document.querySelector('.editor-container').style.display = 'none';
    document.getElementById('visualizer-container').style.display = 'none';
  } else if (mode === 'EDITOR' || mode === 'RENAMING') {
    overviewMode.deactivate();
    document.querySelector('.editor-container').style.display = 'flex';
    document.getElementById('visualizer-container').style.display = 'flex';

    // Ensure editor reflects current part content (Only for EDITOR, Renaming handles its own reset)
    // Ensure editor reflects current part content (Only for EDITOR, Renaming handles its own reset)
    if (mode === 'EDITOR') {
      editorMode.resetState();
    }
  }

  if (mode === 'GUTTER') {
    gutterMode.activate();
  } else {
    gutterMode.deactivate();
  }
  updateStatusText(mode);
};

// Persistent Status Helper
function updateStatusText(mode) {
  const area = document.getElementById('notification-area');
  if (!area) return;

  // Icon Updates (Always update)
  const modeIcon = document.getElementById('mode-indicator');
  const caseIcon = document.getElementById('case-indicator');

  if (mode === 'VISUAL_SELECT') {
    if (modeIcon) modeIcon.innerHTML = '<i class="fa-solid fa-eye"></i>';
    if (caseIcon) caseIcon.style.display = 'none';
  } else if (mode === 'EDITOR' || mode === 'RENAMING') {
    if (modeIcon) {
      let isModifier = false;
      try {
        const gp = gamepadManager.getActiveGamepad();
        if (gp && typingEngine && typingEngine.mapper) {
          const mapped = typingEngine.mapper.map(gp);
          if (mapped && mapped.buttons && mapped.buttons.north) {
            isModifier = true;
          }
        }
      } catch (e) { console.warn("Status Icon Modifier Check Failed", e); }

      modeIcon.innerHTML = isModifier ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-border-none"></i>';
    }
    if (caseIcon) caseIcon.style.display = 'flex';
  } else {
    if (caseIcon) caseIcon.style.display = 'flex'; // Default show
  }

  // Text Updates (Blocked by Notification)
  if (currentNotificationTimeout) return;

  let html = '';
  if (mode === 'OVERVIEW') {
    const isUpdate = !!focusManager.citationUpdateTarget;
    const updateText = isUpdate
      ? `Update (<strong>Prev:</strong> ${overviewMode.cursor.x}, ${overviewMode.cursor.y})`
      : `Cite`;

    html = `
            <span class="notification-persistent">
                <i class="fa-solid fa-arrows-up-down-left-right icon-purple"></i> Pan&emsp;
                <i class="fa-solid fa-x icon-blue"></i> <strong>Hold 3s:</strong> Delete&emsp;
                <i class="fa-solid fa-y icon-yellow"></i> Rename&emsp;
                <i class="fa-solid fa-b icon-red"></i> ${updateText}
            </span>
        `;
  } else if (mode === 'RENAMING') {
    const oldName = focusManager.renameTarget ? focusManager.renameTarget.oldName : 'Unknown';
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
document.getElementById('help-btn')?.addEventListener('click', () => {
  helpManager.toggle();
});

window.addEventListener('request-help-toggle', (e) => {
  helpManager.toggle(e.detail.input);
});



// Book Menu Actions
bookMenu.onAction = (action) => {
  if (action === 'new') {
    inputRouter.requestConfirm('Create new book? Unsaved changes will be lost.', () => {
      bookManager.loadBook({}, "untitled.htz");
      bookManager.createPart(0, 0); // This sets current part to 0,0

      // Update Editor State
      const part = bookManager.getCurrentPart();
      if (part) {
        typingEngine.reset(part.content);
        if (typeof lastEngineTextLength !== 'undefined') lastEngineTextLength = part.content.length;
        editorRenderer.render(part);
      }

      focusManager.setMode('EDITOR');
      gridOverview.render();
      showNotification('New Book Created');
    });
  } else if (action === 'save') {
    const content = bookManager.exportBook();
    const filename = bookManager.filename || "my_book.htz";

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Book Saved to Downloads');
  } else if (action === 'open') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.htz,.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          bookManager.loadBook(data, file.name || "imported.htz");

          // Update Editor State
          const part = bookManager.getCurrentPart();
          if (part) {
            typingEngine.reset(part.content);
            if (typeof lastEngineTextLength !== 'undefined') lastEngineTextLength = part.content.length;
            editorRenderer.render(part);
          }

          focusManager.setMode('EDITOR');
          gridOverview.render();
          showNotification(`Loaded ${file.name}`);
        } catch (err) {
          console.error(err);
          showNotification("Failed to load book");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
};

const gearBtn = document.getElementById('settings-btn');
if (gearBtn) {
  gearBtn.addEventListener('click', () => {
    if (!settingsManager.isOpen) {
      settingsManager.toggle();
      focusManager.setMode('SETTINGS_MENU');
    }
  });

  const gamepadBtn = document.getElementById('gamepad-btn');
  gamepadBtn.addEventListener('click', () => {
    if (!gamepadMenu.isOpen) {
      gamepadMenu.toggle();
      focusManager.setMode('GAMEPAD_MENU');
    }
  });

  const bookBtn = document.getElementById('book-menu-btn');
  if (bookBtn) {
    bookBtn.addEventListener('click', () => {
      if (!bookMenu.isOpen) {
        bookMenu.toggle();
        focusManager.setMode('BOOK_MENU');
      }
    });
  }
}

settingsManager.onUpdate = (config) => {
  console.log('[Settings] Update received:', config);

  // Apply Settings
  const vContainer = document.getElementById('visualizer-container');
  const dStatus = document.getElementById('debug-status');
  const editor = document.getElementById('editor-view');
  const exportBtn = document.getElementById('export-logs-btn');

  console.log('[Settings] Elements found:', {
    vContainer: !!vContainer,
    dStatus: !!dStatus,
    exportBtn: !!exportBtn
  });

  if (vContainer) {
    const showVis = config.visualizer ? '1' : '0';
    console.log('[Settings] Setting visualizer opacity to:', showVis);
    vContainer.style.opacity = showVis;
    // Also set visibility to ensure it doesn't block clicks if 0 opacity
    vContainer.style.visibility = config.visualizer ? 'visible' : 'hidden';

    // Apply Placement Class
    vContainer.className = 'visualizer'; // Reset
    const placement = config.visualizerPlacement || 'BOTTOM_CENTER';
    console.log('[Settings] Visualizer placement:', placement);

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

  if (exportBtn) {
    console.log('[Settings] Toggling Export Button. Debug:', config.debug);
    // Force inline style update
    if (!config.debug) {
      exportBtn.style.setProperty('display', 'none', 'important');
    } else {
      exportBtn.style.display = ''; // Reset to default (CSS handled)
      // If CSS is hidden by default (it shouldn't be), this might fail.
      // But user said it IS showing. So default is visible.
    }
  } else {
    console.warn('[Settings] Export Button NOT found!');
  }

  if (dStatus) {
    dStatus.style.display = config.debug ? 'block' : 'none';

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

  // Sync InputDebugOverlay visibility
  if (typeof debugOverlay !== 'undefined') {
    debugOverlay.visible = config.debug;
    if (debugOverlay.element) {
      debugOverlay.element.style.display = config.debug ? 'block' : 'none';
    }
  }

  typingEngine.mapper.DEADZONE = config.deadzone;
  typingEngine.onsetConflictMode = config.onsetConflict;

  // Refresh Editor to reflect cursor changes immediately
  if (focusManager.mode === 'EDITOR' || focusManager.mode === 'GUTTER' || settingsManager.isOpen) {
    const part = bookManager.getCurrentPart();
    if (part) editorRenderer.render(part);
  }
};

// Initial Render
settingsManager.loadSettings(); // Force load from persistence
settingsManager.render();
settingsManager.onUpdate(settingsManager.config);
updateStatusText(focusManager.mode); // Ensure initial status text is shown


// Handle Gamepad Connection
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
  console.log("Request Rename Data:", e.detail);
  const { x, y, name } = e.detail;
  // Previously opened modal. Now we switch to RENAMING mode inline.
  // We need to know WHICH part we are renaming to block movement?
  // GridOverview handles the "selected" logic. We just need to capture input.

  // Actually, GridOverview dispatches this.
  // We should switch TypingEngine to the name content.
  const initialName = name ? name.trim() : '';
  console.log("Renaming Initial Name:", initialName);

  typingEngine.reset(initialName);
  console.log("Buffer after reset:", typingEngine.getBufferText());

  // Set cursor to end
  typingEngine.state.cursor = initialName.length;

  // Store target coordinates in focusManager or a temp var? 
  // Let's attach it to focusManager for convenience
  focusManager.renameTarget = { x, y, oldName: name };

  focusManager.renameState = {
    content: initialName,
    cursor: initialName.length,
    lastLength: initialName.length,
    lastDpad: { up: false, down: false, left: false, right: false }
  };

  focusManager.setMode('RENAMING');

  editorRenderer.render({
    content: initialName,
    cursor: initialName.length
  });
});

window.addEventListener('request-help-toggle', (e) => {
  const input = e.detail?.input;
  helpManager.toggle(input);
});

// Replaced static listener with global event listener
// Fallback clipboard method
const fallbackCopy = (text) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";  // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      showNotification('Debug logs copied (fallback)!', 3000);
    } else {
      console.error("Fallback copy failed.");
      window.prompt("Copy logs manually:", text);
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    window.prompt("Copy logs manually:", text);
  }
};

window.addEventListener('request-export-logs', () => {
  // Collect all logs: Console + History
  const consoleLogs = logger.export();
  const historyLogs = historyManager.exportLogs();

  const combined = `=== CONSOLE LOGS ===\n${consoleLogs}\n\n=== HISTORY LOGS ===\n${historyLogs}`;

  // 1. Always log to console as backup
  console.log("--- DEBUG LOG EXPORT ---");
  console.log(combined);
  console.log("------------------------");

  // 2. Try Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(combined).then(() => {
      showNotification('Debug logs copied to clipboard!', 3000);
    }).catch(err => {
      console.error('Clipboard API failed', err);
      fallbackCopy(combined);
    });
  } else {
    fallbackCopy(combined);
  }

  // 3. Download File (Original behavior)
  logger.download();
});

window.addEventListener('request-citation-insert', (e) => {
  console.log("Main: Received request-citation-insert", e.detail);
  const { x, y } = e.detail;
  const part = bookManager.getCurrentPart();

  if (part) {
    const tag = `{{cite:${x},${y}}}`;
    let content = part.content || "";
    let newCursor = part.cursor || 0;

    // CHECK: Are we updating an existing citation?
    if (focusManager.citationUpdateTarget) {
      const { start, end } = focusManager.citationUpdateTarget;
      // Replace the range
      content = content.slice(0, start) + tag + content.slice(end);
      // Cursor after the tag
      newCursor = start + tag.length;

      showNotification(`Link updated to (${x},${y})`);
      focusManager.citationUpdateTarget = null;
      gridOverview.setLinkTarget(null);
    } else {
      // New Insertion at cursor
      const cursor = part.cursor || 0;
      content = content.slice(0, cursor) + tag + content.slice(cursor);
      newCursor = cursor + tag.length;
      showNotification(`Link to (${x},${y}) inserted`);
    }

    bookManager.setCurrentPartContent(content);
    bookManager.setPartCursor(newCursor);

    // CRITICAL: Sync TypingEngine so it knows about the inserted tag!
    typingEngine.reset(content);

    // Check if we have the gamepad instance from the event frame? 
    // We don't have it directly here.
    // But we can force the NEXT frame to treat inputs as 'held' not 'pressed'.
    // We can't easily get the 'gamepad' object here though.
    // Solution: main.js loop handles the update.
    // If we rely on main loop, we need to ensure main loop knows we just switched.
    // Or we manually update gamepadManager.lastButtons?

    // Better: If we have a reference to the gamepad manager or current state.
    // Workaround: TypingEngine.resetInputState needs a gamepad object.
    // We can access gamepadManager.detect() if implementation allows, or wait for next frame loop.

    // Actually, simply clearing 'lastButtons' in Main Loop isn't enough for TypingEngine's internal 'lastInput'.
    // We need to tell TypingEngine to ignore the *first* frame of input after reset.
    // Or we update lastEngineTextLength.

    // Let's modify TypingEngine.js to allow partial update or just accept that we need to suppress 1 frame?
    // main.js lines ~600: gamepadManager.on('frame').
    // If we just set a flag 'justSwitchedMode = true' and pass it?

    // Simpler: gamepadManager provides 'getGamepads()'.
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gps[gamepadManager.index] || gps[0];
    if (gp) {
      typingEngine.resetInputState(gp);
    }

    if (part) {
      historyManager.push({
        type: 'ADD_CITATION',
        partKey: bookManager.currentPartKey,
        data: {
          text: tag,
          index: focusManager.citationUpdateTarget ? focusManager.citationUpdateTarget.start : (part.cursor || 0)
        }
      });
    }

    lastEngineTextLength = content.length;

    focusManager.setMode('EDITOR');
  } else {
    showNotification("No active part to link from.");
  }
});

// --- Main Loop ---
// --- Initialization ---
// Load Persistence last to ensure UI helpers (showNotification) are ready
if (bookManager.loadFromStorage()) {
  setTimeout(() => {
    if (typeof showNotification === 'function') {
      showNotification("Restored Book from Storage");
    }
    // Refresh Editor State with Loaded Data
    const part = bookManager.getCurrentPart();
    if (part) {
      typingEngine.reset(part.content);
      lastEngineTextLength = part.content.length; // Ensure global sync
      if (typeof editorRenderer !== 'undefined') editorRenderer.render(part, null);
    }
    focusManager.setMode('EDITOR');

    // Fix Duplication: Ensure EditorMode knows about the loaded content
    if (typeof editorMode !== 'undefined') editorMode.resetState();
  }, 100);
} else {
  // New Session
  focusManager.setMode('EDITOR');
}


// --- Game Loop ---
function loop() {
  requestAnimationFrame(loop);

  if (!document.hasFocus()) return;

  const gamepad = gamepadManager.getActiveGamepad();
  if (!gamepad) {
    if (focusManager.mode !== 'DIALOG_CONFIRM' && focusManager.mode !== 'OVERVIEW') {
      // visualizer.renderWaiting(); // optional
    }
    return;
  }

  // Poll Input
  const frameInput = typingEngine.mapper.map(gamepad);

  // Debug Overlay Update
  debugOverlay.render(gamepad);

  // Show Input in Visualizer (if visible)
  // visualizer.updateInput(frameInput); 

  // Global Undo/Redo (Meta) ?? 
  // currently inside EDITOR/VISUAL_SELECT. 

  // --- 1. Priority Overlays ---
  if (calibrationManager && calibrationManager.isCalibrating) {
    calibrationManager.handleInput(gamepad);
    return;
  }


  // --- Input Routing ---
  inputRouter.route(frameInput, gamepad);

  // Update History (CRITICAL for debounce)
  gamepadManager.updateLastButtons(frameInput);


}

// Start
requestAnimationFrame(loop);
