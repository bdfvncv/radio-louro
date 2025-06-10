// radio-player.js

const supabaseUrl = "https://yrlwyvvlgrjbwnoiwdxv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHd5dnZsZ3JqYndub2l3ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDk0OTMsImV4cCI6MjA2NDM4NTQ5M30.qrNDx8aqL2WtWPalhmjzeUY6bCNVnnK48L2Oi2DpkVI";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const player = document.getElementById("audioPlayer");
const volumeControl = document.getElementById("volumeControl");
const albumNome = document.getElementById("albumNome");
const albumBanner = document.getElementById("albumBanner");
const relatorio = document.getElementById("relatorio");

let fila = [];
let filaHora = [];
let filaAvisos = [];
let tocadas = {};
let albumAtivo = localStorage.getItem("albumAtivo") || null;
let senha = "2007";

// Volume
volumeControl.addEventListener("input", () => {
  player.volume = volumeControl.value;
});

// Login modo dev
window.entrarDev = function() {
  const senhaInput = document.getElementById("senhaDev").value;
  if (senhaInput === senha) {
    document.getElementById("painelDev").classList.remove("hidden");
    document.getElementById("loginDev").classList.add("hidden");
    carregarRelatorio();
  } else {
    alert("Senha incorreta");
  }
};

// Uploads
window.uploadArquivo = async function(bucket) {
  const input = document.getElementById(`upload${bucket.charAt(0).toUpperCase() + bucket.slice(1)}`);
  const file = input.files[0];
  if (!file) return alert("Selecione um arquivo");
  const { error } = await supabase.storage.from(bucket).upload(`${Date.now()}-${file.name}`, file);
  if (error) return alert("Erro ao enviar");
  alert("Enviado com sucesso!");
};

window.uploadParaAlbum = async function(bucket, inputId) {
  const input = document.getElementById(inputId);
  const file = input.files[0];
  if (!file) return alert("Selecione um arquivo");
  const { error } = await supabase.storage.from(bucket).upload(`${Date.now()}-${file.name}`, file);
  if (error) return alert("Erro ao enviar");
  alert("Enviado com sucesso ao álbum " + bucket);
};

// Ativar/Desativar álbum
window.ativarAlbum = function(album) {
  localStorage.setItem("albumAtivo", album);
  albumAtivo = album;
  mostrarAlbum();
  alert("Álbum " + album + " ativado");
};

window.desativarAlbum = function() {
  localStorage.removeItem("albumAtivo");
  albumAtivo = null;
  mostrarAlbum();
  alert("Álbum desativado");
};

function mostrarAlbum() {
  if (albumAtivo) {
    albumNome.innerText = "Álbum Ativo: " + albumAtivo.toUpperCase();
    albumBanner.src = `/img/${albumAtivo}.jpg`;
    albumBanner.style.display = "block";
  } else {
    albumNome.innerText = "";
    albumBanner.style.display = "none";
  }
}

// Reproduzir música
async function carregarAudios(bucket) {
  const { data, error } = await supabase.storage.from(bucket).list();
  if (error) return [];
  const urls = await Promise.all(
    data.map(async file => {
      const { data: urlData } = await supabase.storage.from(bucket).getPublicUrl(file.name);
      return urlData.publicUrl;
    })
  );
  return urls;
}

function tocarProxima() {
  if (filaHora.length && novaHora()) {
    player.src = filaHora.shift();
  } else if (filaAvisos.length && tocadasTotais() % 6 === 0) {
    player.src = filaAvisos.shift();
  } else {
    if (fila.length === 0) return;
    const musica = fila.shift();
    player.src = musica;
    if (!tocadas[musica]) tocadas[musica] = 0;
    tocadas[musica]++;
  }
  player.play();
  salvarRelatorio();
}

function novaHora() {
  const agora = new Date();
  return agora.getMinutes() === 10; // exemplo: 1:10, 2:10, etc
}

function tocadasTotais() {
  return Object.values(tocadas).reduce((a, b) => a + b, 0);
}

async function iniciarRadio() {
  fila = await carregarAudios(albumAtivo || "musicas");
  filaHora = await carregarAudios("hora_certa");
  filaAvisos = await carregarAudios("avisos");
  embaralhar(fila);
  player.addEventListener("ended", tocarProxima);
  tocarProxima();
}

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function salvarRelatorio() {
  relatorio.innerHTML = "";
  Object.entries(tocadas).forEach(([nome, qtd]) => {
    const li = document.createElement("li");
    li.innerText = `${nome.split("-").pop()} - ${qtd}x`;
    relatorio.appendChild(li);
  });
}

function carregarRelatorio() {
  salvarRelatorio();
}

window.resetarRelatorio = function() {
  tocadas = {};
  salvarRelatorio();
};

// Inicialização
mostrarAlbum();
iniciarRadio();
