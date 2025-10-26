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

// Estado do player - TRANSMISSÃO AO VIVO
let isPlaying = false;
let currentHourData = null;
let allSchedules = [];
let backgroundPlaylist = [];
let advertisements = [];
let dailyPlaylist = []; // Playlist embaralhada do dia
let currentDailySeed = ''; // Seed do dia para embaralhar
let streamTimeline = []; // Timeline completa da transmissão
let isLiveStream = true; // Flag para modo transmissão ao vivo

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
        
        // Gerar programação diária e iniciar transmissão
        await generateDailySchedule();
        await startLiveStream();
        
        showMessage('Transmissão ao vivo carregada!', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar transmissão.', 'error');
    }
}

// Gerar seed baseado na data (muda a cada dia)
function getDailySeed() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// Embaralhar array com seed (mesmo resultado para mesmo seed)
function seededShuffle(array, seed) {
    const arr = [...array];
    let currentSeed = hashCode(seed);
    
    for (let i = arr.length - 1; i > 0; i--) {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        const j = Math.floor((currentSeed / 233280) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    
    return arr;
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

// Gerar programação diária embaralhada
async function generateDailySchedule() {
    const todaySeed = getDailySeed();
    
    // Se já gerou hoje, não gera de novo
    if (currentDailySeed === todaySeed && dailyPlaylist.length > 0) {
        console.log('Programação diária já gerada');
        return;
    }
    
    console.log('Gerando nova programação diária:', todaySeed);
    currentDailySeed = todaySeed;
    
    // Embaralhar playlist de fundo com seed do dia
    dailyPlaylist = seededShuffle(backgroundPlaylist.filter(t => t.enabled), todaySeed);
    
    // Criar timeline da transmissão (24 horas)
    await buildStreamTimeline();
    
    console.log('Programação diária gerada:', dailyPlaylist.length, 'músicas');
}

// Construir timeline completa da transmissão
async function buildStreamTimeline() {
    streamTimeline = [];
    let currentTimeOffset = 0; // Em segundos desde meia-noite
    let adRotationIndex = 0; // Para rotacionar propagandas
    
    // Para cada hora do dia
    for (let hour = 0; hour < 24; hour++) {
        const hourSchedule = allSchedules.find(s => s.hour === hour && s.enabled);
        
        // Se tem hora certa configurada
        if (hourSchedule && hourSchedule.audio_url) {
            streamTimeline.push({
                type: 'hour_certa',
                hour: hour,
                url: hourSchedule.audio_url,
                title: `Hora Certa ${String(hour).padStart(2, '0')}:00`,
                startTime: currentTimeOffset,
                duration: 180 // Estimado: 3 minutos
            });
            currentTimeOffset += 180;
            
            // Adicionar propaganda após hora certa (se houver)
            if (advertisements.length > 0) {
                const ad = advertisements[adRotationIndex % advertisements.length];
                if (ad && ad.enabled) {
                    streamTimeline.push({
                        type: 'advertisement',
                        url: ad.audio_url,
                        title: ad.title,
                        advertiser: ad.advertiser,
                        startTime: currentTimeOffset,
                        duration: 30 // Estimado: 30 segundos
                    });
                    currentTimeOffset += 30;
                    adRotationIndex++;
                }
            }
        }
        
        // Preencher resto da hora com músicas da playlist diária
        const hourEndTime = (hour + 1) * 3600; // Fim desta hora em segundos
        let trackIndex = 0;
        let tracksInThisHour = 0;
        
        while (currentTimeOffset < hourEndTime && dailyPlaylist.length > 0) {
            const track = dailyPlaylist[trackIndex % dailyPlaylist.length];
            
            if (track && track.enabled) {
                streamTimeline.push({
                    type: 'music',
                    url: track.audio_url,
                    title: track.title,
                    startTime: currentTimeOffset,
                    duration: 210 // Estimado: 3.5 minutos
                });
                currentTimeOffset += 210;
                tracksInThisHour++;
                
                // Adicionar propaganda a cada X músicas
                const adFrequency = advertisements.length > 0 && advertisements[0].frequency ? advertisements[0].frequency : 3;
                if (tracksInThisHour % adFrequency === 0 && advertisements.length > 0) {
                    const ad = advertisements[adRotationIndex % advertisements.length];
                    if (ad && ad.enabled) {
                        streamTimeline.push({
                            type: 'advertisement',
                            url: ad.audio_url,
                            title: ad.title,
                            advertiser: ad.advertiser,
                            startTime: currentTimeOffset,
                            duration: 30
                        });
                        currentTimeOffset += 30;
                        adRotationIndex++;
                    }
                }
            }
            
            trackIndex++;
            
            // Evitar loop infinito
            if (trackIndex > dailyPlaylist.length * 50) break;
        }
    }
    
    console.log('Timeline gerada:', streamTimeline.length, 'itens');
}

// Iniciar transmissão ao vivo
async function startLiveStream() {
    try {
        const currentItem = getCurrentStreamItem();
        
        if (!currentItem) {
            console.warn('Nenhum item disponível na transmissão');
            handleNoAudio();
            return;
        }
        
        // Calcular tempo desde meia-noite
        const now = new Date();
        const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        
        // Calcular posição atual dentro do item
        const itemElapsed = secondsSinceMidnight - currentItem.startTime;
        const startPosition = Math.max(0, Math.min(itemElapsed, currentItem.duration - 1));
        
        console.log('Entrando na transmissão ao vivo:', {
            item: currentItem.title,
            position: startPosition + 's',
            type: currentItem.type
        });
        
        // Carregar áudio e posicionar
        audioPlayer.src = currentItem.url;
        
        // Aguardar áudio estar pronto antes de posicionar
        audioPlayer.addEventListener('loadedmetadata', function setPosition() {
            audioPlayer.currentTime = startPosition;
            audioPlayer.removeEventListener('loadedmetadata', setPosition);
        });
        
        // Atualizar display
        updateNowPlayingDisplay(currentItem);
        
        // Se estava tocando, continuar
        if (isPlaying) {
            audioPlayer.play().catch(err => {
                console.error('Erro ao reproduzir:', err);
            });
        }
        
        // Verificar se precisa trocar de faixa
        const remaining = currentItem.duration - itemElapsed;
        if (remaining > 0) {
            setTimeout(() => {
                startLiveStream(); // Carregar próximo item
            }, remaining * 1000);
        } else {
            // Item já terminou, carregar próximo imediatamente
            setTimeout(() => startLiveStream(), 100);
        }
    } catch (error) {
        console.error('Erro ao iniciar transmissão:', error);
        setTimeout(() => startLiveStream(), 5000); // Tentar novamente em 5s
    }
}

// Obter item atual da transmissão
function getCurrentStreamItem() {
    const now = new Date();
    const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    // Encontrar item atual na timeline
    for (let i = 0; i < streamTimeline.length; i++) {
        const item = streamTimeline[i];
        const itemEnd = item.startTime + item.duration;
        
        if (secondsSinceMidnight >= item.startTime && secondsSinceMidnight < itemEnd) {
            return item;
        }
    }
    
    // Se não encontrou, retornar primeiro item (fallback)
    return streamTimeline[0] || null;
}

function updateNowPlayingDisplay(item) {
    if (!item) return;
    
    let icon = '🎵';
    let label = '';
    
    switch (item.type) {
        case 'hour_certa':
            icon = '🎙️';
            label = 'HORA CERTA';
            break;
        case 'advertisement':
            icon = '📢';
            label = item.advertiser ? `PROPAGANDA - ${item.advertiser}` : 'PROPAGANDA';
            break;
        case 'music':
            icon = '🎵';
            label = 'AO VIVO';
            break;
    }
    
    currentProgram.textContent = `${icon} ${label}: ${item.title}`;
}

async function ensureTableExists() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('hour')
            .limit(1);
        
        if (error && error.code === '42P01') {
            console.warn('Tabelas não existem. Execute o SQL de configuração no Supabase.');
            showMessage('Configure as tabelas no Supabase primeiro.', 'info');
        }
    } catch (error) {
        console.error('Erro ao verificar tabela:', error);
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
        .channel('radio_schedule_changes')
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

async function handleRealtimeUpdate(payload) {
    console.log('Atualização em tempo real:', payload);
    
    try {
        await loadSchedule();
        await loadBackgroundPlaylist();
        await loadAdvertisements();
        await generateDailySchedule();
        
        showMessage('Programação atualizada!', 'info');
    } catch (error) {
        console.error('Erro ao atualizar:', error);
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
        : `${String(prevHourNum).padStart(2, '0')}:00 - Playlist`;
    
    currentHour.textContent = currData && currData.enabled 
        ? `${String(currentHourNum).padStart(2, '0')}:00 - Hora Certa`
        : `${String(currentHourNum).padStart(2, '0')}:00 - Playlist`;
    
    nextProgram.textContent = nextData && nextData.enabled 
        ? `${String(nextHourNum).padStart(2, '0')}:00 - Próximo`
        : `${String(nextHourNum).padStart(2, '0')}:00 - Playlist`;
}

function handleNoAudio() {
    audioPlayer.src = '';
    currentProgram.textContent = 'Programação temporariamente indisponível';
    showMessage('Nenhum conteúdo disponível no momento', 'info');
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
        // Ao dar play, sincronizar com transmissão ao vivo
        startLiveStream().then(() => {
            audioPlayer.play()
                .then(() => {
                    isPlaying = true;
                    playBtn.innerHTML = '<span class="icon">⏸️</span><span class="text">Pause</span>';
                    playBtn.classList.add('playing');
                })
                .catch(error => {
                    console.error('Erro ao reproduzir:', error);
                    showMessage('Erro ao reproduzir áudio.', 'error');
                });
        });
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
        await loadSchedule();
        await loadBackgroundPlaylist();
        await loadAdvertisements();
        await generateDailySchedule();
        await startLiveStream();
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
    
    // Verificar se mudou o dia (gerar nova programação)
    const todaySeed = getDailySeed();
    if (todaySeed !== currentDailySeed) {
        console.log('Novo dia detectado! Gerando nova programação...');
        generateDailySchedule().then(() => startLiveStream());
    }
}

function handleAudioEnded() {
    console.log('Áudio finalizado, carregando próximo da transmissão...');
    startLiveStream();
}

function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    showMessage('Erro ao carregar áudio.', 'error');
    // Tentar próximo item
    setTimeout(() => startLiveStream(), 2000);
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 5000);
}

audioPlayer.volume = 0.7;

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
