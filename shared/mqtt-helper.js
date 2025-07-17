const mqtt = require('mqtt');
const configLoader = require('./config-loader');
const logger = require('./logger');

class MQTTHelper {
    static createLocalClient() {
        const config = configLoader.load();
        const brokerUrl = `mqtt://${config.mqtt.local.host}:${config.mqtt.local.port}`;
        
        logger.info('MQTT-HELPER', `Connexion au courtier local: ${brokerUrl}`);
        return mqtt.connect(brokerUrl);
    }

    static createHiveMQClient() {
        const config = configLoader.load();
        const brokerUrl = `mqtt://${config.mqtt.hivemq.host}:${config.mqtt.hivemq.port}`;
        
        logger.info('MQTT-HELPER', `Connexion à HiveMQ: ${brokerUrl}`);
        return mqtt.connect(brokerUrl);
    }

    static formatSensorValue(value, decimals = 2) {
        if (typeof value !== 'number' || isNaN(value)) {
            logger.warn('MQTT-HELPER', `Valeur capteur invalide: ${value}`);
            return null;
        }
        return value.toFixed(decimals);
    }

    static parseRGBMessage(message) {
        try {
            const rgbValues = message.toString().split(';');
            if (rgbValues.length !== 3) {
                throw new Error('Format RGB invalide');
            }

            const r = parseInt(rgbValues[0]);
            const g = parseInt(rgbValues[1]);
            const b = parseInt(rgbValues[2]);

            if (isNaN(r) || isNaN(g) || isNaN(b) || 
                r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
                throw new Error('Valeurs RGB hors limites');
            }

            return { r, g, b };
        } catch (error) {
            logger.error('MQTT-HELPER', `Erreur parsing RGB: ${error.message}`);
            return null;
        }
    }

    static setupClientHandlers(client, componentName) {
        client.on('connect', () => {
            logger.info(componentName, 'Connecté au courtier MQTT');
        });

        client.on('error', (error) => {
            logger.error(componentName, `Erreur MQTT: ${error.message}`);
        });

        client.on('close', () => {
            logger.warn(componentName, 'Connexion MQTT fermée');
        });

        client.on('reconnect', () => {
            logger.info(componentName, 'Reconnexion MQTT...');
        });

        return client;
    }
}

module.exports = MQTTHelper;
