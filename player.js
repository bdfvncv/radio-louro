const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const syncBtn = document.getElementById('syncBtn');
const currentTime = document.getElementById('currentTime');
const countdownTimer = document.getElementById('countdownTimer');
const statusText = document.getElementById('statusText');
const trackName = document.getElementById('trackName');

// ── Estado geral ──────────────────────────────────────────────
let isPlaying = false;
let isShuffling = false;
let lastKnownDate = null;

// ── Dados da programação atual (playlist aleatória — legado) ──
let allSchedules = [];
let backgroundPlaylist = [];
let advertisements = [];
let currentBackgroundIndex = 0;
let currentAdIndex = 0;
let tracksPlayedSinceLastAd = 0;
let isPlayingHourCerta = false;
let isPlayingAd = false;
let lastPlayedSlot = null;

// ── Dados sazonais (legado + v2) ──────────────────────────────
let seasonalPlaylist = [];
let seasonalAds = [];
let activeSeasonalCategory = null;
let isSeasonalActive = false;

// ── Grades horárias (novo) ────────────────────────────────────
let timeSlots = [];               // faixas cadastradas
let currentSlot = null;           // faixa ativa agora
let slotPlaylist = [];            // músicas da faixa ativa
let slotCurrentIndex = 0;
let slotAdsIndex = 0;
let slotTracksPlayedSinceAd = 0;
let isGradeMode = false;          // true quando há grade configurada para o horário

// ── Vinhetas (novo) ───────────────────────────────────────────
let jinglesOpening = [];
let jinglesMiddle = [];
let jinglesClosing = [];
let jingleMiddleCount = 0;        // quantas vinhetas do meio já tocaram na grade atual
let isPlayingJingle = false;
let jinglePhase = null;           // 'opening' | 'middle' | 'closing'
let lastJingleOpening = null;     // evita repetição
let lastJingleMiddle = null;
let lastJingleClosing = null;

// ── Blocos sazonais v2 (novo) ─────────────────────────────────
let seasonalBlocksToday = [];     // blocos agendados para hoje
let seasonalBlockPlaying = false; // está tocando um bloco sazonal agora
let seasonalBlockQueue = [];      // fila das 4 músicas do bloco atual
let seasonalBlockIndex = 0;

// ── Controle de troca de grade ────────────────────────────────
let slotCheckInterval = null;
let lastSlotId = null;
let gradeOpeningDone = false;     // vinheta de abertura já tocou nesta grade
let gradeMiddle1Done = false;     // primeira vinheta do meio já tocou
let gradeMiddle2Done = false;     // segunda vinheta do meio já tocou
let gradeClosingScheduled = false;
let gradeStartTime = null;        // quando a grade começou (timestamp)
let gradeDurationMs = 0;          // duração total da grade em ms

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
init();

async function init() {
    try {
        lastKnownDate = new Date().toISOString().split('T')[0];
        await loadAllData();
        setupEventListeners();
        setupRealtimeSubscription();
        updateClock();
        setInterval(updateClock, 1000);
        setInterval(checkHourChange, 30000);
        setInterval(checkSeasonalStatus, 5000);
        setInterval(checkSlotChange, 60000);
        await loadCurrentHourAudio();
        await detectAndActivateSlot();
        setTimeout(() => { checkAndShuffleIfNewDay(); }, 2000);
        setInterval(checkAndShuffleIfNewDay, 300000);
    } catch (error) {
        console.error('Erro ao inicializar:', error);
    }
}

