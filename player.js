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
        
        // Carregar playlist de fundo (com embaralhamento se necessário)
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
        
        // Verificar novo dia (a cada minuto)
        setInterval(checkAndShuffleIfNewDay, 60000);
        
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
    original_order INTEGER DEFAULT 0,
    daily_order INTEGER DEFAULT 0,
    last_shuffle_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advertisements (
    id SERIAL PRIMARY KEY,
    audio_url TEXT NOT NULL,
    title TEXT NOT NULL,
    advertiser TEXT,
    frequency INTEGER DEFAULT 3,
    play_order INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_radio_schedule_hour ON radio_schedule(hour);
CREATE INDEX IF NOT EXISTS idx_radio_schedule_enabled ON radio_schedule(enabled);
CREATE INDEX IF NOT EXISTS idx_background_playlist_daily_order ON background_playlist(daily_order);
CREATE INDEX IF NOT EXISTS idx_advertisements_order ON advertisements(play_order);
            `);
        }
    } catch (error) {
        console.error('Erro ao verificar tabela:', error);
    }
}

// ==========================================
// 🎲 PROGRAMAÇÃO DINÂMICA DIÁRIA - NOVO!
// ==========================================

async function checkAndShuffleIfNewDay() {
    try {
        // Buscar data do último embaralhamento
        const { data, error } = await supabase
            .from('background_playlist')
            .select('last_shuffle_date')
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao verificar data:', error);
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const lastShuffleDate = data?.last_shuffle_date;
        
        // Se é um novo dia, embaralhar
        if (!lastShuffleDate || lastShuffleDate !== today) {
            console.log('🎲 Novo dia detectado! Embaralhando playlist...');
            await shufflePlaylistForToday();
            // Recarregar playlist após embaralhar
            await loadBackgroundPlaylist();
        } else {
            console.log('✅ Playlist do dia já configurada para:', today);
        }
    } catch (error) {
        console.error('Erro ao verificar dia:', error);
    }
}

async function shufflePlaylistForToday() {
    try {
        // Buscar todas as músicas ativas
        const { data: allTracks, error: fetchError } = await supabase
            .from('background_playlist')
            .select('id, original_order')
            .eq('enabled', true)
            .order('original_order', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        if (!allTracks || allTracks.length === 0) {
            console.log('Nenhuma música para embaralhar');
            return;
        }
        
        // Criar array de índices e embaralhar (Fisher-Yates shuffle)
        const shuffledIndices = [...Array(allTracks.length).keys()];
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        
        // Atualizar cada música com nova ordem
        const today = new Date().toISOString().split('T')[0];
        
        for (let i = 0; i < allTracks.length; i++) {
            const track = allTracks[i];
            const newOrder = shuffledIndices[i];
            
            const { error: updateError } = await supabase
                .from('background_playlist')
                .update({
                    daily_order: newOrder,
                    last_shuffle_date: today
                })
                .eq('id', track.id);
            
            if (updateError) {
                console.error('Erro ao atualizar ordem:', updateError);
            }
        }
        
        console.log('🎲 Playlist embaralhada com sucesso!');
        console.log(`📅 Nova programação para: ${today}`);
        
    } catch (error) {
        console.error('Erro ao embaralhar playlist:', error);
    }
}

// ==========================================
// FIM - PROGRAMAÇÃO DINÂMICA DIÁRIA
// ==========================================

async function loadBackgroundPlaylist() {
    try {
        // Verificar se precisa embaralhar (novo dia)
        await checkAndShuffleIfNewDay();
        
        // IMPORTANTE: Usar daily_order ao invés de play_order
        const { data, error } = await supabase
            .from('background_playlist')
            .select('*')
            .eq('enabled', true)
            .order('daily_order', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar playlist de fundo:', error);
            backgroundPlaylist = [];
            return;
        }
        
        backgroundPlaylist = data || [];
        console.log('🎵 Playlist de fundo carregada:', backgroundPlaylist.length, 'músicas');
        console.log('🎲 Ordem do dia aplicada!');
        
        // Log da ordem do dia para debug
        if (backgroundPlaylist.length > 0) {
            console.log('📋 Ordem de reprodução hoje:');
            backgroundPlaylist.forEach((track, index) => {
                console.log(`  ${index + 1}. ${track.title} (Original: ${track.original_order}, Dia: ${track.daily_order})`);
            });
        }
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
        console.log('📢 Propagandas carregadas:', advertisements.length, 'anúncios');
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
    // Subscription para mudanças na programação de hora certa
    supabase
        .channel('radio_schedule_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            handleRealtimeUpdate
        )
        .subscribe();
    
    // Subscription para mudanças na playlist
    supabase
        .channel('playlist_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'background_playlist' },
            () => {
                console.log('🔄 Playlist atualizada, recarregando...');
                loadBackgroundPlaylist();
            }
        )
        .subscribe();
    
    // Subscription para mudanças nas propagandas
    supabase
        .channel('ads_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'advertisements' },
            () => {
                console.log('🔄 Propagandas atualizadas, recarregando...');
                loadAdvertisements();
            }
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
        
        // 🆕 HORA CERTA em 2 momentos com ÁUDIOS DIFERENTES:
        // 1. Minutos 00, 01, 02 (hora cheia) → usa audio_url
        // 2. Minutos 30, 31, 32 (meia hora) → usa audio_url_half
        const isHourExact = currentMinute <= 2;
        const isHalfHour = currentMinute >= 30 && currentMinute <= 32;
        
        if (isHourExact && data && data.audio_url && data.audio_url.trim() !== '') {
            // HORA CHEIA (XX:00)
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:00`;
            console.log(`🎙️ Tocando Hora Certa (hora cheia): ${currentProgram.textContent}`);
            
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em Play para ouvir', 'info');
                });
            }
        } else if (isHalfHour && data && data.audio_url_half && data.audio_url_half.trim() !== '') {
            // MEIA HORA (XX:30)
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url_half;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:30`;
            console.log(`🎙️ Tocando Hora Certa (meia hora): ${currentProgram.textContent}`);
            
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em Play para ouvir', 'info');
                });
            }
        } else {
            // Fora do horário da hora certa OU sem áudio configurado
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
        
        console.log(`🎵 Tocando: ${currentTrack.title} (${currentBackgroundIndex + 1}/${backgroundPlaylist.length})`);
        
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
        
        console.log(`📢 Tocando propaganda: ${currentAd.title}`);
        
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
        await loadBackgroundPlaylist();
        await loadAdvertisements();
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
    const currentMinute = now.getMinutes();
    
    // 🆕 Verificar mudança de hora (:00) ou meia hora (:30)
    const isHourChange = currentMinute === 0;
    const isHalfHourChange = currentMinute === 30;
    
    if ((isHourChange || isHalfHourChange) && (!currentHourData || currentHourData.hour !== currentHourNum)) {
        console.log('🕐 Mudança detectada (hora cheia ou meia hora), recarregando...');
        await loadCurrentHourAudio();
        updateScheduleDisplay();
    }
}

function handleAudioEnded() {
    console.log('🎵 Áudio finalizado');
    
    // Se estava tocando hora certa, mudar para playlist de fundo
    if (isPlayingHourCerta) {
        console.log('✅ Hora certa finalizada, verificando propagandas...');
        // Após hora certa, tocar propaganda se houver
        if (advertisements.length > 0) {
            playAdvertisement();
        } else {
            playBackgroundMusic();
        }
    } else if (isPlayingAd) {
        // Se estava tocando propaganda, voltar para playlist
        console.log('✅ Propaganda finalizada, voltando para playlist');
        playBackgroundMusic();
    } else {
        // Se estava tocando música de fundo, avançar para próxima
        if (backgroundPlaylist.length > 0) {
            currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundPlaylist.length;
            console.log(`➡️ Avançando para próxima música: ${currentBackgroundIndex + 1}/${backgroundPlaylist.length}`);
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
    console.error('❌ Erro no áudio:', event);
    showMessage('Erro ao carregar áudio. Verifique a URL.', 'error');
    if (isPlaying) {
        togglePlay();
    }
}

function handleCanPlay() {
    console.log('✅ Áudio pronto para reprodução');
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
