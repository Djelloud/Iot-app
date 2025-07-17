
const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor() {
        this.config = null;
        this.configPath = path.join(__dirname, '../config/team-config.json');
    }

    load() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log(`Configuration chargée pour équipe ${this.config.teamNumber}`);
            return this.config;
        } catch (error) {
            console.error('Erreur chargement configuration:', error.message);
            throw error;
        }
    }

    get(key) {
        if (!this.config) {
            this.load();
        }
        
        
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return null;
            }
        }
        
        return value;
    }

    getTopics() {
        const teamNumber = this.get('teamNumber');
        return {
            temperature: `GTI700/Data/E2025/${teamNumber}/temperature`,
            humidity: `GTI700/Data/E2025/${teamNumber}/humidite`,
            alerts: `GTI700/Alerts/E2025/${teamNumber}`
        };
    }
}

module.exports = new ConfigLoader(); 