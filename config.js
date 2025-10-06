// ==========================================
// CONFIGURAÇÕES - RÁDIO SUPERMERCADO DO LOURO
// Supabase + Cloudinary
// ==========================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Configuração do Supabase - SUAS CREDENCIAIS
const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuração do Cloudinary
export const CLOUDINARY_CONFIG = {
  cloudName: 'dygbrcrr6',
  apiKey: '853591251513134',
  apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
  uploadPreset: 'radio_preset',
  baseUrl: 'https://api.cloudinary.com/v1_1/dygbrcrr6'
};

// Configurações da Rádio
export const RADIO_CONFIG = {
  // Rotação de músicas
  intervaloRepeticao: 45, // minutos
  historicoMaximo: 10,
  maxGeneroRepetido: 3,
  
  // Sequência de transmissão
  sequenciaPadrao: [
    { tipo: 'musica', quantidade: 3 },
    { tipo: 'vinheta', subtipo: 'identificacao', quantidade: 1 },
    { tipo: 'musica', quantidade: 2 },
    { tipo: 'aviso', quantidade: 1 },
    { tipo: 'musica', quantidade: 2 },
    { tipo: 'propaganda', quantidade: 1 }
  ],
  
  // Horários do dia
  horarios: {
    manha: { inicio: 6, fim: 12, preferencia: ['animado', 'energetico'] },
    tarde: { inicio: 12, fim: 18, preferencia: ['todos'] },
    noite: { inicio: 18, fim: 22, preferencia: ['calmo', 'moderado'] },
    madrugada: { inicio: 22, fim: 6, preferencia: ['calmo'] }
  },
  
  // Categorias
  categorias: {
    musicas: {
      geral: 'Músicas Gerais',
      natal: 'Natal',
      pascoa: 'Páscoa',
      saojoao: 'São João',
      carnaval: 'Carnaval'
    },
    vinhetas: {
      abertura: 'Vinheta de Abertura',
      identificacao: 'Vinheta de Identificação',
      passagem: 'Vinheta de Passagem'
    },
    avisos: {
      promocoes: 'Promoções',
      setores: 'Setores',
      institucional: 'Institucional'
    },
    propagandas: {
      produtos: 'Produtos',
      marcas: 'Marcas'
    },
    horaCerta: {
      principal: 'Hora Certa'
    }
  },
  
  // Gêneros musicais
  generos: [
    'pop', 'rock', 'mpb', 'sertanejo', 'forro', 
    'samba', 'pagode', 'axe', 'funk', 'eletronica',
    'gospel', 'instrumental', 'classica', 'jazz', 'outros'
  ],
  
  // Ritmos
  ritmos: ['calmo', 'moderado', 'animado', 'energetico'],
  
  // Períodos
  periodos: ['manha', 'tarde', 'noite', 'madrugada', 'todos']
};

// Estrutura de pastas no Cloudinary
export const CLOUDINARY_FOLDERS = {
  musicas: 'radio-louro/musicas',
  vinhetas: 'radio-louro/vinhetas',
  avisos: 'radio-louro/avisos',
  propagandas: 'radio-louro/propagandas',
  horaCerta: 'radio-louro/hora-certa'
};

// Mensagens do sistema
export const MESSAGES = {
  semMusicas: 'Aguardando músicas para iniciar transmissão...',
  carregando: 'Carregando rádio...',
  transmissaoAtiva: 'TRANSMISSÃO AO VIVO',
  transmissaoInativa: 'RÁDIO OFFLINE',
  erroUpload: 'Erro ao fazer upload do arquivo',
  sucessoUpload: 'Arquivo enviado com sucesso!',
  erroDelete: 'Erro ao deletar arquivo',
  sucessoDelete: 'Arquivo deletado com sucesso!',
  erroCarregar: 'Erro ao carregar dados',
  confirmDelete: 'Tem certeza que deseja deletar este arquivo?'
};

console.log('✅ Configurações carregadas - Supabase + Cloudinary');

// Configuração do Cloudinary
export const CLOUDINARY_CONFIG = {
  cloudName: 'dygbrcrr6',
  apiKey: '853591251513134',
  apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
  uploadPreset: 'radio_preset',
  baseUrl: 'https://api.cloudinary.com/v1_1/dygbrcrr6'
};

// Configurações da Rádio
export const RADIO_CONFIG = {
  // Rotação de músicas
  intervaloRepeticao: 45, // minutos
  historicoMaximo: 10,
  maxGeneroRepetido: 3,
  
  // Sequência de transmissão
  sequenciaPadrao: [
    { tipo: 'musica', quantidade: 3 },
    { tipo: 'vinheta', subtipo: 'identificacao', quantidade: 1 },
    { tipo: 'musica', quantidade: 2 },
    { tipo: 'aviso', quantidade: 1 },
    { tipo: 'musica', quantidade: 2 },
    { tipo: 'propaganda', quantidade: 1 }
  ],
  
  // Horários do dia
  horarios: {
    manha: { inicio: 6, fim: 12, preferencia: ['animado', 'energetico'] },
    tarde: { inicio: 12, fim: 18, preferencia: ['todos'] },
    noite: { inicio: 18, fim: 22, preferencia: ['calmo', 'moderado'] },
    madrugada: { inicio: 22, fim: 6, preferencia: ['calmo'] }
  },
  
  // Categorias
  categorias: {
    musicas: {
      geral: 'Músicas Gerais',
      natal: 'Natal',
      pascoa: 'Páscoa',
      saojoao: 'São João',
      carnaval: 'Carnaval'
    },
    vinhetas: {
      abertura: 'Vinheta de Abertura',
      identificacao: 'Vinheta de Identificação',
      passagem: 'Vinheta de Passagem'
    },
    avisos: {
      promocoes: 'Promoções',
      setores: 'Setores',
      institucional: 'Institucional'
    },
    propagandas: {
      produtos: 'Produtos',
      marcas: 'Marcas'
    },
    horaCerta: {
      principal: 'Hora Certa'
    }
  },
  
  // Gêneros musicais
  generos: [
    'pop', 'rock', 'mpb', 'sertanejo', 'forro', 
    'samba', 'pagode', 'axe', 'funk', 'eletronica',
    'gospel', 'instrumental', 'classica', 'jazz', 'outros'
  ],
  
  // Ritmos
  ritmos: ['calmo', 'moderado', 'animado', 'energetico'],
  
  // Períodos
  periodos: ['manha', 'tarde', 'noite', 'madrugada', 'todos']
};

// Estrutura de pastas no Cloudinary
export const CLOUDINARY_FOLDERS = {
  musicas: 'radio-louro/musicas',
  vinhetas: 'radio-louro/vinhetas',
  avisos: 'radio-louro/avisos',
  propagandas: 'radio-louro/propagandas',
  horaCerta: 'radio-louro/hora-certa'
};

// Mensagens do sistema
export const MESSAGES = {
  semMusicas: 'Aguardando músicas para iniciar transmissão...',
  carregando: 'Carregando rádio...',
  transmissaoAtiva: 'TRANSMISSÃO AO VIVO',
  transmissaoInativa: 'RÁDIO OFFLINE',
  erroUpload: 'Erro ao fazer upload do arquivo',
  sucessoUpload: 'Arquivo enviado com sucesso!',
  erroDelete: 'Erro ao deletar arquivo',
  sucessoDelete: 'Arquivo deletado com sucesso!',
  erroCarregar: 'Erro ao carregar dados',
  confirmDelete: 'Tem certeza que deseja deletar este arquivo?'
};

console.log('✅ Configurações carregadas - Supabase + Cloudinary');
