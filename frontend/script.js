class IoTDashboard {
    constructor() {
        this.mqttClient = null;
        this.sensorData = {
            temperature: {
                current: null,
                history: [],
                count: 0,
                lastUpdate: null
            },
            humidity: {
                current: null,
                history: [],
                count: 0,
                lastUpdate: null
            }
        };
        
        this.alertsData = new Map(); // Map des alertes par équipe
        this.alertsLog = [];
        this.maxHistoryLength = 15;
        this.currentTeam = '05'; // Notre équipe
        this.allTeamsData = new Map(); // Données de toutes les équipes
        
        this.initializeElements();
        this.initializeMQTT();
        this.setupEventListeners();
        this.startUpdateTimers();
        
        console.log('Dashboard IoT initialisé pour l\'équipe 05');
    }


    initializeElements() {
        // Éléments des capteurs
        this.elements = {
            // Température
            temperatureValue: document.getElementById('temperatureValue'),
            temperatureTime: document.getElementById('temperatureTime'),
            temperatureCount: document.getElementById('temperatureCount'),
            temperatureHistory: document.getElementById('temperatureHistory'),
            
            // Humidité
            humidityValue: document.getElementById('humidityValue'),
            humidityTime: document.getElementById('humidityTime'),
            humidityCount: document.getElementById('humidityCount'),
            humidityHistory: document.getElementById('humidityHistory'),
            
            // Alertes
            alertsGrid: document.getElementById('alertsGrid'),
            alertsLog: document.getElementById('alertsLog'),
            
            // Configuration
            mqttHost: document.getElementById('mqttHost'),
            mqttPort: document.getElementById('mqttPort'),
            connectBtn: document.getElementById('connectBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            autoReconnect: document.getElementById('autoReconnect'),
            showNotifications: document.getElementById('showNotifications'),
            
            // Statistiques
            totalMessages: document.getElementById('totalMessages'),
            uptime: document.getElementById('uptime'),
            
            // Onglets
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabPanels: document.querySelectorAll('.tab-panel')
        };
        
        // Initialiser la grille des équipes
        this.initializeTeamsGrid();
    }

    initializeMQTT() {
        this.mqttClient = new MQTTDualClient();
        
        // Callbacks pour les événements MQTT
        this.mqttClient.on('onConnect', () => {
            this.showNotification('Connecté au broker MQTT', 'success');
            this.updateConnectionControls(true);
        });
        
        this.mqttClient.on('onDisconnect', () => {
            this.showNotification('Déconnecté du broker MQTT', 'warning');
            this.updateConnectionControls(false);
        });
        
        this.mqttClient.on('onError', (error) => {
            this.showNotification(`Erreur MQTT: ${error.message}`, 'error');
        });
        
        this.mqttClient.on('onTemperature', (data) => {
            this.handleTemperatureData(data);
        });
        
        this.mqttClient.on('onHumidity', (data) => {
            this.handleHumidityData(data);
        });
        
        this.mqttClient.on('onAlert', (data) => {
            this.handleAlertData(data);
        });
        
        // Connexion automatique au démarrage
        this.connectToMQTT();
    }

    setupEventListeners() {
        // Boutons de connexion
        this.elements.connectBtn.addEventListener('click', () => {
            this.connectToMQTT();
        });
        
        this.elements.disconnectBtn.addEventListener('click', () => {
            this.mqttClient.disconnectAll();
        });
        
        // Configuration
        this.elements.autoReconnect.addEventListener('change', (e) => {
            this.mqttClient.setAutoReconnect(e.target.checked);
        });
        
        // Onglets
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
        
        // Notifications si supportées
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    }

    async connectToMQTT() {
        try {
            this.elements.connectBtn.disabled = true;
            this.elements.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
            
            await this.mqttClient.connectAll();
            
        } catch (error) {
            this.showNotification(`Erreur de connexion: ${error.message}`, 'error');
        } finally {
            this.elements.connectBtn.disabled = false;
            this.elements.connectBtn.innerHTML = '<i class="fas fa-plug"></i> Reconnecter';
        }
    }


    handleTemperatureData(data) {
        if (data.teamNumber === this.currentTeam || this.sensorData.temperature.current === null) {
            this.sensorData.temperature.current = data.value;
            this.sensorData.temperature.count++;
            this.sensorData.temperature.lastUpdate = data.timestamp;
            
            // Ajouter à l'historique
            this.addToHistory('temperature', data);
            
            // Mettre à jour l'interface
            this.updateTemperatureDisplay();
            
            // Animation de mise à jour
            this.animateValueUpdate(this.elements.temperatureValue);
            
            // Afficher l'équipe source si différente
            if (data.teamNumber !== this.currentTeam) {
                this.elements.temperatureValue.title = `Données de l'équipe ${data.teamNumber}`;
            }
        }
        
        // Log pour toutes les équipes (selon énoncé)
        console.log(`Température équipe ${data.teamNumber}: ${data.value}°C`);
    }

    handleHumidityData(data) {
        if (data.teamNumber === this.currentTeam || this.sensorData.humidity.current === null) {
            this.sensorData.humidity.current = data.value;
            this.sensorData.humidity.count++;
            this.sensorData.humidity.lastUpdate = data.timestamp;
            
            // Ajouter à l'historique
            this.addToHistory('humidity', data);
            
            // Mettre à jour l'interface
            this.updateHumidityDisplay();
            
            this.animateValueUpdate(this.elements.humidityValue);
            
            // Afficher l'équipe source si différente
            if (data.teamNumber !== this.currentTeam) {
                this.elements.humidityValue.title = `Données de l'équipe ${data.teamNumber}`;
            }
        }
        
        console.log(`Humidité équipe ${data.teamNumber}: ${data.value}%`);
    }


    handleAlertData(data) {
        this.alertsData.set(data.teamNumber, {
            ...data,
            isActive: true,
            lastColor: data.hexColor,
            lastRGB: data.rgb
        });
        
        // Ajouter au log
        this.addToAlertsLog(data);
        
        // Mettre à jour l'interface
        this.updateAlertsDisplay();
        this.updateTeamCard(data.teamNumber, data);
        
        // Notification si activée
        if (this.elements.showNotifications.checked) {
            this.showSystemNotification(`Alerte équipe ${data.teamNumber}`, `Couleur RGB: ${data.rgb.r}, ${data.rgb.g}, ${data.rgb.b}`);
        }
        
        setTimeout(() => {
            const alertData = this.alertsData.get(data.teamNumber);
            if (alertData) {
                alertData.isActive = false;
                this.updateTeamCard(data.teamNumber, alertData);
            }
        }, 30000);
    }

    addToHistory(type, data) {
        const history = this.sensorData[type].history;
        
        history.unshift({
            value: data.value,
            timestamp: data.timestamp,
            trend: this.calculateTrend(history, data.value)
        });
        
        if (history.length > this.maxHistoryLength) {
            history.splice(this.maxHistoryLength);
        }
        
        this.updateHistoryTable(type);
    }

    calculateTrend(history, newValue) {
        if (history.length === 0) return 'stable';
        
        const lastValue = history[0].value;
        const diff = newValue - lastValue;
        
        if (Math.abs(diff) < 0.1) return 'stable';
        return diff > 0 ? 'up' : 'down';
    }

    updateTemperatureDisplay() {
        const data = this.sensorData.temperature;
        
        if (data.current !== null) {
            this.elements.temperatureValue.textContent = data.current.toFixed(1);
            this.elements.temperatureTime.textContent = this.formatTime(data.lastUpdate);
            this.elements.temperatureCount.textContent = `${data.count} mesures`;
        }
    }

    updateHumidityDisplay() {
        const data = this.sensorData.humidity;
        
        if (data.current !== null) {
            this.elements.humidityValue.textContent = data.current.toFixed(1);
            this.elements.humidityTime.textContent = this.formatTime(data.lastUpdate);
            this.elements.humidityCount.textContent = `${data.count} mesures`;
        }
    }

    updateHistoryTable(type) {
        const history = this.sensorData[type].history;
        const tbody = this.elements[`${type}History`];
        
        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">Aucune donnée disponible</td></tr>';
            return;
        }
        
        tbody.innerHTML = history.map(entry => {
            const trendIcon = this.getTrendIcon(entry.trend);
            const unit = type === 'temperature' ? '°C' : '%';
            
            return `
                <tr>
                    <td>${this.formatTime(entry.timestamp)}</td>
                    <td>${entry.value.toFixed(1)}${unit}</td>
                    <td>${trendIcon}</td>
                </tr>
            `;
        }).join('');
    }

    getTrendIcon(trend) {
        switch (trend) {
            case 'up':
                return '<i class="fas fa-arrow-up" style="color: #10b981;"></i>';
            case 'down':
                return '<i class="fas fa-arrow-down" style="color: #ef4444;"></i>';
            case 'stable':
            default:
                return '<i class="fas fa-minus" style="color: #64748b;"></i>';
        }
    }


    initializeTeamsGrid() {
        const teams = [];
        for (let i = 1; i <= 20; i++) {
            teams.push(i.toString().padStart(2, '0'));
        }
        
        this.elements.alertsGrid.innerHTML = teams.map(team => `
            <div class="team-card" id="team-${team}">
                <div class="team-number">Équipe ${team}</div>
                <div class="led-preview" id="led-${team}"></div>
                <div class="team-status" id="status-${team}">Aucune alerte</div>
            </div>
        `).join('');
    }

    updateTeamCard(teamNumber, alertData) {
        const card = document.getElementById(`team-${teamNumber}`);
        const led = document.getElementById(`led-${teamNumber}`);
        const status = document.getElementById(`status-${teamNumber}`);
        
        if (!card || !led || !status) return;
        
        if (alertData && (alertData.hexColor || alertData.lastColor)) {
            const color = alertData.hexColor || alertData.lastColor;
            const rgb = alertData.rgb || alertData.lastRGB;
            
            card.style.backgroundColor = color;
            card.style.border = `2px solid ${color}`;
            
            const brightness = this.calculateBrightness(rgb.r, rgb.g, rgb.b);
            const textColor = brightness > 128 ? '#000000' : '#ffffff';
            card.style.color = textColor;
            
            led.style.backgroundColor = color;
            led.style.border = `2px solid ${textColor}`;
            
            status.textContent = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            status.style.color = textColor;
            status.style.fontWeight = 'bold';
            
            if (alertData.isActive) {
                card.classList.add('alert-active');
                led.style.boxShadow = `0 0 15px ${color}`;
            } else {
                card.classList.remove('alert-active');
                led.style.boxShadow = 'none';
            }
            
        } else {
            card.style.backgroundColor = '';
            card.style.border = '';
            card.style.color = '';
            
            led.style.backgroundColor = '';
            led.style.border = '';
            led.style.boxShadow = '';
            
            status.textContent = 'Aucune alerte';
            status.style.color = '';
            status.style.fontWeight = '';
            
            card.classList.remove('alert-active');
        }
    }


    calculateBrightness(r, g, b) {
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    addToAlertsLog(alertData) {
        this.alertsLog.unshift({
            ...alertData,
            id: Date.now()
        });
        
        if (this.alertsLog.length > 50) {
            this.alertsLog.splice(50);
        }
        
        this.updateAlertsLog();
    }

    updateAlertsLog() {
        if (this.alertsLog.length === 0) {
            this.elements.alertsLog.innerHTML = '<p class="no-alerts">Aucune alerte reçue</p>';
            return;
        }
        
        this.elements.alertsLog.innerHTML = this.alertsLog.map(alert => `
            <div class="log-entry">
                <div class="log-time">${this.formatDateTime(alert.timestamp)}</div>
                <div class="log-message">
                    <strong>Équipe ${alert.teamNumber}:</strong> 
                    RGB(${alert.rgb.r}, ${alert.rgb.g}, ${alert.rgb.b})
                    <span class="color-preview" style="background-color: ${alert.hexColor}; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-left: 8px;"></span>
                </div>
            </div>
        `).join('');
    }

    updateAlertsDisplay() {
        console.log(` Alertes actives: ${Array.from(this.alertsData.values()).filter(a => a.isActive).length}`);
    }

    switchTab(tabId) {
        this.elements.tabBtns.forEach(btn => btn.classList.remove('active'));
        this.elements.tabPanels.forEach(panel => panel.classList.remove('active'));
        
        const selectedBtn = document.querySelector(`[data-tab="${tabId}"]`);
        const selectedPanel = document.getElementById(tabId);
        
        if (selectedBtn && selectedPanel) {
            selectedBtn.classList.add('active');
            selectedPanel.classList.add('active');
        }
    }

    animateValueUpdate(element) {
        element.classList.add('updated');
        setTimeout(() => {
            element.classList.remove('updated');
        }, 600);
    }

    updateConnectionControls(isConnected) {
        this.elements.connectBtn.disabled = isConnected;
        this.elements.disconnectBtn.disabled = !isConnected;
    }

    startUpdateTimers() {
        setInterval(() => {
            if (this.mqttClient) {
                const stats = this.mqttClient.getStats();
                this.elements.totalMessages.textContent = stats.messageCount;
                this.elements.uptime.textContent = stats.uptime;
            }
        }, 1000);
        
        setInterval(() => {
            this.cleanupOldAlerts();
        }, 60000);
    }

    cleanupOldAlerts() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        this.alertsLog = this.alertsLog.filter(alert => 
            now - alert.timestamp.getTime() < maxAge
        );
        
        this.updateAlertsLog();
    }
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    showSystemNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/favicon.ico'
            });
        }
    }

    formatTime(date) {
        if (!date) return 'Jamais';
        return date.toLocaleTimeString('fr-FR');
    }


    formatDateTime(date) {
        if (!date) return 'Jamais';
        return date.toLocaleString('fr-FR');
    }
}

// Styles pour les notifications
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    }
    
    .notification.success { background: #10b981; }
    .notification.warning { background: #f59e0b; }
    .notification.error { background: #ef4444; }
    .notification.info { background: #3b82f6; }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;

// Ajouter les styles au DOM
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Initialiser le dashboard quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new IoTDashboard();
});

// Export pour utilisation externe
window.IoTDashboard = IoTDashboard; 