// ─────────────────────────────────────────────────────────────
// CARREGAMENTO DE DADOS
// ─────────────────────────────────────────────────────────────
async function loadAllData() {
    try {
        const [
            scheduleData, playlistData, adsData,
            seasonalMusicData, seasonalAdsData, seasonalSettingsData,
            timeSlotsData
        ] = await Promise.all([
            supabase.from('radio_schedule').select('*').order('hour', { ascending: true }),
            supabase.from('background_playlist').select('*').eq('enabled', true).order('daily_order', { ascending: true }),
            supabase.from('advertisements').select('*').eq('enabled', true).order('play_order', { ascending: true }),
            supabase.from('seasonal_playlists').select('*').eq('type', 'music').eq('enabled', true).order('daily_order', { ascending: true }),
            supabase.from('seasonal_playlists').select('*').eq('type', 'ad').eq('enabled', true).order('play_order', { ascending: true }),
            supabase.from('seasonal_settings').select('*').eq('is_active', true).maybeSingle(),
            supabase.from('time_slots').select('*').eq('enabled', true).order('sort_order', { ascending: true })
        ]);

        allSchedules    = scheduleData.data    || [];
        backgroundPlaylist = playlistData.data || [];
        advertisements  = adsData.data         || [];
        timeSlots       = timeSlotsData.data   || [];

        if (seasonalSettingsData.data?.category) {
            activeSeasonalCategory = seasonalSettingsData.data.category;
            isSeasonalActive = true;
            seasonalPlaylist = (seasonalMusicData.data || []).filter(i => i.category === activeSeasonalCategory);
            seasonalAds      = (seasonalAdsData.data   || []).filter(i => i.category === activeSeasonalCategory);
        } else {
            isSeasonalActive = false;
            seasonalPlaylist = [];
            seasonalAds = [];
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// ─────────────────────────────────────────────────────────────
// GRADES HORÁRIAS — DETECÇÃO E ATIVAÇÃO
// ─────────────────────────────────────────────────────────────

// Retorna a faixa ativa para a hora atual, ou null se for madrugada/sem grade
function getActiveSlotForHour(hour) {
    if (timeSlots.length === 0) return null;

    // Madrugada: faixa com start_hour=20 e end_hour=7 (cruza meia-noite)
    for (const slot of timeSlots) {
        if (slot.start_hour === 20 && slot.end_hour === 7) {
            // Madrugada = não usa grade
            if (hour >= 20 || hour < 7) return null;
            continue;
        }
        if (hour >= slot.start_hour && hour < slot.end_hour) {
            return slot;
        }
    }
    return null;
}

async function detectAndActivateSlot() {
    const hour = new Date().getHours();
    const slot = getActiveSlotForHour(hour);

    if (!slot) {
        // Sem grade configurada para este horário — usa playlist legada
        isGradeMode = false;
        currentSlot = null;
        lastSlotId = null;
        return;
    }

    if (slot.id === lastSlotId) return; // mesma grade, não recarrega

    isGradeMode = true;
    currentSlot = slot;
    lastSlotId = slot.id;
    gradeOpeningDone = false;
    gradeMiddle1Done = false;
    gradeMiddle2Done = false;
    gradeClosingScheduled = false;
    jingleMiddleCount = 0;

    // Calcula horários das vinhetas do meio
    gradeStartTime = new Date();
    gradeStartTime.setMinutes(0, 0, 0);
    gradeStartTime.setHours(slot.start_hour);

    const endTime = new Date(gradeStartTime);
    endTime.setHours(slot.end_hour);
    gradeDurationMs = endTime - gradeStartTime;

    await loadSlotPlaylist(slot.id);
    await loadSlotJingles(slot.id);

    if (isSeasonalActive) {
        await ensureSeasonalBlocksToday();
    }

    if (isPlaying && !isPlayingHourCerta) {
        startGrade();
    }
}

async function loadSlotPlaylist(slotId) {
    try {
        const { data } = await supabase
            .from('slot_playlists')
            .select('*')
            .eq('slot_id', slotId)
            .eq('enabled', true)
            .order('daily_order', { ascending: true });

        slotPlaylist = data || [];
        slotCurrentIndex = 0;
        slotAdsIndex = 0;
        slotTracksPlayedSinceAd = 0;
    } catch (error) {
        console.error('Erro ao carregar playlist da grade:', error);
        slotPlaylist = [];
    }
}

async function loadSlotJingles(slotId) {
    try {
        const { data } = await supabase
            .from('jingles')
            .select('*')
            .eq('slot_id', slotId)
            .eq('enabled', true);

        jinglesOpening = (data || []).filter(j => j.position === 'opening');
        jinglesMiddle  = (data || []).filter(j => j.position === 'middle');
        jinglesClosing = (data || []).filter(j => j.position === 'closing');
    } catch (error) {
        console.error('Erro ao carregar vinhetas:', error);
        jinglesOpening = [];
        jinglesMiddle = [];
        jinglesClosing = [];
    }
}

async function loadSeasonalJingles(category) {
    try {
        const { data } = await supabase
            .from('jingles')
            .select('*')
            .eq('seasonal_category', category)
            .eq('enabled', true);

        return {
            opening: (data || []).filter(j => j.position === 'opening'),
            middle:  (data || []).filter(j => j.position === 'middle'),
            closing: (data || []).filter(j => j.position === 'closing')
        };
    } catch (error) {
        return { opening: [], middle: [], closing: [] };
    }
}

function checkSlotChange() {
    const hour = new Date().getHours();
    const slot = getActiveSlotForHour(hour);
    const newId = slot ? slot.id : null;

    if (newId !== lastSlotId) {
        detectAndActivateSlot();
    }
}

// ─────────────────────────────────────────────────────────────
// BLOCOS SAZONAIS V2 (08h–20h, 3 blocos de 4 músicas)
// ─────────────────────────────────────────────────────────────

async function ensureSeasonalBlocksToday() {
    if (!isSeasonalActive || !activeSeasonalCategory) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        const { data: existing } = await supabase
            .from('seasonal_blocks')
            .select('*')
            .eq('block_date', today)
            .eq('seasonal_category', activeSeasonalCategory);

        if (existing && existing.length === 3) {
            seasonalBlocksToday = existing;
            return;
        }

        // Gera os 3 blocos: janelas 08-12, 12-16, 16-20
        const windows = [
            { window_number: 1, start: 8,  end: 12 },
            { window_number: 2, start: 12, end: 16 },
            { window_number: 3, start: 16, end: 20 }
        ];

        const blocks = windows.map(w => ({
            block_date: today,
            seasonal_category: activeSeasonalCategory,
            window_number: w.window_number,
            scheduled_hour: Math.floor(Math.random() * (w.end - w.start)) + w.start,
            played: false
        }));

        // Usa service_role via RPC não disponível no player — apenas registra localmente
        // O admin.js vai persistir os blocos; o player usa a lógica local como fallback
        seasonalBlocksToday = blocks;
    } catch (error) {
        console.error('Erro ao verificar blocos sazonais:', error);
    }
}

function shouldPlaySeasonalBlock() {
    if (!isSeasonalActive || seasonalBlockPlaying) return false;

    const now = new Date();
    const hour = now.getHours();
    if (hour < 8 || hour >= 20) return false;

    return seasonalBlocksToday.some(b => !b.played && b.scheduled_hour === hour);
}

function getNextSeasonalBlock() {
    const hour = new Date().getHours();
    return seasonalBlocksToday.find(b => !b.played && b.scheduled_hour === hour) || null;
}

function markBlockAsPlayed(windowNumber) {
    const block = seasonalBlocksToday.find(b => b.window_number === windowNumber);
    if (block) block.played = true;
}

// ─────────────────────────────────────────────────────────────
// VINHETAS — SORTEIO SEM REPETIÇÃO
// ─────────────────────────────────────────────────────────────

function pickJingle(list, lastUsed) {
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];

    const available = list.filter(j => j.id !== lastUsed);
    return available[Math.floor(Math.random() * available.length)];
}

function playJingle(position, onEndCallback) {
    let jingle = null;

    if (position === 'opening') {
        jingle = pickJingle(jinglesOpening, lastJingleOpening);
        if (jingle) lastJingleOpening = jingle.id;
    } else if (position === 'middle') {
        jingle = pickJingle(jinglesMiddle, lastJingleMiddle);
        if (jingle) lastJingleMiddle = jingle.id;
    } else if (position === 'closing') {
        jingle = pickJingle(jinglesClosing, lastJingleClosing);
        if (jingle) lastJingleClosing = jingle.id;
    }

    if (!jingle) {
        if (onEndCallback) onEndCallback();
        return;
    }

    isPlayingJingle = true;
    jinglePhase = position;
    isPlayingHourCerta = false;
    isPlayingAd = false;

    audioPlayer.src = jingle.audio_url;
    updateDisplay('🎬 Vinheta', jingle.title);

    audioPlayer._jingleCallback = onEndCallback;

    if (isPlaying) {
        audioPlayer.play().catch(err => console.error('Erro vinheta:', err));
    }
}

// ─────────────────────────────────────────────────────────────
// INÍCIO DA GRADE — SEQUÊNCIA: abertura → propaganda → músicas
// ─────────────────────────────────────────────────────────────

function startGrade() {
    if (jinglesOpening.length > 0 && !gradeOpeningDone) {
        gradeOpeningDone = true;
        playJingle('opening', () => {
            playSlotAdvertisement(() => {
                scheduleMiddleJingles();
                playSlotMusic();
            });
        });
    } else {
        playSlotAdvertisement(() => {
            scheduleMiddleJingles();
            playSlotMusic();
        });
    }
}

// Agenda as 2 vinhetas do meio distribuídas na duração da grade
function scheduleMiddleJingles() {
    if (jinglesMiddle.length === 0) return;

    const now = Date.now();
    const gradeStart = gradeStartTime.getTime();
    const gradeEnd = gradeStart + gradeDurationMs;
    const remaining = gradeEnd - now;

    if (remaining <= 0) return;

    // Divide o tempo restante em 3 partes — vinhetas no fim do 1º e 2º terço
    const third = remaining / 3;
    const time1 = Math.floor(third * 1);
    const time2 = Math.floor(third * 2);

    setTimeout(() => {
        if (!gradeMiddle1Done && isGradeMode && isPlaying) {
            gradeMiddle1Done = true;
            playJingle('middle', () => { playSlotMusic(); });
        }
    }, time1);

    setTimeout(() => {
        if (!gradeMiddle2Done && isGradeMode && isPlaying) {
            gradeMiddle2Done = true;
            playJingle('middle', () => { playSlotMusic(); });
        }
    }, time2);
}

// ─────────────────────────────────────────────────────────────
// REPRODUÇÃO — MODO GRADE
// ─────────────────────────────────────────────────────────────

function playSlotMusic() {
    isPlayingJingle = false;
    isPlayingHourCerta = false;
    isPlayingAd = false;

    // Verifica se deve tocar bloco sazonal
    if (shouldPlaySeasonalBlock()) {
        const block = getNextSeasonalBlock();
        if (block) {
            startSeasonalBlock(block);
            return;
        }
    }

    if (slotPlaylist.length === 0) {
        // Grade sem músicas ainda — cai na playlist legada
        playBackgroundMusic();
        return;
    }

    const freq = (advertisements[slotAdsIndex % advertisements.length]?.frequency) || 3;
    if (advertisements.length > 0 && slotTracksPlayedSinceAd >= freq) {
        playSlotAdvertisement(() => { playSlotMusicTrack(); });
        return;
    }

    playSlotMusicTrack();
}

function playSlotMusicTrack() {
    const track = slotPlaylist[slotCurrentIndex % slotPlaylist.length];
    if (!track) { playBackgroundMusic(); return; }

    audioPlayer.src = track.audio_url;
    updateDisplay(currentSlot ? `🎵 ${currentSlot.name}` : 'Tocando agora', track.title || 'Música');
    slotTracksPlayedSinceAd++;

    if (isPlaying) {
        audioPlayer.play().catch(err => console.error('Erro música grade:', err));
    }
}

function playSlotAdvertisement(onEndCallback) {
    if (advertisements.length === 0) {
        if (onEndCallback) onEndCallback();
        return;
    }

    isPlayingAd = true;
    slotTracksPlayedSinceAd = 0;

    const ad = advertisements[slotAdsIndex % advertisements.length];
    slotAdsIndex++;

    if (!ad) { if (onEndCallback) onEndCallback(); return; }

    audioPlayer.src = ad.audio_url;
    updateDisplay('📢 Propaganda', ad.title);
    audioPlayer._adCallback = onEndCallback;

    if (isPlaying) {
        audioPlayer.play().catch(err => console.error('Erro propaganda:', err));
    }
}

// ─────────────────────────────────────────────────────────────
// BLOCOS SAZONAIS — REPRODUÇÃO DO BLOCO DE 4 MÚSICAS
// ─────────────────────────────────────────────────────────────

async function startSeasonalBlock(block) {
    seasonalBlockPlaying = true;
    seasonalBlockIndex = 0;

    // Monta fila com 4 músicas aleatórias da playlist sazonal
    const pool = [...seasonalPlaylist];
    seasonalBlockQueue = [];
    for (let i = 0; i < 4 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        seasonalBlockQueue.push(pool.splice(idx, 1)[0]);
    }

    if (seasonalBlockQueue.length === 0) {
        seasonalBlockPlaying = false;
        markBlockAsPlayed(block.window_number);
        playSlotMusic();
        return;
    }

    // Carrega vinhetas sazonais se existirem
    const seasonalJingles = await loadSeasonalJingles(activeSeasonalCategory);

    if (seasonalJingles.opening.length > 0) {
        const j = seasonalJingles.opening[Math.floor(Math.random() * seasonalJingles.opening.length)];
        audioPlayer.src = j.audio_url;
        updateDisplay('🎭 Especial', j.title);
        audioPlayer._seasonalBlockJingles = seasonalJingles;
        audioPlayer._seasonalBlock = block;
        if (isPlaying) audioPlayer.play().catch(e => console.error(e));
    } else {
        playSeasonalBlockTrack(block);
    }
}

function playSeasonalBlockTrack(block) {
    if (seasonalBlockIndex >= seasonalBlockQueue.length) {
        // Bloco terminou
        seasonalBlockPlaying = false;
        markBlockAsPlayed(block.window_number);
        audioPlayer._seasonalBlock = null;

        if (audioPlayer._seasonalBlockJingles?.closing?.length > 0) {
            const jingles = audioPlayer._seasonalBlockJingles;
            const j = jingles.closing[Math.floor(Math.random() * jingles.closing.length)];
            audioPlayer.src = j.audio_url;
            updateDisplay('🎭 Especial', j.title);
            audioPlayer._afterSeasonalBlock = true;
            if (isPlaying) audioPlayer.play().catch(e => console.error(e));
        } else {
            playSlotMusic();
        }
        return;
    }

    const track = seasonalBlockQueue[seasonalBlockIndex];
    seasonalBlockIndex++;

    audioPlayer.src = track.audio_url;
    updateDisplay('🎭 Especial Sazonal', track.title || 'Música Temática');
    audioPlayer._seasonalBlock = block;

    if (isPlaying) {
        audioPlayer.play().catch(err => console.error('Erro bloco sazonal:', err));
    }
}

// ─────────────────────────────────────────────────────────────
// REPRODUÇÃO — MODO LEGADO (playlist aleatória)
// ─────────────────────────────────────────────────────────────

function playBackgroundMusic() {
    isPlayingHourCerta = false;
    isPlayingAd = false;
    isPlayingJingle = false;

    const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
    const ads = isSeasonalActive ? seasonalAds : advertisements;

    if (playlist.length === 0) { handleNoAudio(); return; }

    const adFreq = (ads[currentAdIndex]?.frequency) || 3;
    if (ads.length > 0 && tracksPlayedSinceLastAd >= adFreq) {
        playAdvertisement();
        return;
    }

    const track = playlist[currentBackgroundIndex];
    if (!track?.audio_url) { handleNoAudio(); return; }

    audioPlayer.src = track.audio_url;
    updateDisplay(isSeasonalActive ? '🎭 Música Temática' : 'Tocando agora', track.title || 'Música');
    tracksPlayedSinceLastAd++;

    if (isPlaying) {
        audioPlayer.play().catch(err => console.error('Erro:', err));
    }
}

function playAdvertisement() {
    const ads = isSeasonalActive ? seasonalAds : advertisements;
    if (ads.length === 0) { playBackgroundMusic(); return; }

    isPlayingAd = true;
    tracksPlayedSinceLastAd = 0;

    const ad = ads[currentAdIndex];
    currentAdIndex = (currentAdIndex + 1) % ads.length;

    if (!ad?.audio_url) { playBackgroundMusic(); return; }

    audioPlayer.src = ad.audio_url;
    updateDisplay('📢 Propaganda', ad.title);

    if (isPlaying) {
        audioPlayer.play().catch(err => console.error('Erro:', err));
    }
}

// ─────────────────────────────────────────────────────────────
// HORA CERTA (:00 e :30) — inalterada
// ─────────────────────────────────────────────────────────────

async function loadCurrentHourAudio() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    try {
        const data = allSchedules.find(s => s.hour === hour && s.enabled);
        if (!data) { resumeAfterHourCerta(); return; }

        const isHourExact = minute <= 2;
        const isHalfHour = minute >= 30 && minute <= 32;
        const currentSlotStr = isHourExact ? `${hour}:00` : `${hour}:30`;

        if (lastPlayedSlot === currentSlotStr) { resumeAfterHourCerta(); return; }

        if (isHourExact && data.audio_url?.trim()) {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url;
            updateDisplay('Hora Certa', `${String(hour).padStart(2,'0')}:00`);
            lastPlayedSlot = currentSlotStr;
            if (isPlaying) audioPlayer.play().catch(e => console.error(e));
        } else if (isHalfHour && data.audio_url_half?.trim()) {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url_half;
            updateDisplay('Hora Certa', `${String(hour).padStart(2,'0')}:30`);
            lastPlayedSlot = currentSlotStr;
            if (isPlaying) audioPlayer.play().catch(e => console.error(e));
        } else {
            resumeAfterHourCerta();
        }
    } catch (error) {
        console.error('Erro hora certa:', error);
        resumeAfterHourCerta();
    }
}

