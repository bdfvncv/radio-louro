// rádio-jogador.js

// Inicializa o Supabase
const supabaseUrl = "https://yrlwyvvlgrjbwnoiwdxv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHd5dnZsZ3JqYndub2l3ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDk0OTMsImV4cCI6MjA2NDM4NTQ5M30.qrNDx8aqL2WtWPalhmjzeUY6bCNVnnK48L2Oi2DpkVI";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Elementos da página
const audio = document.getElementById("audioPlayer");
const volumeControl = document.getElementById("volumeControl");
const albumNomeEl = document.getElementById("albumNome");
const albumBanner = document.getElementById("albumBanner");
const relatorioEl = document.getElementById("relatorio");
const listaArquivosEl = document.getElementById("listaArquivos");

// Estado
let fila = [];
let filaHora = [];
let filaAvisos = [];
let tocadas = {};
let albumAtivo = localStorage.getItem("albumAtivo") || null;
const senhaDev = "2007";

// Ajusta volume
volumeControl.addEventListener("input", () => {
  audio.volume = volumeControl.value;
});

// Carrega todas as playlists (músicas, hora certa, avisos)
async function iniciarRadio() {
  await carregarPlaylist();
  await carregarHoraCerta();
  await carregarAvisos();
  embaralhar(fila);
  tocarProxima();
}

// 1) Carrega músicas
async function carregarPlaylist() {
  const bucket = albumAtivo || "musicas";
  const { data, error } = await supabase.storage.from(bucket).list();
  if (error) return console.error(error);
  fila = data.filter(f => f.name.endsWith(".mp3")).map(f => f.name);
  atualizarBanner();
  listarArquivos(bucket, data);
}

// 2) Carrega hora certa
async function carregarHoraCerta() {
  const { data, error } = await supabase.storage.from("hora_certa").list();
  if (error) return console.error(error);
  filaHora = data.map(f => f.name);
}

// 3) Carrega avisos
async function carregarAvisos() {
  const { data, error } = await supabase.storage.from("avisos").list();
  if (error) return console.error(error);
  filaAvisos = data.map(f => f.name);
}

// Exibe banner e nome do álbum ativo
function atualizarBanner() {
  if (albumAtivo) {
    albumNomeEl.innerText = `Álbum Ativo: ${albumAtivo}`;
    albumBanner.src = `${supabaseUrl}/storage/v1/object/public/imagens/${albumAtivo}.jpg`;
    albumBanner.style.display = "block";
  } else {
    albumNomeEl.innerText = "";
    albumBanner.style.display = "none";
  }
}

// Embaralha array in-place
function embaralhar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// 4) Lógica de reprodução
audio.addEventListener("ended", tocarProxima);
async function tocarProxima() {
  let nome;
  const total = Object.values(tocadas).reduce((a, b) => a + b, 0);
  
  // A cada 6 músicas, toca aviso
  if (total > 0 && total % 6 === 0 && filaAvisos.length) {
    nome = filaAvisos[Math.floor(Math.random() * filaAvisos.length)];
  }
  // A cada 3 músicas, toca hora certa
  else if (total > 0 && total % 3 === 0 && filaHora.length) {
    nome = filaHora[Math.floor(Math.random() * filaHora.length)];
  }
  // Caso contrário, toca próxima música
  else {
    if (!fila.length) {
      await carregarPlaylist();
      embaralhar(fila);
    }
    nome = fila.shift();
    tocadas[nome] = (tocadas[nome] || 0) + 1;
  }

  // Busca URL pública ou assinada
  const bucket = albumAtivo || "musicas";
  const { data: urlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(nome, 60);
  if (error) return console.error(error);

  audio.src = urlData.signedUrl;
  audio.play();
  atualizarRelatorio();
}

// Atualiza relatório na tela
function atualizarRelatorio() {
  relatorioEl.innerHTML = "";
  Object.entries(tocadas).forEach(([nome, qtd]) => {
    const li = document.createElement("li");
    li.textContent = `${nome}: ${qtd}x`;
    relatorioEl.appendChild(li);
  });
}

// Reseta relatório
window.resetarRelatorio = function() {
  tocadas = {};
  atualizarRelatorio();
};

// Funções de upload
window.uploadArquivo = async function(bucket) {
  const input = document.getElementById(`upload${capitalize(bucket)}`);
  const file = input.files[0];
  if (!file) return alert("Selecione um arquivo");
  const destino = bucket === "musicas" && albumAtivo ? albumAtivo : bucket;
  const { error } = await supabase.storage.from(destino).upload(file.name, file, { upsert: true });
  if (error) return alert("Erro no upload");
  alert("Upload bem-sucedido!");
  await iniciarRadio();
};

window.uploadParaAlbum = async function(album, inputId) {
  const input = document.getElementById(inputId);
  const file = input.files[0];
  if (!file) return alert("Selecione um arquivo");
  const { error } = await supabase.storage.from(album).upload(file.name, file, { upsert: true });
  if (error) return alert("Erro no upload");
  alert(`Enviado ao álbum ${album}`);
  await iniciarRadio();
};

// Ativa e desativa álbuns
window.ativarAlbum = function(nome) {
  localStorage.setItem("albumAtivo", nome);
  albumAtivo = nome;
  atualizarBanner();
  iniciarRadio();
};

window.desativarAlbum = function() {
  localStorage.removeItem("albumAtivo");
  albumAtivo = null;
  atualizarBanner();
  iniciarRadio();
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Login modo dev
window.entrarDev = function() {
  const s = document.getElementById("senhaDev").value;
  if (s === senhaDev) {
    document.getElementById("painelDev").classList.remove("hidden");
    document.getElementById("loginDev").classList.add("hidden");
  } else {
    alert("Senha incorreta");
  }
};

// Inicialização
document.addEventListener("DOMContentLoaded", iniciarRadio);
