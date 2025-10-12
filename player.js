// Variáveis globais
let audioPlayer = null;
let currentHour = -1;
let realtimeSubscription = null;
let countdownInterval = null;

// Inicialização do player
function initPlayer() {
  audioPlayer = document.getElementById('audioPlayer');
  
  // Atualizar relógio a cada segundo
  updateClock();
  setInterval(updateClock, 1000);
  
  // Carregar programação da hora atual
  loadCurrentProgram();
  
  // Verificar mudança de hora a cada minuto
  setInterval(checkHourChange, 60000);
  
  // Configurar evento de fim de áudio
  audioPlayer.addEventListener('ended', onAudioEnded);
  
  // Configurar botões
  document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
  document.getElementById('volumeControl').addEventListener('input', changeVolume);
  document.getElementById('syncBtn').addEventListener('click', syncNow);
  
  // Inicializar Supabase Realtime
  initRealtimeSync();
  
  console.log('Player inicializado com sucesso!');
}

// Atualizar relógio
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const clockElement = document.getElementById('currentTime');
  if (clockElement) {
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
  
  // Atualizar contador regressivo
  updateCountdown(now);
}

// Atualizar contador regressivo
function updateCountdown(now) {
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  const remainingMinutes = 59 - minutes;
  const remainingSeconds = 59 - seconds;
  
  const countdownElement = document.getElementById('countdown');
  if (countdownElement) {
    countdownElement.textContent = `Próxima hora em: ${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
}

// Carregar programa da hora atual
async function loadCurrentProgram() {
  const now = new Date();
  const hora = now.getHours();
  
  if (hora === currentHour) {
    return; // Já estamos tocando o programa correto
  }
  
  currentHour = hora;
  
  // Atualizar indicador de hora
  const hourIndicator = document.getElementById('currentHour');
  if (hourIndicator) {
    hourIndicator.textContent = `${String(hora).padStart(2, '0')}:00`;
  }
  
  // Buscar programação
  const programa = await getProgramacaoPorHora(hora);
  
  if (programa && programa.url_audio) {
    console.log('Carregando programa da hora:', hora, programa);
    loadAudio(programa.url_audio);
    updateProgramInfo(programa);
    showLiveIndicator(true);
  } else {
    console.log('Nenhum programa disponível para a hora:', hora);
    showFallbackMessage();
    showLiveIndicator(false);
  }
}

// Carregar áudio
function loadAudio(url) {
  if (audioPlayer.src !== url) {
    audioPlayer.src = url;
    audioPlayer.load();
    
    // Reproduzir automaticamente
    audioPlayer.play().catch(error => {
      console.error('Erro ao reproduzir áudio:', error);
      showMessage('Clique no botão Play para iniciar a reprodução', 'info');
    });
  }
}

// Atualizar informações do programa
function updateProgramInfo(programa) {
  const statusElement = document.getElementById('programStatus');
  if (statusElement) {
    statusElement.textContent = 'Tocando agora';
    statusElement.className = 'status-live';
  }
  
  const messageElement = document.getElementById('statusMessage');
  if (messageElement) {
    messageElement.textContent = '';
  }
}

// Mostrar mensagem de fallback
function showFallbackMessage() {
  const statusElement = document.getElementById('programStatus');
  if (statusElement) {
    statusElement.textContent = 'Fora do ar';
    statusElement.className = 'status-offline';
  }
  
  const messageElement = document.getElementById('statusMessage');
  if (messageElement) {
    messageElement.textContent = 'Programação temporariamente indisponível para esta hora';
  }
  
  // Pausar player
  audioPlayer.pause();
  audioPlayer.src = '';
}

// Mostrar/ocultar indicador ao vivo
function showLiveIndicator(show) {
  const indicator = document.getElementById('liveIndicator');
  if (indicator) {
    indicator.style.display = show ? 'flex' : 'none';
  }
}

// Verificar mudança de hora
function checkHourChange() {
  const now = new Date();
  const hora = now.getHours();
  
  if (hora !== currentHour) {
    console.log('Mudança de hora detectada:', currentHour, '->', hora);
    loadCurrentProgram();
  }
}

// Quando o áudio termina
function onAudioEnded() {
  console.log('Áudio finalizado, repetindo...');
  audioPlayer.play();
}

// Toggle play/pause
function togglePlayPause() {
  const btn = document.getElementById('playPauseBtn');
  
  if (audioPlayer.paused) {
    audioPlayer.play();
    btn.textContent = '⏸️ Pausar';
  } else {
    audioPlayer.pause();
    btn.textContent = '▶️ Reproduzir';
  }
}

// Alterar volume
function changeVolume(event) {
  audioPlayer.volume = event.target.value / 100;
  document.getElementById('volumeValue').textContent = event.target.value + '%';
}

// Sincronizar agora
function syncNow() {
  console.log('Sincronização manual solicitada');
  currentHour = -1; // Forçar recarga
  loadCurrentProgram();
  showMessage('Sincronizado com sucesso!', 'success');
}

// Inicializar sincronização em tempo real
function initRealtimeSync() {
  realtimeSubscription = subscribeToChanges((payload) => {
    console.log('Mudança em tempo real:', payload);
    
    // Se a mudança afeta a hora atual, recarregar
    const now = new Date();
    const hora = now.getHours();
    
    if (payload.new && payload.new.hour === hora) {
      console.log('Atualização para a hora atual detectada!');
      currentHour = -1; // Forçar recarga
      loadCurrentProgram();
      showMessage('Programação atualizada!', 'info');
    }
  });
}

// Mostrar mensagem temporária
function showMessage(text, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `toast toast-${type}`;
  messageDiv.textContent = text;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    messageDiv.classList.remove('show');
    setTimeout(() => messageDiv.remove(), 300);
  }, 3000);
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlayer);
} else {
  initPlayer();
}
