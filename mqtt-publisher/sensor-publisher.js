const SensorReader = require('../sensor-layer/sensor-reader');
const MQTTHelper = require('../shared/mqtt-helper');
const configLoader = require('../shared/config-loader');
const logger = require('../shared/logger');

class SensorPublisher {
    constructor() {
        this.config = configLoader.load();
        this.mqttClient = null;
        this.sensorReader = new SensorReader();
        this.isConnected = false;
        this.publishCount = { temperature: 0, humidity: 0 };
        
    }

    async start() {
        try {
            await this.connectMQTT();
            
            this.startSensorReading();
            
        } catch (error) {
            logger.error('PUBLISHER', `Erreur démarrage: ${error.message}`);
            throw error;
        }
    }

    async connectMQTT() {
        return new Promise((resolve, reject) => {
            this.mqttClient = MQTTHelper.createLocalClient();
            MQTTHelper.setupClientHandlers(this.mqttClient, 'PUBLISHER');
            
            const timeout = setTimeout(() => {
                reject(new Error('Timeout connexion MQTT'));
            }, 10000);

            this.mqttClient.on('connect', () => {
                clearTimeout(timeout);
                this.isConnected = true;
                resolve();
            });

            this.mqttClient.on('error', (error) => {
                clearTimeout(timeout);
                this.isConnected = false;
                reject(error);
            });

            this.mqttClient.on('close', () => {
                this.isConnected = false;
                setTimeout(() => this.connectMQTT().catch(() => {}), 5000);
            });
        });
    }

    startSensorReading() {
        this.sensorReader.onTemperatureData((temperature, timestamp) => {
            this.publishTemperature(temperature, timestamp);
        });

        this.sensorReader.onHumidityData((humidity, timestamp) => {
            this.publishHumidity(humidity, timestamp);
        });

        this.sensorReader.onError((error) => {
            logger.error('PUBLISHER', `Erreur capteur: ${error.message}`);
        });

        // Démarrer la lecture
        this.sensorReader.start();
    }

    publishTemperature(temperature, timestamp) {
        if (!this.isConnected) {
            logger.warn('PUBLISHER', 'MQTT non connecté');
            return;
        }

        try {
            const topics = configLoader.getTopics();
            const formattedTemp = MQTTHelper.formatSensorValue(temperature, 2);
            
            if (formattedTemp !== null) {
                this.mqttClient.publish(topics.temperature, formattedTemp);
                this.publishCount.temperature++;
                
                logger.info('PUBLISHER', ` Température publiée: ${formattedTemp}°C`, {
                    topic: topics.temperature,
                    count: this.publishCount.temperature
                });
            }
            
        } catch (error) {
            logger.error('PUBLISHER', `Erreur publication température: ${error.message}`);
        }
    }

    publishHumidity(humidity, timestamp) {
        if (!this.isConnected) {
            logger.warn('PUBLISHER', 'MQTT non connecté');
            return;
        }

        try {
            const topics = configLoader.getTopics();
            const formattedHumidity = MQTTHelper.formatSensorValue(humidity, 2);
            
            if (formattedHumidity !== null) {
                this.mqttClient.publish(topics.humidity, formattedHumidity);
                this.publishCount.humidity++;
                
                logger.info('PUBLISHER', `💧 Humidité publiée: ${formattedHumidity}%`, {
                    topic: topics.humidity,
                    count: this.publishCount.humidity
                });
            }
            
        } catch (error) {
            logger.error('PUBLISHER', `Erreur publication humidité: ${error.message}`);
        }
    }

    getStats() {
        return {
            mqtt: {
                connected: this.isConnected,
                teamNumber: this.config.teamNumber
            },
            sensor: this.sensorReader.getStats(),
            publishing: {
                counts: this.publishCount
            }
        };
    }

    stop() {
        if (this.sensorReader) {
            this.sensorReader.stop();
        }
        
        if (this.mqttClient) {
            this.mqttClient.end();
        }
        
        this.isConnected = false;
    }
}

const publisher = new SensorPublisher();

process.on('SIGINT', () => {
    console.log('\n Arrêt du publisher');
    publisher.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n Arrêt du publisher (SIGTERM)');
    publisher.stop();
    process.exit(0);
});

setInterval(() => {
    if (publisher.isConnected) {
        const stats = publisher.getStats();
        logger.info('PUBLISHER', 'Statistiques:', stats);
    }
}, 30000);

if (require.main === module) {
    publisher.start().catch((error) => {
        logger.error('PUBLISHER', `Erreur fatale: ${error.message}`);
        process.exit(1);
    });
}

module.exports = SensorPublisher;