function resumeAfterHourCerta() {
    if (isGradeMode && slotPlaylist.length > 0) {
        playSlotMusic();
    } else {
        playBackgroundMusic();
    }
}

// ─────────────────────────────────────────────────────────────
// HANDLE AUDIO ENDED — roteamento central
// ─────────────────────────────────────────────────────────────

function handleAudioEnded() {
    // Vinheta terminou
    if (isPlayingJingle) {
        isPlayingJingle = false;
        const cb = audioPlayer._jingleCallback;
        audioPlayer._jingleCallback = null;
        if (cb) { cb(); return; }
        playSlotMusic();
        return;
    }

    // Propaganda no modo grade terminou
    if (isPlayingAd && isGradeMode) {
        isPlayingAd = false;
        const cb = audioPlayer._adCallback;
        audioPlayer._adCallback = null;
        if (cb) { cb(); return; }
        playSlotMusicTrack();
        return;
    }

    // Vinheta de abertura do bloco sazonal
    if (audioPlayer._seasonalBlock && !seasonalBlockPlaying) {
        seasonalBlockPlaying = true;
        playSeasonalBlockTrack(audioPlayer._seasonalBlock);
        return;
    }

    // Música do bloco sazonal
    if (audioPlayer._seasonalBlock && seasonalBlockPlaying) {
        playSeasonalBlockTrack(audioPlayer._seasonalBlock);
        return;
    }

    // Vinheta de encerramento do bloco sazonal
    if (audioPlayer._afterSeasonalBlock) {
        audioPlayer._afterSeasonalBlock = false;
        playSlotMusic();
        return;
    }

    // Hora certa terminou
    if (isPlayingHourCerta) {
        isPlayingHourCerta = false;
        if (isGradeMode) {
            playSlotAdvertisement(() => { playSlotMusic(); });
        } else {
            const ads = isSeasonalActive ? seasonalAds : advertisements;
            if (ads.length > 0) { playAdvertisement(); }
            else { playBackgroundMusic(); }
        }
        return;
    }

    // Propaganda legada terminou
    if (isPlayingAd && !isGradeMode) {
        isPlayingAd = false;
        playBackgroundMusic();
        return;
    }

    // Música do modo grade terminou
    if (isGradeMode) {
        slotCurrentIndex = (slotCurrentIndex + 1) % Math.max(slotPlaylist.length, 1);
        playSlotMusic();
        return;
    }

    // Música legada terminou
    const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
    if (playlist.length > 0) {
        currentBackgroundIndex = (currentBackgroundIndex + 1) % playlist.length;
        playBackgroundMusic();
    }
}

