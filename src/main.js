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
import { HistoryManager } from './data/HistoryManager.js';
import { EditorRenderer } from './ui/EditorRenderer.js';
import { EditorMode } from './modes/EditorMode.js';
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

const navBar = new NavigationBar('bottom-bar');
const gridOverview = new GridOverview('grid-overview', bookManager, historyManager);

const editorMode = new EditorMode({
  typingEngine,
  bookManager,
  historyManager,
  focusManager,
  gridOverview,
  visualizer,
  gamepadManager,
  renderer: editorRenderer,
  showNotification: (msg) => showNotification(msg),
  onPaste: () => window.handlePaste && window.handlePaste(), // Stub or ref
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
    gridOverview.activate();
    document.querySelector('.editor-container').style.display = 'none';
    document.getElementById('visualizer-container').style.display = 'none';
  } else if (mode === 'EDITOR' || mode === 'RENAMING') {
    gridOverview.deactivate();
    document.querySelector('.editor-container').style.display = 'flex';
    document.getElementById('visualizer-container').style.display = 'flex';

    // Ensure editor reflects current part content (Only for EDITOR, Renaming handles its own reset)
    // Ensure editor reflects current part content (Only for EDITOR, Renaming handles its own reset)
    if (mode === 'EDITOR') {
      editorMode.resetState();
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
    if (modeIcon) modeIcon.innerHTML = '<i class="fa-solid fa-border-none"></i>';
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
      ? `Update (Current: ${gridOverview.cursor.x}, ${gridOverview.cursor.y})`
      : `Cite`;

    html = `
            <span class="notification-persistent">
                <i class="fa-solid fa-arrows-up-down-left-right icon-purple"></i> Pan&emsp;
                <i class="fa-solid fa-y icon-yellow"></i><i class="fa-solid fa-plus"></i> <i class="fa-solid fa-arrows-up-down-left-right icon-purple"></i> Jump&emsp;
                <i class="fa-solid fa-x icon-blue"></i> <strong>Hold 3s:</strong> Delete&emsp;
                <i class="fa-solid fa-y icon-yellow"></i> Rename&emsp;
                <i class="fa-solid fa-b icon-red"></i> ${updateText}
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
document.getElementById('help-btn')?.addEventListener('click', () => {
  helpManager.toggle();
});

window.addEventListener('request-help-toggle', (e) => {
  helpManager.toggle(e.detail.input);
});

document.getElementById('book-menu-btn')?.addEventListener('click', () => {
  bookMenu.toggle();
  if (bookMenu.isOpen) focusManager.setMode('BOOK_MENU');
});

window.addEventListener('request-book-menu-toggle', (e) => {
  if (bookMenu.toggle(e.detail.input)) {
    focusManager.setMode('BOOK_MENU');
  }
});

// Book Menu Actions
bookMenu.onAction = (action) => {
  if (action === 'new') {
    showConfirmModal('Create new book? Unsaved changes will be lost.', () => {
      bookManager.loadBook({}, "untitled.htz");
      bookManager.createPart(0, 0);
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
    if (!settingsManager.isOpen) settingsManager.toggle();
  });

  const gamepadBtn = document.getElementById('gamepad-btn');
  gamepadBtn.addEventListener('click', () => {
    if (!gamepadMenu.isOpen) gamepadMenu.toggle();
  });
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
  if (focusManager.mode === 'EDITOR' || focusManager.mode === 'BOTTOM_BAR' || settingsManager.isOpen) {
    const part = bookManager.getCurrentPart();
    if (part) renderCustomEditor(part);
  }
};

// Initial Render
settingsManager.loadSettings(); // Force load from persistence
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

  // Force immediate render so we don't see the old content even for a frame
  renderCustomEditor({
    content: initialName,
    cursor: initialName.length
  });
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

      const ov = document.getElementById('grid-overview');
      const isOverview = ov && (ov.style.display === 'block' || getComputedStyle(ov).display !== 'none');
      focusManager.setMode(isOverview ? 'OVERVIEW' : 'EDITOR');

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

      const ov = document.getElementById('grid-overview');
      const isOverview = ov && (ov.style.display === 'block' || getComputedStyle(ov).display !== 'none');
      focusManager.setMode(isOverview ? 'OVERVIEW' : 'EDITOR');

    } else {
      settingsManager.handleInput(frameInput);
    }
    gamepadManager.lastStart = startPressed;
    gamepadManager.lastSelect = selectPressed;
    return;
  }

  // 2c. Help Menu (Priority)
  if (helpManager.isOpen) {
    helpManager.handleInput(frameInput);
    gamepadManager.lastStart = startPressed;
    gamepadManager.lastSelect = selectPressed;
    return;
  }

  // 3. Global Toggles Bottom Bar (Only if not in Dialog or Book Menu)
  if (focusManager.mode !== 'DIALOG' && focusManager.mode !== 'BOOK_MENU' && startPressed && !gamepadManager.lastStart) {
    focusManager.toggleBottomBar();
  }

  // Select -> Toggle Overview (Only if not in Dialog or Renaming)
  if (focusManager.mode !== 'DIALOG' && focusManager.mode !== 'RENAMING' && selectPressed && !gamepadManager.lastSelect) {
    if (focusManager.mode === 'OVERVIEW') {
      // Cancelling Overview Action
      focusManager.citationUpdateTarget = null;
      gridOverview.setLinkTarget(null);
    }
    focusManager.toggleOverview();
    if (focusManager.mode === 'OVERVIEW') {
      gridOverview.syncInputState(frameInput);
    }
  }



  // 5. Route Input based on Focus
  switch (focusManager.mode) {
    case 'HELP':
      helpManager.handleInput(frameInput);
      break;

    case 'BOOK_MENU':
      bookMenu.handleInput(frameInput);
      if (!bookMenu.isOpen) {
        // Return to Overview if it's visible, otherwise Editor
        const ov = document.getElementById('grid-overview');
        const isOverview = ov && (ov.style.display === 'block' || getComputedStyle(ov).display !== 'none');
        focusManager.setMode(isOverview ? 'OVERVIEW' : 'EDITOR');
      }
      break;

    case 'OVERVIEW':
      const isMod = frameInput.buttons.north;

      // Undo: Y (North) + Left Trigger
      if (isMod && frameInput.buttons.lt && !gamepadManager.lastButtons?.lt) {
        historyManager.undo().then(op => {
          if (op) {
            showNotification(`Undo: ${op.type} (To: ${op.navigateTo?.mode || 'EDITOR'})`);
            if (op.navigateTo) {
              if (bookManager.currentPartKey !== `${op.navigateTo.x},${op.navigateTo.y}`) {
                bookManager.selectPart(op.navigateTo.x, op.navigateTo.y);
              }
              if (op.navigateTo.mode) {
                focusManager.setMode(op.navigateTo.mode);
                if (op.navigateTo.mode === 'OVERVIEW') {
                  gridOverview.setCursor(op.navigateTo.x, op.navigateTo.y);
                  gridOverview.syncInputState(frameInput);
                  gridOverview.ignoreNextRename = true;
                  gridOverview.updateView(true);
                }
              }
            }
            // Sync Engine regardless (for safe transition)
            const p = bookManager.getCurrentPart();
            if (p) {
              typingEngine.reset(p.content);
              lastEngineTextLength = p.content.length;
              renderCustomEditor(p);
            }
          } else {
            showNotification("Nothing to Undo");
          }
        });
        gamepadManager.lastButtons.lt = true; // Consume
        // Don't update lastButtons fully here, let falling through handle it?
        // Actually we want to return or continue?
        // If we set lastButtons here we need to be careful.
        // Let's just return to skip gridOverview input this frame.
        gamepadManager.lastButtons = { ...frameInput.buttons };
        break;
      }

      // Redo: Y (North) + Right Trigger
      if (isMod && frameInput.buttons.rt && !gamepadManager.lastButtons?.rt) {
        historyManager.redo().then(op => {
          if (op) {
            showNotification(`Redo: ${op.type}`);
            if (op.navigateTo) {
              if (bookManager.currentPartKey !== `${op.navigateTo.x},${op.navigateTo.y}`) {
                bookManager.selectPart(op.navigateTo.x, op.navigateTo.y);
              }
              if (op.navigateTo.mode) {
                focusManager.setMode(op.navigateTo.mode);
                if (op.navigateTo.mode === 'OVERVIEW') {
                  gridOverview.setCursor(op.navigateTo.x, op.navigateTo.y);
                  gridOverview.syncInputState(frameInput);
                  gridOverview.ignoreNextRename = true;
                  gridOverview.updateView(true);
                }
              }
            }
            const p = bookManager.getCurrentPart();
            if (p) {
              typingEngine.reset(p.content);
              lastEngineTextLength = p.content.length;
              renderCustomEditor(p);
            }
          } else {
            showNotification("Nothing to Redo");
          }
        });
        gamepadManager.lastButtons = { ...frameInput.buttons };
        break;
      }

      // Route all input to GridOverview
      gridOverview.handleInput(frameInput);

      // Update Global State Tracker for Edge Detection
      gamepadManager.lastButtons = { ...frameInput.buttons };

      break;

    case 'BOTTOM_BAR':
      navBar.handleInput(frameInput);
      break;


    case 'RENAMING':
      const rState = focusManager.renameState;
      if (!rState) break; // Safety

      // 1. SAVE (B)
      const lastBtns = gamepadManager.lastButtons || {}; // Safety check
      if (frameInput.buttons.east && !lastBtns.east) {
        const newName = rState.content;
        const { x, y } = focusManager.renameTarget;

        // Push to History (we need old name)
        const oldName = bookManager.getPart(x, y).name;

        bookManager.renamePart(x, y, newName);

        historyManager.push({
          type: 'RENAME_PART',
          partKey: `${x},${y}`,
          data: {
            x: x,
            y: y,
            oldName: oldName,
            newName: newName
          }
        });

        focusManager.setMode('OVERVIEW');

        // Prevent fall-through! Sync the overview's last button state to current frame
        // so it doesn't see "B" as a "new press" in the next frame if button is held, 
        // or effectively "debounces" this action.
        gridOverview.syncInputState(frameInput);

        gridOverview.updateView(true);
        showNotification(`Part renamed to "${newName}"`);
        break;
      }

      // 2. CANCEL (Select)
      if (selectPressed && !gamepadManager.lastSelect) {
        focusManager.setMode('OVERVIEW');
        showNotification("Renaming Cancelled");
        break;
      }

      // 3. Navigation (D-Pad)
      const rDpad = frameInput.buttons.dpad;
      const rJustPressed = (btn) => rDpad[btn] && !rState.lastDpad[btn];

      if (rJustPressed('left')) {
        rState.cursor = Math.max(0, rState.cursor - 1);
      }
      if (rJustPressed('right')) {
        rState.cursor = Math.min(rState.content.length, rState.cursor + 1);
      }
      rState.lastDpad = { ...rDpad };

      // 4. Typing (Diff Logic)
      const rEngineState = typingEngine.processFrame(gamepad);
      const rCurrentText = typingEngine.getBufferText();
      const rDiff = rCurrentText.length - rState.lastLength;

      if (rDiff !== 0) {
        if (rDiff > 0) {
          // Insertion
          const added = rCurrentText.slice(rState.lastLength);
          rState.content = rState.content.slice(0, rState.cursor) + added + rState.content.slice(rState.cursor);
          rState.cursor += rDiff;
        } else {
          // Backspace (Engine removed from end)
          const amount = -rDiff;
          const start = Math.max(0, rState.cursor - amount);
          rState.content = rState.content.slice(0, start) + rState.content.slice(rState.cursor);
          rState.cursor = start;
        }

        // Sync Engine to match our modified content
        typingEngine.reset(rState.content);
        rState.lastLength = rState.content.length;
      }

      // 5. Render Editor
      renderCustomEditor({
        content: rState.content,
        cursor: rState.cursor
      });

      // 6. Render Visualizer (Live typing feedback)
      visualizer.update(frameInput, typingEngine.state.mode, typingEngine.mappings);

      break;

    case 'EDITOR':
      editorMode.handleInput(frameInput, gamepad);
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

            const removedText = originalContent.slice(sStart, sEnd);
            historyManager.push({
              type: 'REMOVE_TEXT',
              partKey: bookManager.currentPartKey,
              data: {
                text: removedText,
                index: sStart
              }
            });

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
  // Delegate to safe EditorRenderer
  editorRenderer.render(part, currentAnchor);
}

// Keep old indicators update? Or move to standard update status?
// indicators (case/mode) are outside editor-view usually.
updateIndicators();

function updateIndicators() {
  const mInd = document.getElementById('mode-indicator');
  const cInd = document.getElementById('case-indicator');
  const state = typingEngine.state;

  if (mInd) {
    // Priority: FocusManager Mode
    if (focusManager.mode === 'VISUAL_SELECT') {
      mInd.innerHTML = '<i class="fa-solid fa-eye"></i>';
    } else {
      let icon = '';
      const leftLocked = state.leftStick?.locked;
      const rightLocked = state.rightStick?.locked;
      const isSelectionActive = leftLocked || rightLocked || state.syllable?.onset; // "Selected Consonant" mode
      const isModifierHeld = gamepadManager.lastButtons?.north;
      switch (state.mode) {

        case 'ONSET':
          icon = isSelectionActive
            ? '<i class="fa-regular fa-square"></i>'
            : isModifierHeld ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-border-none"></i>';
          break;
        case 'RIME_LEFT': icon = '<i class="fa-solid fa-square-caret-left"></i>'; break;
        case 'RIME_RIGHT': icon = '<i class="fa-solid fa-square-caret-right"></i>'; break;
        case 'PUNCTUATION': icon = '<i class="fa-solid fa-square-minus"></i>'; break;
        default: icon = state.mode;
      }
      mInd.innerHTML = icon;
    }
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
// Sync with Settings (Initial)
debugOverlay.visible = settingsManager.config.debug;
if (debugOverlay.visible) debugOverlay.element.style.display = 'block';
else debugOverlay.element.style.display = 'none';

// Rogue onUpdate removed here. Logic moved to main handler.

// --- Robust Export Logic ---
const exportBtn = document.getElementById('export-logs-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
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
      lastEngineTextLength = part.content.length;
      if (typeof renderCustomEditor === 'function') renderCustomEditor(part);

      // Restore Cursor if available?
      // TypingEngine reset might zero it.
      // We should sync typingEngine cursor to part.cursor if possible (not currently supported by reset)
      // Manual sync:
      // typingEngine.cursorIndex = part.cursor; // If public
    }
  }, 100);
}
