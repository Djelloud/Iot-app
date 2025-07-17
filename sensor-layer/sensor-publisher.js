const SensorReader = require('../sensor-layer/sensor-reader');
const MQTTHelper = require('../shared/mqtt-helper');
const configLoader = require('../shared/config-loader');
const logger = require('../shared/logger');

class SensorPublisher {
    constructor() {
        this.config = configLoader.load();
        this.mqttClient = null;
        this.sensorReader = null;
        this.isConnected = false;
        this.lastTemperature = null;
        this.lastHumidity = null;
        this.publishCount = { temperature: 0, humidity: 0 };
        
    }

    async start() {
        try {
            await this.connectMQTT();
            this.startSensorReading();
            
        } catch (error) {
            logger.error('PUBLISHER', `Erreur start: ${error.message}`);
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
                logger.warn('PUBLISHER', 'Connexion MQTT fermée, retrying');
                setTimeout(() => this.connectMQTT().catch(() => {}), 5000);
            });
        });
    }

    startSensorReading() {
        this.sensorReader = new SensorReader();
        this.lastPublishTime = { temperature: 0, humidity: 0 };
        const publishInterval = 5000; 
        
        this.sensorReader.onTemperatureData((temperature, timestamp) => {
            const now = Date.now();
            const shouldPublish = (
                temperature !== this.lastTemperature || 
                (now - this.lastPublishTime.temperature) > publishInterval
            );
            
            if (shouldPublish) {
                this.publishTemperature(temperature, timestamp);
                this.lastTemperature = temperature;
                this.lastPublishTime.temperature = now;
            }
        });

        this.sensorReader.onHumidityData((humidity, timestamp) => {
            const now = Date.now();
            const shouldPublish = (
                humidity !== this.lastHumidity || 
                (now - this.lastPublishTime.humidity) > publishInterval
            );
            
            if (shouldPublish) {
                this.publishHumidity(humidity, timestamp);
                this.lastHumidity = humidity;
                this.lastPublishTime.humidity = now;
            }
        });

        this.sensorReader.onError((error) => {
            logger.error('PUBLISHER', `Erreur capteur: ${error.message}`);
        });

        this.sensorReader.start();
    }



    publishTemperature(temperature, timestamp) {
        if (!this.isConnected) {
            logger.warn('PUBLISHER', 'MQTT non connecté, impossible de publier temp');
            return;
        }

        try {
            const topics = configLoader.getTopics();
            const formattedTemp = MQTTHelper.formatSensorValue(temperature, 2);
            
            if (formattedTemp !== null) {
                this.mqttClient.publish(topics.temperature, formattedTemp);
                this.publishCount.temperature++;
            }
            
        } catch (error) {
            logger.error('PUBLISHER', `Erreur publication température: ${error.message}`);
        }
    }

    publishHumidity(humidity, timestamp) {
        if (!this.isConnected) {
            logger.warn('PUBLISHER', 'MQTT non connecté, impossible de publier hum');
            return;
        }

        try {
            const topics = configLoader.getTopics();
            const formattedHumidity = MQTTHelper.formatSensorValue(humidity, 2);
            
            if (formattedHumidity !== null) {
                this.mqttClient.publish(topics.humidity, formattedHumidity);
                this.publishCount.humidity++;
                
            }
            
        } catch (error) {
            logger.error('PUBLISHER', `Erreur publication humidité: ${error.message}`);
        }
    }

    getStats() {
        const baseStats = {
            mqtt: {
                connected: this.isConnected,
                teamNumber: this.config.teamNumber
            },
            publishing: {
                counts: this.publishCount,
                latest: {
                    temperature: this.lastTemperature,
                    humidity: this.lastHumidity
                }
            },
            mode: 'hardware',
            platform: 'linux'
        };

        if (this.sensorReader) {
            baseStats.sensor = this.sensorReader.getStats();
        }

        return baseStats;
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

// boot
const publisher = new SensorPublisher();

process.on('SIGINT', () => {
    console.log('\n Arrêt du publisher...');
    publisher.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n Arrêt du publisher (SIGTERM)...');
    publisher.stop();
    process.exit(0);
});

// Afficher les statistiques toutes les 30 secondes
setInterval(() => {
    if (publisher.isConnected) {
        const stats = publisher.getStats();
        logger.info('PUBLISHER', ' Statistiques:', stats);
    }
}, 30000);

// Démarrer le publisher
if (require.main === module) {
    publisher.start().catch((error) => {
        logger.error('PUBLISHER', `Erreur fatale: ${error.message}`);
        process.exit(1);
    });
}

module.exports = SensorPublisher;
