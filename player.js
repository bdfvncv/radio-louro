// Configuração do Supabase
const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos DOM
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const syncBtn = document.getElementById('syncBtn');
const currentTime = document.getElementById('currentTime');
const countdownTimer = document.getElementById('countdownTimer');
const currentProgram = document.getElementById('currentProgram');
const statusMessage = document.getElementById('statusMessage');
const previousProgram = document.getElementById('previousProgram');
const currentHour = document.getElementById('currentHour');
const nextProgram = document.getElementById('nextProgram');

// Estado do player
let isPlaying = false;
let allSchedules = [];
let backgroundPlaylist = [];
let advertisements = [];
let dailyPlaylist = [];
let programSchedule = [];
let currentProgramIndex = 0;
let adFrequency = 3;
let tracksUntilNextAd = 3;

// Duração média estimada (em segundos)
const AVERAGE_TRACK_DURATION = 210; // 3min30s
const AVERAGE_AD_DURATION = 30; // 30s
const HOUR_CERTA_DURATION = 120; // 2min

// Inicializar
init();

async function init() {
    try {
        await loadAllData();
        setupEventListeners();
        setupRealtimeSubscription();
        
        updateClock();
        setInterval(updateClock, 1000);
        
        // Calcular programação e posição atual
        await calculateDailySchedule();
        await syncToLivePosition();
        
        showMessage('Rádio sincronizada! Você está ao vivo.', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar. Verifique o console.', 'error');
    }
}

async function loadAllData() {
    await Promise.all([
        loadSchedule(),
        loadBackgroundPlaylist(),
        loadAdvertisements()
    ]);
}

async function loadSchedule() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .eq('enabled', true)
            .order('hour', { ascending: true });
        
        if (error) throw error;
        allSchedules = data || [];
        updateScheduleDisplay();
    } catch (error) {
        console.error('Erro ao carregar programação:', error);
        allSchedules = [];
    }
}

async function loadBackgroundPlaylist() {
    try {
        const { data, error } = await supabase
            .from('background_playlist')
            .select('*')
            .eq('enabled', true)
            .order('play_order', { ascending: true });
        
        if (error) throw error;
        backgroundPlaylist = data || [];
    } catch (error) {
        console.error('Erro ao carregar playlist:', error);
        backgroundPlaylist = [];
    }
}

async function loadAdvertisements() {
    try {
        const { data, error } = await supabase
            .from('advertisements')
            .select('*')
            .eq('enabled', true)
            .order('play_order', { ascending: true });
        
        if (error) throw error;
        advertisements = data || [];
        if (advertisements.length > 0) {
            adFrequency = advertisements[0].frequency || 3;
        }
    } catch (error) {
        console.error('Erro ao carregar propagandas:', error);
        advertisements = [];
    }
}

function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    volumeSlider.addEventListener('input', updateVolume);
    syncBtn.addEventListener('click', forceSync);
    audioPlayer.addEventListener('ended', handleAudioEnded);
    audioPlayer.addEventListener('error', handleAudioError);
}

function setupRealtimeSubscription() {
    supabase
        .channel('radio_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            handleRealtimeUpdate
        )
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'background_playlist' },
            handleRealtimeUpdate
        )
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'advertisements' },
            handleRealtimeUpdate
        )
        .subscribe();
}

async function handleRealtimeUpdate() {
    console.log('Atualização detectada, recalculando programação...');
    await loadAllData();
    await calculateDailySchedule();
    if (!isPlaying) {
        await syncToLivePosition();
    }
}

// ============================================
// SISTEMA DE TRANSMISSÃO AO VIVO CONTÍNUA
// ============================================

