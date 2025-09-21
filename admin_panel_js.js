// 🛠️ PAINEL ADMINISTRATIVO
console.log('🛠️ Carregando painel administrativo...');

class AdminPanel {
    constructor() {
        this.isAuthenticated = false;
        console.log('🛠️ AdminPanel inicializado');
    }
    
    async authenticate(password) {
        if (password === RADIO_CONFIG.admin.defaultPassword) {
            this.isAuthenticated = true;
            this.showPanel();
            RADIO_UTILS.log('🔓 Admin autenticado');
            return true;
        }
        return false;
    }
    
    showPanel() {
        const radioPlayer = document.getElementById('radioPlayer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (radioPlayer) radioPlayer.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        
        this.updateStatus();
    }
    
    hidePanel() {
        const radioPlayer = document.getElementById('radioPlayer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (radioPlayer) radioPlayer.style.display = 'block';  
        if (adminPanel) adminPanel.style.display = 'none';
    }
    
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            this.showNotification('Selecione pelo menos um arquivo!', 'warning');
            return;
        }
        
        const files = Array.from(fileInput.files);
        this.showLoading(true, `Enviando ${files.length} arquivo(s)...`);
        
        try {
            const uploadedFiles = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateLoadingText(`Enviando ${file.name}... (${i + 1}/${files.length})`);
                
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
                
                // Adicionar à biblioteca
                this.addToLibrary(uploadedFile, category, albumType);
            }
            
            // Salvar estado
            RADIO_UTILS.save();
            
            // Limpar input
            fileInput.value = '';
            
            // Se não há música tocando, iniciar
            if (RADIO_STATE.transmission.isLive && !RADIO_STATE.transmission.currentTrack) {
                setTimeout(() => {
                    if (window.RadioCore) {
                        RadioCore.playNext();
                    }
                }, 1000);
            }
            
            this.showNotification(
                `${files.length} arquivo(s) enviado(s) com sucesso!`, 
                'success'
            );
            
            RADIO_UTILS.log(`📤 ${files.length} arquivos enviados para ${category}`);
            
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            this.showNotification('Erro no upload. Tente novamente.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    getFileInput(category) {
        const inputs = {
            music: document.getElementById('musicUpload'),
            time: document.getElementById('timeUpload'),
            ads: document.getElementById('adUpload'),
            album: document.getElementById('albumUpload')
        };
        return inputs[category];
    }
    
    async uploadToCloudinary(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', RADIO_CONFIG.cloudinary.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(RADIO_UTILS.getCloudinaryURL(), {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload falhou: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
            originalName: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            category: category,
            album: albumType || null
        };
    }
    
    addToLibrary(file, category, albumType = '') {
        if (category === 'album') {
            if (!RADIO_STATE.library.albums[albumType]) {
                RADIO_STATE.library.albums[albumType] = [];
            }
            RADIO_STATE.library.albums[albumType].push(file);
        } else {
            if (!RADIO_STATE.library[category]) {
                RADIO_STATE.library[category] = [];
            }
            RADIO_STATE.library[category].push(file);
        }
    }
    
    toggleTransmission() {
        if (window.RadioCore) {
            RadioCore.toggleTransmission();
            this.updateStatus();
            
            const status = RADIO_STATE.transmission.isLive ? 'iniciada' : 'pausada';
            this.showNotification(`Transmissão ${status}!`, 'info');
        }
    }
    
    skipTrack() {
        if (window.RadioCore && RADIO_STATE.transmission.isLive) {
            RadioCore.skipToNext();
            this.showNotification('Pulando para próxima música...', 'info');
        }
    }
    
    resetStats() {
        if (!confirm('Tem certeza que deseja resetar todas as estatísticas?')) return;
        
        RADIO_STATE.stats = {
            totalPlayed: 0,
            playHistory: {},
            sessionStart: Date.now()
        };
        
        RADIO_UTILS.save();
        this.showNotification('Estatísticas resetadas!', 'success');
        RADIO_UTILS.log('🔄 Estatísticas resetadas');
    }
    
    showStats() {
        if (Object.keys(RADIO_STATE.stats.playHistory).length === 0) {
            this.showNotification('Nenhuma estatística disponível ainda.', 'info');
            return;
        }
        
        const stats = Object.entries(RADIO_STATE.stats.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        let message = '📊 TOP 10 MÚSICAS:\n\n';
        stats.forEach(([track, count], index) => {
            message += `${index + 1}. ${track} - ${count}x\n`;
        });
        
        alert(message);
    }
    
    updateStatus() {
        // Esta função é chamada pelo RadioCore
        // Apenas garantir que existe
    }
    
    updateLoadingText(text) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }
    
    showLoading(show, message = 'Carregando...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            if (show && message) {
                this.updateLoadingText(message);
            }
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            info: 'ℹ️',
            success: '✅', 
            warning: '⚠️',
            error: '❌'
        };
        
        notification.innerHTML = `
            <span style="margin-right: 10px;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            border-radius: 25px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            max-width: 400px;
            text-align: center;
        `;
        
        const colors = {
            info: 'rgba(52, 152, 219, 0.9)',
            success: 'rgba(46, 204, 113, 0.9)',
            warning: 'rgba(243, 156, 18, 0.9)',
            error: 'rgba(231, 76, 60, 0.9)'
        };
        
        notification.style.background = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Auto-remover
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }
}

// Criar instância global
window.AdminPanel = new AdminPanel();

// Funções globais para compatibilidade com HTML
window.uploadFiles = (category) => {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    AdminPanel.uploadFiles(category, albumType);
};

window.toggleTransmission = () => AdminPanel.toggleTransmission();
window.skipTrack = () => AdminPanel.skipTrack();
window.resetStats = () => AdminPanel.resetStats();
window.showStats = () => AdminPanel.showStats();

console.log('✅ AdminPanel carregado com sucesso!');