function handleNoAudio() {
    audioPlayer.src = '';
    updateDisplay('Sem programação', 'Aguardando áudio...');
}

function handleAudioError() {
    if (isGradeMode) {
        slotCurrentIndex = (slotCurrentIndex + 1) % Math.max(slotPlaylist.length, 1);
        setTimeout(playSlotMusic, 1000);
    } else {
        updateDisplay('Erro', 'Falha ao carregar áudio');
    }
}

// ─────────────────────────────────────────────────────────────
// SEASONAL STATUS CHECK
// ─────────────────────────────────────────────────────────────

async function checkSeasonalStatus() {
    try {
        const { data } = await supabase
            .from('seasonal_settings')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();

        const wasActive = isSeasonalActive;
        const prevCategory = activeSeasonalCategory;

        if (data?.category) {
            if (!wasActive || prevCategory !== data.category) {
                const [musicData, adData] = await Promise.all([
                    supabase.from('seasonal_playlists').select('*').eq('type', 'music').eq('enabled', true).eq('category', data.category).order('daily_order', { ascending: true }),
                    supabase.from('seasonal_playlists').select('*').eq('type', 'ad').eq('enabled', true).eq('category', data.category).order('play_order', { ascending: true })
                ]);
                activeSeasonalCategory = data.category;
                isSeasonalActive = true;
                seasonalPlaylist = musicData.data || [];
                seasonalAds = adData.data || [];
                currentBackgroundIndex = 0;
                currentAdIndex = 0;
                tracksPlayedSinceLastAd = 0;
                await ensureSeasonalBlocksToday();
                if (isPlaying && !isPlayingHourCerta && !isGradeMode) playBackgroundMusic();
            }
        } else if (wasActive) {
            isSeasonalActive = false;
            activeSeasonalCategory = null;
            seasonalPlaylist = [];
            seasonalAds = [];
            seasonalBlocksToday = [];
            currentBackgroundIndex = 0;
            currentAdIndex = 0;
            tracksPlayedSinceLastAd = 0;
            if (isPlaying && !isPlayingHourCerta && !isGradeMode) playBackgroundMusic();
        }
    } catch (error) {
        console.error('Erro ao verificar status sazonal:', error);
    }
}

