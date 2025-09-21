// 🎵 INICIALIZAÇÃO E CONTROLES PRINCIPAIS
console.log('🚀 Carregando sistema principal...');

class RadioApp {
    constructor() {
        this.isInitialized = false;
        this.elements = {};
        console.log('🚀 RadioApp construtor chamado');
    }
    
    async initialize() {
        if (this.isInitialized) {
            console.warn('⚠️ Sistema já inicializado');
            return;
        }
        
        try {
            console.log('📋 Iniciando sistemas...');
            
            // Carregar dados salvos
            window.RADIO_UTILS.load();
            
            // Inicializar elementos DOM
            this.initializeElements();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Inicializar sistema de transmissão
            await this.initializeRadioCore();
            
            // Configurar volume inicial
            this.setupVolumeControl();
            
            // Marcar como inicializado
            this.isInitialized = true;
            
            console.log('✅ RadioApp inicializada com sucesso!');
            window.RADIO_UTILS.log('🎵 Sistema pronto para uso');
            
            // Verificar se há músicas e mostrar mensagem apropriada
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
        
        this.elements = {};
        let foundElements = 0;
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements[id] = element;
                foundElements++;
            } else {
                console.warn(`⚠️ Elemento não encontrado: ${id}`);
            }
        });
        
        console.log(`📋 Elementos encontrados: ${foundElements}/${elementIds.length}`);
        
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
            console.log('🔧 Configurando event listeners...');
            
            // Botão principal play/stop
            if (this.elements.playStopBtn) {
                this.elements.playStopBtn.addEventListener('click', () => {
                    console.log('🎛️ Play/Stop button clicked');
                    this.handlePlayStopClick();
                });
                console.log('✅ Play/Stop listener configurado');
            }
            
            // Controle de volume
            if (this.elements.volumeControl) {
                this.elements.volumeControl.addEventListener('input', (e) => {
                    this.handleVolumeChange(e.target.value);
                });
                console.log('✅ Volume listener configurado');
            }
            
            // Acesso ao admin
            if (this.elements.adminAccessBtn) {
                this.elements.adminAccessBtn.addEventListener('click', () => {
                    console.log('🔐 Admin button clicked');
                    this.showPasswordModal();
                });
                console.log('✅ Admin access listener configurado');
            }
            
            // Modal de senha - Enter key
            if (this.elements.adminPassword) {
                this.elements.adminPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        console.log('🔐 Enter pressed in password field');
                        this.checkAdminPassword();
                    }
                });
                console.log('✅ Password field listener configurado');
            }
            
            // Voltar do admin
            if (this.elements.backToRadioBtn) {
                this.elements.backToRadioBtn.addEventListener('click', () => {
                    console.log('📻 Back to radio clicked');
                    window.AdminPanel.hidePanel();
                });
                console.log('✅ Back to radio listener configurado');
            }
            
            // Toggle transmissão (admin)
            if (this.elements.toggleTransmissionBtn) {
                this.elements.toggleTransmissionBtn.addEventListener('click', () => {
                    console.log('🎛️ Toggle transmission clicked');
                    window.AdminPanel.toggleTransmission();
                });
                console.log('✅ Toggle transmission listener configurado');
            }
            
            // Eventos globais
            this.setupGlobalEvents();
            
            console.log('✅ Todos os event listeners configurados');
            
        } catch (error) {
            console.error('❌ Erro ao configurar listeners:', error);
            throw error;
        }
    }
    
    setupGlobalEvents() {
        // Visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && window.RADIO_STATE.transmission.isLive) {
                console.log('👁️ Página visível, verificando transmissão...');
                setTimeout(() => {
                    if (window.RADIO_STATE.transmission.isLive && 
                        this.elements.radioStream && 
                        this.elements.radioStream.paused) {
                        this.elements.radioStream.play().catch(() => {});
                    }
                }, 1000);
            }
        });
        
        // Salvar antes de sair
        window.addEventListener('beforeunload', () => {
            window.RADIO_UTILS.save();
            console.log('💾 Estado salvo antes de sair');
        });
        
        // Erros globais
        window.addEventListener('error', (e) => {
            console.error('❌ Erro global:', e.error);
            if (window.RADIO_STATE.transmission.isLive && window.RadioCore) {
                setTimeout(() => {
                    console.log('🔄 Tentando recuperar...');
                    window.RadioCore.playNext();
                }, 5000);
            }
        });
        
        console.log('✅ Global events configurados');
    }
    
    async initializeRadioCore() {
        try {
            console.log('📻 Inicializando RadioCore...');
            
            if (!window.RadioCore) {
                throw new Error('RadioCore não encontrado');
            }
            
            const success = await window.RadioCore.initialize();
            if (!success) {
                throw new Error('Falha na inicialização do RadioCore');
            }
            
            console.log('✅ RadioCore inicializado');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar RadioCore:', error);
            throw error;
        }
    }
    
    setupVolumeControl() {
        if (!this.elements.volumeControl || !this.elements.volumeDisplay) {
            console.warn('⚠️ Elementos de volume não encontrados');
            return;
        }
        
        const initialVolume = window.RADIO_CONFIG.radio.audio.defaultVolume * 100;
        this.elements.volumeControl.value = initialVolume;
        this.elements.volumeDisplay.textContent = `${Math.round(initialVolume)}%`;
        
        console.log('✅ Volume configurado:', initialVolume + '%');
    }
    
    checkAndStartRadio() {
        const totalTracks = this.getTotalTracks();
        
        console.log(`📊 Total de faixas na biblioteca: ${totalTracks}`);
        
        if (totalTracks === 0) {
            console.log('⚠️ Nenhuma música encontrada - mostrando mensagem de boas-vindas');
            this.showWelcomeMessage();
        } else {
            console.log(`🎵 ${totalTracks} faixas encontradas`);
            this.showReadyMessage();
        }
    }
    
    showWelcomeMessage() {
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: rgba(255,255,255,0.1); backdrop-filter: blur(20px); 
                        border-radius: 20px; padding: 30px; text-align: center; z-index: 9999;
                        border: 1px solid rgba(255,255,255,0.2); max-width: 450px; margin: 20px;">
                <h3 style="color: #4facfe; margin-bottom: 15px; font-size: 1.5rem;">🎵 Bem-vindo à Rádio!</h3>
                <p style="color: #a0a0a0; margin-bottom: 20px; line-height: 1.5;">
                    Para começar a transmissão, você precisa fazer upload de músicas no painel administrativo.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove(); document.getElementById('adminAccessBtn').click();" 
                            style="background: linear-gradient(135deg, #667eea, #764ba2); border: none; 
                                   padding: 12px 20px; color: white; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🛠️ Abrir Admin
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" 
                            style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                                   padding: 12px 20px; color: white; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        ❌ Fechar
                    </button>
                </div>
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
    
    showReadyMessage() {
        const totalTracks = this.getTotalTracks();
        
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; 
                        background: rgba(46, 204, 113, 0.9); color: white; 
                        padding: 15px 20px; border-radius: 10px; z-index: 9999;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-weight: 600;">
                ✅ Rádio pronta! ${totalTracks} música(s) carregada(s)
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.style.opacity = '0';
                message.style.transform = 'translateX(100%)';
                message.style.transition = 'all 0.3s ease';
                setTimeout(() => message.remove(), 300);
            }
        }, 4000);
    }
    
    // Handlers de eventos
    handlePlayStopClick() {
        try {
            console.log('🎛️ Processando clique do botão play/stop');
            
            if (!window.RadioCore) {
                console.error('❌ RadioCore não disponível');
                return;
            }
            
            window.RadioCore.toggleTransmission();
            
            const status = window.RADIO_STATE.transmission.isLive ? 'iniciada' : 'pausada';
            console.log(`🎛️ Transmissão ${status}`);
            
        } catch (error) {
            console.error('❌ Erro ao controlar transmissão:', error);
        }
    }
    
    handleVolumeChange(value) {
        try {
            const volume = parseFloat(value) / 100;
            
            console.log('🔊 Volume alterado para:', Math.round(value) + '%');
            
            if (window.RadioCore) {
                window.RadioCore.setVolume(volume);
            }
            
            if (this.elements.volumeDisplay) {
                this.elements.volumeDisplay.textContent = `${Math.round(value)}%`;
            }
            
        } catch (error) {
            console.error('❌ Erro ao alterar volume:', error);
        }
    }
    
    showPasswordModal() {
        console.log('🔐 Abrindo modal de senha admin');
        
        if (this.elements.passwordModal) {
            this.elements.passwordModal.style.display = 'flex';
            
            setTimeout(() => {
                if (this.elements.adminPassword) {
                    this.elements.adminPassword.focus();
                }
            }, 100);
        } else {
            console.error('❌ Modal de senha não encontrado');
        }
    }
    
    async checkAdminPassword() {
        if (!this.elements.adminPassword) {
            console.error('❌ Campo de senha não encontrado');
            return;
        }
        
        const password = this.elements.adminPassword.value.trim();
        
        console.log('🔐 Verificando senha admin...');
        
        try {
            if (!window.AdminPanel) {
                throw new Error('AdminPanel não disponível');
            }
            
            const success = await window.AdminPanel.authenticate(password);
            
            if (success) {
                this.closeModal('passwordModal');
                console.log('🔓 Acesso admin liberado');
            } else {
                console.log('🔒 Senha incorreta');
                alert('Senha incorreta! Tente: admin123');
                this.elements.adminPassword.value = '';
                this.elements.adminPassword.focus();
            }
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error);
            alert('Erro na autenticação. Tente novamente.');
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            
            if (modalId === 'passwordModal' && this.elements.adminPassword) {
                this.elements.adminPassword.value = '';
            }
            
            console.log(`✅ Modal ${modalId} fechado`);
        } else {
            console.warn(`⚠️ Modal ${modalId} não encontrado`);
        }
    }
    
    showErrorMessage(message) {
        console.error('💥 Erro crítico:', message);
        
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                        background: rgba(0,0,0,0.9); display: flex; align-items: center; 
                        justify-content: center; z-index: 99999;">
                <div style="background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; 
                            backdrop-filter: blur(20px); max-width: 500px; text-align: center; color: white;
                            border: 1px solid rgba(255,255,255,0.2);">
                    <h2 style="color: #ff6b6b; margin-bottom: 20px;">❌ Erro Fatal</h2>
                    <p style="margin-bottom: 30px; line-height: 1.5;">${message}</p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button onclick="location.reload()" style="background: #667eea; border: none; 
                                color: white; padding: 15px 25px; border-radius: 10px; cursor: pointer; font-weight: 600;">
                            🔄 Recarregar Página
                        </button>
                        <button onclick="console.clear(); this.parentElement.parentElement.parentElement.remove();" 
                                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                                color: white; padding: 15px 25px; border-radius: 10px; cursor: pointer; font-weight: 600;">
                            🔍 Continuar (Debug)
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
    
    getTotalTracks() {
        let total = 0;
        if (window.RADIO_STATE && window.RADIO_STATE.library) {
            total += window.RADIO_STATE.library.music.length || 0;
            total += window.RADIO_STATE.library.time.length || 0;
            total += window.RADIO_STATE.library.ads.length || 0;
            
            if (window.RADIO_STATE.library.albums) {
                Object.values(window.RADIO_STATE.library.albums).forEach(album => {
                    total += album.length || 0;
                });
            }
        }
        
        return total;
    }
    
    getStatus() {
        return {
            initialized: this.isInitialized,
            totalTracks: this.getTotalTracks(),
            elements: Object.keys(this.elements),
            radioCore: window.RadioCore ? window.RadioCore.getStatus() : null,
            library: window.RADIO_STATE ? window.RADIO_STATE.library : null
        };
    }
}

