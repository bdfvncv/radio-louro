// ==========================================
// RADIO ENGINE - MOTOR PRINCIPAL DA RÁDIO
// Lógica Avançada de Programação 24h
// ==========================================

import { RADIO_CONFIG } from './config.js';
import { firebaseService } from './firebase-service.js';
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
    
    // Estatísticas em tempo real
    this.stats = {
      musicasTocadas: 0,
      ultimosGeneros: [],
      ultimoRitmo: null
    };
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

  /**
   * Inicializa o motor da rádio
   */
  async inicializar(audioElementId = 'radioPlayer') {
    try {
      console.log('🎵 Iniciando Radio Engine...');
      
      // Buscar elemento de áudio
      this.audioPlayer = document.getElementById(audioElementId);
      if (!this.audioPlayer) {
        throw new Error('Elemento de áudio não encontrado');
      }
      
      // Configurar eventos do player
      this.configurarEventosPlayer();
      
      // Carregar configurações
      const config = await firebaseService.buscarConfig();
      this.isTransmitting = config.ativa || false;
      
      // Carregar histórico recente
      await this.carregarHistoricoRecente();
      
      console.log('✅ Radio Engine inicializado');
      
      // Se transmissão estiver ativa, iniciar
      if (this.isTransmitting) {
        await this.iniciarTransmissao();
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao inicializar Radio Engine:', error);
      throw error;
    }
  }

  /**
   * Configura eventos do player de áudio
   */
  configurarEventosPlayer() {
    this.audioPlayer.addEventListener('ended', () => this.onTrackEnded());
    this.audioPlayer.addEventListener('error', (e) => this.onPlayerError(e));
    this.audioPlayer.addEventListener('canplay', () => this.onCanPlay());
    this.audioPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
    
    console.log('✅ Eventos do player configurados');
  }

  // ============================================
  // CONTROLE DE TRANSMISSÃO
  // ============================================

  /**
   * Inicia transmissão ao vivo
   */
  async iniciarTransmissao() {
    try {
      console.log('🔴 Iniciando transmissão ao vivo...');
      
      this.isTransmitting = true;
      
      // Atualizar configuração no Firestore
      await firebaseService.salvarConfig({ ativa: true });
      
      // Iniciar verificação de hora certa
      this.iniciarVerificacaoHoraCerta();
      
      // Tocar primeira música
      await this.reproduzirProximo();
      
      // Notificar listeners
      this.notificarListeners('transmissaoIniciada');
      
      console.log('✅ Transmissão ao vivo iniciada');
      
    } catch (error) {
      console.error('❌ Erro ao iniciar transmissão:', error);
      this.isTransmitting = false;
      throw error;
    }
  }

  /**
   * Para transmissão
   */
  async pararTransmissao() {
    console.log('⏹️ Parando transmissão...');
    
    this.isTransmitting = false;
    
    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }
    
    // Atualizar configuração
    await firebaseService.salvarConfig({ ativa: false });
    
    // Parar verificação de hora certa
    if (this.intervaloHoraCerta) {
      clearInterval(this.intervaloHoraCerta);
    }
    
    this.notificarListeners('transmissaoParada');
    
    console.log('✅ Transmissão parada');
  }

  // ============================================
  // SEQUÊNCIA DE REPRODUÇÃO
  // ============================================

  /**
   * Monta próxima sequência seguindo o padrão
   * 3 músicas → vinheta → 2 músicas → aviso → 2 músicas → propaganda
   */
  async montarProximaSequencia() {
    try {
      console.log('📋 Montando próxima sequência...');
      
      const sequencia = [];
      const horarioAtual = this.determinarHorario();
      
      // Seguir padrão configurado
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
      
      console.log(`✅ Sequência montada: ${sequencia.length} itens`);
      return sequencia;
      
    } catch (error) {
      console.error('❌ Erro ao montar sequência:', error);
      return [];
    }
  }

  /**
   * Seleciona música com lógica avançada
   */
  async selecionarMusica(horarioAtual) {
    try {
      const config = await firebaseService.buscarConfigRotacao();
      const albumAtivo = (await firebaseService.buscarConfig()).albumAtivo || 'geral';
      
      // 1. Buscar músicas disponíveis (não tocadas recentemente)
      let musicasDisponiveis = await firebaseService.buscarMusicasDisponiveis(
        'musicas',
        config.intervaloMinimo
      );
      
      // Filtrar por álbum ativo se não for "geral"
      if (albumAtivo && albumAtivo !== 'geral') {
        musicasDisponiveis = musicasDisponiveis.filter(
          m => m.subcategoria === albumAtivo
        );
      }
      
      if (musicasDisponiveis.length === 0) {
        // Se não tem músicas disponíveis, reseta e busca todas
        console.log('⚠️ Sem músicas disponíveis, resetando pool');
        musicasDisponiveis = await firebaseService.buscarArquivosPorCategoria('musicas', albumAtivo === 'geral' ? null : albumAtivo);
        this.stats.ultimosGeneros = []; // Reset controle de gêneros
      }
      
      // 2. Aplicar filtro de horário
      if (config.considerarHorario && horarioAtual !== 'todos') {
        const horarioConfig = RADIO_CONFIG.horarios[horarioAtual];
        const preferencias = horarioConfig.preferencia;
        
        const musicasHorario = musicasDisponiveis.filter(m => 
          m.horarioIdeal === 'todos' || 
          m.horarioIdeal === horarioAtual ||
          preferencias.includes(m.ritmo)
        );
        
        if (musicasHorario.length > 0) {
          musicasDisponiveis = musicasHorario;
        }
      }
      
      // 3. Controle de gêneros (não repetir mais de 3x em 10 músicas)
      if (config.balancearGeneros && this.stats.ultimosGeneros.length >= RADIO_CONFIG.historicoMaximo) {
        const contagemGeneros = {};
        
        this.stats.ultimosGeneros.forEach(gen => {
          contagemGeneros[gen] = (contagemGeneros[gen] || 0) + 1;
        });
        
        // Filtrar gêneros que já apareceram 3 ou mais vezes
        musicasDisponiveis = musicasDisponiveis.filter(m => 
          (contagemGeneros[m.genero] || 0) < RADIO_CONFIG.maxGeneroRepetido
        );
      }
      
      // 4. Alternância de ritmo
      if (config.balancearRitmos && this.stats.ultimoRitmo) {
        const ritmoDesejado = this.alternarRitmo(this.stats.ultimoRitmo);
        
        const musicasRitmo = musicasDisponiveis.filter(m => m.ritmo === ritmoDesejado);
        
        if (musicasRitmo.length > 0) {
          musicasDisponiveis = musicasRitmo;
        }
      }
      
      // 5. Selecionar aleatoriamente
      if (musicasDisponiveis.length === 0) {
        console.log('⚠️ Nenhuma música válida encontrada');
        return null;
      }
      
      const musicaSelecionada = musicasDisponiveis[
        Math.floor(Math.random() * musicasDisponiveis.length)
      ];
      
      // Atualizar estatísticas
      this.atualizarStats(musicaSelecionada);
      
      console.log(`🎵 Música selecionada: ${musicaSelecionada.nome}`);
      return musicaSelecionada;
      
    } catch (error) {
      console.error('❌ Erro ao selecionar música:', error);
      return null;
    }
  }

  /**
   * Seleciona outros tipos (vinheta, aviso, propaganda)
   */
  async selecionarOutro(tipo, subtipo = null) {
    try {
      let arquivos = await firebaseService.buscarArquivosPorCategoria(tipo, subtipo);
      
      if (arquivos.length === 0) {
        console.log(`⚠️ Nenhum arquivo encontrado: ${tipo}/${subtipo}`);
        return null;
      }
      
      // Selecionar aleatoriamente
      const selecionado = arquivos[Math.floor(Math.random() * arquivos.length)];
      console.log(`📢 ${tipo} selecionado: ${selecionado.nome}`);
      
      return selecionado;
      
    } catch (error) {
      console.error(`❌ Erro ao selecionar ${tipo}:`, error);
      return null;
    }
  }

  // ============================================
  // REPRODUÇÃO
  // ============================================

  /**
   * Reproduz próximo item da fila
   */
  async reproduzirProximo() {
    try {
      if (!this.isTransmitting) {
        console.log('⏸️ Transmissão parada');
        return;
      }
      
      // Se fila vazia, montar nova sequência
      if (this.fila.length === 0) {
        const novaSequencia = await this.montarProximaSequencia();
        this.fila = [...novaSequencia];
        
        // Misturar gêneros ao reiniciar sequência
        this.stats.ultimosGeneros = [];
      }
      
      // Pegar próximo da fila
      const proximoItem = this.fila.shift();
      
      if (!proximoItem) {
        console.log('⚠️ Fila vazia, aguardando...');
        setTimeout(() => this.reproduzirProximo(), 5000);
        return;
      }
      
      // Reproduzir
      await this.reproduzir(proximoItem);
      
    } catch (error) {
      console.error('❌ Erro ao reproduzir próximo:', error);
      setTimeout(() => this.reproduzirProximo(), 5000);
    }
  }

  /**
   * Reproduz um arquivo específico
   */
  async reproduzir(item) {
    try {
      console.log(`▶️ Reproduzindo: ${item.nome}`);
      
      this.currentTrack = item;
      
      // Salvar no histórico
      this.currentHistoricoId = await firebaseService.salvarHistorico({
        arquivoId: item.id,
        nome: item.nome,
        categoria: item.categoria
      });
      
      // Incrementar contador
      await firebaseService.incrementarPlayCount(item.id);
      
      // Carregar áudio
      const streamUrl = cloudinaryService.getCachedUrl(item.cloudinaryPublicId);
      this.audioPlayer.src = streamUrl;
      
      // Atualizar config
      await firebaseService.salvarConfig({
        ativa: true,
        musicaAtual: {
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          iniciadoEm: new Date()
        }
      });
      
      // Reproduzir
      await this.audioPlayer.play();
      
      // Notificar listeners
      this.notificarListeners('trackChanged', item);
      
      this.stats.musicasTocadas++;
      
    } catch (error) {
      console.error('❌ Erro ao reproduzir:', error);
      // Tentar próximo
      setTimeout(() => this.reproduzirProximo(), 2000);
    }
  }

  // ============================================
  // EVENTOS DO PLAYER
  // ============================================

  /**
   * Quando música termina
   */
  async onTrackEnded() {
    console.log('✅ Track finalizado');
    
    // Atualizar histórico
    if (this.currentHistoricoId) {
      await firebaseService.finalizarHistorico(this.currentHistoricoId, true);
    }
    
    // Reproduzir próximo
    await this.reproduzirProximo();
  }

  /**
   * Quando player está pronto
   */
  onCanPlay() {
    console.log('✅ Player pronto para reproduzir');
  }

  /**
   * Atualização de tempo
   */
  onTimeUpdate() {
    if (!this.currentTrack || !this.audioPlayer) return;
    
    const progresso = {
      current: this.audioPlayer.currentTime,
      duration: this.audioPlayer.duration,
      percentage: (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100
    };
    
    this.notificarListeners('timeUpdate', progresso);
  }

  /**
   * Erro no player
   */
  onPlayerError(error) {
    console.error('❌ Erro no player:', error);
    
    // Tentar próximo após erro
    setTimeout(() => {
      if (this.isTransmitting) {
        this.reproduzirProximo();
      }
    }, 3000);
  }

  // ============================================
  // HORA CERTA
  // ============================================

  /**
   * Inicia verificação de hora certa a cada minuto
   */
  iniciarVerificacaoHoraCerta() {
    // Verificar imediatamente
    this.verificarHoraCerta();
    
    // Verificar a cada minuto
    this.intervaloHoraCerta = setInterval(() => {
      this.verificarHoraCerta();
    }, 60000); // 60 segundos
  }

  /**
   * Verifica se deve tocar hora certa
   */
  async verificarHoraCerta() {
    const agora = new Date();
    const minuto = agora.getMinutes();
    const hora = agora.getHours();
    
    // Só toca na hora cheia (minuto 00)
    if (minuto !== 0) return;
    
    // Verificar se já tocou nesta hora
    if (this.ultimaHoraCerta === hora) return;
    
    console.log(`🕐 Hora certa: ${hora}:00`);
    
    // Buscar arquivo de hora certa
    const horaCertaArquivos = await firebaseService.buscarArquivosPorCategoria('horaCerta');
    
    if (horaCertaArquivos.length === 0) {
      console.log('⚠️ Nenhum arquivo de hora certa encontrado');
      return;
    }
    
    // Procurar arquivo específico para esta hora (ex: "10-horas.mp3")
    const nomeArquivo = `${hora.toString().padStart(2, '0')}-horas`;
    let arquivoHora = horaCertaArquivos.find(arq => 
      arq.nome.toLowerCase().includes(nomeArquivo)
    );
    
    // Se não encontrar, pegar qualquer arquivo de hora certa
    if (!arquivoHora) {
      arquivoHora = horaCertaArquivos[0];
    }
    
    // Adicionar na fila imediatamente (prioridade)
    this.fila.unshift(arquivoHora);
    
    // Marcar que já tocou nesta hora
    this.ultimaHoraCerta = hora;
    
    // Se não estiver tocando nada, reproduzir imediatamente
    if (this.audioPlayer.paused) {
      await this.reproduzirProximo();
    }
  }

  // ============================================
  // LÓGICA DE ROTAÇÃO AVANÇADA
  // ============================================

  /**
   * Determina horário do dia atual
   */
  determinarHorario() {
    const hora = new Date().getHours();
    
    if (hora >= 6 && hora < 12) return 'manha';
    if (hora >= 12 && hora < 18) return 'tarde';
    if (hora >= 18 && hora < 22) return 'noite';
    return 'madrugada';
  }

  /**
   * Alterna ritmo (calmo <-> animado)
   */
  alternarRitmo(ritmoAtual) {
    const alternancia = {
      'calmo': 'animado',
      'moderado': 'animado',
      'animado': 'calmo',
      'energetico': 'calmo'
    };
    
    return alternancia[ritmoAtual] || 'moderado';
  }

  /**
   * Atualiza estatísticas de reprodução
   */
  atualizarStats(musica) {
    // Atualizar lista de gêneros
    this.stats.ultimosGeneros.push(musica.genero);
    
    // Manter apenas últimos 10
    if (this.stats.ultimosGeneros.length > RADIO_CONFIG.historicoMaximo) {
      this.stats.ultimosGeneros.shift();
    }
    
    // Atualizar último ritmo
    this.stats.ultimoRitmo = musica.ritmo;
  }

  /**
   * Carrega histórico recente do Firestore
   */
  async carregarHistoricoRecente() {
    try {
      const historico = await firebaseService.buscarHistoricoRecente(10);
      
      // Extrair arquivos do histórico
      const arquivosIds = historico.map(h => h.arquivoId);
      
      // Buscar dados completos dos arquivos
      const arquivosPromises = arquivosIds.map(id => 
        firebaseService.get('arquivos', id)
      );
      
      const arquivos = await Promise.all(arquivosPromises);
      
      // Atualizar stats
      arquivos.forEach(arq => {
        if (arq && arq.genero) {
          this.stats.ultimosGeneros.push(arq.genero);
        }
      });
      
      // Manter apenas últimos 10
      this.stats.ultimosGeneros = this.stats.ultimosGeneros.slice(-10);
      
      console.log('✅ Histórico recente carregado');
      
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error);
    }
  }

  // ============================================
  // CONTROLES PÚBLICOS
  // ============================================

  /**
   * Play/Pause manual
   */
  togglePlay() {
    if (!this.audioPlayer) return;
    
    if (this.audioPlayer.paused) {
      this.audioPlayer.play();
    } else {
      this.audioPlayer.pause();
    }
  }

  /**
   * Pular para próxima música
   */
  async pularMusica() {
    console.log('⏭️ Pulando música...');
    
    // Finalizar histórico como não concluído
    if (this.currentHistoricoId) {
      await firebaseService.finalizarHistorico(this.currentHistoricoId, false);
    }
    
    // Reproduzir próximo
    await this.reproduzirProximo();
  }

  /**
   * Ajustar volume
   */
  setVolume(volume) {
    if (!this.audioPlayer) return;
    
    const vol = Math.max(0, Math.min(1, volume / 100));
    this.audioPlayer.volume = vol;
    
    console.log(`🔊 Volume: ${Math.round(vol * 100)}%`);
  }

  /**
   * Adicionar música na fila
   */
  async adicionarNaFila(arquivoId) {
    try {
      const arquivo = await firebaseService.get('arquivos', arquivoId);
      
      if (!arquivo) {
        throw new Error('Arquivo não encontrado');
      }
      
      this.fila.push(arquivo);
      console.log(`➕ Adicionado na fila: ${arquivo.nome}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao adicionar na fila:', error);
      return false;
    }
  }

  /**
   * Obter informações da fila
   */
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

  /**
   * Obter informações da música atual
   */
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

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      isTransmitting: this.isTransmitting,
      filaSize: this.fila.length,
      currentTrack: this.currentTrack ? this.currentTrack.nome : null
    };
  }

  // ============================================
  // LISTENERS (OBSERVADORES)
  // ============================================

  /**
   * Adiciona listener para eventos
   */
  addEventListener(eventName, callback) {
    this.listeners.push({ eventName, callback });
  }

  /**
   * Remove listener
   */
  removeEventListener(eventName, callback) {
    this.listeners = this.listeners.filter(
      l => l.eventName !== eventName || l.callback !== callback
    );
  }

  /**
   * Notifica todos os listeners de um evento
   */
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

  // ============================================
  // UTILITÁRIOS
  // ============================================

  /**
   * Formata tempo em segundos para mm:ss
   */
  formatarTempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Limpa recursos e para transmissão
   */
  async destroy() {
    console.log('🔚 Destruindo Radio Engine...');
    
    await this.pararTransmissao();
    
    if (this.intervaloHoraCerta) {
      clearInterval(this.intervaloHoraCerta);
    }
    
    this.listeners = [];
    this.fila = [];
    
    console.log('✅ Radio Engine destruído');
  }
}

// Exporta instância única (singleton)
export const radioEngine = new RadioEngine();

console.log('✅ Radio Engine carregado');
