class MQTTDualClient {
    constructor() {
        this.localClient = null;
        this.hivemqClient = null;
        this.isLocalConnected = false;
        this.isHivemqConnected = false;
        this.connectionAttempts = { local: 0, hivemq: 0 };
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        
        this.config = {
            local: {
                host: '192.168.2.33',
                port: 9001,
                clientId: `dashboard_local_${Math.random().toString(16).substr(2, 8)}`,
                topics: {
                    temperature: 'GTI700/Data/E2025/+/temperature',  
                    humidity: 'GTI700/Data/E2025/+/humidite'        
                }
            },
            hivemq: {
                host: 'broker.hivemq.com',
                port: 8000,
                clientId: `dashboard_hivemq_${Math.random().toString(16).substr(2, 8)}`,
                topics: {
                    alerts: 'GTI700/Alerts/E2025/+'  
                }
            }
        };
        
        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onMessage: [],
            onError: [],
            onTemperature: [],
            onHumidity: [],
            onAlert: []
        };
        
        this.messageCount = { local: 0, hivemq: 0 };
        this.startTime = Date.now();
        
        this.log('Client MQTT Dual initialisé', 'info');
    }

    async connectAll() {
        try {
            this.log('Connexion aux deux brokers MQTT...', 'info');
            
            // Connexions en parallèle
            const promises = [
                this.connectLocal(),
                this.connectHiveMQ()
            ];
            
            await Promise.allSettled(promises);
            
            const status = this.getConnectionStatus();
            this.log(`Statut connexions: Local=${status.local}, HiveMQ=${status.hivemq}`, 'info');
            
            this.updateConnectionUI();
            
        } catch (error) {
            this.log(`Erreur connexion globale: ${error.message}`, 'error');
        }
    }


    async connectLocal() {
        return new Promise((resolve, reject) => {
            try {
                const brokerUrl = `ws://${this.config.local.host}:${this.config.local.port}`;
                this.log(`Connexion broker local: ${brokerUrl}`, 'info');
                
                const options = {
                    clientId: this.config.local.clientId,
                    clean: true,
                    connectTimeout: 10000,
                    keepalive: 60
                };

                this.localClient = mqtt.connect(brokerUrl, options);
                
                this.localClient.on('connect', () => {
                    this.isLocalConnected = true;
                    this.connectionAttempts.local = 0;
                    this.log(' Connecté au broker LOCAL', 'success');
                    
                    // Sabonner aux topics capteurs
                    this.subscribeLocalTopics();
                    this.emit('onConnect', 'local');
                    resolve();
                });

                this.localClient.on('message', (topic, message) => {
                    this.handleLocalMessage(topic, message);
                });

                this.localClient.on('error', (error) => {
                    this.log(` Erreur broker LOCAL: ${error.message}`, 'error');
                    this.emit('onError', { broker: 'local', error });
                    reject(error);
                });

                this.localClient.on('close', () => {
                    this.isLocalConnected = false;
                    this.log(' Broker LOCAL déconnecté', 'warn');
                    this.emit('onDisconnect', 'local');
                    this.updateConnectionUI();
                });

            } catch (error) {
                this.log(` Erreur connexion locale: ${error.message}`, 'error');
                reject(error);
            }
        });
    }


    async connectHiveMQ() {
        return new Promise((resolve, reject) => {
            try {
                const brokerUrl = `ws://${this.config.hivemq.host}:${this.config.hivemq.port}/mqtt`;
                this.log(` Connexion broker HiveMQ: ${brokerUrl}`, 'info');
                
                const options = {
                    clientId: this.config.hivemq.clientId,
                    clean: true,
                    connectTimeout: 15000,
                    keepalive: 60
                };

                this.hivemqClient = mqtt.connect(brokerUrl, options);
                
                this.hivemqClient.on('connect', () => {
                    this.isHivemqConnected = true;
                    this.connectionAttempts.hivemq = 0;
                    this.log(' Connecté au broker HIVEMQ', 'success');
                    
                    // S'abonner aux topics alertes
                    this.subscribeHiveMQTopics();
                    this.emit('onConnect', 'hivemq');
                    resolve();
                });

                this.hivemqClient.on('message', (topic, message) => {
                    this.handleHiveMQMessage(topic, message);
                });

                this.hivemqClient.on('error', (error) => {
                    this.log(` Erreur broker HIVEMQ: ${error.message}`, 'error');
                    this.emit('onError', { broker: 'hivemq', error });
                    reject(error);
                });

                this.hivemqClient.on('close', () => {
                    this.isHivemqConnected = false;
                    this.log(' Broker HIVEMQ déconnecté', 'warn');
                    this.emit('onDisconnect', 'hivemq');
                    this.updateConnectionUI();
                });

            } catch (error) {
                this.log(` Erreur connexion HiveMQ: ${error.message}`, 'error');
                reject(error);
            }
        });
    }

    /**
     * S'abonner aux topics du broker local
     */
    subscribeLocalTopics() {
        const topics = Object.values(this.config.local.topics);
        
        topics.forEach(topic => {
            this.localClient.subscribe(topic, { qos: 1 }, (error) => {
                if (error) {
                    this.log(` Erreur souscription locale ${topic}: ${error.message}`, 'error');
                } else {
                    this.log(` Souscrit LOCAL: ${topic}`, 'info');
                }
            });
        });
    }

    /**
     * S'abonner aux topics du broker HiveMQ
     */
    subscribeHiveMQTopics() {
        const topics = Object.values(this.config.hivemq.topics);
        
        topics.forEach(topic => {
            this.hivemqClient.subscribe(topic, { qos: 1 }, (error) => {
                if (error) {
                    this.log(` Erreur souscription HiveMQ ${topic}: ${error.message}`, 'error');
                } else {
                    this.log(` Souscrit HIVEMQ: ${topic}`, 'info');
                }
            });
        });
    }

    handleLocalMessage(topic, message) {
        try {
            this.messageCount.local++;
            const messageStr = message.toString();
            const timestamp = new Date();
            
            this.log(` LOCAL: ${topic} = ${messageStr}`, 'debug');
            
            // Extraire le numéro d'équipe du topic
            const teamMatch = topic.match(/E2025\/(\d+)/);
            const teamNumber = teamMatch ? teamMatch[1] : 'XX';
            
            if (topic.includes('/temperature')) {
                this.handleTemperatureMessage(messageStr, timestamp, teamNumber);
            } else if (topic.includes('/humidite')) {
                this.handleHumidityMessage(messageStr, timestamp, teamNumber);
            }
            
        } catch (error) {
            this.log(` Erreur traitement message local: ${error.message}`, 'error');
        }
    }

    /**
     * Gérer les messages du broker HiveMQ
     */
    handleHiveMQMessage(topic, message) {
        try {
            this.messageCount.hivemq++;
            const messageStr = message.toString();
            const timestamp = new Date();
            
            this.log(` HIVEMQ: ${topic} = ${messageStr}`, 'debug');
            
            // Extraire le numéro d'équipe du topic
            const teamMatch = topic.match(/E2025\/(\d+)/);
            const teamNumber = teamMatch ? teamMatch[1] : 'XX';
            
            // Traiter les alertes
            if (topic.includes('/Alerts/')) {
                this.handleAlertMessage(messageStr, timestamp, teamNumber);
            }
            
        } catch (error) {
            this.log(`Erreur traitement message HiveMQ: ${error.message}`, 'error');
        }
    }

    /**
     * Traiter les messages de température
     */
    handleTemperatureMessage(message, timestamp, teamNumber) {
        try {
            const temperature = parseFloat(message);
            
            if (!isNaN(temperature)) {
                this.emit('onTemperature', {
                    teamNumber,
                    value: temperature,
                    timestamp,
                    broker: 'local'
                });
                
                this.log(`Température équipe ${teamNumber}: ${temperature}°C`, 'info');
            } else {
                this.log(`Température invalide: ${message}`, 'warn');
            }
            
        } catch (error) {
            this.log(`Erreur parsing température: ${error.message}`, 'error');
        }
    }

    /**
     * Traiter les messages d'humidité
     */
    handleHumidityMessage(message, timestamp, teamNumber) {
        try {
            const humidity = parseFloat(message);
            
            if (!isNaN(humidity)) {
                this.emit('onHumidity', {
                    teamNumber,
                    value: humidity,
                    timestamp,
                    broker: 'local'
                });
                
                this.log(` Humidité équipe ${teamNumber}: ${humidity}%`, 'info');
            } else {
                this.log(`Humidité invalide: ${message}`, 'warn');
            }
            
        } catch (error) {
            this.log(` Erreur parsing humidité: ${error.message}`, 'error');
        }
    }

    /**
     * Traiter les messages d'alerte
     */
    handleAlertMessage(message, timestamp, teamNumber) {
        try {
            // Format attendu: "R;G;B" (ex: "255;0;0")
            const rgbValues = message.split(';');
            
            if (rgbValues.length === 3) {
                const r = parseInt(rgbValues[0]);
                const g = parseInt(rgbValues[1]);
                const b = parseInt(rgbValues[2]);
                
                if (this.isValidRGB(r, g, b)) {
                    this.emit('onAlert', {
                        teamNumber,
                        rgb: { r, g, b },
                        timestamp,
                        hexColor: this.rgbToHex(r, g, b),
                        broker: 'hivemq'
                    });
                    
                    this.log(` Alerte équipe ${teamNumber}: RGB(${r}, ${g}, ${b}) via HiveMQ`, 'warn');
                } else {
                    this.log(` Valeurs RGB invalides: ${message}`, 'warn');
                }
            } else {
                this.log(`Format alerte invalide: ${message}`, 'warn');
            }
            
        } catch (error) {
            this.log(`Erreur parsing alerte: ${error.message}`, 'error');
        }
    }

    /**
     * Valider les valeurs RGB
     */
    isValidRGB(r, g, b) {
        return [r, g, b].every(val => 
            !isNaN(val) && val >= 0 && val <= 255
        );
    }

    /**
     * Convertir RGB en hexadécimal
     */
    rgbToHex(r, g, b) {
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    }

    /**
     * Ajouter un callback pour les événements
     */
    on(eventName, callback) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].push(callback);
        }
    }

    /**
     * Émettre un événement
     */
    emit(eventName, data) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log(`Erreur callback ${eventName}: ${error.message}`, 'error');
                }
            });
        }
    }

    /**
     * Obtenir le statut des connexions
     */
    getConnectionStatus() {
        return {
            local: this.isLocalConnected,
            hivemq: this.isHivemqConnected,
            both: this.isLocalConnected && this.isHivemqConnected
        };
    }

    /**
     * Mettre à jour l'interface de connexion
     */
    updateConnectionUI() {
        const status = this.getConnectionStatus();
        const statusElement = document.getElementById('connectionStatus');
        
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            
            if (status.both) {
                statusElement.className = 'status connected';
                icon.className = 'fas fa-wifi';
                statusElement.childNodes[1].textContent = ' Connecté (Local + HiveMQ)';
            } else if (status.local || status.hivemq) {
                statusElement.className = 'status connecting';
                icon.className = 'fas fa-wifi';
                statusElement.childNodes[1].textContent = ` Partiel (L:${status.local ? '✓' : '✗'} H:${status.hivemq ? '✓' : '✗'})`;
            } else {
                statusElement.className = 'status disconnected';
                icon.className = 'fas fa-wifi';
                statusElement.childNodes[1].textContent = ' Déconnecté';
            }
        }
    }

    /**
     * Déconnecter tous les brokers
     */
    disconnectAll() {
        if (this.localClient) {
            this.localClient.end();
            this.isLocalConnected = false;
        }
        
        if (this.hivemqClient) {
            this.hivemqClient.end();
            this.isHivemqConnected = false;
        }
        
        this.log(' Déconnexion de tous les brokers', 'info');
        this.updateConnectionUI();
    }

    /**
     * Obtenir les statistiques
     */
    getStats() {
        return {
            connections: this.getConnectionStatus(),
            messages: this.messageCount,
            uptime: Date.now() - this.startTime,
            clientIds: {
                local: this.config.local.clientId,
                hivemq: this.config.hivemq.clientId
            }
        };
    }

    /**
     * Logger avec timestamp
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [MQTT-DUAL]`;
        
        switch (level) {
            case 'error':
                console.error(`${prefix}  ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix}  ${message}`);
                break;
            case 'success':
                console.log(`${prefix}  ${message}`);
                break;
            case 'debug':
                console.debug(`${prefix}  ${message}`);
                break;
            case 'info':
            default:
                console.log(`${prefix}  ${message}`);
                break;
        }
    }
}

// Exporter pour utilisation globale
window.MQTTDualClient = MQTTDualClient; 