// Criar instância global
window.RadioApp = new RadioApp();

// Funções globais para compatibilidade com HTML
window.checkAdminPassword = () => {
    console.log('🔐 checkAdminPassword() called');
    if (window.RadioApp && window.RadioApp.isInitialized) {
        window.RadioApp.checkAdminPassword();
    } else {
        console.error('❌ RadioApp não inicializado');
    }
};

window.closeModal = (modalId) => {
    console.log('🚪 closeModal() called for:', modalId);
    if (window.RadioApp && window.RadioApp.isInitialized) {
        window.RadioApp.closeModal(modalId);
    } else {
        // Fallback direto
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            console.log('✅ Modal fechado via fallback');
        }
    }
};

// Função de debug global
window.radioDebug = () => {
    console.log('🐛 === DEBUG INFO ===');
    console.log('📻 RadioApp Status:', window.RadioApp.getStatus());
    console.log('📊 RADIO_STATE:', window.RADIO_STATE);
    console.log('⚙️ RADIO_CONFIG:', window.RADIO_CONFIG);
    console.log('🎵 RadioCore:', window.RadioCore);
    console.log('🛠️ AdminPanel:', window.AdminPanel);
    console.log('🔧 Elements found:', Object.keys(window.RadioApp.elements || {}));
    console.log('🐛 === END DEBUG ===');
};

// Inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎵 === INICIANDO RÁDIO SUPERMERCADO DO LOURO ===');
        console.log('📋 DOM carregado, iniciando sistemas...');
        
        // Aguardar um pouco para garantir que todos os scripts carregaram
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verificar se todas as dependências estão disponíveis
        const dependencies = [
            { name: 'RADIO_CONFIG', obj: window.RADIO_CONFIG },
            { name: 'RADIO_STATE', obj: window.RADIO_STATE },
            { name: 'RADIO_UTILS', obj: window.RADIO_UTILS },
            { name: 'RadioCore', obj: window.RadioCore },
            { name: 'AdminPanel', obj: window.AdminPanel }
        ];
        
        const missing = dependencies.filter(dep => !dep.obj);
        
        if (missing.length > 0) {
            throw new Error(`Dependências não carregadas: ${missing.map(d => d.name).join(', ')}`);
        }
        
        console.log('✅ Todas as dependências carregadas:', dependencies.map(d => d.name).join(', '));
        
        // Inicializar aplicação
        await window.RadioApp.initialize();
        
        console.log('🎉 === SISTEMA INICIALIZADO COM SUCESSO ===');
        console.log('🎵 Rádio Supermercado do Louro está pronta!');
        console.log('💡 Digite "radioDebug()" no console para informações de debug');
        
    } catch (error) {
        console.error('❌ === ERRO FATAL NA INICIALIZAÇÃO ===');
        console.error('💥 Erro:', error.message);
        console.error('🔍 Stack:', error.stack);
        
        if (window.RadioApp && typeof window.RadioApp.showErrorMessage === 'function') {
            window.RadioApp.showErrorMessage(`Erro na inicialização: ${error.message}`);
        } else {
            alert(`❌ Erro crítico: ${error.message}\n\nAbra o console (F12) para mais detalhes.\nRecarregue a página para tentar novamente.`);
        }
    }
});

console.log('✅ main.js carregado com sucesso!');
