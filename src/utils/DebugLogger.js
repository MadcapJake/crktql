export class DebugLogger {
    constructor(maxSize = 2000) {
        this.logs = [];
        this.maxSize = maxSize;
        this.startTime = Date.now();
    }

    log(category, message, data = null) {
        const timestamp = Date.now() - this.startTime;
        this.logs.push({
            timestamp,
            category,
            message,
            data: data ? JSON.parse(JSON.stringify(data)) : null // Deep copy data
        });

        if (this.logs.length > this.maxSize) {
            this.logs.shift(); // Remove oldest
        }
    }

    export() {
        return this.logs.map(l => {
            const dataStr = l.data ? ` | ${JSON.stringify(l.data)}` : '';
            return `[${l.timestamp}ms] [${l.category}] ${l.message}${dataStr}`;
        }).join('\n');
    }

    clear() {
        this.logs = [];
        this.startTime = Date.now(); // Reset relative timer
    }
    download() {
        const text = this.export();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crktql_logs_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const logger = new DebugLogger();
