# yôn Cuktelo

![yôn Cuktelo Logo](public/cuktelo.svg)

A gamepad-only [Hîsyêô](https://hisyeo.github.io/) text editor designed for efficient, controller-based writing and text manipulation.

## Overview
**yôn Cuktelo** reimagines text entry by mapping typing, navigation, and editing commands to a standard gamepad controller. It features a modal interface similar to console text editors but optimized for thumbs, allowing for (hopefully) high-speed input and precise control without a keyboard.

## Features
- **Gamepad Typing**: Chorded syllable entry system.
- **Modes**:
  - **Editor**: Standard text composition.
  - **Overview**: Grid-based navigation of document parts.
  - **Visual Select**: Precise text selection and manipulation.
  - **Gutter**: Bottom bar for file management, settings, and gamepad configuration.
- **Persistence**: Auto-saves content and settings to LocalStorage.
- **Undo/Redo**: Robust history system saved to SessionStorage.
- **Citations**: Atomic citation tags `{{cite:x,y}}` with jump navigation support.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/crktqla.git
   cd crktqla
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` (or the port shown) in your browser.
   *Ensure a gamepad is connected before pressing any buttons to initialize input.*

## Controls

### General
- **Modifier (North / Y)**: Hold to access secondary layers

### Editor Mode
- **Left Stick / Right Stick**: Syllable Entry
- **D-Pad**: Cursor Movement (Standard)
- **Modifier + D-Pad**: Word Navigation
- **South (A)**: Enter / Confirm
- **West (X)**: Delete Backwards
- **Modifier + West (X)**: Delete Word Backwards
- **Modifier + L3/R3**: Paste from Clipboard
- **Modifier + RB**: Enter Visual Select Mode
- **Modifier + LT**: Undo
- **Modifier + RT**: Redo

### Overview Mode
- **D-Pad**: Grid Navigation
- **South (A)**: Enter Selected Part
- **Modifier + B**: Follow Link (if valid)

### Visual Select Mode
- **D-Pad**: Expand/Shrink Selection
- **West (X)**: Cut
- **South (A)**: Copy

## Custom Mappings

You can define custom input mappings by adding a `.json` file to the `src/mappings/` directory. The filename will be used as the name of the Writing System in the Settings menu.

### Structure

```json
{
    "STARTING_BOOK_NAME": "tômôs",
    "STARTING_MAIN_NAME": "niwos",
    "STAGING_BRACKETS": "⟦⟧",
    "ONSET": {
        "DEFAULT_VOWEL": "a",
        "LEFT": { "NORTH": "h", "SOUTH": "f" ... },
        "RIGHT": { "NORTH": "y", "SOUTH": "b" ... }
    },
   "RIME": {
        "ORDER": ["VOWELS", "CODA"], 
        "VOWELS": { "NORTH": "i", "SOUTH": "o" ... },
        "CODA": { "NORTH": "k", "SOUTH": "s" ... }
    },
    "PUNCTUATION": {
        "LEFT": { ... },
        "RIGHT": { ... }
    }
}
```

- **STARTING_BOOK_NAME**: The default name used for the book when creating a new one with this writing system active.
- **STARTING_MAIN_NAME**: The default name for the first part (0,0) created in a new book.
- **STARTING_PART_NAME**: The default name for all new parts created.
- **STAGING_BRACKETS**: A two-character string (e.g., "⟦⟧") used to wrap the syllable currently being constructed (staged) in the editor view.
- **ONSET.DEFAULT_VOWEL**: The vowel automatically appended when releasing an onset stick without selecting a rime (e.g., 'a' or 'o').
- **RIME.ORDER**: Defines the syllable construction order.
    - `["VOWELS", "CODA"]`: Produces `<ONSET><VOWEL><CODA>`.
    - `["CODA", "VOWELS"]`: Produces `<ONSET><CODA><VOWEL>`.

## Project Structure
- `src/main.js`: Application entry point and main loop
- `src/engine/`: Typing Engine logic
- `src/modes/`: Mode logic (Editor, Overview, etc.)
- `src/ui/`: UI Renderers
- `src/input/`: Input routing and mapping
- `src/mappings/`: Input mappings for different writing systems
- `src/data/`: Book data and history

## TODO
- [x] Add mapping field STARTING_PART_NAME for default new part name given
- [ ] Move to IndexedDB from LocalStorage for async autosave and session restore
- [ ] Spellcheck Mode (shoulder buttons nav thru errors) (customizable w/ hunspell files)
- [ ] Home/End/Top/Bottom using another chording key
- [ ] In Overview Mode, Home navigates to main part (0,0), but End/Top/Bottom do nothing
- [ ] In Editor Mode, part navigation using another chording key
- [ ] Add a joystick layer for symbols/numbers
- [ ] Allow parts to be external links to websites that load in an iframe

## License
[ACSL](LICENSE)
