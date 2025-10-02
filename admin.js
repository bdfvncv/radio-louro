// ==========================================
// ADMIN.JS - PAINEL ADMINISTRATIVO
// ==========================================

import { radioEngine } from './radio-engine.js';
import { firebaseService } from './firebase-service.js';
import { cloudinaryService } from './cloudinary-service.js';
import { RADIO_CONFIG } from './config.js';

class AdminController {
  constructor() {
    this.currentSection = 'dashboard';
    this.confirmCallback = null;
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

  async init() {
    try {
      console.log('🛠️ Inicializando Admin Panel...');
      
      // Inicializar Radio Engine
      await radioEngine.inicializar('radioPlayer');
      
      // Configurar navegação
      this.setupNavigation();
      
      // Configurar eventos
      this.setupEvents();
      
      // Carregar dados iniciais
      await this.loadDashboard();
      
      // Atualizar status
      this.updateRadioStatus();
      
      console.log('✅ Admin Panel inicializado');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar Admin:', error);
      this.showToast('Erro ao carregar painel', 'error');
    }
  }

  // ============================================
  // NAVEGAÇÃO
  // ============================================

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.navigateTo(section);
      });
    });
  }

  navigateTo(section) {
    // Atualizar nav ativa
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === section) {
        item.classList.add('active');
      }
    });
    
    // Atualizar seção ativa
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
      targetSection.classList.add('active');
      this.currentSection = section;
      
      // Carregar dados da seção
      this.loadSectionData(section);
    }
  }

  async loadSectionData(section) {
    switch(section) {
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'files':
        await this.loadFiles();
        break;
      case 'stats':
        await this.loadStats();
        break;
      case 'config':
        await this.loadConfig();
        break;
    }
  }

  // ============================================
  // EVENTOS
  // ============================================

  setupEvents() {
    // Toggle Transmissão
    document.getElementById('toggleTransmission')?.addEventListener('click', () => {
      this.toggleTransmission();
    });
    
    // Refresh buttons
    document.getElementById('refreshStats')?.addEventListener('click', () => {
      this.loadDashboard();
    });
    
    document.getElementById('refreshFiles')?.addEventListener('click', () => {
      this.loadFiles();
    });
    
    // Reset Stats
    document.getElementById('resetStats')?.addEventListener('click', () => {
      this.resetStats();
    });
    
    // Save Config
    document.getElementById('saveConfig')?.addEventListener('click', () => {
      this.saveConfig();
    });
    
    // Confirm Modal
    document.getElementById('confirmYes')?.addEventListener('click', () => {
      this.confirmAction(true);
    });
    
    document.getElementById('confirmNo')?.addEventListener('click', () => {
      this.confirmAction(false);
    });
  }

  // ============================================
  // DASHBOARD
  // ============================================

  async loadDashboard() {
    try {
      const stats = await firebaseService.buscarEstatisticas();
      
      if (!stats) return;
      
      // Atualizar cards
      this.updateElement('totalMusicas', stats.porCategoria.musicas || 0);
      this.updateElement('totalVinhetas', stats.porCategoria.vinhetas || 0);
      this.updateElement('totalAvisos', stats.porCategoria.avisos || 0);
      this.updateElement('totalReproducoes', stats.totalReproducoes || 0);
      
      // Atualizar "Tocando Agora"
      const trackInfo = radioEngine.getCurrentTrackInfo();
      if (trackInfo) {
        const html = `
          <div style="padding: 1.5rem; background: #f5f5f5; border-radius: 0.75rem;">
            <h4 style="color: #0d4d3d; margin-bottom: 0.5rem;">${this.formatTrackName(trackInfo.nome)}</h4>
            <p style="color: #6c757d; margin-bottom: 1rem;">${this.formatCategoria(trackInfo.categoria)}</p>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #6c757d;">
              <span>${this.formatTime(trackInfo.currentTime)} / ${this.formatTime(trackInfo.duration)}</span>
              <span>${trackInfo.isPlaying ? '▶️ Tocando' : '⏸️ Pausado'}</span>
            </div>
          </div>
        `;
        document.getElementById('nowPlayingInfo').innerHTML = html;
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error);
    }
  }

  // ============================================
  // UPLOAD DE ARQUIVOS
  // ============================================

  async uploadFiles(categoria) {
    try {
      const inputId = `${categoria}Input`;
      const input = document.getElementById(inputId);
      
      if (!input || input.files.length === 0) {
        this.showToast('Selecione pelo menos um arquivo', 'warning');
        return;
      }
      
      // Obter metadados adicionais
      const metadados = this.getUploadMetadata(categoria);
      
      // Mostrar progresso
      this.showUploadProgress();
      
      // Upload múltiplo
      const resultados = await cloudinaryService.uploadMultiplos(
        Array.from(input.files),
        categoria,
        metadados.subcategoria,
        (current, total, filename) => {
          this.updateUploadProgress(current, total, filename);
        }
      );
      
      // Processar resultados
      let sucessos = 0;
      let erros = 0;
      
      for (const resultado of resultados) {
        if (resultado.sucesso) {
          // Salvar no Firestore
          await firebaseService.salvarArquivo({
            ...resultado.arquivo,
            categoria: categoria,
            subcategoria: metadados.subcategoria,
            genero: metadados.genero,
            ritmo: metadados.ritmo,
            horarioIdeal: metadados.horarioIdeal
          });
          sucessos++;
        } else {
          erros++;
          console.error('Erro no upload:', resultado.nomeArquivo, resultado.erro);
        }
      }
      
      // Esconder progresso
      this.hideUploadProgress();
      
      // Feedback
      if (sucessos > 0) {
        this.showToast(`${sucessos} arquivo(s) enviado(s) com sucesso!`, 'success');
      }
      
      if (erros > 0) {
        this.showToast(`${erros} arquivo(s) falharam no upload`, 'error');
      }
      
      // Limpar input
      input.value = '';
      
      // Atualizar dashboard
      await this.loadDashboard();
      
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      this.showToast('Erro ao fazer upload', 'error');
      this.hideUploadProgress();
    }
  }

  getUploadMetadata(categoria) {
    const metadata = {
      subcategoria: 'geral',
      genero: 'outros',
      ritmo: 'moderado',
      horarioIdeal: 'todos'
    };
    
    if (categoria === 'musicas') {
      metadata.subcategoria = document.getElementById('musicCategoria')?.value || 'geral';
      metadata.genero = document.getElementById('musicGenero')?.value || 'outros';
      metadata.ritmo = document.getElementById('musicRitmo')?.value || 'moderado';
      metadata.horarioIdeal = document.getElementById('musicHorario')?.value || 'todos';
    } else if (categoria === 'vinhetas') {
      metadata.subcategoria = document.getElementById('vinhetaTipo')?.value || 'identificacao';
    } else if (categoria === 'avisos') {
      metadata.subcategoria = document.getElementById('avisoTipo')?.value || 'promocoes';
    } else if (categoria === 'propagandas') {
      metadata.subcategoria = document.getElementById('propagandaTipo')?.value || 'produtos';
    }
    
    return metadata;
  }

  showUploadProgress() {
    const progress = document.getElementById('uploadProgress');
    if (progress) {
      progress.style.display = 'block';
      this.updateUploadProgress(0, 1, 'Preparando...');
    }
  }

  updateUploadProgress(current, total, filename) {
    const percent = Math.round((current / total) * 100);
    
    const statusEl = document.getElementById('uploadStatus');
    const percentEl = document.getElementById('uploadPercent');
    const fillEl = document.getElementById('uploadProgressFill');
    
    if (statusEl) statusEl.textContent = `Enviando: ${filename}`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;
  }

  hideUploadProgress() {
    const progress = document.getElementById('uploadProgress');
    if (progress) {
      setTimeout(() => {
        progress.style.display = 'none';
      }, 1000);
    }
  }

  // ============================================
  // GERENCIAR ARQUIVOS
  // ============================================

  async loadFiles() {
    try {
      const categorias = ['musicas', 'vinhetas', 'avisos', 'propagandas'];
      
      for (const categoria of categorias) {
        const arquivos = await firebaseService.buscarArquivosPorCategoria(categoria);
        this.renderFileList(categoria, arquivos);
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar arquivos:', error);
    }
  }

  renderFileList(categoria, arquivos) {
    const listId = `list${this.capitalize(categoria)}`;
    const countId = `count${this.capitalize(categoria)}`;
    
    const listEl = document.getElementById(listId);
    const countEl = document.getElementById(countId);
    
    if (!listEl) return;
    
    // Atualizar contador
    if (countEl) countEl.textContent = arquivos.length;
    
    // Renderizar lista
    if (arquivos.length === 0) {
      listEl.innerHTML = '<p style="color: #6c757d;">Nenhum arquivo encontrado</p>';
      return;
    }
    
    const html = arquivos.map(arq => `
      <div class="file-item">
        <div class="file-info">
          <div class="file-name">${this.formatTrackName(arq.nome)}</div>
          <div class="file-meta">
            ${arq.genero ? `${arq.genero} • ` : ''}
            ${arq.duracao ? this.formatTime(arq.duracao) : ''} • 
            Tocou ${arq.playCount || 0}x
          </div>
        </div>
        <div class="file-actions">
          <button class="btn-icon btn-icon-play" onclick="adminController.playPreview('${arq.cloudinaryUrl}')" title="Preview">
            ▶️
          </button>
          <button class="btn-icon btn-icon-delete" onclick="adminController.deleteFile('${arq.id}', '${arq.cloudinaryPublicId}', '${categoria}')" title="Deletar">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
    
    listEl.innerHTML = html;
  }

  async deleteFile(arquivoId, publicId, categoria) {
    this.showConfirm(
      'Deletar Arquivo',
      'Tem certeza que deseja deletar este arquivo? Esta ação não pode ser desfeita.',
      async () => {
        try {
          // Deletar do Cloudinary
          await cloudinaryService.deleteAudio(publicId);
          
          // Deletar do Firestore
          await firebaseService.delete('arquivos', arquivoId);
          
          this.showToast('Arquivo deletado com sucesso', 'success');
          
          // Atualizar lista
          await this.loadFiles();
          await this.loadDashboard();
          
        } catch (error) {
          console.error('❌ Erro ao deletar:', error);
          this.showToast('Erro ao deletar arquivo', 'error');
        }
      }
    );
  }

  playPreview(url) {
    // Criar player temporário para preview
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play();
    
    this.showToast('Reproduzindo preview', 'info');
    
    // Parar após 10 segundos
    setTimeout(() => audio.pause(), 10000);
  }

  // ============================================
  // ESTATÍSTICAS
  // ============================================

  async loadStats() {
    try {
      const stats = await firebaseService.buscarEstatisticas();
      
      if (!stats || !stats.maisTodastas) return;
      
      const tableBody = document.getElementById('topMusicasTable');
      
      if (stats.maisTodastas.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: #6c757d;">
              Nenhuma música foi tocada ainda
            </td>
          </tr>
        `;
        return;
      }
      
      const html = stats.maisTodastas.map((musica, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${this.formatTrackName(musica.nome)}</td>
          <td>${musica.genero || '-'}</td>
          <td>${musica.subcategoria || 'geral'}</td>
          <td><span class="play-count-badge">${musica.playCount}x</span></td>
        </tr>
      `).join('');
      
      tableBody.innerHTML = html;
      
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }

  resetStats() {
    this.showConfirm(
      'Resetar Estatísticas',
      'Tem certeza que deseja resetar todos os contadores de reprodução? Esta ação não pode ser desfeita.',
      async () => {
        try {
          const arquivos = await firebaseService.getAll('arquivos');
          
          for (const arq of arquivos) {
            await firebaseService.update('arquivos', arq.id, {
              playCount: 0,
              ultimaReproducao: null
            });
          }
          
          this.showToast('Estatísticas resetadas com sucesso', 'success');
          await this.loadStats();
          await this.loadDashboard();
          
        } catch (error) {
          console.error('Erro ao resetar stats:', error);
          this.showToast('Erro ao resetar estatísticas', 'error');
        }
      }
    );
  }

  // ============================================
  // CONFIGURAÇÕES
  // ============================================

  async loadConfig() {
    try {
      const [configRotacao, configTransmissao] = await Promise.all([
        firebaseService.buscarConfigRotacao(),
        firebaseService.buscarConfig()
      ]);
      
      // Preencher campos
      if (configRotacao) {
        this.updateElement('configIntervalo', configRotacao.intervaloMinimo, 'value');
        document.getElementById('configBalancearGeneros').checked = configRotacao.balancearGeneros;
        document.getElementById('configBalancearRitmos').checked = configRotacao.balancearRitmos;
        document.getElementById('configConsiderarHorario').checked = configRotacao.considerarHorario;
      }
      
      if (configTransmissao) {
        this.updateElement('configAlbumAtivo', configTransmissao.albumAtivo || 'geral', 'value');
      }
      
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    }
  }

  async saveConfig() {
    try {
      // Salvar config de rotação
      await firebaseService.set('config', 'rotacao', {
        intervaloMinimo: parseInt(document.getElementById('configIntervalo').value),
        balancearGeneros: document.getElementById('configBalancearGeneros').checked,
        balancearRitmos: document.getElementById('configBalancearRitmos').checked,
        considerarHorario: document.getElementById('configConsiderarHorario').checked
      });
      
      // Salvar álbum ativo
      const albumAtivo = document.getElementById('configAlbumAtivo').value;
      const config = await firebaseService.buscarConfig();
      await firebaseService.salvarConfig({
        ...config,
        albumAtivo: albumAtivo
      });
      
      this.showToast('Configurações salvas com sucesso', 'success');
      
    } catch (error) {
      console.error('Erro ao salvar config:', error);
      this.showToast('Erro ao salvar configurações', 'error');
    }
  }

  // ============================================
  // CONTROLE DE TRANSMISSÃO
  // ============================================

  async toggleTransmission() {
    if (radioEngine.isTransmitting) {
      await radioEngine.pararTransmissao();
      this.showToast('Transmissão parada', 'warning');
    } else {
      await radioEngine.iniciarTransmissao();
      this.showToast('Transmissão iniciada', 'success');
    }
    
    this.updateRadioStatus();
  }

  updateRadioStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const toggleBtn = document.getElementById('toggleTransmission');
    const toggleBtnText = document.getElementById('toggleBtnText');
    
    if (radioEngine.isTransmitting) {
      statusDot?.classList.remove('offline');
      if (statusText) statusText.textContent = 'AO VIVO';
      if (toggleBtnText) toggleBtnText.textContent = 'Parar';
      toggleBtn?.classList.remove('btn-secondary-admin');
      toggleBtn?.classList.add('btn-danger-admin');
    } else {
      statusDot?.classList.add('offline');
      if (statusText) statusText.textContent = 'OFFLINE';
      if (toggleBtnText) toggleBtnText.textContent = 'Iniciar';
      toggleBtn?.classList.remove('btn-danger-admin');
      toggleBtn?.classList.add('btn-secondary-admin');
    }
  }

  // ============================================
  // MODAL DE CONFIRMAÇÃO
  // ============================================

  showConfirm(title, message, callback) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    
    this.confirmCallback = callback;
    
    modal?.classList.add('active');
  }

  confirmAction(confirmed) {
    const modal = document.getElementById('confirmModal');
    modal?.classList.remove('active');
    
    if (confirmed && this.confirmCallback) {
      this.confirmCallback();
    }
    
    this.confirmCallback = null;
  }

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================
  // UTILITÁRIOS
  // ============================================

  updateElement(id, value, property = 'textContent') {
    const el = document.getElementById(id);
    if (el) {
      el[property] = value;
    }
  }

  formatTrackName(nome) {
    if (!nome) return 'Sem título';
    return nome.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
  }

  formatCategoria(categoria) {
    const map = {
      'musicas': 'Música',
      'vinhetas': 'Vinheta',
      'avisos': 'Aviso',
      'propagandas': 'Propaganda',
      'horaCerta': 'Hora Certa'
    };
    return map[categoria] || 'Música';
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Criar instância global
window.adminController = new AdminController();

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminController.init();
  });
} else {
  window.adminController.init();
}

console.log('Admin.js carregado');
