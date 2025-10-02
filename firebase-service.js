// ==========================================
// FIREBASE SERVICE - GERENCIAMENTO FIRESTORE
// ==========================================

import { db } from './config.js';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

class FirebaseService {
  constructor() {
    this.listeners = new Map();
  }

  // ============================================
  // CRUD BÁSICO
  // ============================================

  /**
   * Adiciona um documento
   */
  async add(collectionName, data) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log(`✅ Documento adicionado: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erro ao adicionar documento:', error);
      throw error;
    }
  }

  /**
   * Atualiza um documento
   */
  async update(collectionName, docId, data) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      });
      console.log(`✅ Documento atualizado: ${docId}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar documento:', error);
      throw error;
    }
  }

  /**
   * Define um documento (cria ou substitui)
   */
  async set(collectionName, docId, data) {
    try {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      }, { merge: true });
      console.log(`✅ Documento definido: ${docId}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao definir documento:', error);
      throw error;
    }
  }

  /**
   * Busca um documento específico
   */
  async get(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar documento:', error);
      throw error;
    }
  }

  /**
   * Busca todos os documentos de uma coleção
   */
  async getAll(collectionName, filters = {}) {
    try {
      let q = collection(db, collectionName);
      
      // Aplicar filtros
      if (filters.where) {
        filters.where.forEach(([field, operator, value]) => {
          q = query(q, where(field, operator, value));
        });
      }
      
      if (filters.orderBy) {
        const [field, direction = 'asc'] = filters.orderBy;
        q = query(q, orderBy(field, direction));
      }
      
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }
      
      const querySnapshot = await getDocs(q);
      const results = [];
      
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      return results;
    } catch (error) {
      console.error('❌ Erro ao buscar documentos:', error);
      throw error;
    }
  }

  /**
   * Deleta um documento
   */
  async delete(collectionName, docId) {
    try {
      await deleteDoc(doc(db, collectionName, docId));
      console.log(`✅ Documento deletado: ${docId}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar documento:', error);
      throw error;
    }
  }

  // ============================================
  // OPERAÇÕES ESPECÍFICAS DA RÁDIO
  // ============================================

  /**
   * Salva metadados de arquivo de áudio
   */
  async salvarArquivo(dados) {
    const arquivo = {
      nome: dados.nome,
      categoria: dados.categoria,
      subcategoria: dados.subcategoria || 'geral',
      cloudinaryUrl: dados.cloudinaryUrl,
      cloudinaryPublicId: dados.cloudinaryPublicId,
      duracao: dados.duracao || 0,
      genero: dados.genero || 'outros',
      ritmo: dados.ritmo || 'moderado',
      horarioIdeal: dados.horarioIdeal || 'todos',
      playCount: 0,
      ultimaReproducao: null
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
          playCount: (arquivo.playCount || 0) + 1,
          ultimaReproducao: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('❌ Erro ao incrementar play count:', error);
    }
  }

  /**
   * Salva no histórico de reprodução
   */
  async salvarHistorico(dados) {
    const historico = {
      arquivoId: dados.arquivoId,
      nome: dados.nome,
      categoria: dados.categoria,
      iniciadoEm: Timestamp.now(),
      finalizadoEm: null,
      concluiu: false
    };
    
    return await this.add('historico', historico);
  }

  /**
   * Atualiza histórico quando música termina
   */
  async finalizarHistorico(historicoId, concluiu = true) {
    return await this.update('historico', historicoId, {
      finalizadoEm: Timestamp.now(),
      concluiu
    });
  }

  /**
   * Busca histórico recente
   */
  async buscarHistoricoRecente(limiteDocs = 10) {
    return await this.getAll('historico', {
      orderBy: ['iniciadoEm', 'desc'],
      limit: limiteDocs
    });
  }

  /**
   * Busca músicas não tocadas recentemente
   */
  async buscarMusicasDisponiveis(categoria, minutosMinimo = 45) {
    try {
      // Busca todas as músicas da categoria
      const todasMusicas = await this.buscarArquivosPorCategoria(categoria);
      
      // Busca histórico recente
      const tempoLimite = new Date();
      tempoLimite.setMinutes(tempoLimite.getMinutes() - minutosMinimo);
      
      const historicoRecente = await this.getAll('historico', {
        where: [
          ['categoria', '==', categoria],
          ['iniciadoEm', '>=', Timestamp.fromDate(tempoLimite)]
        ]
      });
      
      // IDs das músicas tocadas recentemente
      const idsTocadas = new Set(historicoRecente.map(h => h.arquivoId));
      
      // Filtra músicas não tocadas recentemente
      return todasMusicas.filter(musica => !idsTocadas.has(musica.id));
      
    } catch (error) {
      console.error('❌ Erro ao buscar músicas disponíveis:', error);
      return [];
    }
  }

  /**
   * Salva/Atualiza configuração da rádio
   */
  async salvarConfig(config) {
    return await this.set('config', 'transmissao', config);
  }

  /**
   * Busca configuração da rádio
   */
  async buscarConfig() {
    const config = await this.get('config', 'transmissao');
    
    if (!config) {
      // Configuração padrão
      const configPadrao = {
        ativa: false,
        albumAtivo: 'geral',
        musicaAtual: null,
        proximaNaFila: null,
        ultimaHoraCerta: null
      };
      await this.salvarConfig(configPadrao);
      return configPadrao;
    }
    
    return config;
  }

  /**
   * Busca configurações de rotação
   */
  async buscarConfigRotacao() {
    const config = await this.get('config', 'rotacao');
    
    if (!config) {
      const configPadrao = {
        intervaloMinimo: 45,
        balancearGeneros: true,
        balancearRitmos: true,
        considerarHorario: true
      };
      await this.set('config', 'rotacao', configPadrao);
      return configPadrao;
    }
    
    return config;
  }

  /**
   * Busca estatísticas gerais
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
      
      // Contagem por categoria
      arquivos.forEach(arq => {
        if (!stats.porCategoria[arq.categoria]) {
          stats.porCategoria[arq.categoria] = 0;
        }
        stats.porCategoria[arq.categoria]++;
      });
      
      // Músicas mais tocadas
      stats.maisTodastas = arquivos
        .filter(arq => arq.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 10);
      
      return stats;
      
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return null;
    }
  }

  // ============================================
  // LISTENERS EM TEMPO REAL
  // ============================================

  /**
   * Escuta mudanças em tempo real
   */
  listenToCollection(collectionName, callback, filters = {}) {
    let q = collection(db, collectionName);
    
    if (filters.where) {
      filters.where.forEach(([field, operator, value]) => {
        q = query(q, where(field, operator, value));
      });
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      callback(data);
    });
    
    this.listeners.set(collectionName, unsubscribe);
    return unsubscribe;
  }

  /**
   * Escuta mudanças em um documento específico
   */
  listenToDocument(collectionName, docId, callback) {
    const docRef = doc(db, collectionName, docId);
    
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    });
    
    const key = `${collectionName}/${docId}`;
    this.listeners.set(key, unsubscribe);
    return unsubscribe;
  }

  /**
   * Remove listener
   */
  removeListener(key) {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(key);
      console.log(`✅ Listener removido: ${key}`);
    }
  }

  /**
   * Remove todos os listeners
   */
  removeAllListeners() {
    this.listeners.forEach((unsubscribe, key) => {
      unsubscribe();
      console.log(`✅ Listener removido: ${key}`);
    });
    this.listeners.clear();
  }

  // ============================================
  // OPERAÇÕES DE FILA
  // ============================================

  /**
   * Adiciona item na fila de reprodução
   */
  async adicionarNaFila(item) {
    try {
      // Busca último item da fila para determinar ordem
      const fila = await this.getAll('fila', {
        orderBy: ['ordem', 'desc'],
        limit: 1
      });
      
      const ultimaOrdem = fila.length > 0 ? fila[0].ordem : 0;
      
      const novoItem = {
        ordem: ultimaOrdem + 1,
        arquivoId: item.arquivoId,
        tipo: item.tipo,
        adicionadoEm: Timestamp.now()
      };
      
      return await this.add('fila', novoItem);
    } catch (error) {
      console.error('❌ Erro ao adicionar na fila:', error);
      throw error;
    }
  }

  /**
   * Busca toda a fila ordenada
   */
  async buscarFila() {
    return await this.getAll('fila', {
      orderBy: ['ordem', 'asc']
    });
  }

  /**
   * Remove primeiro item da fila
   */
  async removerDaFila(filaId) {
    return await this.delete('fila', filaId);
  }

  /**
   * Limpa toda a fila
   */
  async limparFila() {
    try {
      const fila = await this.buscarFila();
      const promises = fila.map(item => this.delete('fila', item.id));
      await Promise.all(promises);
      console.log('✅ Fila limpa');
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar fila:', error);
      throw error;
    }
  }

  // ============================================
  // UTILITÁRIOS
  // ============================================

  /**
   * Converte Timestamp do Firebase para Date
   */
  timestampToDate(timestamp) {
    if (!timestamp) return null;
    return timestamp.toDate();
  }

  /**
   * Converte Date para Timestamp do Firebase
   */
  dateToTimestamp(date) {
    if (!date) return null;
    return Timestamp.fromDate(date);
  }

  /**
   * Formata duração em segundos para mm:ss
   */
  formatarDuracao(segundos) {
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Exporta instância única (singleton)
export const firebaseService = new FirebaseService();

console.log('✅ Firebase Service carregado');
