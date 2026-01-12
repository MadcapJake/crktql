
export class EditorRenderer {
    constructor(elementId, typingEngine, settingsManager) {
        this.container = document.getElementById(elementId);
        this.typingEngine = typingEngine;
        this.settingsManager = settingsManager;
    }

    render(part, selectionAnchor = null) {
        if (!this.container || !part) return;

        const content = part.content || "";
        const cursor = part.cursor || 0;

        // Pending Syllable Logic
        const pending = this.typingEngine.getFormattedSyllable();

        // HTML Escaping & Citation Rendering
        const safeEscape = (str) => {
            let escaped = str.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>')
                .replace(/ /g, '&nbsp;');

            // Render Citations: {{cite:x,y}} -> Pill
            return escaped.replace(/\{\{cite:(-?\d+),(-?\d+)\}\}/g, '<span class="citation-pill">⌖ $1, $2</span>');
        };

        const processText = safeEscape;
        const esc = safeEscape;

        // Selection Logic
        const anchor = selectionAnchor;
        const isSelectionActive = (anchor !== undefined && anchor !== null && anchor !== cursor);

        let html = "";

        if (isSelectionActive) {
            // Range Selection
            const start = Math.min(anchor, cursor);
            const end = Math.max(anchor, cursor);

            const preSelect = content.slice(0, start);
            const range = content.slice(start, end);
            const postSelect = content.slice(end);

            html = processText(preSelect);
            html += `<span class="selection-highlight">${esc(range)}</span>`;

            // Note: Legacy code just highlighted. Assuming no cursor indicator needed in selection for now to match exactly.
            html += processText(postSelect);
        } else {
            // Standard Cursor Logic
            const before = content.slice(0, cursor);
            const after = content.slice(cursor);

            const pendingHtml = pending ? `<span class="pending-text">${esc(pending)}</span>` : '';

            // Determine Cursor Type
            const cursorType = this.settingsManager?.config?.cursorType || 'BAR';
            let cursorSubClass = 'cursor-bar';
            if (cursorType === 'BLOCK') cursorSubClass = 'cursor-block';
            if (cursorType === 'UNDERLINE') cursorSubClass = 'cursor-underline';

            html += processText(before);
            html += pendingHtml;

            if (cursorType === 'BAR') {
                html += `<span class="cursor ${cursorSubClass}"></span>`;
                html += processText(after);
            } else {
                // Block/Underline logic
                if (after.length > 0) {
                    // Check for citation at start of 'after'
                    const match = /^\{\{cite:(-?\d+),(-?\d+)\}\}/.exec(after);

                    if (match) {
                        // ATOMIC RENDER: Merge classes
                        const x = match[1];
                        const y = match[2];
                        const rest = after.slice(match[0].length);

                        // Render the pill WITH the cursor class
                        html += `<span class="citation-pill cursor ${cursorSubClass} cursor-atomic">⌖ ${x}, ${y}</span>`;
                        html += processText(rest);
                    } else {
                        // Standard Char
                        const targetChar = after[0];
                        const rest = after.slice(1);
                        html += `<span class="cursor ${cursorSubClass}">${processText(targetChar)}</span>`;
                        html += processText(rest);
                    }
                } else {
                    // End of file
                    html += `<span class="cursor ${cursorSubClass}">&nbsp;</span>`;
                }
            }
        }

        this.container.innerHTML = html;

        // Auto Scroll
        const cursorEl = this.container.querySelector('.cursor');
        if (cursorEl) {
            cursorEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }
}
