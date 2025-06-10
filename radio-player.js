// rádio-jogador.js - versão final com correções completas

const supabaseUrl = "https://yrlwyvvlgrjbwnoiwdxv.supabase.co"; const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHd5dnZsZ3JqYndub2l3ZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDk0OTMsImV4cCI6MjA2NDM4NTQ5M30.qrNDx8aqL2WtWPalhmjzeUY6bCNVnnK48L2Oi2DpkVI";

const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const audio = new Audio(); let playlist = []; let currentIndex = 0; let musicasTocadas = 0; let modoDevAtivo = false;

const albuns = ["geral", "hora_certa", "avisos"];

async function carregarMusicas(bucket) { const { data, error } = await supabase.storage.from(bucket).list("", { limit: 100 }); if (error) { console.error(Erro ao carregar ${bucket}:, error); return []; } return data.map((file) => ({ nome: file.name, bucket })); }

async function montarPlaylist() { playlist = []; const geral = await carregarMusicas("geral"); const horaCerta = await carregarMusicas("hora_certa"); const avisos = await carregarMusicas("avisos");

for (let i = 0; i < geral.length; i++) { playlist.push(geral[i]); if ((i + 1) % 3 === 0 && horaCerta.length) { playlist.push(horaCerta[Math.floor(Math.random() * horaCerta.length)]); } if ((i + 1) % 6 === 0 && avisos.length) { playlist.push(avisos[Math.floor(Math.random() * avisos.length)]); } } }

async function tocarProxima() { if (currentIndex >= playlist.length) { currentIndex = 0; await montarPlaylist(); }

const musica = playlist[currentIndex]; currentIndex++;

const { data, error } = supabase.storage.from(musica.bucket).getPublicUrl(musica.nome); if (error) { console.error("Erro ao obter URL pública:", error); tocarProxima(); return; }

audio.src = data.publicUrl; audio.load(); audio.play().catch((err) => { console.error("Erro ao reproduzir a música:", err); tocarProxima(); });

atualizarTitulo(musica); musicasTocadas++; }

audio.addEventListener("ended", tocarProxima);

function atualizarTitulo(musica) { const titulo = document.getElementById("titulo-musica"); if (titulo) { titulo.textContent = Tocando agora: ${musica.nome}; } }

// Login desenvolvedor async function loginDev() { const senha = document.getElementById("senha-dev").value; if (senha === "superlourosom") { modoDevAtivo = true; document.getElementById("modo-dev").style.display = "block"; document.getElementById("login-dev").style.display = "none"; } else { alert("Senha incorreta!"); } }

// Upload async function uploadArquivo(tipo) { const inputMap = { geral: "uploadGeral", hora_certa: "uploadHora", avisos: "uploadAviso" }; const inputId = inputMap[tipo]; const fileInput = document.getElementById(inputId); const file = fileInput.files[0];

if (!file) return alert("Selecione um arquivo!");

const { error } = await supabase.storage.from(tipo).upload(file.name, file, { cacheControl: "3600", upsert: true });

if (error) { console.error("Erro no upload:", error); alert("Erro ao enviar o arquivo!"); } else { alert("Upload realizado com sucesso!"); await montarPlaylist(); } }

// Inicialização automática window.addEventListener("DOMContentLoaded", async () => { const titulo = document.getElementById("titulo-musica"); if (titulo) titulo.textContent = "Carregando músicas..."; await montarPlaylist(); tocarProxima(); });

