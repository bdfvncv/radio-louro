// rádio-jogador.js

// 1) Liste aqui TODOS os links diretos que você pegou do Cloudinary:
const MUSIC_URLS = [
  // exemplo:
  "https://res.cloudinary.com/seu_usuario/video/upload/musicas/minha-musica_x1y2z3.mp3",
  // adicione quantas músicas quiser...
];

const TIME_URLS = [
  // exemplo de hora certa:
  // "https://res.cloudinary.com/seu_usuario/video/upload/hora_certa/hora-certa-1_abcd.mp3",
];

const AD_URLS = [
  // exemplo de aviso:
  // "https://res.cloudinary.com/seu_usuario/video/upload/avisos/aviso-promocional_wxyz.mp3",
];

// Se quiser álbuns temáticos, crie outros arrays:
const ALBUM_URLS = {
  natal: [
    // "https://res.cloudinary.com/seu_usuario/video/upload/natal/jingle-bells_qwerty.mp3",
  ],
  pascoa: [
    // ...
  ],
  saojoao: [
    // ...
  ],
};

// ------------------------------------------------------------------
// ** Não edite abaixo desta linha, a não ser para ajustes visuais **
// ------------------------------------------------------------------

const audio = document.getElementById("audioPlayer");
const playBtn = document.getElementById("playBtn");
const volumeSlider = document.getElementById("volumeSlider");
const nowPlaying = document.getElementById("nowPlaying");
const trackInfo = document.getElementById("trackInfo");

let queue = [];
let count = 0;
let current = 0;
let tocadas = {};

let activeAlbum = localStorage.getItem("activeAlbum") || null;

// Monta fila de reprodução com lógica alternada
function buildQueue() {
  queue = [];
  let i = 0;
  let mIdx = 0, tIdx = 0, aIdx = 0, alIdx = 0;
  // Cria um ciclo de 100 execuções (você pode ajustar)
  while (i < 100) {
    if (i > 0 && i % 6 === 0 && AD_URLS.length) {
      queue.push({ url: AD_URLS[aIdx++ % AD_URLS.length], label: "Aviso" });
    } else if (i > 0 && i % 3 === 0 && TIME_URLS.length) {
      queue.push({ url: TIME_URLS[tIdx++ % TIME_URLS.length], label: "Hora Certa" });
    } else {
      // álbum temático ou música normal
      if (activeAlbum && ALBUM_URLS[activeAlbum]?.length && Math.random()<0.3) {
        const arr = ALBUM_URLS[activeAlbum];
        queue.push({ url: arr[alIdx % arr.length], label: activeAlbum.toUpperCase() });
        alIdx++;
      } else if (MUSIC_URLS.length) {
        queue.push({ url: MUSIC_URLS[mIdx % MUSIC_URLS.length], label: "Música" });
        mIdx++;
      }
    }
    i++;
  }
  current = 0;
}

// Reproduz a faixa atual e registra no relatório
function playCurrent() {
  if (!queue.length) {
    nowPlaying.textContent = "Nenhuma faixa disponível";
    return;
  }
  const item = queue[current];
  audio.src = item.url;
  nowPlaying.textContent = item.label;
  const nome = item.url.split("/").pop();
  tocadas[nome] = (tocadas[nome] || 0) + 1;
  localStorage.setItem("tocadas", JSON.stringify(tocadas));
  updateReport();
  audio.play();
  playBtn.textContent = "⏸️";
}

// Avança para a próxima faixa (ou reconstrói a fila)
function nextTrack() {
  current++;
  if (current >= queue.length) {
    buildQueue();
  }
  playCurrent();
}

// Atualiza relatório na tela
function updateReport() {
  const reportEl = document.getElementById("relatorio");
  reportEl.innerHTML = "";
  for (const [file, cnt] of Object.entries(tocadas)) {
    const li = document.createElement("li");
    li.textContent = `${file} — ${cnt}x`;
    reportEl.appendChild(li);
  }
}

// Função de alternância Play/Pause
function togglePlay() {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = "⏸️";
  } else {
    audio.pause();
    playBtn.textContent = "▶️";
  }
}

// Controla o volume
volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value / 100;
});

// Reseta o relatório
window.resetarRelatorio = () => {
  tocadas = {};
  localStorage.removeItem("tocadas");
  updateReport();
};

// Define álbum ativo
window.selectAlbum = (alb) => {
  activeAlbum = alb === "none" ? null : alb;
  localStorage.setItem("activeAlbum", activeAlbum);
  buildQueue();
  updateAlbumDisplay();
};

// Atualiza exibição do álbum ativo
function updateAlbumDisplay() {
  const coverEl = document.getElementById("albumCover");
  const nameEl = document.getElementById("albumNome");
  if (activeAlbum) {
    const cfg = { natal: "🎄", pascoa: "🐰", saojoao: "🌽" };
    coverEl.textContent = cfg[activeAlbum] || "🎵";
    nameEl.textContent = `Álbum: ${activeAlbum}`;
  } else {
    coverEl.textContent = "🎵";
    nameEl.textContent = "";
  }
}

// Evento ao terminar de tocar
audio.addEventListener("ended", nextTrack);

// Botão play
playBtn.addEventListener("click", togglePlay);

// Inicia tudo
document.addEventListener("DOMContentLoaded", () => {
  tocadas = JSON.parse(localStorage.getItem("tocadas")||"{}");
  buildQueue();
  updateAlbumDisplay();
  updateReport();
  playCurrent();
});
