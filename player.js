// ==========================================
// PLAYER.JS - INTERFACE PÚBLICA
// ==========================================

import { radioEngine } from './radio-engine.js';
import { firebaseService } from './firebase-service.js';

class PlayerUI {
  constructor() {
    this.elements = {};
    this.historico = [];
    this.isInitialized = false;
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

  async init() {
    try {
      console.log('🎵 Inicializando Player UI...');
      
      // Buscar elementos DOM
      this.cacheElements();
      
      // Configurar eventos
      this.setupEvents();
      
      // Inicializar Radio Engine
      await radioEngine.inicializar('radioPlayer');
      
      // Configurar listeners do engine
      this.setupEngineListeners();
      
      // Carregar histórico
      await this.carregarHistorico();
      
      // Ocultar loading
      this.hideLoading();
      
      this.isInitialized = true;
      console.log('✅ Player UI inicializado');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar Player:', error);
      this.showError('Erro ao carregar rádio. Recarregue a página.');
    }
  }

  cacheElements() {
    const ids = [
      'radioPlayer', 'playPauseBtn', 'nextBtn', 'prevBtn',
      'volumeSlider', 'volumeValue', 'volumeIcon',
      'trackTitle', 'trackArtist', 'trackCategory',
      'albumCover', 'currentTime', 'duration',
      'progressBar', 'progressFill', 'historyList',
      'liveStatus', 'liveBadge', 'equalizer',
      'shareBtn', 'shareModal', 'closeShareModal',
      'shareWhatsapp', 'shareFacebook', 'shareTwitter',
      'shareLinkInput', 'copyLinkBtn', 'loadingOverlay'
    ];
    
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  }

  setupEvents() {
    // Controles
    this.elements.playPauseBtn?.addEventListener('click', () => this.togglePlay());
    this.elements.nextBtn?.addEventListener('click', () => this.pularMusica());
    this.elements.prevBtn?.addEventListener('click', () => this.voltarMusica());
    
    // Volume
    this.elements.volumeSlider?.addEventListener('input', (e) => this.updateVolume(e));
    
    // Progresso
    this.elements.progressBar?.addEventListener('click', (e) => this.seekTrack(e));
    
    // Compartilhar
    this.elements.shareBtn?.addEventListener('click', () => this.openShareModal());
    this.elements.closeShareModal?.addEventListener('click', () => this.closeShareModal());
    this.elements.shareWhatsapp?.addEventListener('click', () => this.shareOnWhatsapp());
    this.elements.shareFacebook?.addEventListener('click', () => this.shareOnFacebook());
    this.elements.shareTwitter?.addEventListener('click', () => this.shareOnTwitter());
    this.elements.copyLinkBtn?.addEventListener('click', () => this.copyLink());
    
    // Fechar modal ao clicar fora
    this.elements.shareModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.shareModal) {
        this.closeShareModal();
      }
    });
    
    // Atalhos de teclado
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  setupEngineListeners() {
    // Quando track muda
    radioEngine.addEventListener('trackChanged', (track) => {
      this.updateTrackInfo(track);
      this.addToHistory(track);
    });
    
    // Atualização de tempo
    radioEngine.addEventListener('timeUpdate', (progress) => {
      this.updateProgress(progress);
    });
    
    // Transmissão iniciada
    radioEngine.addEventListener('transmissaoIniciada', () => {
      this.updateLiveStatus(true);
    });
    
    // Transmissão parada
    radioEngine.addEventListener('transmissaoParada', () => {
      this.updateLiveStatus(false);
    });
  }

  // ============================================
  // CONTROLES DO PLAYER
  // ============================================

  togglePlay() {
    const player = this.elements.radioPlayer;
    
    if (!radioEngine.isTransmitting) {
      // Iniciar transmissão
      radioEngine.iniciarTransmissao();
      this.elements.playPauseBtn.textContent = '⏸️';
    } else {
      // Toggle play/pause
      if (player.paused) {
        player.play();
        this.elements.playPauseBtn.textContent = '⏸️';
      } else {
        player.pause();
        this.elements.playPauseBtn.textContent = '▶️';
      }
    }
  }

  async pularMusica() {
    await radioEngine.pularMusica();
  }

  voltarMusica() {
    // Voltar para início da música atual
    if (this.elements.radioPlayer) {
      this.elements.radioPlayer.currentTime = 0;
    }
  }

  updateVolume(event) {
    const volume = event.target.value;
    radioEngine.setVolume(volume);
    
    if (this.elements.volumeValue) {
      this.elements.volumeValue.textContent = `${volume}%`;
    }
    
    // Atualizar ícone
    this.updateVolumeIcon(volume);
  }

  updateVolumeIcon(volume) {
    if (!this.elements.volumeIcon) return;
    
    if (volume == 0) {
      this.elements.volumeIcon.textContent = '🔇';
    } else if (volume < 50) {
      this.elements.volumeIcon.textContent = '🔉';
    } else {
      this.elements.volumeIcon.textContent = '🔊';
    }
  }

  seekTrack(event) {
    const player = this.elements.radioPlayer;
    if (!player || !player.duration) return;
    
    const rect = this.elements.progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const seekTime = percent * player.duration;
    
    player.currentTime = seekTime;
  }

  // ============================================
  // ATUALIZAÇÃO DE INTERFACE
  // ============================================

  updateTrackInfo(track) {
    if (!track) return;
    
    // Título
    if (this.elements.trackTitle) {
      this.elements.trackTitle.textContent = this.formatTrackName(track.nome);
    }
    
    // Artista/Descrição
    if (this.elements.trackArtist) {
      this.elements.trackArtist.textContent = this.getTrackDescription(track);
    }
    
    // Categoria
    if (this.elements.trackCategory) {
      this.elements.trackCategory.textContent = this.formatCategoria(track.categoria);
    }
    
    // Capa (se houver)
    // TODO: Implementar sistema de capas por música
    
    console.log(`🎵 Tocando: ${track.nome}`);
  }

  updateProgress(progress) {
    if (!progress) return;
    
    // Barra de progresso
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${progress.percentage}%`;
    }
    
    // Tempo atual
    if (this.elements.currentTime) {
      this.elements.currentTime.textContent = this.formatTime(progress.current);
    }
    
    // Duração
    if (this.elements.duration) {
      this.elements.duration.textContent = this.formatTime(progress.duration);
    }
  }

  updateLiveStatus(isLive) {
    if (!this.elements.liveStatus) return;
    
    if (isLive) {
      this.elements.liveStatus.textContent = 'AO VIVO';
      this.elements.liveBadge?.classList.add('active');
      this.startEqualizer();
    } else {
      this.elements.liveStatus.textContent = 'OFFLINE';
      this.elements.liveBadge?.classList.remove('active');
      this.stopEqualizer();
    }
  }

  // ============================================
  // HISTÓRICO "TOCOU AGORA"
  // ============================================

  async carregarHistorico() {
    try {
      const historico = await firebaseService.buscarHistoricoRecente(5);
      
      if (historico.length === 0) return;
      
      this.historico = historico;
      this.renderHistorico();
      
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
    }
  }

  addToHistory(track) {
    const item = {
      nome: track.nome,
      categoria: track.categoria,
      timestamp: new Date()
    };
    
    this.historico.unshift(item);
    
    // Manter apenas 5
    if (this.historico.length > 5) {
      this.historico.pop();
    }
    
    this.renderHistorico();
  }

  renderHistorico() {
    if (!this.elements.historyList) return;
    
    if (this.historico.length === 0) {
      this.elements.historyList.innerHTML = `
        <li class="history-item">
          <span class="history-time">--:--</span>
          <span class="history-track">Nenhuma música tocada ainda</span>
        </li>
      `;
      return;
    }
    
    const html = this.historico.map(item => `
      <li class="history-item">
        <span class="history-time">${this.formatTimestamp(item.timestamp)}</span>
        <span class="history-track">${this.formatTrackName(item.nome)}</span>
      </li>
    `).join('');
    
    this.elements.historyList.innerHTML = html;
  }

  // ============================================
  // COMPARTILHAMENTO
  // ============================================

  openShareModal() {
    if (!this.elements.shareModal) return;
    
    this.elements.shareModal.classList.add('active');
    
    // Preencher link
    if (this.elements.shareLinkInput) {
      this.elements.shareLinkInput.value = window.location.href;
    }
  }

  closeShareModal() {
    if (!this.elements.shareModal) return;
    this.elements.shareModal.classList.remove('active');
  }

  shareOnWhatsapp() {
    const text = encodeURIComponent('Ouça a Rádio Supermercado do Louro ao vivo!');
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  }

  shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }

  shareOnTwitter() {
    const text = encodeURIComponent('Ouça a Rádio Supermercado do Louro ao vivo!');
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  async copyLink() {
    try {
      const link = window.location.href;
      await navigator.clipboard.writeText(link);
      
      // Feedback visual
      const btn = this.elements.copyLinkBtn;
      const originalText = btn.textContent;
      btn.textContent = '✅ Copiado!';
      btn.style.background = '#28a745';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro ao copiar link:', error);
      alert('Erro ao copiar link');
    }
  }

  // ============================================
  // EQUALIZADOR VISUAL
  // ============================================

  startEqualizer() {
    if (!this.elements.equalizer) return;
    this.elements.equalizer.classList.add('active');
  }

  stopEqualizer() {
    if (!this.elements.equalizer) return;
    this.elements.equalizer.classList.remove('active');
  }

  // ============================================
  // ATALHOS DE TECLADO
  // ============================================

  handleKeyboard(event) {
    // Espaço = Play/Pause
    if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
      event.preventDefault();
      this.togglePlay();
    }
    
    // Seta direita = Próxima
    if (event.code === 'ArrowRight') {
      event.preventDefault();
      this.pularMusica();
    }
    
    // Seta esquerda = Voltar ao início
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      this.voltarMusica();
    }
    
    // Seta cima = Volume +
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      const vol = Math.min(100, parseInt(this.elements.volumeSlider.value) + 5);
      this.elements.volumeSlider.value = vol;
      this.updateVolume({ target: { value: vol } });
    }
    
    // Seta baixo = Volume -
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      const vol = Math.max(0, parseInt(this.elements.volumeSlider.value) - 5);
      this.elements.volumeSlider.value = vol;
      this.updateVolume({ target: { value: vol } });
    }
  }

  // ============================================
  // UTILITÁRIOS
  // ============================================

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatTimestamp(date) {
    if (!date) return '--:--';
    
    const d = date instanceof Date ? date : new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  formatTrackName(nome) {
    if (!nome) return 'Sem título';
    
    // Remove extensão
    return nome.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
  }

  formatCategoria(categoria) {
    const map = {
      'musicas': '🎵 Música',
      'vinhetas': '📻 Vinheta',
      'avisos': '📢 Aviso',
      'propagandas': '📣 Propaganda',
      'horaCerta': '🕐 Hora Certa'
    };
    
    return map[categoria] || '🎵 Música';
  }

  getTrackDescription(track) {
    if (track.categoria === 'musicas') {
      return track.subcategoria 
        ? this.capitalize(track.subcategoria) 
        : 'Música Geral';
    }
    
    return this.formatCategoria(track.categoria).replace(/[^\w\s]/gi, '').trim();
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  hideLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.classList.add('hidden');
      setTimeout(() => {
        this.elements.loadingOverlay.style.display = 'none';
      }, 300);
    }
  }

  showError(message) {
    alert(message);
    this.hideLoading();
  }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const player = new PlayerUI();
    player.init();
  });
} else {
  const player = new PlayerUI();
  player.init();
}

console.log('✅ Player.js carregado');