async function calculateDailySchedule() {
    programSchedule = [];
    
    // Gerar shuffle diário baseado na data
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    dailyPlaylist = shuffleWithSeed(backgroundPlaylist, dayKey);
    
    // Construir programação completa do dia (24h)
    for (let hour = 0; hour < 24; hour++) {
        // Verificar se há hora certa configurada
        const horaCerta = allSchedules.find(s => s.hour === hour);
        
        if (horaCerta && horaCerta.audio_url) {
            programSchedule.push({
                type: 'hora_certa',
                hour: hour,
                url: horaCerta.audio_url,
                title: `Hora Certa ${String(hour).padStart(2, '0')}:00`,
                duration: HOUR_CERTA_DURATION
            });
            
            // Propaganda após hora certa
            if (advertisements.length > 0) {
                const ad = advertisements[Math.floor(Math.random() * advertisements.length)];
                programSchedule.push({
                    type: 'propaganda',
                    url: ad.audio_url,
                    title: ad.title,
                    advertiser: ad.advertiser,
                    duration: AVERAGE_AD_DURATION
                });
            }
        }
        
        // Preencher o resto da hora com músicas e propagandas
        const minutesLeft = 60 - (horaCerta ? 3 : 0); // 3 min usados pela hora certa + propaganda
        let minutesUsed = 0;
        let tracksCount = 0;
        
        while (minutesUsed < minutesLeft && dailyPlaylist.length > 0) {
            const trackIndex = (currentProgramIndex + tracksCount) % dailyPlaylist.length;
            const track = dailyPlaylist[trackIndex];
            
            programSchedule.push({
                type: 'musica',
                url: track.audio_url,
                title: track.title,
                duration: AVERAGE_TRACK_DURATION
            });
            
            minutesUsed += AVERAGE_TRACK_DURATION / 60;
            tracksCount++;
            
            // Propaganda a cada X músicas
            if (tracksCount % adFrequency === 0 && advertisements.length > 0) {
                const ad = advertisements[Math.floor(Math.random() * advertisements.length)];
                programSchedule.push({
                    type: 'propaganda',
                    url: ad.audio_url,
                    title: ad.title,
                    advertiser: ad.advertiser,
                    duration: AVERAGE_AD_DURATION
                });
                minutesUsed += AVERAGE_AD_DURATION / 60;
            }
        }
    }
    
    console.log('Programação diária calculada:', programSchedule.length, 'itens');
}

async function syncToLivePosition() {
    if (programSchedule.length === 0) {
        showMessage('Nenhuma programação disponível', 'info');
        return;
    }
    
    const now = new Date();
    const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    
    // Calcular qual programa deve estar tocando agora
    let accumulatedTime = 0;
    let targetIndex = 0;
    let offsetInTrack = 0;
    
    for (let i = 0; i < programSchedule.length; i++) {
        const program = programSchedule[i];
        
        if (accumulatedTime + program.duration > secondsSinceMidnight) {
            targetIndex = i;
            offsetInTrack = secondsSinceMidnight - accumulatedTime;
            break;
        }
        
        accumulatedTime += program.duration;
    }
    
    // Se passou de todas as programações, volta para o início
    if (accumulatedTime < secondsSinceMidnight) {
        targetIndex = 0;
        offsetInTrack = (secondsSinceMidnight - accumulatedTime) % (programSchedule[0]?.duration || AVERAGE_TRACK_DURATION);
    }
    
    currentProgramIndex = targetIndex;
    await playProgramAtIndex(targetIndex, offsetInTrack);
}

async function playProgramAtIndex(index, offset = 0) {
    if (index >= programSchedule.length || index < 0) {
        index = 0;
    }
    
    const program = programSchedule[index];
    
    if (!program || !program.url) {
        console.warn('Programa inválido no índice:', index);
        currentProgramIndex = (index + 1) % programSchedule.length;
        await playProgramAtIndex(currentProgramIndex);
        return;
    }
    
    // Atualizar display
    if (program.type === 'hora_certa') {
        currentProgram.textContent = `🎙️ ${program.title}`;
    } else if (program.type === 'propaganda') {
        const advertiser = program.advertiser ? ` - ${program.advertiser}` : '';
        currentProgram.textContent = `📢 ${program.title}${advertiser}`;
    } else {
        currentProgram.textContent = `🎵 ${program.title || 'Música Ambiente'}`;
    }
    
    // Carregar áudio
    audioPlayer.src = program.url;
    
    // Se deve começar do meio (sincronização)
    if (offset > 0 && offset < program.duration) {
        audioPlayer.addEventListener('loadedmetadata', function seekToPosition() {
            if (audioPlayer.duration > offset) {
                audioPlayer.currentTime = offset;
            }
            audioPlayer.removeEventListener('loadedmetadata', seekToPosition);
        });
    }
    
    // Auto-play se estava tocando
    if (isPlaying) {
        try {
            await audioPlayer.play();
        } catch (error) {
            console.error('Erro ao reproduzir:', error);
            isPlaying = false;
            updatePlayButton();
        }
    }
}