// ─────────────────────────────────────────────────────────────
// EMBARALHAMENTO DIÁRIO
// ─────────────────────────────────────────────────────────────

async function checkAndShuffleIfNewDay() {
    if (isShuffling) return;
    try {
        const today = new Date().toISOString().split('T')[0];
        if (lastKnownDate && lastKnownDate !== today) {
            await shufflePlaylistOptimized();
            await shuffleSlotPlaylists();
            lastKnownDate = today;
            seasonalBlocksToday = [];
            if (isSeasonalActive) await ensureSeasonalBlocksToday();
            return;
        }
        const { data } = await supabase.from('background_playlist').select('last_shuffle_date').eq('enabled', true).limit(1).maybeSingle();
        if (!data?.last_shuffle_date || data.last_shuffle_date !== today) {
            await shufflePlaylistOptimized();
            await shuffleSlotPlaylists();
            lastKnownDate = today;
        } else {
            if (!lastKnownDate) lastKnownDate = today;
        }
    } catch (error) {
        console.error('Erro ao verificar dia:', error);
    }
}

async function shufflePlaylistOptimized() {
    if (isShuffling) return;
    isShuffling = true;
    try {
        const { data: tracks } = await supabase.from('background_playlist').select('id').eq('enabled', true).order('original_order', { ascending: true });
        if (!tracks?.length) return;
        const indices = [...Array(tracks.length).keys()];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const today = new Date().toISOString().split('T')[0];
        const batchSize = 50;
        for (let i = 0; i < tracks.length; i += batchSize) {
            const batch = tracks.slice(i, i + batchSize);
            await Promise.all(batch.map((t, idx) =>
                supabase.from('background_playlist').update({ daily_order: indices[i + idx], last_shuffle_date: today }).eq('id', t.id)
            ));
        }
        const { data: refreshed } = await supabase.from('background_playlist').select('*').eq('enabled', true).order('daily_order', { ascending: true });
        backgroundPlaylist = refreshed || [];
    } finally {
        isShuffling = false;
    }
}

