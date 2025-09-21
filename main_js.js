// 🎵 INICIALIZAÇÃO E CONTROLES PRINCIPAIS
console.log('🚀 Carregando sistema principal...');

class RadioApp {
    constructor() {
        this.isInitialized = false;
        this.elements = {};
        console.log('🚀 RadioApp inicializado');
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('📋 Iniciando sistemas...');
            
            // Carregar dados salvos
            RADIO_UTILS.load();
            
            // Inicializar elementos DOM
            this.initializeElements();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Inicializar sistema de transmissão
            await this.initializeRadioCore();
            
            // Configurar volume inicial
            this.setupVolumeControl();
            
            // Iniciar atualizador de UI
            this.startUIUpdater();
            
            // Marcar como inicializado
            this.isInitialized = true;
            
            console.log('✅ RadioApp inicializada com sucesso!');
            RADIO_UTILS.log('🎵 Sistema pronto para uso');
            
            // Verificar se há músicas e iniciar automaticamente
            this.checkAndStartRadio();
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.showErrorMessage('Erro ao inicializar a rádio. Recarregue a página.');
        }
    }
    
    initializeElements() {
        const elementIds = [
            'radioStream', 'playStopBtn', 'volumeControl', 'volumeDisplay',
            'liveStatus', 'nowPlaying', 'transmissionStatus', 'songsCount',
            'lastUpdate', 'adminAccessBtn', 'passwordModal', 'adminPassword',
            'loadingOverlay', 'backToRadioBtn', 'toggleTransmissionBtn'
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements[id] = element;
            } else {
                console.warn(`⚠️ Elemento não encontrado: ${id}`);
            }
        });
        
        // Verificar elementos críticos
        const critical = ['radioStream', 'playStopBtn'];
        const missing = critical.filter(id => !this.elements[id]);
        
        if (missing.length > 0) {
            throw new Error(`Elementos críticos não encontrados: ${missing.join(', ')}`);
        }
        
        console.log('✅ Elementos DOM inicializados');
    }
    
    setupEventListeners() {
        try {
            // Botão principal play/stop
            if (this.elements.playStopBtn) {
                this.elements.playStopBtn.addEventListener('click', () => {
                    this.handlePlayStopClick();
                });
            }
            
            // Controle de volume
            if (this.elements.volumeControl) {
                this.elements.volumeControl.addEventListener('input', (e) => {
                    this.handleVolumeChange(e.target.value);
                });
            }
            
            // Acesso ao admin
            if (this.elements.adminAccessBtn) {
                this.elements.adminAccessBtn.addEventListener('click', () => {
                    this.showPasswordModal();
                });
            }
            
            // Modal de senha
            if (this.elements.adminPassword) {
                this.elements.adminPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.checkAdminPassword();
                    }
                });
            }
            
            // Voltar do admin
            if (this.elements.backToRadioBtn) {
                this.elements.backToRadioBtn.addEventListener('click', () => {
                    AdminPanel.hidePanel();
                });
            }
            
            // Toggle transmissão (admin)
            if (this.elements.toggleTransmissionBtn) {
                this.elements.toggleTransmissionBtn.addEventListener('click', () => {
                    AdminPanel.toggleTransmission();
                });
            }
            
            // Eventos globais
            this.setupGlobalEvents();
            
            console.log('✅ Event listeners configurados');
            
        } catch (error) {
            console.error('❌ Erro ao configurar listeners:', error);
            throw error;
        }
    }
    
    setupGlobalEvents() {
        // Visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && RADIO_STATE.transmission.isLive) {
                console.log('👁️ Página visível, verificando transmissão...');
                setTimeout(() => {
                    if (RADIO_STATE.transmission.isLive && this.elements.radioStream && this.elements.radioStream.paused) {
                        this.elements.radioStream.play().catch(() => {});
                    }
                }, 1000);
            }
        });
        
        // Salvar antes de sair
        window.addEventListener('beforeunload', () => {
            RADIO_UTILS.save();
        });
        
        // Erros globais
        window.addEventListener('error', (e) => {
            console.error('❌ Erro global:', e.error);
            if (RADIO_STATE.transmission.isLive && window.RadioCore) {
                setTimeout(() => {
                    console.log('🔄 Tentando recuperar...');
                    RadioCore.playNext();
                }, 5000);
            }
        });
    }
    
    async initializeRadioCore() {
        try {
            console.log('📻 Inicializando RadioCore...');
            
            if (!window.RadioCore) {
                throw new Error('RadioCore não encontrado');
            }
            
            await RadioCore.initialize();
            console.log('✅ RadioCore inicializado');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar RadioCore:', error);
            throw error;
        }
    }
    
    setupVolumeControl() {
        if (!this.elements.volumeControl || !this.elements.volumeDisplay) return;
        
        const initialVolume = RADIO_CONFIG.radio.audio.defaultVolume * 100;
        this.elements.volumeControl.value = initialVolume;
        this.elements.volumeDisplay.textContent = `${Math.round(initialVolume)}%`;
        
        console.log('✅ Volume configurado');
    }
    
    startUIUpdater() {
        // Atualizar UI a cada 3 segundos
        setInterval(() => {
            if (window.RadioCore) {
                RadioCore.updateUI();
            }
        }, 3000);
    }
    
    checkAndStartRadio() {
        const totalTracks = this.getTotalTracks();
        
        if (totalTracks === 0) {
            console.log('⚠️ Nenhuma música encontrada');
            this.showWelcomeMessage();
        } else {
            console.log(`🎵 ${totalTracks} faixas encontradas na biblioteca`);
            
            // Iniciar automaticamente após 2 segundos
            setTimeout(() => {
                if (!RADIO_STATE.transmission.isLive) {
                    console.log('🚀 Iniciando transmissão automática...');
                    RadioCore.startTransmission();
                }
            }, 2000);
        }
    }
    
    showWelcomeMessage() {
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: rgba(255,255,255,0.1); backdrop-filter: blur(20px); 
                        border-radius: 20px; padding: 30px; text-align: center; z-index: 9999;
                        border: 1px solid rgba(255,255,255,0.2); max-width: 400px;">
                <h3 style="color: #4facfe; margin-bottom: 15px;">🎵 Bem-vindo!</h3>
                <p style="color: #a0a0a0; margin-bottom: 20px;">
                    Para começar a transmissão, faça upload de músicas no painel administrativo.
                </p>
                <button onclick="this.parentElement.parentElement.remove(); document.getElementById('adminAccessBtn').click();" 
                        style="background: linear-gradient(135deg, #667eea, #764ba2); border: none; 
                               padding: 10px 20px; color: white; border-radius: 8px; cursor: pointer;">
                    🛠️ Abrir Painel Admin
                </button>
                <button onclick="this.parentElement.parentElement.remove();" 
                        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                               padding: 10px 20px; color: white; border-radius: 8px; cursor: pointer; margin-left: 10px;">
                    ❌ Fechar
                </button>
            </div>
        `;
        
        document.body.appendChild(message);
        
        // Auto-remover após 30 segundos
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 30000);
    }
    
    // Handlers de eventos
    handlePlayStopClick() {
        try {
            if (window.RadioCore) {
                RadioCore.toggleTransmission();
                
                const status = RADIO_STATE.transmission.isLive ? 'iniciada' : 'pausada';
                console.log(`🎛️ Transmissão ${status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao controlar transmissão:', error);
        }
    }
    
    handleVolumeChange(value) {
        try {
            const volume = parseFloat(value) / 100;
            
            if (window.RadioCore) {
                RadioCore.setVolume(volume);
            }
            
            if (this.elements.volumeDisplay) {
                this.elements.volumeDisplay.textContent = `${Math.round(value)}%`;
            }
            
        } catch (error) {
            console.error('❌ Erro ao alterar volume:', error);
        }
    }
    
    showPasswordModal() {
        if (this.elements.passwordModal) {
            this.elements.passwordModal.style.display = 'flex';
            
            setTimeout(() => {
                if (this.elements.adminPassword) {
                    this.elements.adminPassword.focus();
                }
            }, 100);
        }
    }
    
    async checkAdminPassword() {
        if (!this.elements.adminPassword) return;
        
        const password = this.elements.adminPassword.value;
        
        try {
            const success = await AdminPanel.authenticate(password);
            
            if (success) {
                this.closeModal('passwordModal');
                console.log('🔓 Acesso admin liberado');
            } else {
                alert('Senha incorreta!');
                this.elements.adminPassword.value = '';
                this.elements.adminPassword.focus();
            }
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            
            if (modalId === 'passwordModal' && this.elements.adminPassword) {
                this.elements.adminPassword.value = '';
            }
        }
    }
    
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                        background: rgba(0,0,0,0.9); display: flex; align-items: center; 
                        justify-content: center; z-index: 99999;">
                <div style="background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; 
                            backdrop-filter: blur(20px); max-width: 500px; text-align: center; color: white;">
                    <h2 style="color: #ff6b6b; margin-bottom: 20px;">❌ Erro</h2>
                    <p style="margin-bottom: 30px;">${message}</p>
                    <button onclick="location.reload()" style="background: #667eea; border: none; 
                            color: white; padding: 15px 30px; border-radius: 10px; cursor: pointer;">
                        🔄 Recarregar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
    
    getTotalTracks() {
        let total = 0;
        total += RADIO_STATE.library.music.length;
        total += RADIO_STATE.library.time.length;
        total += RADIO_STATE.library.ads.length;
        
        Object.values(RADIO_STATE.library.albums).forEach(album => {
            total += album.length;
        });
        
        return total;
    }
    
    getStatus() {
        return {
            initialized: this.isInitialized,
            totalTracks: this.getTotalTracks(),
            radioCore: window.RadioCore ? RadioCore.getStatus() : null
        };
    }
}

// Funções globais para compatibilidade
window.checkAdminPassword = () => {
    if (window.RadioApp) {
        RadioApp.checkAdminPassword();
    }
};

window.closeModal = (modalId) => {
    if (window.RadioApp) {
        RadioApp.closeModal(modalId);
    }
};

// Inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎵 Iniciando Rádio Supermercado do Louro...');
        
        // Aguardar um pouco para garantir que tudo está carregado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Criar e inicializar aplicação
        window.RadioApp = new RadioApp();
        await RadioApp.initialize();
        
        console.log('🎉 Sistema inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro fatal:', error);
        if (window.RadioApp) {
            RadioApp.showErrorMessage('Erro na inicialização. Verifique o console e recarregue.');
        }
    }
});

console.log('✅ main.js carregado com sucesso!');
