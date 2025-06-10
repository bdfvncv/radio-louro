// rádio-player.js

// 1) Inicializa o Supabase
const supabaseUrl = "https://yrlwyvvlgrjbwnoiwdxv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHd5dnZsZ3JqYndub2l3ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDk0OTMsImV4cCI6MjA2NDM4NTQ5M30.qrNDx8aqL2WtWPalhmjzeUY6bCNVnnK48L2Oi2DpkVI";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Elementos
const audio = document.getElementById("audioPlayer");
const volumeControl = document.getElementById("volumeControl");
const albumNomeEl = document.getElementById("albumNome");
const albumBanner = document.getElementById("albumBanner");
const relatorioEl = document.getElementById("relatorio");
const listaArquivosEl = document.getElementById("listaArquivos");

// Estado
let fila = [], filaHora = [], filaAvisos = [];
let tocadas = {}, albumAtivo = localStorage.getItem("albumAtivo") || null;
const senhaDev = "2007";

// Ajusta volume
audio.volume = volumeControl.value;
volumeControl.addEventListener("input", () => audio.volume = volumeControl.value);

// Inicia o rádio
async function iniciarRadio() {
  await carregarPlaylist();
  await carregarHoraCerta();
  await carregarAvisos();
  embaralhar(fila);
  tocarProxima();
}

// Carrega músicas
async function carregarPlaylist() {
  const bucket = albumAtivo || "musicas";
  const { data, error } = await supabase.storage.from(bucket).list();
  if (error) return console.error(error);
  fila = data.filter(f => f.name.endsWith(".mp3")).map(f => f.name);
  atualizarBanner();
  listarArquivos(bucket, data);
}

// Carrega hora certa
async function carregarHoraCerta() {
  const { data, error } = await supabase.storage.from("hora_certa").list();
  if (error) return console.error(error);
  filaHora = data.map(f => f.name);
}

// Carrega avisos
async function carregarAvisos() {
  const { data, error } = await supabase.storage.from("avisos").list();
  if (error) return console.error(error);
  filaAvisos = data.map(f => f.name);
}

// Atualiza banner e nome do álbum
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

// Embaralha array
function embaralhar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Toca próxima faixa
audio.addEventListener("ended", tocarProxima);
async function tocarProxima() {
  let nome;
  const total = Object.values(tocadas).reduce((a, b) => a + b, 0);

  if (total > 0 && total % 6 === 0 && filaAvisos.length) {
    nome = filaAvisos[Math.floor(Math.random() * filaAvisos.length)];
  } else if (total > 0 && total % 3 === 0 && filaHora.length) {
    nome = filaHora[Math.floor(Math.random() * filaHora.length)];
  } else {
    if (!fila.length) {
      await carregarPlaylist();
      embaralhar(fila);
    }
    nome = fila.shift();
    tocadas[nome] = (tocadas[nome] || 0) + 1;
  }

  const bucket = albumAtivo || "musicas";
  const { data: urlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(nome, 60);
  if (error) return console.error(error);

  audio.src = urlData.signedUrl;
  audio.play();
  atualizarRelatorio();
}

// Atualiza relatório
function atualizarRelatorio() {
  relatorioEl.innerHTML = "";
  Object.entries(tocadas).forEach(([n, c]) => {
    const li = document.createElement("li");
    li.textContent = `${n}: ${c}x`;
    relatorioEl.appendChild(li);
  });
}

// Reset relatório
window.resetarRelatorio = () => {
  tocadas = {};
  atualizarRelatorio();
};

// Listar arquivos no painel dev
function listarArquivos(bucket, data) {
  listaArquivosEl.innerHTML = "";
  data.forEach(f => {
    const li = document.createElement("li");
    li.textContent = f.name;
    listaArquivosEl.appendChild(li);
  });
}

// Upload genérico
window.uploadArquivo = async bucket => {
  const input = document.getElementById(`upload${capitalize(bucket)}`);
  const file = input.files[0];
  if (!file) return alert("Selecione um arquivo");
  const destino = bucket === "musicas" && albumAtivo ? albumAtivo : bucket;
  const { error } = await supabase.storage.from(destino).upload(file.name, file, { upsert: true });
  if (error) return alert("Upload falhou");
  alert("Upload concluído");
  await iniciarRadio();
};

// Upload em álbum
window.uploadParaAlbum = async (alb, inputId) => {
  const file = document.getElementById(inputId).files[0];
  if (!file) return alert("Selecione um arquivo");
  const { error } = await supabase.storage.from(alb).upload(file.name, file, { upsert: true });
  if (error) return alert("Upload falhou");
  alert("Upload em álbum concluído");
  await iniciarRadio();
};

// Ativar / desativar álbum
window.ativarAlbum = alb => {
  localStorage.setItem("albumAtivo", alb);
  albumAtivo = alb;
  atualizarBanner();
  iniciarRadio();
};
window.desativarAlbum = () => {
  localStorage.removeItem("albumAtivo");
  albumAtivo = null;
  atualizarBanner();
  iniciarRadio();
};

// Login dev
window.entrarDev = () => {
  const s = document.getElementById("senhaDev").value;
  if (s === senhaDev) {
    document.getElementById("painelDev").classList.remove("hidden");
    document.getElementById("loginDev").classList.add("hidden");
  } else {
    alert("Senha incorreta");
  }
};

// Capitaliza string
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Inicia tudo
document.addEventListener("DOMContentLoaded", iniciarRadio);
