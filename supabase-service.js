// ==========================================
// SUPABASE SERVICE - GERENCIAMENTO DATABASE
// ==========================================

import { supabase } from './config.js';

class SupabaseService {
  constructor() {
    this.listeners = new Map();
  }

  // ============================================
  // CRUD BÁSICO
  // ============================================

  /**
   * Adiciona um documento
   */
  async add(table, data) {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert([{
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`✅ Documento adicionado: ${result.id}`);
      return result.id;
    } catch (error) {
      console.error('❌ Erro ao adicionar:', error);
      throw error;
    }
  }

  /**
   * Atualiza um documento
   */
  async update(table, id, data) {
    try {
      const { error } = await supabase
        .from(table)
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      console.log(`✅ Documento atualizado: ${id}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar:', error);
      throw error;
    }
  }

  /**
   * Busca um documento específico
   */
  async get(table, id) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar:', error);
      return null;
    }
  }

  /**
   * Busca todos os documentos
   */
  async getAll(table, filters = {}) {
    try {
      let query = supabase.from(table).select('*');
      
      // Aplicar filtros
      if (filters.where) {
        filters.where.forEach(([field, operator, value]) => {
          if (operator === '==') query = query.eq(field, value);
          else if (operator === '>') query = query.gt(field, value);
          else if (operator === '>=') query = query.gte(field, value);
          else if (operator === '<') query = query.lt(field, value);
          else if (operator === '<=') query = query.lte(field, value);
        });
      }
      
      // Ordenação
      if (filters.orderBy) {
        const [field, direction = 'asc'] = filters.orderBy;
        query = query.order(field, { ascending: direction === 'asc' });
      }
      
      // Limite
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar todos:', error);
      throw error;
    }
  }

  /**
   * Deleta um documento
   */
  async delete(table, id) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      console.log(`✅ Documento deletado: ${id}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar:', error);
      throw error;
    }
  }

  // ============================================
  // OPERAÇÕES ESPECÍFICAS DA RÁDIO
  // ============================================

  /**
   * Salva arquivo de áudio
   */
  async salvarArquivo(dados) {
    const arquivo = {
      nome: dados.nome,
      categoria: dados.categoria,
      subcategoria: dados.subcategoria || 'geral',
      cloudinary_url: dados.cloudinaryUrl,
      cloudinary_public_id: dados.cloudinaryPublicId,
      duracao: dados.duracao || 0,
      genero: dados.genero || 'outros',
      ritmo: dados.ritmo || 'moderado',
      horario_ideal: dados.horarioIdeal || 'todos',
      play_count: 0,
      ultima_reproducao: null
    };
    
    return await this.add('arquivos', arquivo);
  }

  /**
   * Busca arquivos por categoria
   */
  async buscarArquivosPorCategoria(categoria, subcategoria = null) {
    const filters = {
      where: [['categoria', '==', categoria]]
    };
    
    if (subcategoria) {
      filters.where.push(['subcategoria', '==', subcategoria]);
    }
    
    return await this.getAll('arquivos', filters);
  }

  /**
   * Incrementa contador de reprodução
   */
  async incrementarPlayCount(arquivoId) {
    try {
      const arquivo = await this.get('arquivos', arquivoId);
      if (arquivo) {
        await this.update('arquivos', arquivoId, {
          play_count: (arquivo.play_count || 0) + 1,
          ultima_reproducao: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Erro ao incrementar play count:', error);
    }
  }

  /**
   * Salva no histórico
   */
  async salvarHistorico(dados) {
    const historico = {
      arquivo_id: dados.arquivoId,
      nome: dados.nome,
      categoria: dados.categoria,
      iniciado_em: new Date().toISOString(),
      finalizado_em: null,
      concluiu: false
    };
    
    return await this.add('historico', historico);
  }

  /**
   * Finaliza histórico
   */
  async finalizarHistorico(historicoId, concluiu = true) {
    return await this.update('historico', historicoId, {
      finalizado_em: new Date().toISOString(),
      concluiu
    });
  }

  /**
   * Busca histórico recente
   */
  async buscarHistoricoRecente(limite = 10) {
    return await this.getAll('historico', {
      orderBy: ['iniciado_em', 'desc'],
      limit: limite
    });
  }

  /**
   * Busca músicas disponíveis (não tocadas recentemente)
   */
  async buscarMusicasDisponiveis(categoria, minutosMinimo = 45) {
    try {
      // Buscar todas as músicas
      const todasMusicas = await this.buscarArquivosPorCategoria(categoria);
      
      // Buscar histórico recente
      const tempoLimite = new Date();
      tempoLimite.setMinutes(tempoLimite.getMinutes() - minutosMinimo);
      
      const { data: historicoRecente, error } = await supabase
        .from('historico')
        .select('arquivo_id')
        .eq('categoria', categoria)
        .gte('iniciado_em', tempoLimite.toISOString());
      
      if (error) throw error;
      
      // IDs tocados recentemente
      const idsTocados = new Set((historicoRecente || []).map(h => h.arquivo_id));
      
      // Filtrar
      return todasMusicas.filter(musica => !idsTocados.has(musica.id));
      
    } catch (error) {
      console.error('❌ Erro ao buscar músicas disponíveis:', error);
      return [];
    }
  }

  /**
   * Salva/Atualiza configuração
   */
  async salvarConfig(config) {
    try {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('config')
        .select('id')
        .eq('tipo', 'transmissao')
        .single();
      
      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from('config')
          .update({ ...config, updated_at: new Date().toISOString() })
          .eq('tipo', 'transmissao');
        
        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase
          .from('config')
          .insert([{ ...config, tipo: 'transmissao' }]);
        
        if (error) throw error;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar config:', error);
      throw error;
    }
  }

  /**
   * Busca configuração
   */
  async buscarConfig() {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .eq('tipo', 'transmissao')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        // Criar config padrão
        const configPadrao = {
          tipo: 'transmissao',
          ativa: false,
          album_ativo: 'geral',
          musica_atual: null,
          proxima_na_fila: null,
          ultima_hora_certa: null
        };
        
        await supabase.from('config').insert([configPadrao]);
        return configPadrao;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar config:', error);
      return null;
    }
  }

  /**
   * Busca config de rotação
   */
  async buscarConfigRotacao() {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .eq('tipo', 'rotacao')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        const configPadrao = {
          tipo: 'rotacao',
          intervalo_minimo: 45,
          balancear_generos: true,
          balancear_ritmos: true,
          considerar_horario: true
        };
        
        await supabase.from('config').insert([configPadrao]);
        return configPadrao;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar config rotação:', error);
      return null;
    }
  }

  /**
   * Busca estatísticas
   */
  async buscarEstatisticas() {
    try {
      const [arquivos, historico] = await Promise.all([
        this.getAll('arquivos'),
        this.getAll('historico')
      ]);
      
      const stats = {
        totalArquivos: arquivos.length,
        totalReproducoes: historico.length,
        porCategoria: {},
        maisTodastas: []
      };
      
      // Por categoria
      arquivos.forEach(arq => {
        if (!stats.porCategoria[arq.categoria]) {
          stats.porCategoria[arq.categoria] = 0;
        }
        stats.porCategoria[arq.categoria]++;
      });
      
      // Mais tocadas
      stats.maisTodastas = arquivos
        .filter(arq => arq.play_count > 0)
        .sort((a, b) => b.play_count - a.play_count)
        .slice(0, 10);
      
      return stats;
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return null;
    }
  }

  // ============================================
  // LISTENERS EM TEMPO REAL (Realtime)
  // ============================================

  /**
   * Escuta mudanças em tempo real
   */
  listenToTable(table, callback) {
    const channel = supabase
      .channel(`public:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
    
    this.listeners.set(table, channel);
    return channel;
  }

  /**
   * Remove listener
   */
  removeListener(table) {
    const channel = this.listeners.get(table);
    if (channel) {
      supabase.removeChannel(channel);
      this.listeners.delete(table);
      console.log(`✅ Listener removido: ${table}`);
    }
  }

  /**
   * Remove todos os listeners
   */
  removeAllListeners() {
    this.listeners.forEach((channel, table) => {
      supabase.removeChannel(channel);
      console.log(`✅ Listener removido: ${table}`);
    });
    this.listeners.clear();
  }

  // ============================================
  // UTILITÁRIOS
  // ============================================

  formatarDuracao(segundos) {
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Exporta instância única
export const supabaseService = new SupabaseService();

console.log('✅ Supabase Service carregado');
