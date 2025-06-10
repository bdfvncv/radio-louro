<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rádio Supermercado do Louro</title>
  <script type="module">
    import { createClient } from 'https://esm.sh/@supabase/supabase-js';

    const supabaseUrl = 'https://yrlwyvvlgrjbwnoiwdxv.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHd5dnZsZ3JqYndub2l3ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDk0OTMsImV4cCI6MjA2NDM4NTQ5M30.qrNDx8aqL2WtWPalhmjzeUY6bCNVnnK48L2Oi2DpkVI';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    const isAdmin = token === '2007';

    let musicaIndex = 0;
    let musicaCounter = 0;
    let avisoCounter = 0;
    let musicas = [];
    let horaCerta = [];
    let avisos = [];
    let albumAtivo = localStorage.getItem('album') || '';
    let tocadas = JSON.parse(localStorage.getItem('tocadas') || '{}');

    async function uploadFile(bucket, inputId) {
      const file = document.getElementById(inputId).files[0];
      if (!file) return alert('Selecione um arquivo.');
      const destino = bucket === 'musicas' && albumAtivo ? albumAtivo : bucket;
      const { error } = await supabase.storage.from(destino).upload(file.name, file, { upsert: true });
      if (error) return alert('Erro ao enviar: ' + error.message);
      alert('Arquivo enviado com sucesso!');
      listarArquivos();
    }

    async function uploadImagemAlbum() {
      const file = document.getElementById('imagemAlbum').files[0];
      if (!file || !albumAtivo) return alert('Selecione um álbum e uma imagem.');
      const { error } = await supabase.storage.from('imagens').upload(`${albumAtivo}.jpg`, file, { upsert: true });
      if (error) return alert('Erro ao enviar imagem: ' + error.message);
      alert('Imagem do álbum enviada com sucesso!');
      exibirImagemAlbum();
    }

    async function exibirImagemAlbum() {
      if (!albumAtivo) return;
      const url = `${supabaseUrl}/storage/v1/object/public/imagens/${albumAtivo}.jpg`;
      document.getElementById('capaAlbum')?.setAttribute('src', url);
      document.getElementById('nomeAlbum')?.innerText = albumAtivo.toUpperCase();
    }

    async function deletarArquivo(bucket, nome) {
      if (!confirm('Tem certeza que deseja excluir "' + nome + '"?')) return;
      const { error } = await supabase.storage.from(bucket).remove([nome]);
      if (error) return alert('Erro: ' + error.message);
      alert('Excluído com sucesso!');
      listarArquivos();
    }

    async function listarArquivos() {
      if (!isAdmin) return;
      const destino = albumAtivo || 'musicas';
      const { data, error } = await supabase.storage.from(destino).list();
      const lista = document.getElementById("arquivos");
      lista.innerHTML = '';
      data?.forEach(f => {
        const div = document.createElement('div');
        div.textContent = f.name + (tocadas[f.name] ? ` (Tocada: ${tocadas[f.name]})` : '');
        const btn = document.createElement('button');
        btn.textContent = '❌';
        btn.onclick = () => deletarArquivo(destino, f.name);
        div.appendChild(btn);
        lista.appendChild(div);
      });
    }

    async function carregarAudios() {
      document.getElementById("spinner").style.display = "block";

      const musicBucket = albumAtivo || 'musicas';
      const { data: m } = await supabase.storage.from(musicBucket).list();
      const { data: h } = await supabase.storage.from('hora-certa').list();
      const { data: a } = await supabase.storage.from('avisos').list();

      musicas = m?.map(f => `${supabaseUrl}/storage/v1/object/public/${musicBucket}/${f.name}`) || [];
      musicas = musicas.sort(() => Math.random() - 0.5);
      horaCerta = h?.map(f => `${supabaseUrl}/storage/v1/object/public/hora-certa/${f.name}`) || [];
      avisos = a?.map(f => `${supabaseUrl}/storage/v1/object/public/avisos/${f.name}`) || [];

      document.getElementById("spinner").style.display = "none";
      listarArquivos();
      exibirImagemAlbum();
      tocarProxima();
    }

    function tocarProxima() {
      const audio = document.getElementById('player');

      if (musicaCounter === 3 && horaCerta.length > 0) {
        audio.src = horaCerta[Math.floor(Math.random() * horaCerta.length)];
        musicaCounter = 0;
        avisoCounter++;
      } else if (avisoCounter === 2 && avisos.length > 0) {
        audio.src = avisos[Math.floor(Math.random() * avisos.length)];
        avisoCounter = 0;
      } else {
        if (musicas.length === 0) return;
        const src = musicas[musicaIndex % musicas.length];
        const nome = src.split('/').pop();
        tocadas[nome] = (tocadas[nome] || 0) + 1;
        localStorage.setItem('tocadas', JSON.stringify(tocadas));
        audio.src = src;
        musicaIndex++;
        musicaCounter++;
      }

      audio.play();
    }

    window.onload = () => {
      const atual = localStorage.getItem('album') || '';
      if (atual) document.querySelector(`[data-album='${atual}']`)?.classList.add('ativo');
      carregarAudios();
    };

    window.ativarAlbum = (nome) => {
      localStorage.setItem('album', nome);
      document.querySelectorAll('.albumbtn').forEach(b => b.classList.remove('ativo'));
      document.querySelector(`[data-album='${nome}']`).classList.add('ativo');
      location.reload();
    };

    window.desativarAlbum = () => {
      localStorage.removeItem('album');
      location.reload();
    };

    window.resetContagem = () => {
      if (!confirm('Resetar contagem de reproduções?')) return;
      tocadas = {};
      localStorage.removeItem('tocadas');
      listarArquivos();
    }
  </script>
  <style>
    body {
      background: #f7fff8;
      font-family: sans-serif;
      color: #0a572f;
      padding: 30px;
    }
    .box {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 0 10px #ccc;
      margin-bottom: 20px;
    }
    .albumbtn.ativo {
      background: #0a572f;
      color: white;
    }
    #capaAlbum {
      max-width: 100%;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    #spinner { display: none; text-align: center; }
    #arquivos div {
      margin: 5px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #arquivos button {
      background: red;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>📻 Rádio Supermercado do Louro</h1>

  <div class="box">
    <h2>🎵 Álbum Ativo: <span id="nomeAlbum"></span></h2>
    <img id="capaAlbum" src="" alt="Capa do álbum" />
    <div id="spinner">🔄 Carregando músicas...</div>
    <audio id="player" controls onended="tocarProxima()"></audio>
    <label for="volume">Volume</label>
    <input id="volume" type="range" min="0" max="1" step="0.01" value="1" onchange="player.volume=this.value">
  </div>

  <div id="admin" style="display:none">
    <div class="box">
      <h2>🎛️ Painel Administrador</h2>
      <button class="albumbtn" data-album="sao-joao" onclick="ativarAlbum('sao-joao')">São João</button>
      <button class="albumbtn" data-album="natal" onclick="ativarAlbum('natal')">Natal</button>
      <button class="albumbtn" data-album="pascoa" onclick="ativarAlbum('pascoa')">Páscoa</button>
      <button onclick="desativarAlbum()">Desativar Álbum</button>
    </div>

    <div class="box">
      <h2>📁 Envio</h2>
      <input type="file" id="musica" />
      <button onclick="uploadFile('musicas', 'musica')">Música</button>
      <input type="file" id="hora" />
      <button onclick="uploadFile('hora-certa', 'hora')">Hora Certa</button>
      <input type="file" id="aviso" />
      <button onclick="uploadFile('avisos', 'aviso')">Aviso</button>
      <input type="file" id="imagemAlbum" />
      <button onclick="uploadImagemAlbum()">Imagem do Álbum</button>
    </div>

    <div class="box">
      <h2>📄 Arquivos e Contagem</h2>
      <div id="arquivos"></div>
      <button onclick="resetContagem()">🔄 Resetar Contagem</button>
    </div>
  </div>

  <script>
    if (token === '2007') {
      document.getElementById('admin').style.display = 'block';
    }
  </script>
</body>
</html>
