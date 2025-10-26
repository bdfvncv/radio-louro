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
let currentHourData = null;
let allSchedules = [];
let backgroundPlaylist = [];
let advertisements = [];
let dailyShuffledPlaylist = [];
let currentBackgroundIndex = 0;
let currentAdIndex = 0;
let tracksPlayedSinceLastAd = 0;
let isPlayingHourCerta = false;
let isPlayingAd = false;
let streamStartTime = null;
let currentTrackStartTime = null;
let currentTrackDuration = 0;

// Inicializar
init();

async function init() {
    try {
        await ensureTableExists();
        await loadSchedule();
        await loadBackgroundPlaylist();
        await loadAdvertisements();
        
        setupEventListeners();
        setupRealtimeSubscription();
        
        updateClock();
        setInterval(updateClock, 1000);
        setInterval(checkHourChange, 30000);
        
        // Calcular programação do dia
        calculateDailyStream();
        
        showMessage('Rádio ao vivo carregada! Clique em Play para ouvir.', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar o sistema. Verifique o console.', 'error');
    }
}

async function ensureTableExists() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('hour')
            .limit(1);
        
        if (error && error.code === '42P01') {
            console.warn('Tabela radio_schedule não existe. Execute o SQL de criação no Supabase.');
            showMessage('Configure a tabela no Supabase primeiro. Veja o console.', 'info');
        }
    } catch (error) {
        console.error('Erro ao verificar tabela:', error);
    }
}

