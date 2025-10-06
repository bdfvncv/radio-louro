// ==========================================
// RADIO ENGINE - MOTOR PRINCIPAL (SUPABASE)
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
    this.historicoRecente = [];
    this.ultimaHoraCerta = null;
    this.sequenciaAtual = [];
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
      
      await this.carregarHistoricoRecente();
      
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
    this.audioPlayer.addEventListener('canplay', () => this.onCanPlay());
    this.audioPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
    console.log('✅ Eventos configurados');
  }

  async iniciarTransmissao() {
    try {
      console.log('🔴 Iniciando transmissão...');
      this.isTransmitting = true;
      
      await supabaseService.salvarConfig({ ativa: true });
      this.iniciarVerificacaoHoraCerta();
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
    
    if (this.intervaloHoraCerta) {
      clearInterval(this.intervaloHoraCerta);
    }
    
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
      
      if (config.considerar_horario && horarioAtual !== 'todos') {
        const horarioConfig = RADIO_CONFIG.horarios[horarioAtual];
        const preferencias = horarioConfig.preferencia;
        
        const musicasHorario = musicasDisponiveis.filter(m => 
          m.horario_ideal === 'todos' || 
          m.horario_ideal === horarioAtual ||
          preferencias.includes(m.ritmo)
        );
        
        if (musicasHorario.length > 0) {
          musicasDisponiveis = musicasHorario;
        }
      }
      
      if (config.balancear_generos && this.stats.ultimosGeneros.length >= RADIO_CONFIG.historicoMaximo) {
        const contagemGeneros = {};
        this.stats.ultimosGeneros.forEach(gen => {
          contagemGeneros[gen] = (contagemGeneros[gen] || 0) + 1;
        });
        
        musicasDisponiveis = musicasDisponiveis.filter(m => 
          (contagemGeneros[m.genero] || 0) < RADIO_CONFIG.maxGeneroRepetido
        );
      }
      
      if (config.balancear_ritmos && this.stats.ultimoRitmo) {
        const ritmoDesejado = this.alternarRitmo(this.stats.ultimoRitmo);
        const musicasRitmo = musicasDisponiveis.filter(m => m.ritmo === ritmoDesejado);
        
        if (musicasRitmo.length > 0) {
          musicasDisponiveis = musicasRitmo;
        }
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

  onCanPlay() {
    console.log('✅ Player pronto');
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

  iniciarVerificacaoHoraCerta() {
    this.verificarHoraCerta();
    this.intervaloHoraCerta = setInterval(() => {
      this.verificarHoraCerta();
    }, 60000);
  }

  async verificarHoraCerta() {
    const agora = new Date();
    const minuto = agora.getMinutes();
    const hora = agora.getHours();
    
    if (minuto !== 0) return;
    if (this.ultimaHoraCerta === hora) return;
    
    console.log(`🕐 Hora certa: ${hora}:00`);
    
    const horaCertaArquivos = await supabaseService.buscarArquivosPorCategoria('horaCerta');
    
    if (horaCertaArquivos.length === 0) {
      console.log('⚠️ Sem hora certa');
      return;
    }
    
    const nomeArquivo = `${hora.toString().padStart(2, '0')}-horas`;
    let arquivoHora = horaCertaArquivos.find(arq => 
      arq.nome.toLowerCase().includes(nomeArquivo)
    );
    
    if (!arquivoHora) {
      arquivoHora = horaCertaArquivos[0];
    }
    
    this.fila.unshift(arquivoHora);
    this.ultimaHoraCerta = hora;
    
    if (this.audioPlayer.paused) {
      await this.reproduzirProximo();
    }
  }

  determinarHorario() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 12) return 'manha';
    if (hora >= 12 && hora < 18) return 'tarde';
    if (hora >= 18 && hora < 22) return 'noite';
    return 'madrugada';
  }

  alternarRitmo(ritmoAtual) {
    const alternancia = {
      'calmo': 'animado',
      'moderado': 'animado',
      'animado': 'calmo',
      'energetico': 'calmo'
    };
    return alternancia[ritmoAtual] || 'moderado';
  }

  atualizarStats(musica) {
    this.stats.ultimosGeneros.push(musica.genero);
    if (this.stats.ultimosGeneros.length > RADIO_CONFIG.historicoMaximo) {
      this.stats.ultimosGeneros.shift();
    }
    this.stats.ultimoRitmo = musica.ritmo;
  }

  async carregarHistoricoRecente() {
    try {
      const historico = await supabaseService.buscarHistoricoRecente(10);
      const arquivosIds = historico.map(h => h.arquivo_id);
      
      const arquivosPromises = arquivosIds.map(id => 
        supabaseService.get('arquivos', id)
      );
      
      const arquivos = await Promise.all(arquivosPromises);
      
      arquivos.forEach(arq => {
        if (arq && arq.genero) {
          this.stats.ultimosGeneros.push(arq.genero);
        }
      });
      
      this.stats.ultimosGeneros = this.stats.ultimosGeneros.slice(-10);
      console.log('✅ Histórico carregado');
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
    }
  }

  togglePlay() {
    if (!this.audioPlayer) return;
    if (this.audioPlayer.paused) {
      this.audioPlayer.play();
    } else {
      this.audioPlayer.pause();
    }
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

  async adicionarNaFila(arquivoId) {
    try {
      const arquivo = await supabaseService.get('arquivos', arquivoId);
      if (!arquivo) throw new Error('Arquivo não encontrado');
      this.fila.push(arquivo);
      console.log(`➕ Na fila: ${arquivo.nome}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao adicionar:', error);
      return false;
    }
  }

  getFilaInfo() {
    return {
      tamanho: this.fila.length,
      proximo: this.fila[0] || null,
      lista: this.fila.map(item => ({
        id: item.id,
        nome: item.nome,
        categoria: item.categoria
      }))
    };
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

  getStats() {
    return {
      ...this.stats,
      isTransmitting: this.isTransmitting,
      filaSize: this.fila.length,
      currentTrack: this.currentTrack ? this.currentTrack.nome : null
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

  formatarTempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async destroy() {
    console.log('🔚 Destruindo...');
    await this.pararTransmissao();
    if (this.intervaloHoraCerta) {
      clearInterval(this.intervaloHoraCerta);
    }
    this.listeners = [];
    this.fila = [];
    console.log('✅ Destruído');
  }
}

export const radioEngine = new RadioEngine();
console.log('✅ Radio Engine carregado');
