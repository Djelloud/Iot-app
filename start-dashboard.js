#!/usr/bin/env node



const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class IoTProductionLauncher {
    constructor() {
        this.processes = new Map();
        this.isShuttingDown = false;
        
        console.log(' Lanceur du Système IoT - Équipe 05');
    }

    spawnProcess(name, command, args, options = {}) {
        console.log(` Démarrage: ${name}`);
        
        const process = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            ...options
        });

        // Gestion des logs
        process.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(`[${name.toUpperCase()}] ${output}`);
            }
        });

        process.stderr.on('data', (data) => {
            const errorMsg = data.toString().trim();
            if (errorMsg && !errorMsg.includes('GPIO warning')) {
                console.log(`[${name.toUpperCase()}] ${errorMsg}`);
            }
        });

        process.on('close', (code) => {
            if (!this.isShuttingDown) {
                console.log(`  ${name} s'est arrêté avec le code ${code}`);
                this.processes.delete(name);
            }
        });

        process.on('error', (error) => {
            console.error(` Erreur ${name}: ${error.message}`);
            this.processes.delete(name);
        });

        this.processes.set(name, process);
        return process;
    }

    checkPrerequisites() {
        console.log('  Vérification des prérequis...');
        
        // Vérifier Node.js
        const nodeVersion = process.version;
        console.log(`  Node.js: ${nodeVersion}`);
        
        // Vérifier Python3
        try {
            const pythonCheck = spawn('python3', ['--version'], { stdio: 'pipe' });
            pythonCheck.on('close', (code) => {
                if (code === 0) {
                    console.log('  Python3: Disponible');
                } else {
                    console.log('  Python3: Non trouvé');
                }
            });
        } catch (error) {
            console.log('  Python3: Erreur de vérification');
        }
        
        // Vérifier les dossiers logs
        this.ensureLogsDirectory();
        
        console.log('  Prérequis vérifiés');
        console.log('');
    }


    ensureLogsDirectory() {
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
            console.log('Dossier logs créé');
        }
    }


    async startBackend() {
        console.log('  Démarrage du backend (production)...');
        console.log('');
        
        // Démarrer les capteurs
        this.startSensors();
        
        // Petit délai pour laisser les capteurs s'initialiser
        await this.delay(2000);
        
        // Démarrer les alertes
        this.startAlerts();
        
        console.log('');
        console.log('  Backend IoT démarré (production) !');
        console.log('   Capteurs: Publication GPIO active');
        console.log('  Alertes: Surveillance des messages RGB');
        console.log('  LED: Contrôle GPIO opérationnel');
    }


    startSensors() {
        const sensorPath = path.join(__dirname, 'sensor-layer', 'sensor-publisher.js');
        this.spawnProcess('SENSORS', 'node', [sensorPath]);
    }


    startAlerts() {
        const alertPath = path.join(__dirname, 'alert-system', 'alert-subscriber.js');
        this.spawnProcess('ALERTS', 'node', [alertPath]);
    }


    startFrontend() {
        console.log( Démarrage du frontend...');
        
        const frontendPath = path.join(__dirname, 'start-frontend-windows.js');
        this.spawnProcess('FRONTEND', 'node', [frontendPath]);
    }


    async testSystem() {
        console.log('  Test du système IoT...');
        
        // Test des capteurs
        console.log('  Test des capteurs...');
        const sensorTestPath = path.join(__dirname, 'sensor-layer', 'sensor-reader.js');
        this.spawnProcess('SENSOR-TEST', 'node', [sensorTestPath]);
        
        await this.delay(5000);
        
        // Test LED
        console.log('  Test de la LED...');
        const ledTestPath = path.join(__dirname, 'alert-system', 'python-scripts', 'led-control.py');
        
        // Test de couleurs
        const colors = [
            [255, 0, 0],   // Rouge
            [0, 255, 0],   // Vert
            [0, 0, 255],   // Bleu
            [0, 0, 0]      // Éteint
        ];
        
        for (const [r, g, b] of colors) {
            console.log(`  Test couleur: RGB(${r}, ${g}, ${b})`);
            this.spawnProcess('LED-TEST', 'python3', [ledTestPath, r.toString(), g.toString(), b.toString()]);
            await this.delay(1000);
        }
        
        console.log('  Tests terminés');
    }


    showHelp() {
        console.log(``);
    }


    async shutdown() {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        console.log('\  Arrêt du système IoT...');
        
        // Arrêter tous les processus
        for (const [name, process] of this.processes) {
            try {
                console.log(`  Arrêt: ${name}`);
                process.kill('SIGTERM');
                
                // Si le processus ne s'arrête pas, le forcer
                setTimeout(() => {
                    if (!process.killed) {
                        process.kill('SIGKILL');
                    }
                }, 3000);
                
            } catch (error) {
                console.log(`  Erreur arrêt ${name}: ${error.message}`);
            }
        }
        
        // Éteindre la LED
        try {
            const ledPath = path.join(__dirname, 'alert-system', 'python-scripts', 'led-control.py');
            spawn('python3', [ledPath, '0', '0', '0'], { stdio: 'ignore' });
        } catch (error) {
            // Ignore errors during shutdown
        }
        
        await this.delay(1000);
        console.log('  Système arrêté proprement');
        process.exit(0);
    }


    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Point d'entrée principal
async function main() {
    const launcher = new IoTProductionLauncher();
    
    // Gestion des signaux d'arrêt
    process.on('SIGINT', () => launcher.shutdown());
    process.on('SIGTERM', () => launcher.shutdown());
    
    // Parser les arguments
    const args = process.argv.slice(2);
    
    try {
        // Vérifier les prérequis
        launcher.checkPrerequisites();
        
        if (args.includes('--help')) {
            launcher.showHelp();
            return;
        }
        
        if (args.includes('--test')) {
            await launcher.testSystem();
            return;
        }
        
        if (args.includes('--frontend-only')) {
            launcher.startFrontend();
            return;
        }
        
        if (args.includes('--backend-only')) {
            await launcher.startBackend();
        } else {
            // Démarrage complet par défaut
            await launcher.startBackend();
            
        }
        

    } catch (error) {
        console.error(' Erreur fatale:', error.message);
        await launcher.shutdown();
        process.exit(1);
    }
}

// Lancer le programme
if (require.main === module) {
    main().catch(console.error);
} 
