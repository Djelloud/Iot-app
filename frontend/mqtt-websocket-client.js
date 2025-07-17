class MQTTWebSocketClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 3000;
        this.autoReconnect = true;
        
        // Configuration par défaut
        this.config = {
            host: '192.168.2.33',
            port: 9001,
            clientId: `dashboard_${Math.random().toString(16).substr(2, 8)}`,
            topics: {
                temperature: 'GTI700/Data/E2025/+/temperature',
                humidity: 'GTI700/Data/E2025/+/humidite',
                alerts: 'GTI700/Alerts/E2025/+'
            }
        };
        
        // Callbacks pour les événements
        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onMessage: [],
            onError: [],
            onTemperature: [],
            onHumidity: [],
            onAlert: []
        };
        
        this.messageCount = 0;
        this.startTime = Date.now();
        
        this.log('Client MQTT WebSocket initialisé', 'info');
    }

   
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        } else {
            this.log(`Événement inconnu: ${event}`, 'warn');
        }
    }

    emit(event, ...args) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    this.log(`Erreur callback ${event}: ${error.message}`, 'error');
                }
            });
        }
    }

    
    //  Se connecter au broker MQTT
     
    connect(host = null, port = null) {
        if (host) this.config.host = host;
        if (port) this.config.port = port;
        
        if (this.isConnected) {
            this.log('Déjà connecté au broker MQTT', 'warn');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                const brokerUrl = `ws://${this.config.host}:${this.config.port}`;
                this.log(`Tentative de connexion à ${brokerUrl}`, 'info');
   
                const options = {
                    clientId: this.config.clientId,
                    clean: true,
                    connectTimeout: 10000,
                    reconnectPeriod: 0,
                    keepalive: 60,
                    will: {
                        topic: 'GTI700/Status/Dashboard',
                        payload: JSON.stringify({
                            status: 'offline',
                            timestamp: new Date().toISOString(),
                            clientId: this.config.clientId
                        }),
                        qos: 1,
                        retain: false
                    }
                };

                this.client = mqtt.connect(brokerUrl, options);
                

                this.client.on('connect', () => {
                    this.isConnected = true;
                    this.connectionAttempts = 0;
                    
                    this.log('Connecté au broker MQTT', 'success');
                    this.updateConnectionStatus('connected');
                    
                    // Publier le statut en ligne
                    this.publishStatus('online');
                    
                    // S'abonner aux topics
                    this.subscribeToTopics();
                    
                    this.emit('onConnect');
                    resolve();
                });

                this.client.on('message', (topic, message) => {
                    this.handleMessage(topic, message);
                });

                this.client.on('error', (error) => {
                    this.log(`Erreur MQTT: ${error.message}`, 'error');
                    this.updateConnectionStatus('disconnected');
                    this.emit('onError', error);
                    reject(error);
                });

                this.client.on('close', () => {
                    this.isConnected = false;
                    this.log('🔌 Connexion MQTT fermée', 'warn');
                    this.updateConnectionStatus('disconnected');
                    this.emit('onDisconnect');
                    
                    //reconnexion automatique
                    if (this.autoReconnect && this.connectionAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect();
                    }
                });

                this.client.on('reconnect', () => {
                    this.connectionAttempts++;
                    this.log(`Tentative de reconnexion ${this.connectionAttempts}/${this.maxReconnectAttempts}`, 'info');
                    this.updateConnectionStatus('connecting');
                });

            } catch (error) {
                this.log(`Erreur connexion: ${error.message}`, 'error');
                this.updateConnectionStatus('disconnected');
                reject(error);
            }
        });
    }

    
    //  S'abonner aux topics MQTT
     
    subscribeToTopics() {
        const topics = Object.values(this.config.topics);
        
        topics.forEach(topic => {
            this.client.subscribe(topic, { qos: 1 }, (error) => {
                if (error) {
                    this.log(`Erreur souscription ${topic}: ${error.message}`, 'error');
                } else {
                    this.log(`Souscrit à ${topic}`, 'info');
                }
            });
        });
    }

    
     // Gérer les messages reçus
     
    handleMessage(topic, message) {
        try {
            this.messageCount++;
            const messageStr = message.toString();
            const timestamp = new Date();
            
            this.log(` Message reçu: ${topic} = ${messageStr}`, 'debug');
            
       
            const teamMatch = topic.match(/E2025\/(\d+)/);
            const teamNumber = teamMatch ? teamMatch[1] : 'XX';
 
            if (topic.includes('/temperature')) {
                this.handleTemperatureMessage(messageStr, timestamp, teamNumber);
            } else if (topic.includes('/humidite')) {
                this.handleHumidityMessage(messageStr, timestamp, teamNumber);
            } else if (topic.includes('/Alerts/')) {
                this.handleAlertMessage(messageStr, timestamp, teamNumber);
            }
            

            this.emit('onMessage', {
                topic,
                message: messageStr,
                timestamp,
                teamNumber
            });
            
        } catch (error) {
            this.log(`Erreur traitement message: ${error.message}`, 'error');
        }
    }

    
     //Traiter les messages de température
     
    handleTemperatureMessage(value, timestamp, teamNumber) {
        const temperature = parseFloat(value);
        
        if (!isNaN(temperature)) {
            this.emit('onTemperature', {
                value: temperature,
                timestamp,
                teamNumber,
                unit: '°C'
            });
            
            this.log(`Température équipe ${teamNumber}: ${temperature}°C`, 'info');
        } else {
            this.log(`Valeur température invalide: ${value}`, 'warn');
        }
    }


     // Traiter les messages d'humidité
     
    handleHumidityMessage(value, timestamp, teamNumber) {
        const humidity = parseFloat(value);
        
        if (!isNaN(humidity)) {
            this.emit('onHumidity', {
                value: humidity,
                timestamp,
                teamNumber,
                unit: '%'
            });
            
            this.log(`Humidité équipe ${teamNumber}: ${humidity}%`, 'info');
        } else {
            this.log(`Valeur humidité invalide: ${value}`, 'warn');
        }
    }

 
     // Traiter les messages d'alerte (RGB)
     
    handleAlertMessage(message, timestamp, teamNumber) {
        try {
         
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
                        hexColor: this.rgbToHex(r, g, b)
                    });
                    
                    this.log(`Alerte équipe ${teamNumber}: RGB(${r}, ${g}, ${b})`, 'warn');
                } else {
                    this.log(` Valeurs RGB invalides: ${message}`, 'warn');
                }
            } else {
                this.log(` Format alerte invalide: ${message}`, 'warn');
            }
            
        } catch (error) {
            this.log(` Erreur parsing alerte: ${error.message}`, 'error');
        }
    }

  
    isValidRGB(r, g, b) {
        return Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b) &&
               r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

   
    publishStatus(status) {
        if (this.isConnected) {
            const statusMessage = {
                status,
                timestamp: new Date().toISOString(),
                clientId: this.config.clientId,
                messageCount: this.messageCount,
                uptime: this.getUptime()
            };
            
            this.client.publish('GTI700/Status/Dashboard', JSON.stringify(statusMessage), { qos: 1 });
        }
    }


    scheduleReconnect() {
        if (this.connectionAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectDelay * Math.pow(1.5, this.connectionAttempts - 1);
            
            this.log(`🔄 Reconnexion programmée dans ${Math.round(delay/1000)}s`, 'info');
            
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect().catch(() => {

                    });
                }
            }, delay);
        } else {
            this.log('Nombre maximum de tentatives de reconnexion atteint', 'error');
            this.autoReconnect = false;
        }
    }

    disconnect() {
        if (this.isConnected && this.client) {
            this.autoReconnect = false;
            this.publishStatus('offline');
            this.client.end(true);
            this.isConnected = false;
            this.log('Déconnecté du broker MQTT', 'info');
            this.updateConnectionStatus('disconnected');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = `status ${status}`;
            
            const icon = statusElement.querySelector('i');
            const text = statusElement.childNodes[1];
            
            switch (status) {
                case 'connected':
                    icon.className = 'fas fa-wifi';
                    statusElement.childNodes[1].textContent = ' Connecté';
                    break;
                case 'connecting':
                    icon.className = 'fas fa-spinner fa-spin';
                    statusElement.childNodes[1].textContent = ' Connexion...';
                    break;
                case 'disconnected':
                default:
                    icon.className = 'fas fa-wifi';
                    statusElement.childNodes[1].textContent = ' Déconnecté';
                    break;
            }
        }
    }

 
    getUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getStats() {
        return {
            isConnected: this.isConnected,
            messageCount: this.messageCount,
            uptime: this.getUptime(),
            connectionAttempts: this.connectionAttempts,
            clientId: this.config.clientId,
            brokerUrl: `ws://${this.config.host}:${this.config.port}`
        };
    }


    setAutoReconnect(enabled) {
        this.autoReconnect = enabled;
        this.log(`Reconnexion automatique: ${enabled ? 'activée' : 'désactivée'}`, 'info');
    }

    updateConfig(host, port) {
        if (this.isConnected) {
            this.log('Déconnexion avant changement de configuration', 'info');
            this.disconnect();
        }
        
        this.config.host = host;
        this.config.port = port;
        this.connectionAttempts = 0;
        
        this.log(`Configuration mise à jour: ${host}:${port}`, 'info');
    }

 
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [MQTT]`;
        
        switch (level) {
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'success':
                console.log(`${prefix} ${message}`);
                break;
            case 'debug':
                console.debug(`${prefix} ${message}`);
                break;
            case 'info':
            default:
                console.log(`${prefix} ${message}`);
                break;
        }
    }
}


window.MQTTWebSocketClient = MQTTWebSocketClient; 
