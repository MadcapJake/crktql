export class Visualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.leftJoy = this.container.querySelector('#left-joy');
        this.rightJoy = this.container.querySelector('#right-joy');

        // Create radial segments
        this.createRadialSegments(this.leftJoy, 'left');
        this.createRadialSegments(this.rightJoy, 'right');
    }

    createRadialSegments(joyElement, side) {
        // 8 segments
        const sectors = ['NORTH', 'NORTH_EAST', 'EAST', 'SOUTH_EAST', 'SOUTH', 'SOUTH_WEST', 'WEST', 'NORTH_WEST'];

        // Create a container for the segments (background)
        const segmentContainer = document.createElement('div');
        segmentContainer.className = 'segment-container';

        sectors.forEach((sector, index) => {
            const seg = document.createElement('div');
            seg.className = `segment segment-${index}`;
            seg.dataset.sector = sector;

            const label = document.createElement('span');
            label.className = 'segment-label';
            seg.appendChild(label);

            segmentContainer.appendChild(seg);
        });

        joyElement.appendChild(segmentContainer);
    }

    update(input, mode, mappings) {
        if (!input) return;

        this.updateJoystick(this.leftJoy, input.sticks.left, mode, mappings, 'left');
        this.updateJoystick(this.rightJoy, input.sticks.right, mode, mappings, 'right');
    }

    updateJoystick(joyElement, stickData, mode, mappings, side) {
        // Move the stick point (visual feedback of physical stick)
        const stickPoint = joyElement.querySelector('.stick-point');
        const maxDist = 30; // px
        const x = stickData.x * maxDist;
        const y = stickData.y * maxDist;
        stickPoint.style.transform = `translate(${x}px, ${y}px)`;

        // Highlight active sector
        const segments = joyElement.querySelectorAll('.segment');
        segments.forEach(seg => {
            seg.classList.remove('active');
            const label = seg.querySelector('.segment-label');
            label.textContent = ''; // Reset
        });

        if (stickData.active && stickData.sector) {
            const activeSeg = joyElement.querySelector(`.segment[data-sector="${stickData.sector}"]`);
            if (activeSeg) activeSeg.classList.add('active');
        }

        // Update Labels based on mapping
        // mappings structure: { ONSET: { LEFT: {...}, RIGHT: {...} }, ... }

        let currentMap = null;
        if (mode === 'ONSET') {
            currentMap = mappings.ONSET[side.toUpperCase()];
        } else if (mode === 'RIME_LEFT') {
            // Left Trigger Held
            // Left Joystick = Vowels (A)
            // Right Joystick = Coda (B)
            if (side === 'left') currentMap = mappings.RIME.VOWELS;
            if (side === 'right') currentMap = mappings.RIME.CODA;
        } else if (mode === 'RIME_RIGHT') {
            // Right Trigger Held
            // Right Joystick = Vowels (A)
            // Left Joystick = Coda (B)
            if (side === 'right') currentMap = mappings.RIME.VOWELS;
            if (side === 'left') currentMap = mappings.RIME.CODA;
        } else if (mode === 'PUNCTUATION') {
            currentMap = mappings.PUNCTUATION[side.toUpperCase()];
        }

        if (currentMap) {
            segments.forEach(seg => {
                const sector = seg.dataset.sector;
                const char = currentMap[sector];
                if (char) {
                    seg.querySelector('.segment-label').textContent = char.toUpperCase();
                }
            });
        }
    }
}
