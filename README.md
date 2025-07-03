# 🎵 Rádio Supermercado do Louro

Uma plataforma de rádio online inteligente, privada e 100% automatizada, desenvolvida especialmente para uso interno de supermercados.

## 🚀 Características

- **Player Automático**: Reprodução contínua com intercalação inteligente
- **Gerenciamento de Conteúdo**: Upload e organização por categorias
- **Álbuns Temáticos**: Natal, Páscoa, São João, Carnaval
- **Painel Administrativo**: Controle total da programação
- **Relatórios**: Estatísticas de reprodução em tempo real
- **Design Responsivo**: Interface moderna com modo escuro
- **Sem Dependências Externas**: Funciona offline após carregamento

## 📋 Pré-requisitos

- Conta no [Cloudinary](https://cloudinary.com) (gratuita)
- Servidor web (GitHub Pages, Netlify, etc.)
- Navegador moderno com suporte a HTML5 Audio

## 🛠️ Instalação

### 1. Clone o Projeto

```bash
git clone https://github.com/seu-usuario/radio-supermercado-louro.git
cd radio-supermercado-louro
```

### 2. Configurar Cloudinary

1. Crie uma conta no [Cloudinary](https://cloudinary.com)
2. Acesse o Dashboard e anote:
   - **Cloud Name**
   - **API Key** 
   - **API Secret**

3. Crie um Upload Preset:
   - Vá em Settings → Upload
   - Clique em "Add upload preset"
   - Nome: `radio_louro`
   - Signing Mode: `Unsigned`
   - Folder: `radio-louro`
   - Resource Type: `Auto`

### 3. Configurar as Credenciais

Edite o arquivo `cloudinary-config.js`:

```javascript
this.config = {
    cloudName: 'SEU_CLOUD_NAME',     // Substitua aqui
    apiKey: 'SUA_API_KEY',           // Substitua aqui
    apiSecret: 'SEU_API_SECRET',     // Substitua aqui
    uploadPreset: 'radio_louro'      // Nome do preset criado
};
```

### 4. Estrutura dos Arquivos

```
radio-supermercado-louro/
├── index.html              # Página principal
├── styles.css              # Estilos CSS
├── script.js               # JavaScript principal
├── cloudinary-config.js    # Configuração Cloudinary
└── README.md              # Este arquivo
```

### 5. Deploy

#### GitHub Pages
1. Faça push dos arquivos para um repositório GitHub
2. Vá em Settings → Pages
3. Selecione a branch main
4. Acesse: `https://seu-usuario.github.io/radio-supermercado-louro`

#### Netlify
1. Arraste a pasta do projeto para [Netlify Drop](https://app.netlify.com/drop)
2. Ou conecte o repositório GitHub

#### Servidor Local
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

## 🎛️ Uso

### Modo Público (Player)

- **Reprodução automática** com intercalação inteligente
- **Controle de volume** com slider
- **Visualização do álbum ativo** com capa
- **Estatísticas em tempo real**

### Modo Administrador

1. Clique no ícone de configurações (⚙️)
2. Digite a senha: `admin123`
3. Acesse as abas:

#### 📤 Upload
- **Músicas Principais**: Repertório base
- **Hora Certa**: Anúncios de horário
- **Avisos**: Propagandas e comunicados
- **Álbuns Temáticos**: Músicas sazonais

#### 🎵 Álbuns
- Ativar/desativar álbuns temáticos
- Visualizar capas e quantidade de músicas
- Gerenciar conteúdo sazonal

#### 📊 Relatórios
- Músicas mais tocadas
- Estatísticas de reprodução
- Resetar contadores

#### 📁 Arquivos
- Listar todos os arquivos por categoria
- Excluir arquivos indesejados
- Gerenciar biblioteca

## ⚡ Funcionalidades Avançadas

### Lógica de Reprodução

1. **Música principal** (base do repertório)
2. A cada **3 músicas** → **Hora Certa**
3. A cada **6 músicas** → **Avisos/Propagandas**
4. **Álbuns temáticos** intercalados quando ativos

### Álbuns Temáticos

| Álbum | Época | Imagem |
|-------|-------|---------|
| 🎄 Natal | Dezembro | Tema natalino |
| 🐰 Páscoa | Março/Abril | Tema pascal |
| 🎪 São João | Junho | Tema junino |
| 🎭 Carnaval | Fevereiro | Tema carnavalesco |

### Armazenamento

- **Cloudinary**: Arquivos de áudio na nuvem
- **LocalStorage**: Configurações e estatísticas
- **Sem Banco de Dados**: Funciona totalmente no frontend

## 🔧 Personalização

### Alterar Senha Admin

No arquivo `script.js`:

```javascript
this.password = 'sua_nova_senha';
```

### Adicionar Novos Álbuns

```javascript
this.albumInfo = {
    // ... álbuns existentes
    halloween: {
        name: 'Especial Halloween',
        image: 'https://sua-imagem-halloween.jpg'
    }
};

this.playlists = {
    // ... playlists existentes
    albums: {
        // ... álbuns existentes
        halloween: []
    }
};
```

### Personalizar Visual

Edite as variáveis CSS em `styles.css`:

```css
:root {
    --primary-color: #2c3e50;
    --accent-color: #3498db;
    --bg-color: #1a1a1a;
    /* ... outras variáveis */
}
```

## 🔒 Segurança

- **Senha simples** para acesso administrativo
- **Arquivos na nuvem** com URLs seguras
- **Sem exposição de API secrets** no frontend
- **Uploads validados** por tipo e tamanho

## 📱 Responsividade

- **Desktop**: Layout completo com todas as funcionalidades
- **Tablet**: Interface adaptada para telas médias  
- **Mobile**: Player otimizado para smartphones

## 🎵 Formatos Suportados

- **MP3** (recomendado)
- **WAV** (alta qualidade)
- **OGG** (código aberto)
- **FLAC** (sem perdas)

## ⚠️ Limitações

- **Tamanho máximo**: 50MB por arquivo
- **Cloudinary gratuito**: 25GB de armazenamento
- **Sem streaming**: arquivos são baixados inteiros
- **Sem cache offline**: requer conexão à internet

## 🐛 Solução de Problemas

### Arquivos não carregam
- Verifique as credenciais do Cloudinary
- Confirme o upload preset configurado
- Teste com arquivos menores

### Player não inicia
- Verifique se há músicas na playlist
- Confirme permissões de autoplay do navegador
- Teste em modo de navegação privada

### Interface não responde
- Limpe o localStorage: `localStorage.clear()`
- Atualize a página
- Verifique o console para erros

## 📈 Roadmap

- [ ] Integração com streaming services
- [ ] Playlist personalizada por horário
- [ ] Notificações push para administradores
- [ ] API para integração com sistemas externos
- [ ] Suporte a múltiplos idiomas
- [ ] Dashboard de analytics avançado

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
4. Push para a branch: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 Autor

**Supermercado do Louro**
- 📧 Email: contato@supermercadodolouro.com
- 🌐 Website: [www.supermercadodolouro.com](https://www.supermercadodolouro.com)

## 🙏 Agradecimentos

- [Cloudinary](https://cloudinary.com) pela infraestrutura de mídia
- [Font Awesome](https://fontawesome.com) pelos ícones
- [GitHub Pages](https://pages.github.com) pela hospedagem gratuita

---

⭐ **Se este projeto foi útil, considere dar uma estrela no GitHub!**
