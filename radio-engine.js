// ==========================================
// RADIO ENGINE - MOTOR PRINCIPAL
// ==========================================

import { RADIO_CONFIG } from './config.js';
import { supabaseService } from './supabase-service.js';
import { cloudinaryService } from './cloudinary-service.js';

class RadioEngine {
  constructor() {
    this.audioPlayer = null;
    this.isTransmitting = false;
    this.currentTrack = null;
    this.currentHistoricoId = null;
    this.fila = [];
    this.listeners = [];
    
    this.stats = {
      musicasTocadas: 0,
      ultimosGeneros: [],
      ultimoRitmo: null
    };
  }

  async inicializar(audioElementId = 'radioPlayer') {
    try {
      console.log('🎵 Iniciando Radio Engine...');
      
      this.audioPlayer = document.getElementById(audioElementId);
      if (!this.audioPlayer) {
        throw new Error('Elemento de áudio não encontrado');
      }
      
      this.configurarEventosPlayer();
      
      const config = await supabaseService.buscarConfig();
      this.isTransmitting = config?.ativa || false;
      
      console.log('✅ Radio Engine inicializado');
      
      if (this.isTransmitting) {
        await this.iniciarTransmissao();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar:', error);
      throw error;
    }
  }

  configurarEventosPlayer() {
    this.audioPlayer.addEventListener('ended', () => this.onTrackEnded());
    this.audioPlayer.addEventListener('error', (e) => this.onPlayerError(e));
    this.audioPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
    console.log('✅ Eventos configurados');
  }

  async iniciarTransmissao() {
    try {
      console.log('🔴 Iniciando transmissão...');
      this.isTransmitting = true;
      
      await supabaseService.salvarConfig({ ativa: true });
      await this.reproduzirProximo();
      this.notificarListeners('transmissaoIniciada');
      
      console.log('✅ Transmissão iniciada');
    } catch (error) {
      console.error('❌ Erro ao iniciar:', error);
      this.isTransmitting = false;
      throw error;
    }
  }

  async pararTransmissao() {
    console.log('⏹️ Parando transmissão...');
    this.isTransmitting = false;
    
    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }
    
    await supabaseService.salvarConfig({ ativa: false });
    this.notificarListeners('transmissaoParada');
    console.log('✅ Transmissão parada');
  }

  async montarProximaSequencia() {
    try {
      console.log('📋 Montando sequência...');
      const sequencia = [];
      const horarioAtual = this.determinarHorario();
      
      for (const bloco of RADIO_CONFIG.sequenciaPadrao) {
        for (let i = 0; i < bloco.quantidade; i++) {
          let item;
          
          if (bloco.tipo === 'musica') {
            item = await this.selecionarMusica(horarioAtual);
          } else {
            item = await this.selecionarOutro(bloco.tipo, bloco.subtipo);
          }
          
          if (item) {
            sequencia.push(item);
          }
        }
      }
      
      console.log(`✅ Sequência: ${sequencia.length} itens`);
      return sequencia;
    } catch (error) {
      console.error('❌ Erro ao montar sequência:', error);
      return [];
    }
  }

  async selecionarMusica(horarioAtual) {
    try {
      const config = await supabaseService.buscarConfigRotacao();
      const configGeral = await supabaseService.buscarConfig();
      const albumAtivo = configGeral?.album_ativo || 'geral';
      
      let musicasDisponiveis = await supabaseService.buscarMusicasDisponiveis(
        'musicas',
        config.intervalo_minimo
      );
      
      if (albumAtivo && albumAtivo !== 'geral') {
        musicasDisponiveis = musicasDisponiveis.filter(
          m => m.subcategoria === albumAtivo
        );
      }
      
      if (musicasDisponiveis.length === 0) {
        console.log('⚠️ Sem músicas, resetando pool');
        musicasDisponiveis = await supabaseService.buscarArquivosPorCategoria(
          'musicas', 
          albumAtivo === 'geral' ? null : albumAtivo
        );
        this.stats.ultimosGeneros = [];
      }
      
      if (musicasDisponiveis.length === 0) {
        console.log('⚠️ Nenhuma música válida');
        return null;
      }
      
      const musicaSelecionada = musicasDisponiveis[
        Math.floor(Math.random() * musicasDisponiveis.length)
      ];
      
      this.atualizarStats(musicaSelecionada);
      console.log(`🎵 Selecionada: ${musicaSelecionada.nome}`);
      return musicaSelecionada;
    } catch (error) {
      console.error('❌ Erro ao selecionar música:', error);
      return null;
    }
  }

