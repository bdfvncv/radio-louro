// ==========================================
// ADMIN.JS - PAINEL ADMINISTRATIVO
// ==========================================

import { radioEngine } from './radio-engine.js';
import { supabaseService } from './supabase-service.js';
import { cloudinaryService } from './cloudinary_service.js';

class AdminController {
  constructor() {
    this.currentSection = 'dashboard';
  }

  async init() {
    try {
      console.log('🛠️ Init Admin...');
      
      await radioEngine.inicializar('radioPlayer');
      
      this.setupNavigation();
      this.setupEvents();
      
      await this.loadDashboard();
      this.updateRadioStatus();
      
      console.log('✅ Admin OK');
    } catch (error) {
      console.error('❌ Erro:', error);
      this.showToast('Erro ao carregar', 'error');
    }
  }

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
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === section) {
        item.classList.add('active');
      }
    });
    
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
      targetSection.classList.add('active');
      this.currentSection = section;
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
      case 'config':
        await this.loadConfig();
        break;
    }
  }

  setupEvents() {
    document.getElementById('toggleTransmission')?.addEventListener('click', () => {
      this.toggleTransmission();
    });
    
    document.getElementById('refreshStats')?.addEventListener('click', () => {
      this.loadDashboard();
    });
    
    document.getElementById('refreshFiles')?.addEventListener('click', () => {
      this.loadFiles();
    });
    
    document.getElementById('saveConfig')?.addEventListener('click', () => {
      this.saveConfig();
    });
  }

  async loadDashboard() {
    try {
      const stats = await supabaseService.buscarEstatisticas();
      if (!stats) return;
      
      this.updateElement('totalMusicas', stats.porCategoria.musicas || 0);
      this.updateElement('totalVinhetas', stats.porCategoria.vinhetas || 0);
      this.updateElement('totalAvisos', stats.porCategoria.avisos || 0);
      this.updateElement('totalReproducoes', stats.totalReproducoes || 0);
      
      const trackInfo = radioEngine.getCurrentTrackInfo();
      if (trackInfo) {
        const html = `
          <div style="padding:1.5rem;background:#f5f5f5;border-radius:0.75rem">
            <h4 style="color:#0d4d3d;margin-bottom:0.5rem">${this.formatTrackName(trackInfo.nome)}</h4>
            <p style="color:#6c757d">${this.formatCategoria(trackInfo.categoria)}</p>
          </div>
        `;
        document.getElementById('nowPlayingInfo').innerHTML = html;
      }
    } catch (error) {
      console.error('❌ Erro dashboard:', error);
    }
  }

  async uploadFiles(categoria) {
    try {
      const inputId = `${categoria}Input`;
      const input = document.getElementById(inputId);
      
      if (!input || input.files.length === 0) {
        this.showToast('Selecione arquivos', 'warning');
        return;
      }
      
      const metadados = this.getUploadMetadata(categoria);
      this.showUploadProgress();
      
      const resultados = await cloudinaryService.uploadMultiplos(
        Array.from(input.files),
        categoria,
        metadados.subcategoria,
        (current, total, filename) => {
          this.updateUploadProgress(current, total, filename);
        }
      );
      
      let sucessos = 0;
      let erros = 0;
      
      for (const resultado of resultados) {
        if (resultado.sucesso) {
          await supabaseService.salvarArquivo({
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
        }
      }
      
      this.hideUploadProgress();
      
      if (sucessos > 0) {
        this.showToast(`${sucessos} arquivo(s) enviado(s)!`, 'success');
      }
      
      if (erros > 0) {
        this.showToast(`${erros} falhou(ram)`, 'error');
      }
      
      input.value = '';
      await this.loadDashboard();
    } catch (error) {
      console.error('❌ Erro upload:', error);
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

  async loadFiles() {
    try {
      const categorias = ['musicas', 'vinhetas', 'avisos'];
      for (const categoria of categorias) {
        const arquivos = await supabaseService.buscarArquivosPorCategoria(categoria);
        this.renderFileList(categoria, arquivos);
      }
    } catch (error) {
      console.error('❌ Erro files:', error);
    }
  }

  renderFileList(categoria, arquivos) {
    const listId = `list${this.capitalize(categoria)}`;
    const listEl = document.getElementById(listId);
    
    if (!listEl) return;
    
    if (arquivos.length === 0) {
      listEl.innerHTML = '<p style="color:#6c757d">Nenhum arquivo</p>';
      return;
    }
    
    const html = arquivos.map(arq => `
      <div class="file-item">
        <div class="file-info">
          <div class="file-name">${this.formatTrackName(arq.nome)}</div>
          <div class="file-meta">${arq.play_count || 0}x reproduzido</div>
        </div>
      </div>
    `).join('');
    
    listEl.innerHTML = html;
  }

  async loadConfig() {
    try {
      const [configRotacao, configTransmissao] = await Promise.all([
        supabaseService.buscarConfigRotacao(),
        supabaseService.buscarConfig()
      ]);
      
      if (configRotacao) {
        this.updateElement('configIntervalo', configRotacao.intervalo_minimo, 'value');
      }
      
      if (configTransmissao) {
        this.updateElement('configAlbumAtivo', configTransmissao.album_ativo || 'geral', 'value');
      }
    } catch (error) {
      console.error('❌ Erro config:', error);
    }
  }

  async saveConfig() {
    try {
      await supabaseService.salvarConfig({
        tipo: 'rotacao',
        intervalo_minimo: parseInt(document.getElementById('configIntervalo').value)
      });
      
      const albumAtivo = document.getElementById('configAlbumAtivo').value;
      const config = await supabaseService.buscarConfig();
      await supabaseService.salvarConfig({
        ...config,
        album_ativo: albumAtivo
      });
      
      this.showToast('Config salvas', 'success');
    } catch (error) {
      console.error('❌ Erro:', error);
      this.showToast('Erro ao salvar', 'error');
    }
  }

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
    } else {
      statusDot?.classList.add('offline');
      if (statusText) statusText.textContent = 'OFFLINE';
      if (toggleBtnText) toggleBtnText.textContent = 'Iniciar';
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:1rem 1.5rem;background:#0d4d3d;color:white;border-radius:0.75rem;z-index:9999';
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  updateElement(id, value, property = 'textContent') {
    const el = document.getElementById(id);
    if (el) el[property] = value;
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

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

window.adminController = new AdminController();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminController.init();
  });
} else {
  window.adminController.init();
}

console.log('✅ Admin.js carregado');