function handleAudioEnded() {
    // Avançar para próximo programa
    currentProgramIndex = (currentProgramIndex + 1) % programSchedule.length;
    playProgramAtIndex(currentProgramIndex);
}

function togglePlay() {
    if (!audioPlayer.src) {
        syncToLivePosition();
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
    } else {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
            })
            .catch(error => {
                console.error('Erro ao reproduzir:', error);
                showMessage('Erro ao reproduzir áudio', 'error');
            });
    }
    
    updatePlayButton();
}

function updatePlayButton() {
    if (isPlaying) {
        playBtn.innerHTML = '<span class="icon">⏸️</span><span class="text">Pause</span>';
        playBtn.classList.add('playing');
    } else {
        playBtn.innerHTML = '<span class="icon">▶️</span><span class="text">Play</span>';
        playBtn.classList.remove('playing');
    }
}

function updateVolume() {
    const volume = volumeSlider.value / 100;
    audioPlayer.volume = volume;
    volumeValue.textContent = `${volumeSlider.value}%`;
}

async function forceSync() {
    showMessage('Sincronizando com transmissão ao vivo...', 'info');
    syncBtn.disabled = true;
    
    try {
        await loadAllData();
        await calculateDailySchedule();
        await syncToLivePosition();
        showMessage('Sincronizado! Você está ao vivo.', 'success');
    } catch (error) {
        showMessage('Erro na sincronização', 'error');
    } finally {
        setTimeout(() => {
            syncBtn.disabled = false;
        }, 2000);
    }
}

function updateScheduleDisplay() {
    const now = new Date();
    const currentHourNum = now.getHours();
    const prevHourNum = (currentHourNum - 1 + 24) % 24;
    const nextHourNum = (currentHourNum + 1) % 24;
    
    const prevData = allSchedules.find(s => s.hour === prevHourNum);
    const currData = allSchedules.find(s => s.hour === currentHourNum);
    const nextData = allSchedules.find(s => s.hour === nextHourNum);
    
    previousProgram.textContent = prevData 
        ? `${String(prevHourNum).padStart(2, '0')}:00 - ${prevData.enabled ? 'Programado' : 'Sem programação'}`
        : `${String(prevHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    currentHour.textContent = currData 
        ? `${String(currentHourNum).padStart(2, '0')}:00 - No Ar`
        : `${String(currentHourNum).padStart(2, '0')}:00 - Playlist`;
    
    nextProgram.textContent = nextData 
        ? `${String(nextHourNum).padStart(2, '0')}:00 - Próximo`
        : `${String(nextHourNum).padStart(2, '0')}:00 - Playlist`;
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    currentTime.textContent = `${hours}:${minutes}:${seconds}`;
    
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const diff = nextHour - now;
    
    const minutesLeft = Math.floor(diff / 60000);
    const secondsLeft = Math.floor((diff % 60000) / 1000);
    
    countdownTimer.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
}

function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    showMessage('Erro ao carregar áudio. Tentando próximo...', 'error');
    
    // Tentar próximo programa
    currentProgramIndex = (currentProgramIndex + 1) % programSchedule.length;
    playProgramAtIndex(currentProgramIndex);
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 5000);
}

// Função para shuffle com seed (gera mesma ordem para mesmo dia)
function shuffleWithSeed(array, seed) {
    const shuffled = [...array];
    let hash = 0;
    
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    
    const random = (function() {
        let x = Math.sin(hash++) * 10000;
        return function() {
            x = Math.sin(x) * 10000;
            return x - Math.floor(x);
        };
    })();
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

// Configurar volume inicial
audioPlayer.volume = 0.7;

// Recalcular programação à meia-noite
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        console.log('Meia-noite! Recalculando programação diária...');
        calculateDailySchedule();
        syncToLivePosition();
    }
}, 60000); // Verifica a cada minuto