async function shuffleSlotPlaylists() {
    try {
        const today = new Date().toISOString().split('T')[0];
        for (const slot of timeSlots) {
            const { data: tracks } = await supabase.from('slot_playlists').select('id').eq('slot_id', slot.id).eq('enabled', true);
            if (!tracks?.length) continue;
            const indices = [...Array(tracks.length).keys()];
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            await Promise.all(tracks.map((t, idx) =>
                supabase.from('slot_playlists').update({ daily_order: indices[idx], last_shuffle_date: today }).eq('id', t.id)
            ));
        }
        if (currentSlot) await loadSlotPlaylist(currentSlot.id);
    } catch (error) {
        console.error('Erro ao embaralhar grades:', error);
    }
}

// ─────────────────────────────────────────────────────────────
// INTERFACE
// ─────────────────────────────────────────────────────────────

function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    volumeSlider.addEventListener('input', updateVolume);
    syncBtn.addEventListener('click', forceSync);
    audioPlayer.addEventListener('ended', handleAudioEnded);
    audioPlayer.addEventListener('error', handleAudioError);
}

function togglePlay() {
    if (!audioPlayer.src) return;
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayButtonState(false);
    } else {
        audioPlayer.play()
            .then(() => { isPlaying = true; updatePlayButtonState(true); })
            .catch(err => console.error('Erro ao reproduzir:', err));
    }
}

