// ==========================================
// CONFIGURAÇÕES - RÁDIO SUPERMERCADO DO LOURO
// ==========================================

// Configuração do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkuwNr9RqlGGFey7DD9G_tTirCRP3eKqk",
  authDomain: "radio-louro.firebaseapp.com",
  projectId: "radio-louro",
  storageBucket: "radio-louro.firebasestorage.app",
  messagingSenderId: "922823434228",
  appId: "1:922823434228:web:1ca9c473742728a2dee3a1"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

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
  intervaloRepeticao: 45, // minutos antes de repetir uma música
  historicoMaximo: 10, // últimas N músicas para análise de gênero
  maxGeneroRepetido: 3, // máximo de vezes que um gênero pode aparecer em 10 músicas
  
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
  
  // Categorias de arquivos
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
  
  // Gêneros musicais disponíveis
  generos: [
    'pop', 'rock', 'mpb', 'sertanejo', 'forro', 
    'samba', 'pagode', 'axe', 'funk', 'eletronica',
    'gospel', 'instrumental', 'classica', 'jazz', 'outros'
  ],
  
  // Ritmos disponíveis
  ritmos: ['calmo', 'moderado', 'animado', 'energetico'],
  
  // Períodos do dia
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

// Validações
export const VALIDATIONS = {
  audioFormats: ['.mp3', '.wav', '.ogg', '.m4a'],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  minDuration: 5, // segundos
  maxDuration: 600 // 10 minutos
};

console.log('✅ Configurações carregadas - Rádio Supermercado do Louro');
