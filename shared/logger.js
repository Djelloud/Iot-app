
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logLevel = 'info';
        this.logToFile = false;
        this.logFile = path.join(__dirname, '../logs/app.log');
        
        // Créer le dossier logs s'il n'existe pas
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    configure(level = 'info', toFile = false) {
        this.logLevel = level;
        this.logToFile = toFile;
    }

    _log(level, component, message, data = null) {
        const timestamp = new Date().toISOString();
        const levelUpper = level.toUpperCase().padEnd(5);
        const componentFormatted = `[${component}]`.padEnd(12);
        
        let logMessage = `${timestamp} ${levelUpper} ${componentFormatted} ${message}`;
        
        if (data) {
            logMessage += ` ${JSON.stringify(data)}`;
        }

        // Console output avec couleurs
        const colors = {
            error: '\x1b[31m',   // Rouge
            warn: '\x1b[33m',    // Jaune
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[37m',   // Blanc
            reset: '\x1b[0m'
        };

        console.log(`${colors[level] || colors.info}${logMessage}${colors.reset}`);

        // File output
        if (this.logToFile) {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        }
    }

    error(component, message, data) {
        this._log('error', component, message, data);
    }

    warn(component, message, data) {
        this._log('warn', component, message, data);
    }

    info(component, message, data) {
        this._log('info', component, message, data);
    }

    debug(component, message, data) {
        if (this.logLevel === 'debug') {
            this._log('debug', component, message, data);
        }
    }
}

module.exports = new Logger(); 