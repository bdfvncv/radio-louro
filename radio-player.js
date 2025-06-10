// radio-jogador.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://yrlwyvvlgrjbwnoiwdxv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHd5dnZsZ3JqYndub2l3ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDk0OTMsImV4cCI6MjA2NDM4NTQ5M30.qrNDx8aqL2WtWPalhmjzeUY6bCNVnnK48L2Oi2DpkVI'
);

const audioPlayer = document.getElementById('audioPlayer');
const volumeControl = document.getElementById('volumeControl');
const albumBanner = document.getElementById('albumBanner');
const albumNome = document.getElementById('albumNome');
const relatorio = document.getElementById('relatorio');

let fila = [], filaOriginal = [], filaHoraCerta = [], filaAvisos = [], albumAtivo = null, tocadas = [];
let contador = 0;

async function carregarAudios(path) {
  const { data, error } = await supabase.storage.from('audios').list(path);
  if (error) return [];
  return data.map(file => `https://yrlwyvvlgrjbwnoiwdxv.supabase.co/storage/v1/object/public/audios/${path}/${file.name}`);
}

async function inicializarPlayer() {
  const musicas = await carregarAudios('musicas');
  const horaCerta = await carregarAudios('hora_certa');
  const avisos = await carregarAudios('avisos');
  filaOriginal = embaralhar(musicas);
  filaHoraCerta = horaCerta;
  filaAvisos = avisos;
  fila = [...filaOriginal];
  tocarProxima();
}

function embaralhar(lista) {
  return lista.sort(() => Math.random() - 0.5);
}

function tocarProxima() {
  let proxima;
  contador++;

  if (contador % 6 === 0 && filaAvisos.length) {
    proxima = filaAvisos[Math.floor(Math.random() * filaAvisos.length)];
  } else if (contador % 3 === 0 && filaHoraCerta.length) {
    proxima = filaHoraCerta[Math.floor(Math.random() * filaHoraCerta.length)];
  } else {
    if (!fila.length) fila = embaralhar(albumAtivo || filaOriginal);
    proxima = fila.shift();
  }

  audioPlayer.src = proxima;
  audioPlayer.play();
  registrarRelatorio(proxima);
}

audioPlayer.addEventListener('ended', tocarProxima);

volumeControl.addEventListener('input', e => {
  audioPlayer.volume = parseFloat(e.target.value);
});

function registrarRelatorio(url) {
  const nome = decodeURIComponent(url.split('/').pop());
  tocadas.push(nome);
  const li = document.createElement('li');
  li.textContent = nome;
  relatorio.appendChild(li);
}

window.resetarRelatorio = function () {
  relatorio.innerHTML = '';
  tocadas = [];
};

window.entrarDev = function () {
  const senha = document.getElementById('senhaDev').value;
  if (senha === 'admin123') {
    document.getElementById('painelDev').classList.remove('hidden');
  } else {
    alert('Senha incorreta!');
  }
};

window.uploadArquivo = async function (pasta) {
  const input = document.getElementById(`upload${capitalize(pasta)}`);
  if (!input.files.length) return;
  const file = input.files[0];
  await supabase.storage.from('audios').upload(`${pasta}/${file.name}`, file);
  alert('Enviado com sucesso!');
};

window.uploadParaAlbum = async function (album, inputId) {
  const input = document.getElementById(inputId);
  if (!input.files.length) return;
  const file = input.files[0];
  await supabase.storage.from('audios').upload(`${album}/${file.name}`, file);
  alert('Música adicionada ao álbum!');
};

window.ativarAlbum = async function (album) {
  const musicas = await carregarAudios(album);
  if (!musicas.length) return alert('Nenhuma música no álbum.');
  albumAtivo = musicas;
  const bannerURL = `https://yrlwyvvlgrjbwnoiwdxv.supabase.co/storage/v1/object/public/audios/${album}/banner.jpg`;
  albumBanner.src = bannerURL;
  albumBanner.style.display = 'block';
  albumNome.textContent = `Álbum: ${album.replace('_', ' ').toUpperCase()}`;
  fila = embaralhar(musicas);
  tocarProxima();
};

window.desativarAlbum = function () {
  albumAtivo = null;
  albumBanner.style.display = 'none';
  albumNome.textContent = '';
  fila = embaralhar(filaOriginal);
};

inicializarPlayer();

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
