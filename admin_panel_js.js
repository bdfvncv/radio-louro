// 🛠️ PAINEL ADMINISTRATIVO
console.log('🛠️ Carregando painel administrativo...');

window.AdminPanel = {
    isAuthenticated: false,
    
    async authenticate(password) {
        if (password === window.RADIO_CONFIG.admin.defaultPassword) {
            this.isAuthenticated = true;
            this.showPanel();
            window.RADIO_UTILS.log('🔓 Admin autenticado');
            return true;
        }
        return false;
    },
    
    showPanel() {
        const radioPlayer = document.getElementById('radioPlayer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (radioPlayer) radioPlayer.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        
        console.log('🛠️ Painel admin aberto');
    },
    
    hidePanel() {
        const radioPlayer = document.getElementById('radioPlayer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (radioPlayer) radioPlayer.style.display = 'block';  
        if (adminPanel) adminPanel.style.display = 'none';
        
        console.log('📻 Voltando ao player principal');
    },
    
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            this.showNotification('Selecione pelo menos um arquivo!', 'warning');
            return;
        }
        
        const files = Array.from(fileInput.files);
        console.log(`📤 Iniciando upload de ${files.length} arquivo(s) para ${category}`);
        
        this.showLoading(true, `Enviando ${files.length} arquivo(s)...`);
        
        try {
            const uploadedFiles = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateLoadingText(`Enviando ${file.name}... (${i + 1}/${files.length})`);
                
                console.log(`Uploading file: ${file.name}`);
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
                
                // Adicionar à biblioteca
                this.addToLibrary(uploadedFile, category, albumType);
            }
            
            // Salvar estado
            window.RADIO_UTILS.save();
            
            // Limpar input
            fileInput.value = '';
            
            // Se não há música tocando e a rádio está ao vivo, iniciar
            if (window.RADIO_STATE.transmission.isLive && !window.RADIO_STATE.transmission.currentTrack) {
                setTimeout(() => {
                    if (window.RadioCore) {
                        window.RadioCore.playNext();
                    }
                }, 1000);
            }
            
            this.showNotification(
                `${files.length} arquivo(s) enviado(s) com sucesso!`, 
                'success'
            );
            
            window.RADIO_UTILS.log(`📤 ${files.length} arquivos enviados para ${category}`);
            
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            this.showNotification('Erro no upload. Verifique sua conexão e tente novamente.', 'error');
        } finally {
            this.showLoading(false);
        }
    },
    
    getFileInput(category) {
        const inputs = {
            music: document.getElementById('musicUpload'),
            time: document.getElementById('timeUpload'),
            ads: document.getElementById('adUpload'),
            album: document.getElementById('albumUpload')
        };
        return inputs[category];
    },
    
    async uploadToCloudinary(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', window.RADIO_CONFIG.cloudinary.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(window.RADIO_UTILS.getCloudinaryURL(), {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cloudinary error:', errorText);
            throw new Error(`Upload falhou: ${response.status} - ${response.statusText}`);
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
    },
    
    addToLibrary(file, category, albumType = '') {
        if (category === 'album') {
            if (!window.RADIO_STATE.library.albums[albumType]) {
                window.RADIO_STATE.library.albums[albumType] = [];
            }
            window.RADIO_STATE.library.albums[albumType].push(file);
            console.log(`📁 Arquivo adicionado ao álbum ${albumType}: ${file.name}`);
        } else {
            if (!window.RADIO_STATE.library[category]) {
                window.RADIO_STATE.library[category] = [];
            }
            window.RADIO_STATE.library[category].push(file);
            console.log(`📁 Arquivo adicionado à categoria ${category}: ${file.name}`);
        }
    },
    
    toggleTransmission() {
        if (window.RadioCore) {
            window.RadioCore.toggleTransmission();
            
            const status = window.RADIO_STATE.transmission.isLive ? 'iniciada' : 'pausada';
            this.showNotification(`Transmissão ${status}!`, 'info');
            
            console.log(`🎛️ Transmissão ${status}`);
        }
    },
    
    skipTrack() {
        if (window.RadioCore && window.RADIO_STATE.transmission.isLive) {
            window.RadioCore.skipToNext();
            this.showNotification('Pulando para próxima música...', 'info');
            
            console.log('⏭️ Música pulada manualmente');
        }
    },
    
    resetStats() {
        if (!confirm('Tem certeza que deseja resetar todas as estatísticas?')) return;
        
        window.RADIO_STATE.stats = {
            totalPlayed: 0,
            playHistory: {},
            sessionStart: Date.now()
        };
        
        window.RADIO_UTILS.save();
        this.showNotification('Estatísticas resetadas!', 'success');
        window.RADIO_UTILS.log('🔄 Estatísticas resetadas');
    },
    
    showStats() {
        if (Object.keys(window.RADIO_STATE.stats.playHistory).length === 0) {
            this.showNotification('Nenhuma estatística disponível ainda.', 'info');
            return;
        }
        
        const stats = Object.entries(window.RADIO_STATE.stats.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        let message = '📊 TOP 10 MÚSICAS MAIS TOCADAS:\n\n';
        stats.forEach(([track, count], index) => {
            message += `${index + 1}. ${track} - ${count}x\n`;
        });
        
        message += `\n🎵 Total de músicas tocadas: ${window.RADIO_STATE.stats.totalPlayed}`;
        
        alert(message);
    },
    
    updateLoadingText(text) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
    },
    
    showLoading(show, message = 'Carregando...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            if (show && message) {
                this.updateLoadingText(message);
            }
        }
    },
    
    showNotification(message, type = 'info') {
        // Remover notificações anteriores
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());
        
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
};

// Funções globais para uso no HTML
window.uploadFiles = (category) => {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    window.AdminPanel.uploadFiles(category, albumType);
};

window.toggleTransmission = () => window.AdminPanel.toggleTransmission();
window.skipTrack = () => window.AdminPanel.skipTrack();
window.resetStats = () => window.AdminPanel.resetStats();
window.showStats = () => window.AdminPanel.showStats();

console.log('✅ AdminPanel carregado com sucesso!');
