export class Visualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.leftJoy = this.container.querySelector('#left-joy');
        this.rightJoy = this.container.querySelector('#right-joy');

        // Cache stick points
        this.leftStickPoint = this.leftJoy.querySelector('.stick-point');
        this.rightStickPoint = this.rightJoy.querySelector('.stick-point');

        // Create and Cache segments
        this.leftSegments = this.createRadialSegments(this.leftJoy, 'left');
        this.rightSegments = this.createRadialSegments(this.rightJoy, 'right');
    }

    createRadialSegments(joyElement, side) {
        // 8 segments
        const sectors = ['NORTH', 'NORTH_EAST', 'EAST', 'SOUTH_EAST', 'SOUTH', 'SOUTH_WEST', 'WEST', 'NORTH_WEST'];

        // Create a container for the segments (background)
        const segmentContainer = document.createElement('div');
        segmentContainer.className = 'segment-container';

        const segments = [];

        sectors.forEach((sector, index) => {
            const seg = document.createElement('div');
            seg.className = `segment segment-${index}`;
            seg.dataset.sector = sector;

            const label = document.createElement('span');
            label.className = 'segment-label';

            // Cache finding the label? Or just the segment?
            // Storing object { el: seg, label: label, sector: sector } is best.
            const segmentObj = { el: seg, label: label, sector: sector };

            seg.appendChild(label);
            segmentContainer.appendChild(seg);
            segments.push(segmentObj);
        });

        joyElement.appendChild(segmentContainer);
        return segments;
    }

    update(input, mode, mappings) {
        if (!input) return;

        this.updateJoystick(this.leftStickPoint, this.leftSegments, input.sticks.left, mode, mappings, 'left');
        this.updateJoystick(this.rightStickPoint, this.rightSegments, input.sticks.right, mode, mappings, 'right');
    }

    updateJoystick(stickPoint, segments, stickData, mode, mappings, side) {
        // Move the stick point (visual feedback of physical stick)
        const maxDist = 30; // px
        const x = stickData.x * maxDist;
        const y = stickData.y * maxDist;
        stickPoint.style.transform = `translate(${x}px, ${y}px)`;

        // Update Segments
        // Un-highlight all
        for (const seg of segments) {
            seg.el.classList.remove('active');
            seg.label.textContent = '';
        }

        // Highlight active
        if (stickData.active && stickData.sector) {
            const active = segments.find(s => s.sector === stickData.sector);
            if (active) active.el.classList.add('active');
        }

        // Update Labels based on mapping
        let currentMap = null;
        if (mode === 'ONSET') {
            currentMap = mappings.ONSET[side.toUpperCase()];
        } else if (mode === 'RIME_LEFT') {
            if (side === 'left') currentMap = mappings.RIME.VOWELS;
            if (side === 'right') currentMap = mappings.RIME.CODA;
        } else if (mode === 'RIME_RIGHT') {
            if (side === 'right') currentMap = mappings.RIME.VOWELS;
            if (side === 'left') currentMap = mappings.RIME.CODA;
        } else if (mode === 'PUNCTUATION') {
            currentMap = mappings.PUNCTUATION[side.toUpperCase()];
        }

        if (currentMap) {
            for (const seg of segments) {
                const char = currentMap[seg.sector];
                if (char) {
                    seg.label.textContent = char.toUpperCase();
                }
            }
        }
    }
}
