// ==========================================
// PLAYER.JS - INTERFACE PÚBLICA (SUPABASE)
// ==========================================

import { radioEngine } from './radio-engine.js';
import { supabaseService } from './supabase-service.js';

class PlayerUI {
  constructor() {
    this.elements = {};
    this.historico = [];
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('🎵 Inicializando Player...');
      
      this.cacheElements();
      this.setupEvents();
      
      await radioEngine.inicializar('radioPlayer');
      
      this.setupEngineListeners();
      await this.carregarHistorico();
      this.hideLoading();
      
      this.isInitialized = true;
      console.log('✅ Player inicializado');
    } catch (error) {
      console.error('❌ Erro:', error);
      this.showError('Erro ao carregar rádio');
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
    this.elements.playPauseBtn?.addEventListener('click', () => this.togglePlay());
    this.elements.nextBtn?.addEventListener('click', () => this.pularMusica());
    this.elements.prevBtn?.addEventListener('click', () => this.voltarMusica());
    this.elements.volumeSlider?.addEventListener('input', (e) => this.updateVolume(e));
    this.elements.progressBar?.addEventListener('click', (e) => this.seekTrack(e));
    this.elements.shareBtn?.addEventListener('click', () => this.openShareModal());
    this.elements.closeShareModal?.addEventListener('click', () => this.closeShareModal());
    this.elements.shareWhatsapp?.addEventListener('click', () => this.shareOnWhatsapp());
    this.elements.shareFacebook?.addEventListener('click', () => this.shareOnFacebook());
    this.elements.shareTwitter?.addEventListener('click', () => this.shareOnTwitter());
    this.elements.copyLinkBtn?.addEventListener('click', () => this.copyLink());
    
    this.elements.shareModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.shareModal) {
        this.closeShareModal();
      }
    });
    
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  setupEngineListeners() {
    radioEngine.addEventListener('trackChanged', (track) => {
      this.updateTrackInfo(track);
      this.addToHistory(track);
    });
    
    radioEngine.addEventListener('timeUpdate', (progress) => {
      this.updateProgress(progress);
    });
    
    radioEngine.addEventListener('transmissaoIniciada', () => {
      this.updateLiveStatus(true);
    });
    
    radioEngine.addEventListener('transmissaoParada', () => {
      this.updateLiveStatus(false);
    });
  }

  togglePlay() {
    const player = this.elements.radioPlayer;
    
    if (!radioEngine.isTransmitting) {
      radioEngine.iniciarTransmissao();
      this.elements.playPauseBtn.textContent = '⏸️';
    } else {
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

  updateTrackInfo(track) {
    if (!track) return;
    
    if (this.elements.trackTitle) {
      this.elements.trackTitle.textContent = this.formatTrackName(track.nome);
    }
    
    if (this.elements.trackArtist) {
      this.elements.trackArtist.textContent = this.getTrackDescription(track);
    }
    
    if (this.elements.trackCategory) {
      this.elements.trackCategory.textContent = this.formatCategoria(track.categoria);
    }
    
    console.log(`🎵 Tocando: ${track.nome}`);
  }

  updateProgress(progress) {
    if (!progress) return;
    
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${progress.percentage}%`;
    }
    
    if (this.elements.currentTime) {
      this.elements.currentTime.textContent = this.formatTime(progress.current);
    }
    
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

  async carregarHistorico() {
    try {
      const historico = await supabaseService.buscarHistoricoRecente(5);
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
          <span class="history-track">Nenhuma música tocada</span>
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

  openShareModal() {
    if (!this.elements.shareModal) return;
    this.elements.shareModal.classList.add('active');
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
    const text = encodeURIComponent('Ouça a Rádio Supermercado do Louro!');
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const btn = this.elements.copyLinkBtn;
      const originalText = btn.textContent;
      btn.textContent = '✅ Copiado!';
      btn.style.background = '#28a745';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 2000);
    } catch (error) {
      console.error('❌ Erro ao copiar:', error);
      alert('Erro ao copiar link');
    }
  }

  startEqualizer() {
    if (!this.elements.equalizer) return;
    this.elements.equalizer.classList.add('active');
  }

  stopEqualizer() {
    if (!this.elements.equalizer) return;
    this.elements.equalizer.classList.remove('active');
  }

  handleKeyboard(event) {
    if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
      event.preventDefault();
      this.togglePlay();
    }
    
    if (event.code === 'ArrowRight') {
      event.preventDefault();
      this.pularMusica();
    }
    
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      this.voltarMusica();
    }
    
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      const vol = Math.min(100, parseInt(this.elements.volumeSlider.value) + 5);
      this.elements.volumeSlider.value = vol;
      this.updateVolume({ target: { value: vol } });
    }
    
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      const vol = Math.max(0, parseInt(this.elements.volumeSlider.value) - 5);
      this.elements.volumeSlider.value = vol;
      this.updateVolume({ target: { value: vol } });
    }
  }

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
      return track.subcategoria ? this.capitalize(track.subcategoria) : 'Música Geral';
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