async function loadAdvertisements() {
    try {
        const { data, error } = await supabase
            .from('advertisements')
            .select('*')
            .eq('enabled', true)
            .order('play_order', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar propagandas:', error);
            advertisements = [];
            return;
        }
        
        advertisements = data || [];
        console.log('Propagandas carregadas:', advertisements.length, 'anúncios');
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
    audioPlayer.addEventListener('loadedmetadata', handleMetadataLoaded);
}

function setupRealtimeSubscription() {
    supabase
        .channel('radio_schedule_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            handleRealtimeUpdate
        )
        .subscribe();
}

async function handleRealtimeUpdate(payload) {
    console.log('Atualização em tempo real:', payload);
    await loadSchedule();
    await loadBackgroundPlaylist();
    await loadAdvertisements();
    calculateDailyStream();
}

async function loadSchedule() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
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
        
        if (error) {
            console.error('Erro ao carregar playlist de fundo:', error);
            backgroundPlaylist = [];
            return;
        }
        
        backgroundPlaylist = data || [];
        console.log('Playlist de fundo carregada:', backgroundPlaylist.length, 'músicas');
    } catch (error) {
        console.error('Erro ao carregar playlist:', error);
        backgroundPlaylist = [];
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
    
    previousProgram.textContent = prevData && prevData.enabled 
        ? `${String(prevHourNum).padStart(2, '0')}:00 - Programado`
        : `${String(prevHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    currentHour.textContent = currData && currData.enabled 
        ? `${String(currentHourNum).padStart(2, '0')}:00 - No Ar`
        : `${String(currentHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    nextProgram.textContent = nextData && nextData.enabled 
        ? `${String(nextHourNum).padStart(2, '0')}:00 - Próximo`
        : `${String(nextHourNum).padStart(2, '0')}:00 - Sem programação`;
}

// ============================================
// SISTEMA DE TRANSMISSÃO CONTÍNUA AO VIVO
// ============================================

function calculateDailyStream() {
    if (backgroundPlaylist.length === 0) {
        console.log('Playlist vazia, não é possível calcular stream');
        return;
    }
    
    // Embaralhar playlist baseado na data (muda todo dia)
    const today = new Date().toDateString();
    const seed = hashCode(today);
    dailyShuffledPlaylist = shuffleWithSeed([...backgroundPlaylist], seed);
    
    console.log('Playlist do dia embaralhada:', dailyShuffledPlaylist.length, 'músicas');
    
    // Inicializar o stream
    streamStartTime = new Date();
    streamStartTime.setHours(0, 0, 0, 0); // Começa à meia-noite
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function shuffleWithSeed(array, seed) {
    const shuffled = [...array];
    let currentIndex = shuffled.length;
    let temporaryValue, randomIndex;
    
    // Usar seed para gerar números "aleatórios" consistentes
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    
    while (currentIndex !== 0) {
        randomIndex = Math.floor(random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = shuffled[currentIndex];
        shuffled[currentIndex] = shuffled[randomIndex];
        shuffled[randomIndex] = temporaryValue;
    }
    
    return shuffled;
}

function getCurrentStreamPosition() {
    const now = new Date();
    const currentHourNum = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    // Se está nos primeiros 3 minutos da hora, deve estar tocando hora certa
    if (currentMinute < 3) {
        const hourData = allSchedules.find(s => s.hour === currentHourNum && s.enabled);
        if (hourData) {
            return {
                type: 'hora_certa',
                data: hourData,
                position: (currentMinute * 60) + currentSecond
            };
        }
    }
    
    // Calcular quantos segundos se passaram desde meia-noite
    const secondsSinceMidnight = (currentHourNum * 3600) + (currentMinute * 60) + currentSecond;
    
    // Subtrair tempo das horas certas (3 min cada = 180 seg por hora)
    const horasCertasTime = currentHourNum * 180;
    const musicTime = secondsSinceMidnight - horasCertasTime;
    
    // Calcular duração média das músicas (assumindo 210 segundos = 3.5 min)
    const avgTrackDuration = 210;
    const tracksPlayed = Math.floor(musicTime / avgTrackDuration);
    
    // Determinar se deve tocar propaganda ou música
    const adFrequency = advertisements.length > 0 && advertisements[0].frequency ? advertisements[0].frequency : 3;
    const tracksSinceLastAd = tracksPlayed % (adFrequency + 1);
    
    if (tracksSinceLastAd === adFrequency && advertisements.length > 0) {
        // Deve estar tocando propaganda
        const adIndex = Math.floor(tracksPlayed / (adFrequency + 1)) % advertisements.length;
        const positionInTrack = musicTime % avgTrackDuration;
        
        return {
            type: 'advertisement',
            data: advertisements[adIndex],
            index: adIndex,
            position: positionInTrack
        };
    } else {
        // Deve estar tocando música
        const musicIndex = tracksPlayed % dailyShuffledPlaylist.length;
        const positionInTrack = musicTime % avgTrackDuration;
        
        return {
            type: 'music',
            data: dailyShuffledPlaylist[musicIndex],
            index: musicIndex,
            position: positionInTrack
        };
    }
}

function togglePlay() {
    if (dailyShuffledPlaylist.length === 0) {
        showMessage('Nenhuma música disponível na playlist', 'error');
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        playBtn.innerHTML = '<span class="icon">▶️</span><span class="text">Play</span>';
        playBtn.classList.remove('playing');
    } else {
        // Ao dar play, entra na transmissão ao vivo atual
        syncToLiveStream();
        isPlaying = true;
        playBtn.innerHTML = '<span class="icon">⏸️</span><span class="text">Pause</span>';
        playBtn.classList.add('playing');
    }
}

function syncToLiveStream() {
    const streamPos = getCurrentStreamPosition();
    
    if (!streamPos || !streamPos.data) {
        showMessage('Erro ao sincronizar com a transmissão', 'error');
        return;
    }
    
    console.log('Sincronizando com transmissão ao vivo:', streamPos);
    
    isPlayingHourCerta = streamPos.type === 'hora_certa';
    isPlayingAd = streamPos.type === 'advertisement';
    
    if (streamPos.type === 'hora_certa') {
        currentProgram.textContent = `🎙️ Hora Certa - ${String(new Date().getHours()).padStart(2, '0')}:00`;
    } else if (streamPos.type === 'advertisement') {
        currentProgram.textContent = `📢 ${streamPos.data.title}`;
        currentAdIndex = streamPos.index;
    } else {
        currentProgram.textContent = `🎵 ${streamPos.data.title || 'Música ' + (streamPos.index + 1)}`;
        currentBackgroundIndex = streamPos.index;
    }
    
    audioPlayer.src = streamPos.data.audio_url;
    
    // Quando os metadados carregarem, vai pular para a posição correta
    audioPlayer.addEventListener('loadedmetadata', function seekToPosition() {
        if (streamPos.position && streamPos.position < audioPlayer.duration) {
            audioPlayer.currentTime = streamPos.position;
        }
        audioPlayer.play().catch(err => {
            console.error('Erro ao reproduzir:', err);
            showMessage('Clique em Play novamente para ouvir', 'info');
        });
        // Remove o listener para não afetar próximas músicas
        audioPlayer.removeEventListener('loadedmetadata', seekToPosition);
    }, { once: true });
}

function handleMetadataLoaded() {
    currentTrackDuration = audioPlayer.duration;
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
        await loadSchedule();
        await loadBackgroundPlaylist();
        await loadAdvertisements();
        calculateDailyStream();
        
        if (isPlaying) {
            syncToLiveStream();
        }
        
        showMessage('Sincronização concluída!', 'success');
    } catch (error) {
        showMessage('Erro na sincronização', 'error');
    } finally {
        setTimeout(() => {
            syncBtn.disabled = false;
        }, 2000);
    }
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

async function checkHourChange() {
    const now = new Date();
    const currentHourNum = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentMinute === 0 && (!currentHourData || currentHourData.hour !== currentHourNum)) {
        console.log('Mudança de hora detectada');
        updateScheduleDisplay();
        
        // Se está tocando, sincronizar com a hora certa
        if (isPlaying) {
            syncToLiveStream();
        }
    }
    
    // Verificar mudança de dia para embaralhar playlist
    const today = new Date().toDateString();
    const lastShuffleDate = localStorage.getItem('lastShuffleDate');
    
    if (lastShuffleDate !== today) {
        console.log('Novo dia detectado, embaralhando playlist');
        localStorage.setItem('lastShuffleDate', today);
        calculateDailyStream();
        
        if (isPlaying) {
            syncToLiveStream();
        }
    }
}

function handleAudioEnded() {
    console.log('Áudio finalizado, avançando para próximo');
    
    // Sempre sincroniza com a transmissão ao vivo ao terminar uma faixa
    if (isPlaying) {
        syncToLiveStream();
    }
}

function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    showMessage('Erro ao carregar áudio. Tentando próximo...', 'error');
    
    if (isPlaying) {
        // Tenta sincronizar novamente
        setTimeout(() => syncToLiveStream(), 2000);
    }
}

function handleNoAudio() {
    audioPlayer.src = '';
    currentProgram.textContent = 'Programação temporariamente indisponível';
    showMessage('Nenhum áudio disponível', 'info');
    if (isPlaying) {
        togglePlay();
    }
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 5000);
}

// Configurar volume inicial
audioPlayer.volume = 0.7;

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
let currentHourData = null;
let allSchedules = [];
let backgroundPlaylist = [];
let advertisements = [];
let currentBackgroundIndex = 0;
let currentAdIndex = 0;
let tracksPlayedSinceLastAd = 0;
let isPlayingHourCerta = false;
let isPlayingAd = false;

// Inicializar
init();

async function init() {
    try {
        // Verificar se a tabela existe, se não, criar
        await ensureTableExists();
        
        // Carregar programação
        await loadSchedule();
        
        // Carregar playlist de fundo
        await loadBackgroundPlaylist();
        
        // Carregar propagandas
        await loadAdvertisements();
        
        // Configurar listeners
        setupEventListeners();
        
        // Configurar tempo real
        setupRealtimeSubscription();
        
        // Atualizar relógio
        updateClock();
        setInterval(updateClock, 1000);
        
        // Verificar mudança de hora
        setInterval(checkHourChange, 30000); // A cada 30 segundos
        
        // Carregar áudio da hora atual
        await loadCurrentHourAudio();
        
        showMessage('Sistema carregado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar o sistema. Verifique o console.', 'error');
    }
}

async function ensureTableExists() {
    try {
        // Tentar fazer uma query simples para verificar se a tabela existe
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('hour')
            .limit(1);
        
        if (error && error.code === '42P01') {
            // Tabela não existe, mostrar mensagem para criar
            console.warn('Tabela radio_schedule não existe. Execute o SQL de criação no Supabase.');
            showMessage('Configure a tabela no Supabase primeiro. Veja o console.', 'info');
            console.log(`
-- Execute este SQL no Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS radio_schedule (
    id SERIAL PRIMARY KEY,
    hour INTEGER NOT NULL UNIQUE CHECK (hour >= 0 AND hour <= 23),
    audio_url TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_playlist (
    id SERIAL PRIMARY KEY,
    audio_url TEXT NOT NULL,
    title TEXT,
    enabled BOOLEAN DEFAULT true,
    play_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_radio_schedule_hour ON radio_schedule(hour);
CREATE INDEX IF NOT EXISTS idx_radio_schedule_enabled ON radio_schedule(enabled);
CREATE INDEX IF NOT EXISTS idx_background_playlist_order ON background_playlist(play_order);
            `);
        }
    } catch (error) {
        console.error('Erro ao verificar tabela:', error);
    }
}

async function loadBackgroundPlaylist() {
    try {
        const { data, error } = await supabase
            .from('background_playlist')
            .select('*')
            .eq('enabled', true)
            .order('play_order', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar playlist de fundo:', error);
            backgroundPlaylist = [];
            return;
        }
        
        backgroundPlaylist = data || [];
        console.log('Playlist de fundo carregada:', backgroundPlaylist.length, 'músicas');
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
        
        if (error) {
            console.error('Erro ao carregar propagandas:', error);
            advertisements = [];
            return;
        }
        
        advertisements = data || [];
        console.log('Propagandas carregadas:', advertisements.length, 'anúncios');
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
    audioPlayer.addEventListener('canplay', handleCanPlay);
}

function setupRealtimeSubscription() {
    supabase
        .channel('radio_schedule_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            handleRealtimeUpdate
        )
        .subscribe();
}

async function handleRealtimeUpdate(payload) {
    console.log('Atualização em tempo real:', payload);
    
    // Recarregar programação
    await loadSchedule();
    
    // Se a atualização foi na hora atual, recarregar áudio
    const currentHourNum = new Date().getHours();
    if (payload.new && payload.new.hour === currentHourNum) {
        showMessage('Programação atualizada! Recarregando...', 'info');
        await loadCurrentHourAudio();
    }
}

async function loadSchedule() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .order('hour', { ascending: true });
        
        if (error) throw error;
        
        allSchedules = data || [];
        updateScheduleDisplay();
    } catch (error) {
        console.error('Erro ao carregar programação:', error);
        allSchedules = [];
    }
}