function updatePlayButtonState(playing) {
    const playIcon  = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');
    if (playing) {
        playBtn.classList.remove('paused'); playBtn.classList.add('playing');
        playIcon.style.display = 'none'; pauseIcon.style.display = 'block';
    } else {
        playBtn.classList.remove('playing'); playBtn.classList.add('paused');
        playIcon.style.display = 'block'; pauseIcon.style.display = 'none';
    }
}

function updateDisplay(status, track) {
    statusText.textContent = status;
    trackName.textContent  = track;
}

function updateVolume() {
    audioPlayer.volume = volumeSlider.value / 100;
}

async function forceSync() {
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Sincronizando...';
    try {
        await loadAllData();
        await detectAndActivateSlot();
        await loadCurrentHourAudio();
        syncBtn.textContent = '✅ Sincronizado!';
    } catch {
        syncBtn.textContent = '❌ Erro';
    } finally {
        setTimeout(() => { syncBtn.textContent = '🔄 Sincronizar'; syncBtn.disabled = false; }, 2000);
    }
}

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    currentTime.textContent = `${h}:${m}:${s}`;

    const min = now.getMinutes();
    let next = new Date(now);
    if (min < 30) { next.setMinutes(30, 0, 0); }
    else { next.setHours(now.getHours() + 1, 0, 0, 0); }

    const diff = next - now;
    const ml = Math.floor(diff / 60000);
    const sl = Math.floor((diff % 60000) / 1000);
    countdownTimer.textContent = `${String(ml).padStart(2,'0')}:${String(sl).padStart(2,'0')}`;
}

