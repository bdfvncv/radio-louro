# Rádio Supermercado do Louro - Sistema Profissional 24h

Sistema completo de rádio online com transmissão automática 24 horas, programação dinâmica, upload de conteúdo e painel administrativo profissional.

## 📋 Características Principais

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

## 📁 Estrutura dos Arquivos

```
radio-station/
├── index.html          # Interface principal
├── styles.css          # Estilos profissionais
├── radio.js           # Sistema completo
└── README.md          # Este arquivo
```

## 🔧 Configuração da Cloudinary

### 1. Criar Conta na Cloudinary
- Acesse [cloudinary.com](https://cloudinary.com)
- Crie uma conta gratuita
- Anote suas credenciais

### 2. Configurar Upload Preset
- Acesse Dashboard > Settings > Upload
- Clique em "Add upload preset"
- Nome: `radio_preset`
- Signing Mode: `Unsigned`
- Folder: `radio-louro`
- Salve as configurações

### 3. Credenciais (já configuradas)
```javascript
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};
```

### 4. Estrutura de Pastas na Cloudinary
- `/radio-louro/music/` - Músicas principais
- `/radio-louro/time/` - Arquivos de hora certa
- `/radio-louro/ads/` - Avisos e propagandas
- `/radio-louro/jingles/` - Vinhetas da rádio

## 🚀 Instalação

### Opção 1: Local (Desenvolvimento)
1. Baixe todos os arquivos
2. Coloque em uma pasta
3. Abra `index.html` no navegador
4. A rádio iniciará automaticamente

### Opção 2: Servidor Web
1. Faça upload dos arquivos para seu servidor
2. Configure permissões de leitura
3. Acesse via URL do servidor
4. Configure HTTPS para melhor funcionalidade

## 🎮 Como Usar

### Interface Principal
- **Player**: Controles de play/pause e volume
- **Programação**: Visualize a programação do dia
- **Estatísticas**: Veja informações em tempo real
- **Histórico**: Últimas músicas tocadas

### Acesso Administrativo
1. Clique no botão "Admin" (canto inferior direito)
2. Digite a senha: `admin123`
3. Acesse o painel de controle

### Painel Administrativo

#### 📡 Transmissão
- **Status**: Visualizar se está ao vivo/offline
- **Controles**: Pausar/iniciar transmissão
- **Manuais**: Tocar próxima música, hora certa, avisos

#### 📂 Conteúdo
- **Músicas**: Upload de arquivos MP3/WAV/OGG
- **Hora Certa**: Locuções de horário
- **Avisos**: Propagandas e informes
- **Vinhetas**: Jingles da rádio

#### 📅 Programação
- **Adicionar**: Criar novos horários
- **Editar**: Modificar programação existente
- **Remover**: Excluir itens

#### 📊 Relatórios
- **Top 20**: Músicas mais tocadas
- **Estatísticas**: Dados de reprodução
- **Histórico**: Log de atividades

## ⚙️ Sistema de Programação

### Lógica Automática
1. **Hora Certa**: A cada hora exata (se disponível)
2. **Avisos**: A cada 5-7 músicas (mínimo 5 min intervalo)
3. **Vinhetas**: 10% de chance entre músicas
4. **Músicas**: Preenchimento principal

### Programação Padrão
- **06:00** - Manhã no Supermercado
- **09:00** - Hora Certa (automática)
- **12:00** - Almoço Musical
- **15:00** - Tarde Animada
- **18:00** - Final de Tarde
- **21:00** - Noite no Supermercado

## 🎵 Formatos Suportados

### Arquivos de Áudio
- **MP3** (recomendado)
- **WAV** (alta qualidade)
- **OGG** (alternativo)

### Tamanho Máximo
- **10MB** por arquivo (limite Cloudinary gratuito)
- Para arquivos maiores, considere upgrade do plano

## 🔊 Funcionalidades Técnicas

### Player de Áudio
- Controles de play/pause
- Controle de volume com mute
- Visualização de tempo/progresso
- Detecção de fim de música para continuidade

### Sistema de Upload
- Upload múltiplo de arquivos
- Organização automática por categoria
- Feedback visual de progresso
- Tratamento de erros

### Estatísticas
- Contagem de reproduções por música
- Histórico das últimas tocadas
- Simulação de número de ouvintes (50-200)
- Relatórios de performance

## 🛠️ Personalização

### Alterar Cores/Visual
Edite as variáveis CSS no arquivo `styles.css`:
```css
:root {
    --primary-green: #1a4332;
    --secondary-green: #2d5a45;
    --accent-green: #40a578;
    --light-green: #9dcc5a;
}
```

### Alterar Senha Admin
No arquivo `radio.js`, linha ~700:
```javascript
if (password === 'admin123') {
    // Altere 'admin123' para sua senha
```

### Modificar Programação
No arquivo `radio.js`, altere o array `schedule`:
```javascript
schedule: [
    { time: '06:00', title: 'Seu Programa', description: 'Descrição', type: 'program' },
    // Adicione mais itens aqui
]
```

## 🚨 Solução de Problemas

### Upload não funciona
1. Verifique credenciais da Cloudinary
2. Confirme se o upload preset existe
3. Teste com arquivos menores
4. Verifique conexão de internet

### Áudio não toca
1. Clique no botão play (autoplay bloqueado)
2. Verifique se há músicas cadastradas
3. Teste em outro navegador
4. Verifique URLs dos arquivos

### Painel Admin não abre
1. Confirme senha correta: `admin123`
2. Limpe cache do navegador
3. Teste em modo privado/incógnito

### Programação não atualiza
1. Adicione arquivos nas categorias corretas
2. Verifique horários configurados
3. Aguarde alguns minutos para sincronização

## 📱 Responsividade

O sistema é totalmente responsivo:
- **Desktop**: Experiência completa
- **Tablet**: Interface adaptada
- **Mobile**: Layout otimizado

## 💾 Backup e Dados

### Dados Salvos Localmente
- Configurações de volume
- Histórico de reprodução
- Programação personalizada
- Estatísticas básicas

### Dados na Cloudinary
- Todos os arquivos de áudio
- Metadados dos uploads
- Organizados por pastas automáticas

## 🔒 Segurança

### Recomendações
- Altere a senha padrão do admin
- Use HTTPS em produção
- Configure backup regular
- Monitore uso da Cloudinary

## 📞 Suporte

### Logs do Sistema
- Console do navegador mostra status detalhado
- Erros são logados com contexto
- Recuperação automática de falhas

### Troubleshooting
1. **F12** no navegador → Console
2. Procure por mensagens de erro em vermelho
3. Verifique conectividade com a Cloudinary
4. Teste com diferentes navegadores

## 🔄 Atualizações

### Versão Atual: 2.0
- Sistema profissional completo
- Interface moderna e responsiva
- Upload automático para cloud
- Programação inteligente 24h

### Recursos Futuros
- Streaming ao vivo real
- Chat de ouvintes
- API para apps móveis
- Integração redes sociais

## 📄 Licença

Este sistema foi desenvolvido especificamente para o **Supermercado do Louro**.

---

**Desenvolvimento**: Sistema completo de rádio profissional  
**Versão**: 2.0 - Rádio 24h Profissional  
**Data**: Dezembro 2024

Para suporte técnico, consulte os logs do console do navegador ou entre em contato com o desenvolvedor.
