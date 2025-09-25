# Rádio Supermercado do Louro - Sistema Profissional 24h

## Visão Geral
Sistema completo de rádio online com transmissão automática 24 horas, programação dinâmica, upload de conteúdo e painel administrativo profissional.

## Características Principais

### 🔴 Transmissão Ao Vivo 24h
- Reprodução contínua automática
- Sistema inteligente de programação
- Inserção automática de hora certa e avisos
- Simulação realística de ouvintes

### 🎵 Gestão de Conteúdo
- Upload de músicas, avisos, hora certa e vinhetas
- Integração com Cloudinary para armazenamento
- Organização automática por categorias
- Sistema de estatísticas de reprodução

### 📅 Programação Inteligente
- Programação automática baseada em horários
- Inserção de conteúdo promocional
- Sistema de rotação inteligente
- Evita repetições consecutivas

### 🎛️ Painel Administrativo
- Controle total da transmissão
- Upload e gestão de arquivos
- Relatórios de reprodução
- Configuração de programação

## Arquivos do Sistema

### `index.html`
Interface principal com:
- Player de rádio responsivo
- Programação do dia
- Estatísticas em tempo real
- Design moderno verde escuro/branco

### `styles.css`
Estilos profissionais com:
- Tema verde escuro e branco
- Efeitos glassmorphism
- Animações fluidas
- Layout responsivo completo

### `radio.js`
Sistema completo com:
- Gerenciador de transmissão ao vivo
- Sistema de upload para Cloudinary
- Controles administrativos
- Programação automática

## Configuração da Cloudinary

### Credenciais Atualizadas:
```javascript
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};
```

### Estrutura de Pastas:
- `/radio-louro/music/` - Músicas principais
- `/radio-louro/time/` - Arquivos de hora certa
- `/radio-louro/ads/` - Avisos e propagandas
- `/radio-louro/jingles/` - Vinhetas da rádio

## Sistema de Programação

### Programação Automática:
- **06:00** - Manhã no Supermercado
- **09:00** - Hora Certa (automática)
- **12:00** - Almoço Musical
- **15:00** - Tarde Animada
- **18:00** - Final de Tarde
- **21:00** - Noite no Supermercado

### Lógica de Reprodução:
1. **Hora Certa**: A cada hora exata (se disponível)
2. **Avisos**: A cada 5-7 músicas (mínimo 5 min intervalo)
3. **Vinhetas**: 10% de chance entre músicas
4. **Músicas**: Preenchimento principal da programação

## Funcionalidades Técnicas

### Player de Áudio:
- Controles de play/pause
- Controle de volume com mute
- Visualização de tempo/progresso
- Detecção de fim de música para continuidade

### Sistema de Upload:
- Upload múltiplo de arquivos
- Suporte a MP3, WAV, OGG
- Organização automática por categoria
- Feedback visual de progresso

### Estatísticas:
- Contagem de reproduções por música
- Histórico das últimas tocadas
- Simulação de número de ouvintes
- Relatórios de performance

## Acesso Administrativo

### Credenciais:
- **Senha**: `admin123`

### Funcionalidades Admin:
1. **Transmissão**: Controle ao vivo/offline
2. **Conteúdo**: Upload e gestão de arquivos
3. **Programação**: Configuração de horários
4. **Relatórios**: Estatísticas de reprodução

## Melhorias Implementadas

### Visual:
- Design profissional verde escuro/branco
- Efeitos de blur e transparência
- Animações suaves e responsivas
- Indicadores visuais de status ao vivo

### Funcional:
- Sistema robusto de recuperação de erros
- Prevenção de autoplay bloqueado
- Salvamento automático de configurações
- Interface intuitiva e profissional

### Técnico:
- Código modular e bem organizado
- Tratamento de erros abrangente
- Sistema de logs detalhado
- Performance otimizada

## Instalação

1. **Configurar Cloudinary**:
   - Criar upload preset: `radio_preset`
   - Configurar permissões de upload
   - Verificar credenciais

2. **Arquivos**:
   - Colocar todos os arquivos na mesma pasta
   - Manter estrutura de arquivos separados
   - Verificar permissões de execução

3. **Teste**:
   - Abrir `index.html` em navegador
   - Verificar transmissão automática
   - Testar upload de arquivos
   - Validar painel administrativo

## Suporte e Manutenção

### Logs do Sistema:
- Console do navegador mostra status detalhado
- Erros são logados com contexto
- Recuperação automática de falhas

### Backup:
- Dados salvos no localStorage
- Upload de arquivos na Cloudinary
- Configurações preservadas entre sessões

### Troubleshooting:
- Verificar credenciais da Cloudinary
- Confirmar upload preset configurado
- Validar permissões de autoplay no navegador
- Checar conexão de internet para uploads

---

**Desenvolvimento**: Sistema completo de rádio profissional
**Versão**: 2.0 - Rádio 24h Profissional
**Última Atualização**: 2024
