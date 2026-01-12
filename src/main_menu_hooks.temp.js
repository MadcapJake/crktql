
// Hook Menu Close Events to restore Focus
gamepadMenu.onClose = () => {
    if (focusManager.mode === 'GAMEPAD_MENU') {
        focusManager.setMode(focusManager.previousMode || 'EDITOR');
    }
};

settingsManager.onClose = () => {
    if (focusManager.mode === 'SETTINGS_MENU') {
        focusManager.setMode(focusManager.previousMode || 'EDITOR');
    }
};

bookMenu.onClose = () => {
    if (focusManager.mode === 'BOOK_MENU') {
        focusManager.setMode(focusManager.previousMode || 'EDITOR');
    }
};