async function checkHourChange() {
    const now = new Date();
    const h = now.getHours();
    const min = now.getMinutes();
    if (min === 0 || min === 30) {
        const slot = `${h}:${min === 0 ? '00' : '30'}`;
        if (lastPlayedSlot !== slot) {
            lastPlayedSlot = null;
            await loadCurrentHourAudio();
        }
    }
}

// ─────────────────────────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────────────────────────

function setupRealtimeSubscription() {
    supabase.channel('radio_schedule_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_schedule' }, async () => {
            const { data } = await supabase.from('radio_schedule').select('*').order('hour', { ascending: true });
            allSchedules = data || [];
            await loadCurrentHourAudio();
        }).subscribe();

    supabase.channel('playlist_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'background_playlist' }, async () => {
            const { data } = await supabase.from('background_playlist').select('*').eq('enabled', true).order('daily_order', { ascending: true });
            backgroundPlaylist = data || [];
        }).subscribe();

    supabase.channel('ads_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advertisements' }, async () => {
            const { data } = await supabase.from('advertisements').select('*').eq('enabled', true).order('play_order', { ascending: true });
            advertisements = data || [];
        }).subscribe();

    supabase.channel('seasonal_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'seasonal_playlists' }, () => checkSeasonalStatus())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'seasonal_settings' }, () => checkSeasonalStatus())
        .subscribe();

    supabase.channel('slot_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_slots' }, async () => {
            const { data } = await supabase.from('time_slots').select('*').eq('enabled', true).order('sort_order', { ascending: true });
            timeSlots = data || [];
            await detectAndActivateSlot();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_playlists' }, async () => {
            if (currentSlot) await loadSlotPlaylist(currentSlot.id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jingles' }, async () => {
            if (currentSlot) await loadSlotJingles(currentSlot.id);
        })
        .subscribe();
}

// ─────────────────────────────────────────────────────────────
// INIT ESTADO
// ─────────────────────────────────────────────────────────────
audioPlayer.volume = 0.7;
updatePlayButtonState(false);