  async selecionarOutro(tipo, subtipo = null) {
    try {
      let arquivos = await supabaseService.buscarArquivosPorCategoria(tipo, subtipo);
      
      if (arquivos.length === 0) {
        console.log(`⚠️ Nenhum ${tipo} encontrado`);
        return null;
      }
      
      const selecionado = arquivos[Math.floor(Math.random() * arquivos.length)];
      console.log(`📢 ${tipo}: ${selecionado.nome}`);
      return selecionado;
    } catch (error) {
      console.error(`❌ Erro ao selecionar ${tipo}:`, error);
      return null;
    }
  }

  async reproduzirProximo() {
    try {
      if (!this.isTransmitting) {
        console.log('⏸️ Transmissão parada');
        return;
      }
      
      if (this.fila.length === 0) {
        const novaSequencia = await this.montarProximaSequencia();
        this.fila = [...novaSequencia];
        this.stats.ultimosGeneros = [];
      }
      
      const proximoItem = this.fila.shift();
      
      if (!proximoItem) {
        console.log('⚠️ Fila vazia');
        setTimeout(() => this.reproduzirProximo(), 5000);
        return;
      }
      
      await this.reproduzir(proximoItem);
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
      setTimeout(() => this.reproduzirProximo(), 5000);
    }
  }

  async reproduzir(item) {
    try {
      console.log(`▶️ Reproduzindo: ${item.nome}`);
      this.currentTrack = item;
      
      this.currentHistoricoId = await supabaseService.salvarHistorico({
        arquivoId: item.id,
        nome: item.nome,
        categoria: item.categoria
      });
      
      await supabaseService.incrementarPlayCount(item.id);
      
      const streamUrl = cloudinaryService.getCachedUrl(item.cloudinary_public_id);
      this.audioPlayer.src = streamUrl;
      
      await supabaseService.salvarConfig({
        ativa: true,
        musica_atual: {
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          iniciado_em: new Date().toISOString()
        }
      });
      
      await this.audioPlayer.play();
      this.notificarListeners('trackChanged', item);
      this.stats.musicasTocadas++;
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
      setTimeout(() => this.reproduzirProximo(), 2000);
    }
  }

  async onTrackEnded() {
    console.log('✅ Track finalizado');
    
    if (this.currentHistoricoId) {
      await supabaseService.finalizarHistorico(this.currentHistoricoId, true);
    }
    
    await this.reproduzirProximo();
  }

  onTimeUpdate() {
    if (!this.currentTrack || !this.audioPlayer) return;
    
    const progresso = {
      current: this.audioPlayer.currentTime,
      duration: this.audioPlayer.duration,
      percentage: (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100
    };
    
    this.notificarListeners('timeUpdate', progresso);
  }

  onPlayerError(error) {
    console.error('❌ Erro no player:', error);
    setTimeout(() => {
      if (this.isTransmitting) {
        this.reproduzirProximo();
      }
    }, 3000);
  }

  determinarHorario() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 12) return 'manha';
    if (hora >= 12 && hora < 18) return 'tarde';
    if (hora >= 18 && hora < 22) return 'noite';
    return 'madrugada';
  }

  atualizarStats(musica) {
    if (musica.genero) {
      this.stats.ultimosGeneros.push(musica.genero);
      if (this.stats.ultimosGeneros.length > RADIO_CONFIG.historicoMaximo) {
        this.stats.ultimosGeneros.shift();
      }
    }
    this.stats.ultimoRitmo = musica.ritmo;
  }

  async pularMusica() {
    console.log('⏭️ Pulando música...');
    if (this.currentHistoricoId) {
      await supabaseService.finalizarHistorico(this.currentHistoricoId, false);
    }
    await this.reproduzirProximo();
  }

  setVolume(volume) {
    if (!this.audioPlayer) return;
    const vol = Math.max(0, Math.min(1, volume / 100));
    this.audioPlayer.volume = vol;
    console.log(`🔊 Volume: ${Math.round(vol * 100)}%`);
  }

  getCurrentTrackInfo() {
    if (!this.currentTrack) return null;
    return {
      id: this.currentTrack.id,
      nome: this.currentTrack.nome,
      categoria: this.currentTrack.categoria,
      duracao: this.currentTrack.duracao,
      currentTime: this.audioPlayer ? this.audioPlayer.currentTime : 0,
      duration: this.audioPlayer ? this.audioPlayer.duration : 0,
      isPlaying: this.audioPlayer ? !this.audioPlayer.paused : false
    };
  }

  addEventListener(eventName, callback) {
    this.listeners.push({ eventName, callback });
  }

  removeEventListener(eventName, callback) {
    this.listeners = this.listeners.filter(
      l => l.eventName !== eventName || l.callback !== callback
    );
  }

  notificarListeners(eventName, data = null) {
    this.listeners
      .filter(l => l.eventName === eventName)
      .forEach(l => {
        try {
          l.callback(data);
        } catch (error) {
          console.error('❌ Erro no listener:', error);
        }
      });
  }
}

export const radioEngine = new RadioEngine();
console.log('✅ Radio Engine carregado');
