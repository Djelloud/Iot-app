const MQTTHelper = require('../shared/mqtt-helper');
const configLoader = require('../shared/config-loader');
const logger = require('../shared/logger');
const { spawn } = require('child_process');
const LEDController = require('./led-controller'); 

class AlertSubscriber {
    constructor() {
        this.config = configLoader.load();
        this.client = null;
        this.isConnected = false;
        this.alertCount = 0;
        this.ledController = new LEDController();
    }

    async start() {
        try {
            await this.ledController.initialize();
            
            await this.connectHiveMQ();
            this.subscribeToAlerts();
        } catch (error) {
            logger.error('ALERT', `Erreur démarrage: ${error.message}`);
            throw error;
        }
    }

    async connectHiveMQ() {
        return new Promise((resolve, reject) => {
            this.client = MQTTHelper.createHiveMQClient();
            MQTTHelper.setupClientHandlers(this.client, 'ALERT');
            
            const timeout = setTimeout(() => {
                reject(new Error('Timeout connexion HiveMQ'));
            }, 15000);

            this.client.on('connect', () => {
                clearTimeout(timeout);
                this.isConnected = true;
                resolve();
            });

            this.client.on('message', (topic, message) => {
                this.handleAlertMessage(topic, message);
            });

            this.client.on('error', (error) => {
                clearTimeout(timeout);
                this.isConnected = false;
                reject(error);
            });

            this.client.on('close', () => {
                this.isConnected = false;
                setTimeout(() => this.connectHiveMQ().catch(() => {}), 5000);
            });
        });
    }

    subscribeToAlerts() {
        const topics = configLoader.getTopics();
        this.client.subscribe(topics.alerts, (error) => {
            if (error) {
                logger.error('ALERT', `Erreur souscription: ${error.message}`);
            }
        });
    }

    handleAlertMessage(topic, message) {
        try {
            const rgb = MQTTHelper.parseRGBMessage(message);
            if (rgb) {
                this.alertCount++;
                logger.info('ALERT', `Alerte reçue: RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`, {
                    count: this.alertCount
                });
                this.setLEDColor(rgb.r, rgb.g, rgb.b);
            }
        } catch (error) {
            logger.error('ALERT', `Erreur traitement alerte: ${error.message}`);
        }
    }

    async setLEDColor(r, g, b) {
        try {
            logger.info('ALERT', `Définition LED: RGB(${r}, ${g}, ${b})`);
            
            // Utiliser LEDController au lieu du code commenté
            const result = await this.ledController.setColor(r, g, b);
            
            if (result.success) {
                logger.info('ALERT', `LED allumée avec succès: RGB(${r}, ${g}, ${b})`);
            }
            
        } catch (error) {
            logger.error('ALERT', ` Erreur contrôle LED: ${error.message}`);
        }
    }

    async stop() {

        if (this.ledController) {
            await this.ledController.cleanup();
        }
        
        if (this.client) {
            this.client.end();
        }
        this.isConnected = false;
    }
}

module.exports = AlertSubscriber;

// Démarrage si appelé directement
if (require.main === module) {
    const subscriber = new AlertSubscriber();
    subscriber.start().catch(console.error);
}
