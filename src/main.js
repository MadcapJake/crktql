import '../style.css'
import { GamepadManager } from './input/GamepadManager.js';
import { TypingEngine } from './engine/TypingEngine.js';
import { Visualizer } from './ui/Visualizer.js';

document.querySelector('#app').innerHTML = `
  <div class="container">
    <div class="header">
        <div id="mode-indicator">ONSET</div>
        <div id="case-indicator">LOWER</div>
    </div>
    
    <div class="editor-container">
        <textarea id="editor" readonly placeholder="Waiting for input..."></textarea>
    </div>

    <div class="visualizer" id="visualizer-container">
        <div class="joystick" id="left-joy">
            <div class="stick-point"></div>
            <div class="label">Left Stick</div>
        </div>
        <div class="joystick" id="right-joy">
            <div class="stick-point"></div>
            <div class="label">Right Stick</div>
        </div>
    </div>
    
    <div id="debug-status"></div>
  </div>
`

const gamepadManager = new GamepadManager();
const typingEngine = new TypingEngine();
const visualizer = new Visualizer('visualizer-container');

window.addEventListener("gamepadconnected", (e) => {
  const gp = e.gamepad;
  gamepadManager.handleConnect(gp);
  console.log(`Gamepad connected at index ${gp.index}: ${gp.id}. ${gp.buttons.length} buttons, ${gp.axes.length} axes.`);
});

window.addEventListener("gamepaddisconnected", (e) => {
  gamepadManager.handleDisconnect(e.gamepad);
  console.log("Gamepad disconnected.");
});

gamepadManager.on('frame', (gamepad) => {
  const state = typingEngine.processFrame(gamepad);
  if (!state) return;

  // Update UI
  const editor = document.getElementById('editor');

  // Show text + pending syllable preview
  let displayText = state.text;
  const s = typingEngine.state.syllable;

  // We reconstruct the display to include brackets and case manually?
  // Or better, let's expose specific formatted parts from engine?
  // "getFormattedDisplay()"?

  // Let's just replicate the Title Case logic visually or use the engine helper if possible?
  // Engine `getFormattedSyllable` returns "Min". We want "[Min]".
  // But for partials? "[M-n]".
  // The engine doesn't return dashes.

  const mode = typingEngine.state.caseMode;
  const applyCase = (str, isStart) => {
    if (!str) return str;
    if (mode === 2) return str.toUpperCase();
    if (mode === 1 && isStart) return str.toUpperCase();
    return str; // Lower
  };

  // Determine "Start" for Title Case
  const onset = s.onset || '';
  const vowel = s.vowel; // can be null
  const coda = s.coda || '';

  let pOnset = applyCase(onset, true);
  let pVowel = applyCase(vowel || (state.mode.startsWith('RIME') ? '-' : ''), !onset); // Vowel is start if no onset
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
  document.getElementById('mode-indicator').textContent = state.mode;
  document.getElementById('case-indicator').textContent = ['LOWER', 'SHIFT', 'CAPS'][state.caseMode];

  const input = typingEngine.mapper.map(gamepad);

  // Update Visualizer
  visualizer.update(input, state.mode, typingEngine.mappings);

  // Debug
  if (input) {
    const rawAxes = gamepad.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(' ');
    // Show active buttons for debugging L3/R3
    const activeButtons = gamepad.buttons
      .map((b, i) => b.pressed ? i : null)
      .filter(i => i !== null)
      .join(', ');

    document.getElementById('debug-status').innerHTML = `
          Buttons: [${activeButtons}] <br>
          Raw Axes: ${rawAxes} <br>
          LT: ${input.mode.raw.lt.toFixed(2)} | RT: ${input.mode.raw.rt.toFixed(2)} <br>
          L-Stick: ${input.sticks.left.active ? input.sticks.left.sector : 'Center'} (${Math.round(input.sticks.left.angle)}°)<br>
          R-Stick: ${input.sticks.right.active ? input.sticks.right.sector : 'Center'} (${Math.round(input.sticks.right.angle)}°)
      `;
  }
});
