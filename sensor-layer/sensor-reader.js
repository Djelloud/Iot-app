const SensorModule = require('./sensor_module'); 
const configLoader = require('../shared/config-loader');
const logger = require('../shared/logger');

class SensorReader {
    constructor() {
        this.config = configLoader.load();
        this.sensorModule = new SensorModule();
        this.callbacks = {
            onTemperature: null,
            onHumidity: null,
            onError: null
        };
        

        if (this.config.sensor) {
            this.sensorModule.configureSensor(
                this.config.sensor.type,
                this.config.sensor.pin,
                this.config.sensor.name
            );
        }
    }

    start() {
        this.sensorModule.start();

        this.monitoringInterval = setInterval(() => {
            this.checkForNewData();
        }, 1000);
    }

    stop() {
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        if (this.sensorModule) {
            this.sensorModule.stop();
        }
    }

    checkForNewData() {
        try {
            const latest = this.sensorModule.getLatestReading();
            
            if (latest.temperature !== null && this.callbacks.onTemperature) {
                this.callbacks.onTemperature(latest.temperature, latest.timestamp);
            }
            
            if (latest.humidity !== null && this.callbacks.onHumidity) {
                this.callbacks.onHumidity(latest.humidity, latest.timestamp);
            }
            
        } catch (error) {
            logger.error('SENSOR', `Erreur lecture capteur: ${error.message}`);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        }
    }

    onTemperatureData(callback) {
        this.callbacks.onTemperature = callback;
    }

    onHumidityData(callback) {
        this.callbacks.onHumidity = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    getLatestTemperature() {
        return this.sensorModule.getLatestTemperature();
    }

    getLatestHumidity() {
        return this.sensorModule.getLatestHumidity();
    }

    getStats() {
        return this.sensorModule.getStats();
    }

    getHistory(n = 10) {
        return {
            temperature: this.sensorModule.getTemperatureHistory(n),
            humidity: this.sensorModule.getHumidityHistory(n)
        };
    }
}

module.exports = SensorReader;
