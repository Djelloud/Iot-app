const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');
const configLoader = require('../shared/config-loader');

class LEDController {
    constructor() {
        this.config = configLoader.load();
        this.currentColor = { r: 0, g: 0, b: 0 };
        this.isInitialized = false;
        
        this.pythonScriptPath = path.join(__dirname, 'python-scripts', 'led-control.py');
        this.ensurePythonScript();
    }

    ensurePythonScript() {
        const scriptDir = path.dirname(this.pythonScriptPath);
        
        if (!fs.existsSync(scriptDir)) {
            fs.mkdirSync(scriptDir, { recursive: true });
        }

        if (!fs.existsSync(this.pythonScriptPath)) {
            logger.warn('LED-CTRL', 'S');
        }
    }

    async initialize() {
        try {
            await this.setColor(0, 0, 0);
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            logger.error('LED-CTRL', `Erreur init LED: ${error.message}`);
            return false;
        }
    }

    async setColor(r, g, b) {
        if (!this.isValidRGB(r, g, b)) {
            const error = new Error(`Valeurs RGB invalides: (${r}, ${g}, ${b})`);
            logger.error('LED-CTRL', error.message);
            throw error;
        }

        return await this.setColorHardware(r, g, b);
    }

    async setColorHardware(r, g, b) {
        return new Promise((resolve, reject) => {
            try {
                const pythonCommand = this.isWindows ? 'python' : 'python3';
                
                const pythonProcess = spawn(pythonCommand, [this.pythonScriptPath, r.toString(), g.toString(), b.toString()]);
                
                let output = '';
                let errorOutput = '';

                pythonProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                    if (data.toString().includes('mode simulation')) {
                        logger.info('LED-CTRL', 'sim activ');
                    }
                });

                pythonProcess.on('close', (code) => {
                    if (code === 0) {
                        this.currentColor = { r, g, b };
                        logger.info('LED-CTRL', ` LED: RGB(${r}, ${g}, ${b})`);
                        resolve({ success: true, color: this.currentColor, output: output.trim() });
                    } else {
                        const error = new Error(`Script Python code ${code}: ${errorOutput}`);
                        logger.error('LED-CTRL', error.message);
                        reject(error);
                    }
                });

                pythonProcess.on('error', (error) => {
                    logger.error('LED-CTRL', `Erreur py: ${error.message}`);
                    reject(error);
                });

            } catch (error) {
                logger.error('LED-CTRL', `Erreur setColor: ${error.message}`);
                reject(error);
            }
        });
    }

    isValidRGB(r, g, b) {
        return Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b) &&
               r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
    }

    async setColorFromMQTTMessage(message) {
        try {
            const rgbValues = message.toString().split(';');
            
            if (rgbValues.length !== 3) {
                throw new Error(`Format MQTT invalide: ${message}. Attendu: "R;G;B"`);
            }

            const r = parseInt(rgbValues[0]);
            const g = parseInt(rgbValues[1]);
            const b = parseInt(rgbValues[2]);

            return await this.setColor(r, g, b);

        } catch (error) {
            logger.error('LED-CTRL', `Erreur parsing message MQTT: ${error.message}`);
            throw error;
        }
    }

    async testLED() {
        try {
            logger.info('LED-CTRL', 'testled');
            
            const testColors = [
                { name: 'Rouge', r: 255, g: 0, b: 0 },
                { name: 'Vert', r: 0, g: 255, b: 0 },
                { name: 'Bleu', r: 0, g: 0, b: 255 },
                { name: 'Jaune', r: 255, g: 255, b: 0 },
                { name: 'Magenta', r: 255, g: 0, b: 255 },
                { name: 'Cyan', r: 0, g: 255, b: 255 },
                { name: 'Blanc', r: 255, g: 255, b: 255 },
                { name: 'Éteint', r: 0, g: 0, b: 0 }
            ];

            for (const color of testColors) {
                logger.info('LED-CTRL', ` Test: ${color.name}`);
                await this.setColor(color.r, color.g, color.b);
                await this.delay(800); 
            }

            return true;

        } catch (error) {
            logger.error('LED-CTRL', `Erreur test LED: ${error.message}`);
            return false;
        }
    }

  
    async turnOff() {
        return await this.setColor(0, 0, 0);
    }

    getCurrentColor() {
        return { ...this.currentColor };
    }

    getStats() {
        return {
            isInitialized: this.isInitialized,
            currentColor: this.currentColor,
            mode: 'hardware',
            platform: 'linux'
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        try {

            await this.turnOff();
            
            logger.info('LED-CTRL', ' LED éteinte');
        } catch (error) {
            logger.error('LED-CTRL', `Erreur cleanup: ${error.message}`);
        }
    }
}

module.exports = LEDController;