function updateScheduleDisplay() {
    const now = new Date();
    const currentHourNum = now.getHours();
    const prevHourNum = (currentHourNum - 1 + 24) % 24;
    const nextHourNum = (currentHourNum + 1) % 24;
    
    // Buscar dados das horas
    const prevData = allSchedules.find(s => s.hour === prevHourNum);
    const currData = allSchedules.find(s => s.hour === currentHourNum);
    const nextData = allSchedules.find(s => s.hour === nextHourNum);
    
    // Atualizar display
    previousProgram.textContent = prevData && prevData.enabled 
        ? `${String(prevHourNum).padStart(2, '0')}:00 - Programado`
        : `${String(prevHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    currentHour.textContent = currData && currData.enabled 
        ? `${String(currentHourNum).padStart(2, '0')}:00 - No Ar`
        : `${String(currentHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    nextProgram.textContent = nextData && nextData.enabled 
        ? `${String(nextHourNum).padStart(2, '0')}:00 - Próximo`
        : `${String(nextHourNum).padStart(2, '0')}:00 - Sem programação`;
}

async function loadCurrentHourAudio() {
    const currentHourNum = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .eq('hour', currentHourNum)
            .eq('enabled', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // Nenhum registro encontrado - tocar playlist de fundo
                playBackgroundMusic();
                return;
            }
            throw error;
        }
        
        currentHourData = data;
        
        // Se está no minuto 00, 01 ou 02, tocar hora certa
        // Depois disso, tocar música de fundo
        if (currentMinute <= 2 && data && data.audio_url && data.audio_url.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:00`;
            
            // Auto-play se estava tocando
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em Play para ouvir', 'info');
                });
            }
        } else {
            // Fora do horário da hora certa, tocar música de fundo
            playBackgroundMusic();
        }
    } catch (error) {
        console.error('Erro ao carregar áudio:', error);
        playBackgroundMusic();
    }
}

function playBackgroundMusic() {
    isPlayingHourCerta = false;
    isPlayingAd = false;
    
    if (backgroundPlaylist.length === 0) {
        handleNoAudio();
        return;
    }
    
    // Verificar se deve tocar propaganda
    const adFrequency = advertisements.length > 0 && advertisements[currentAdIndex] 
        ? advertisements[currentAdIndex].frequency 
        : 3;
    
    if (advertisements.length > 0 && tracksPlayedSinceLastAd >= adFrequency) {
        playAdvertisement();
        return;
    }
    
    // Tocar música atual da playlist
    const currentTrack = backgroundPlaylist[currentBackgroundIndex];
    
    if (currentTrack && currentTrack.audio_url) {
        audioPlayer.src = currentTrack.audio_url;
        currentProgram.textContent = `🎵 ${currentTrack.title || 'Música ' + (currentBackgroundIndex + 1)}`;
        
        tracksPlayedSinceLastAd++;
        
        // Auto-play se estava tocando
        if (isPlaying) {
            audioPlayer.play().catch(err => {
                console.error('Erro ao reproduzir música de fundo:', err);
            });
        }
    } else {
        handleNoAudio();
    }
}

function playAdvertisement() {
    if (advertisements.length === 0) {
        playBackgroundMusic();
        return;
    }
    
    isPlayingAd = true;
    isPlayingHourCerta = false;
    tracksPlayedSinceLastAd = 0;
    
    const currentAd = advertisements[currentAdIndex];
    
    if (currentAd && currentAd.audio_url) {
        audioPlayer.src = currentAd.audio_url;
        currentProgram.textContent = `📢 ${currentAd.title}${currentAd.advertiser ? ' - ' + currentAd.advertiser : ''}`;
        
        // Auto-play se estava tocando
        if (isPlaying) {
            audioPlayer.play().catch(err => {
                console.error('Erro ao reproduzir propaganda:', err);
            });
        }
        
        // Avançar para próxima propaganda
        currentAdIndex = (currentAdIndex + 1) % advertisements.length;
    } else {
        playBackgroundMusic();
    }
}

function handleNoAudio() {
    audioPlayer.src = '';
    currentProgram.textContent = 'Programação temporariamente indisponível';
    showMessage('Nenhum áudio programado para esta hora', 'info');
    if (isPlaying) {
        togglePlay();
    }
}

function togglePlay() {
    if (!audioPlayer.src) {
        showMessage('Nenhum áudio disponível', 'error');
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        playBtn.innerHTML = '<span class="icon">▶️</span><span class="text">Play</span>';
        playBtn.classList.remove('playing');
    } else {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                playBtn.innerHTML = '<span class="icon">⏸️</span><span class="text">Pause</span>';
                playBtn.classList.add('playing');
            })
            .catch(error => {
                console.error('Erro ao reproduzir:', error);
                showMessage('Erro ao reproduzir áudio. Verifique a URL.', 'error');
            });
    }
}

function updateVolume() {
    const volume = volumeSlider.value / 100;
    audioPlayer.volume = volume;
    volumeValue.textContent = `${volumeSlider.value}%`;
}

async function forceSync() {
    showMessage('Sincronizando...', 'info');
    syncBtn.disabled = true;
    
    try {
        await loadSchedule();
        await loadCurrentHourAudio();
        showMessage('Sincronização concluída!', 'success');
    } catch (error) {
        showMessage('Erro na sincronização', 'error');
    } finally {
        setTimeout(() => {
            syncBtn.disabled = false;
        }, 2000);
    }
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    currentTime.textContent = `${hours}:${minutes}:${seconds}`;
    
    // Countdown para próxima hora
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const diff = nextHour - now;
    
    const minutesLeft = Math.floor(diff / 60000);
    const secondsLeft = Math.floor((diff % 60000) / 1000);
    
    countdownTimer.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
}

async function checkHourChange() {
    const now = new Date();
    const currentHourNum = now.getHours();
    
    // Se mudou de hora e estamos no minuto 00
    if (now.getMinutes() === 0 && (!currentHourData || currentHourData.hour !== currentHourNum)) {
        console.log('Mudança de hora detectada, recarregando...');
        await loadCurrentHourAudio();
        updateScheduleDisplay();
    }
}

function handleAudioEnded() {
    console.log('Áudio finalizado');
    
    // Se estava tocando hora certa, mudar para playlist de fundo
    if (isPlayingHourCerta) {
        console.log('Hora certa finalizada, verificando propagandas...');
        // Após hora certa, tocar propaganda se houver
        if (advertisements.length > 0) {
            playAdvertisement();
        } else {
            playBackgroundMusic();
        }
    } else if (isPlayingAd) {
        // Se estava tocando propaganda, voltar para playlist
        console.log('Propaganda finalizada, voltando para playlist');
        playBackgroundMusic();
    } else {
        // Se estava tocando música de fundo, avançar para próxima
        if (backgroundPlaylist.length > 0) {
            currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundPlaylist.length;
            console.log('Avançando para próxima música:', currentBackgroundIndex);
            playBackgroundMusic();
        } else {
            // Se não houver playlist, repetir o áudio atual
            if (audioPlayer.src) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao repetir:', err);
                });
            }
        }
    }
}

function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    showMessage('Erro ao carregar áudio. Verifique a URL.', 'error');
    if (isPlaying) {
        togglePlay();
    }
}

function handleCanPlay() {
    console.log('Áudio pronto para reprodução');
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 5000);
}

// Configurar volume inicial
audioPlayer.volume = 0.7;
