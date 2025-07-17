const sensorLib = require("node-dht-sensor");

class SensorModule {
    constructor() { //Constructeur d'historique
        this.temperatureHistory = [];
        this.humidityHistory = [];
        this.maxHistorySize = 720; // 1 heure à 5s d'intervalle
        this.interval = 3000; // 3 secondes
        this.isRunning = false;
                this.sensor = { 
            name: "Capteur 1",
            type: 11,  // DHT11
            pin: 17
        };
    }

    start() { //Débute le programme
        if (this.isRunning) {
            console.log('Le programme fonctionne déjà');
            return;
        }
        
        this.isRunning = true;
        console.log(`Début de la lecture au ${this.interval}ms`);
        this.startReading();
    }

    stop() { //Arrête le programme
        if (this.readingInterval) {
            clearInterval(this.readingInterval);
            this.readingInterval = null;
        }
        this.isRunning = false;
        console.log('Programme arrêté');
    }

    startReading() { //Débute la lecture
        // Première lecture immédiate
        this.readSensor();
        
        // Puis lecture périodique
        this.readingInterval = setInterval(() => {
            this.readSensor();
        }, this.interval);
    }

    readSensor() { //Lit les sorties du capteur
        try {
            const readout = sensorLib.read(this.sensor.type, this.sensor.pin); 
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            
            if (readout.isValid) {
                const temperature = parseFloat(readout.temperature.toFixed(1)); //Transforme en Float la température et humidité
                const humidity = parseFloat(readout.humidity.toFixed(1));
                
                this.temperatureHistory.push([timestamp, temperature]);
                if (this.temperatureHistory.length > this.maxHistorySize) {
                    this.temperatureHistory.shift();
                }
                
                this.humidityHistory.push([timestamp, humidity]);
                if (this.humidityHistory.length > this.maxHistorySize) {
                    this.humidityHistory.shift();
                }
                
                console.log(
                    `[${this.sensor.name}] ${timestamp} - ` +
                    `Température: ${temperature}°C, ` +
                    `Humidité: ${humidity}%`
                );
            } else {
                console.error(`Lecture invalide ${timestamp}`);
            }
        } catch (error) {
            console.error(`Erreur de lecture: ${error.message}`);
        }
    }

    getLatestTemperature() { 
        return this.temperatureHistory.length > 0 ? 
               this.temperatureHistory[this.temperatureHistory.length - 1][1] : null;
    }

    getLatestHumidity() {
        return this.humidityHistory.length > 0 ? 
               this.humidityHistory[this.humidityHistory.length - 1][1] : null;
    }

    getLatestReading() {
        return {
            temperature: this.getLatestTemperature(),
            humidity: this.getLatestHumidity(),
            timestamp: this.temperatureHistory.length > 0 ? 
                      this.temperatureHistory[this.temperatureHistory.length - 1][0] : null
        };
    }

    getTemperatureHistory(n) {
        return this.temperatureHistory.slice(-n);
    }

    getHumidityHistory(n) {
        return this.humidityHistory.slice(-n);
    }

    getTemperatureAverage(n) {
        const history = this.getTemperatureHistory(n);
        if (history.length === 0) return null;
        
        const sum = history.reduce((acc, entry) => acc + entry[1], 0);
        return parseFloat((sum / history.length).toFixed(1));
    }

    getHumidityAverage(n) {
        const history = this.getHumidityHistory(n);
        if (history.length === 0) return null;
        
        const sum = history.reduce((acc, entry) => acc + entry[1], 0);
        return parseFloat((sum / history.length).toFixed(1));
    }

    getStats(n = 10) {
        return {
            latest: this.getLatestReading(),
            averages: {
                temperature: this.getTemperatureAverage(n),
                humidity: this.getHumidityAverage(n)
            },
            historySize: {
                temperature: this.temperatureHistory.length,
                humidity: this.humidityHistory.length
            }
        };
    }

    configureSensor(type, pin, name) {
        if (this.isRunning) {
            console.log('Le programme doit être arrêté avant de pouvoir configurer le capteur');
            return false;
        }
        
        this.sensor = { type, pin, name };
        console.log(`Capteur configuré: ${name} (Type: ${type}, Pin: ${pin})`);
        return true;
    }
}

module.exports = SensorModule;
