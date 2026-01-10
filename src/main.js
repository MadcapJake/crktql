import '../style.css'
import { GamepadManager } from './input/GamepadManager.js';
import { TypingEngine } from './engine/TypingEngine.js';
import { Visualizer } from './ui/Visualizer.js';
import { CalibrationManager } from './ui/CalibrationManager.js';
import { SettingsManager } from './ui/SettingsManager.js';
import { logger } from './utils/DebugLogger.js';

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

    <div class="editor-container">
        <textarea id="editor" readonly placeholder="Waiting for input..."></textarea>
    </div>

    <div class="bottom-bar">
        <div id="mode-indicator"><i class="fa-solid fa-circle-half-stroke"></i></div>
        <div id="case-indicator"><i class="fa-regular fa-circle"></i></div>
        <div class="header-actions">
            <div id="export-logs-btn" class="settings-trigger" title="Export Debug Logs"><i class="fa-solid fa-file-export"></i></div>
            <div id="settings-btn" class="settings-trigger"><i class="fa-solid fa-gear"></i></div>
        </div>
    </div>
    
    <div id="debug-status"></div>
  </div>
`

// Initialize Managers
const gamepadManager = new GamepadManager();
const typingEngine = new TypingEngine();
const visualizer = new Visualizer('visualizer-container');
const settingsManager = new SettingsManager();

// Initialize Calibration Manager
const calibrationManager = new CalibrationManager(
  gamepadManager,
  typingEngine.mapper,
  () => {
    // On Close, what do we do?
    // Maybe ensure we are back in a safe state.
  }
);

// Settings -> Calibration Integration
settingsManager.onAction = (action) => {
  if (action === 'calibrate') {
    settingsManager.toggle(); // Close settings
    calibrationManager.start(); // Open calibration
  }
};

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
      editor.style.paddingTop = '2rem'; // Default
      editor.style.paddingBottom = '2rem'; // Default

      if (placement.startsWith('TOP')) {
        editor.style.paddingTop = '320px'; // Give room at top
      } else {
        editor.style.paddingBottom = '320px'; // Give room at bottom
      }
    }
  }

  if (dStatus) dStatus.style.display = config.debug ? 'block' : 'none';

  typingEngine.mapper.DEADZONE = config.deadzone;
  typingEngine.onsetConflictMode = config.onsetConflict;
};

// Initialize Defaults
settingsManager.render();
settingsManager.onUpdate(settingsManager.config);

// Gamepad Events
window.addEventListener("gamepadconnected", (e) => {
  const gp = e.gamepad;
  gamepadManager.handleConnect(gp);
  console.log(`Gamepad connected at index ${gp.index}: ${gp.id}.`);
});

window.addEventListener("gamepaddisconnected", (e) => {
  gamepadManager.handleDisconnect(e.gamepad);
  console.log("Gamepad disconnected.");
});

// Main Loop
gamepadManager.on('frame', (gamepad) => {
  // 1. Calibration takes priority
  if (calibrationManager.isCalibrating) {
    calibrationManager.handleInput(gamepad);
    return;
  }

  // 2. Map Input
  const frameInput = typingEngine.mapper.map(gamepad);

  // 3. Global Toggles (Start Button)
  const startPressed = frameInput?.buttons.start;
  // Simple edge detection for Start
  if (startPressed && !gamepadManager.lastStart) {
    settingsManager.toggle();
  }
  gamepadManager.lastStart = startPressed;

  // 4. Settings Menu
  if (settingsManager.isOpen) {
    settingsManager.handleInput(frameInput);
    return; // Pause typing while in menu
  }

  // 5. Typing Engine
  const state = typingEngine.processFrame(gamepad);
  if (!state) return;

  // 6. Update UI
  updateEditorUI(state);

  // 7. Visualizer
  visualizer.update(frameInput, state.mode, typingEngine.mappings, typingEngine.state.syllable);

  // 8. Debug Status
  updateDebugUI(frameInput, gamepad, state);
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
