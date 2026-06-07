const SUPABASE_URL      = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';
const YOUTUBE_API_KEY   = 'AIzaSyCcpLnZ0XHsSEx34Zvkc80FwmHiHIqS6Gs';
const BLOCKED_TERMS     = ['funk','rock pesado','metal','punk','rap','trap'];
const MAX_SUGGESTIONS   = 20;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Estado do player ──────────────────────────────────────────
let backgroundPlaylist  = [];
let advertisements      = [];
let scheduleData        = [];
let timeSlots           = [];
let slotPlaylists       = {};
let slotJingles         = {};
let seasonalData        = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
let seasonalSettings    = {};
let seasonalJingles     = { natal:[], ano_novo:[], pascoa:[], sao_joao:[] };

let currentPlaylist     = [];
let currentIndex        = 0;
let currentTable        = 'background_playlist';
let currentSlotId       = null;
let isGradeMode         = false;
let isPlaying           = false;
let musicCount          = 0;
let adIndex             = 0;
let lastPlayedHour      = -1;
let lastPlayedHalf      = false;
let lastScheduleCheck   = 0;
let gradesEnabled       = true;

// ── Jingles de grade ──────────────────────────────────────────
let openingJinglePlayed = false;
let closingScheduled    = false;
let middleJinglesPlayed = 0;
let lastJingleId        = null;
let slotStartTime       = null;
let slotEndTime         = null;

// ── Emergência ────────────────────────────────────────────────
let emergencyActive     = false;
let emergencyAudio      = null;
let emergencyInterval   = null;

// ── Locutor ao vivo ───────────────────────────────────────────
let liveLocutorActive   = false;
let liveAudioCtx        = null;
let liveSourceNode      = null;

// ── Sugestões ─────────────────────────────────────────────────
let deviceId            = null;
let suggestionCount     = 0;
let suggestResults      = [];
let suggestSelectedId   = null;

// ── DOM ───────────────────────────────────────────────────────
let audio, playBtn, trackTitle, trackArtist, trackStatus,
    volumeSlider, progressBar, currentTimeEl, durationEl,
    liveIndicator, liveText;

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
    audio         = document.getElementById('audioPlayer');
    playBtn       = document.getElementById('playBtn');
    trackTitle    = document.getElementById('trackTitle');
    trackArtist   = document.getElementById('trackArtist');
    trackStatus   = document.getElementById('trackStatus');
    volumeSlider  = document.getElementById('volumeSlider');
    progressBar   = document.getElementById('progressBar');
    currentTimeEl = document.getElementById('currentTime');
    durationEl    = document.getElementById('duration');
    liveIndicator = document.getElementById('liveIndicator');
    liveText      = document.getElementById('liveText');

    setupAudioListeners();
    setupUIListeners();
    setupSuggestionListeners();

    deviceId = getDeviceId();
    await loadSuggestionCount();
    await loadAllData();
    setupRealtimeSubscription();
}

// ─────────────────────────────────────────────────────────────
// CARREGAMENTO DE DADOS
// ─────────────────────────────────────────────────────────────
async function loadAllData() {
    try {
        const [schRes, plRes, adsRes, slotsRes, smRes, saRes, ssRes, setRes] = await Promise.all([
            supabase.from('radio_schedule').select('*').order('hour', {ascending:true}),
            supabase.from('background_playlist').select('*').order('daily_order', {ascending:true}),
            supabase.from('advertisements').select('*').eq('enabled',true).order('play_order', {ascending:true}),
            supabase.from('time_slots').select('*').eq('enabled',true).order('sort_order', {ascending:true}),
            supabase.from('seasonal_playlists').select('*').eq('type','music').order('daily_order', {ascending:true}),
            supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order', {ascending:true}),
            supabase.from('seasonal_settings').select('*'),
            supabase.from('radio_settings').select('*').eq('id',1).single()
        ]);

        scheduleData     = schRes.data  || [];
        backgroundPlaylist = plRes.data || [];
        advertisements   = adsRes.data  || [];
        timeSlots        = slotsRes.data|| [];
        gradesEnabled    = setRes.data?.grades_enabled !== false;

        seasonalData = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
        (smRes.data||[]).forEach(i => { if(seasonalData[i.category]) seasonalData[i.category].music.push(i); });
        (saRes.data||[]).forEach(i => { if(seasonalData[i.category]) seasonalData[i.category].ads.push(i);  });
        seasonalSettings = {};
        (ssRes.data||[]).forEach(s => { seasonalSettings[s.category] = s; });

        await loadSlotData();
        await loadSeasonalJingles();
        await checkEmergencyState();
        await restorePlayerState();

        if(!isPlaying) startPlayback();
        startScheduleChecker();
    } catch(err) {
        console.error('Erro ao carregar dados:', err);
        showError('Erro ao carregar playlist. Tentando novamente em 30s...');
        setTimeout(loadAllData, 30000);
    }
}

async function loadSlotData() {
    if(!timeSlots.length) return;
    const [plRes, jRes] = await Promise.all([
        supabase.from('slot_playlists').select('*').eq('enabled',true).order('daily_order', {ascending:true}),
        supabase.from('jingles').select('*').eq('enabled',true).not('slot_id','is',null)
    ]);
    slotPlaylists = {}; slotJingles = {};
    timeSlots.forEach(s => { slotPlaylists[s.id] = []; slotJingles[s.id] = []; });
    (plRes.data||[]).forEach(t => { if(slotPlaylists[t.slot_id]) slotPlaylists[t.slot_id].push(t); });
    (jRes.data||[]).forEach(j => { if(slotJingles[j.slot_id])   slotJingles[j.slot_id].push(j);   });
}

async function loadSeasonalJingles() {
    const {data} = await supabase.from('jingles').select('*').eq('enabled',true).not('seasonal_category','is',null);
    seasonalJingles = { natal:[], ano_novo:[], pascoa:[], sao_joao:[] };
    (data||[]).forEach(j => { if(seasonalJingles[j.seasonal_category]) seasonalJingles[j.seasonal_category].push(j); });
}

// ─────────────────────────────────────────────────────────────
// ESTADO DO PLAYER
// ─────────────────────────────────────────────────────────────
async function restorePlayerState() {
    try {
        const {data} = await supabase.from('player_state').select('*').eq('id',1).single();
        if(!data) return;
        currentTable  = data.current_table  || 'background_playlist';
        currentIndex  = data.current_index  || 0;
        currentSlotId = data.slot_id        || null;
        isGradeMode   = data.is_grade_mode  || false;
    } catch(err) { /* sem estado salvo — começa do zero */ }
}

async function savePlayerState() {
    try {
        await supabase.from('player_state').upsert([{
            id: 1,
            current_table: currentTable,
            current_index: currentIndex,
            slot_id:       currentSlotId,
            is_grade_mode: isGradeMode,
            updated_at:    new Date().toISOString()
        }]);
    } catch(err) { /* silencioso */ }
}

// ─────────────────────────────────────────────────────────────
// INÍCIO DA REPRODUÇÃO
// ─────────────────────────────────────────────────────────────
function startPlayback() {
    const activeSeasonal = getActiveSeasonal();

    if(activeSeasonal) {
        startSeasonalMode(activeSeasonal);
        return;
    }

    if(gradesEnabled) {
        const slot = getCurrentSlot();
        if(slot && slotPlaylists[slot.id]?.length) {
            startSlotMode(slot);
            return;
        }
    }

    startBackgroundMode();
}

function getActiveSeasonal() {
    return Object.keys(seasonalSettings).find(cat => seasonalSettings[cat]?.is_active && seasonalData[cat]?.music?.length);
}

function getCurrentSlot() {
    const hour = new Date().getHours();
    return timeSlots.find(s => {
        if(s.start_hour < s.end_hour) return hour >= s.start_hour && hour < s.end_hour;
        return hour >= s.start_hour || hour < s.end_hour; // atravessa meia-noite
    }) || null;
}

// ─────────────────────────────────────────────────────────────
// MODOS DE PLAYBACK
// ─────────────────────────────────────────────────────────────
function startBackgroundMode() {
    isGradeMode   = false;
    currentSlotId = null;
    currentTable  = 'background_playlist';
    currentPlaylist = backgroundPlaylist.filter(t => t.enabled !== false);
    if(!currentPlaylist.length) { showError('Playlist vazia.'); return; }
    if(currentIndex >= currentPlaylist.length) currentIndex = 0;
    playCurrentTrack();
}

function startSlotMode(slot) {
    isGradeMode      = true;
    currentSlotId    = slot.id;
    currentTable     = 'slot_playlists';
    currentPlaylist  = slotPlaylists[slot.id] || [];
    openingJinglePlayed = false;
    closingScheduled    = false;
    middleJinglesPlayed = 0;
    slotStartTime       = slot.start_hour;
    slotEndTime         = slot.end_hour;
    if(!currentPlaylist.length) { startBackgroundMode(); return; }
    if(currentIndex >= currentPlaylist.length) currentIndex = 0;

    // Vinheta de abertura
    const opening = (slotJingles[slot.id] || []).filter(j => j.position === 'opening' && j.enabled);
    if(opening.length) {
        const jingle = pickJingle(opening);
        playJingle(jingle, () => { openingJinglePlayed = true; playCurrentTrack(); });
        return;
    }
    openingJinglePlayed = true;
    playCurrentTrack();
}

function startSeasonalMode(category) {
    isGradeMode   = false;
    currentSlotId = null;
    currentTable  = 'seasonal_playlists';
    currentPlaylist = seasonalData[category].music.filter(t => t.enabled !== false);
    if(!currentPlaylist.length) { startBackgroundMode(); return; }
    if(currentIndex >= currentPlaylist.length) currentIndex = 0;
    playCurrentTrack();
}

// ─────────────────────────────────────────────────────────────
// REPRODUÇÃO DE FAIXA
// ─────────────────────────────────────────────────────────────
function playCurrentTrack() {
    if(!currentPlaylist.length) return;
    const track = currentPlaylist[currentIndex];
    if(!track) { advanceTrack(); return; }

    audio.src = track.audio_url;
    audio.load();
    audio.play().catch(err => {
        console.warn('Autoplay bloqueado:', err);
        updateUI(track, false);
    });

    updateUI(track, true);
    logPlay(track);
    savePlayerState();
}

function playJingle(jingle, onEnd) {
    const jAudio = new Audio(jingle.audio_url);
    lastJingleId  = jingle.id;
    jAudio.volume = audio.volume;
    jAudio.play().catch(() => { if(onEnd) onEnd(); });
    jAudio.onended = onEnd || null;
    updateStatusText('🎬 Vinheta');
}

function pickJingle(list) {
    const filtered = list.filter(j => j.id !== lastJingleId);
    const pool = filtered.length ? filtered : list;
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────
// FIM DE FAIXA
// ─────────────────────────────────────────────────────────────
async function handleAudioEnded() {
    musicCount++;

    // Propaganda?
    const shouldPlayAd = checkAdTrigger();
    if(shouldPlayAd) {
        const ad = getNextAd();
        if(ad) { await playAd(ad); return; }
    }

    // Vinheta de meio (grade)?
    if(isGradeMode && currentSlotId) {
        const midPoint = Math.floor(currentPlaylist.length / 2);
        if(musicCount === midPoint && middleJinglesPlayed < 2) {
            const midJingles = (slotJingles[currentSlotId] || []).filter(j => j.position === 'middle' && j.enabled);
            if(midJingles.length) {
                const jingle = pickJingle(midJingles);
                middleJinglesPlayed++;
                playJingle(jingle, () => { advanceTrack(); playCurrentTrack(); });
                return;
            }
        }
    }

    advanceTrack();
    playCurrentTrack();
}

function advanceTrack() {
    currentIndex++;
    if(currentIndex >= currentPlaylist.length) {
        currentIndex = 0;
        handlePlaylistComplete();
    }
}

async function handlePlaylistComplete() {
    // Vinheta de encerramento (grade)?
    if(isGradeMode && currentSlotId && !closingScheduled) {
        const closing = (slotJingles[currentSlotId] || []).filter(j => j.position === 'closing' && j.enabled);
        if(closing.length) {
            closingScheduled = true;
            const jingle = pickJingle(closing);
            playJingle(jingle, () => { shuffleAndRestart(); });
            return;
        }
    }
    shuffleAndRestart();
}

async function shuffleAndRestart() {
    await shuffleCurrentPlaylist();
    currentIndex        = 0;
    openingJinglePlayed = false;
    closingScheduled    = false;
    middleJinglesPlayed = 0;
    musicCount          = 0;
    playCurrentTrack();
}

async function shuffleCurrentPlaylist() {
    try {
        let table, filter;
        if(currentTable === 'slot_playlists')     { table='slot_playlists';     filter={slot_id: currentSlotId}; }
        else if(currentTable === 'seasonal_playlists') { table='seasonal_playlists'; filter={category: getActiveSeasonal(), type:'music'}; }
        else                                       { table='background_playlist'; filter=null; }

        let query = supabase.from(table).select('id').eq('enabled',true);
        if(filter) Object.entries(filter).forEach(([k,v]) => { query = query.eq(k,v); });
        const {data:tracks} = await query;
        if(!tracks?.length) return;

        const idx = [...Array(tracks.length).keys()];
        for(let i = idx.length-1; i > 0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        const today = new Date().toISOString().split('T')[0];
        await Promise.all(tracks.map((t,i) =>
            supabase.from(table).update({daily_order: idx[i], last_shuffle_date: today}).eq('id', t.id)
        ));

        // Recarrega playlist embaralhada
        let freshQuery = supabase.from(table).select('*').eq('enabled',true).order('daily_order',{ascending:true});
        if(filter) Object.entries(filter).forEach(([k,v]) => { freshQuery = freshQuery.eq(k,v); });
        const {data:fresh} = await freshQuery;
        currentPlaylist = fresh || [];
        if(currentTable === 'background_playlist') backgroundPlaylist = currentPlaylist;
        else if(currentTable === 'slot_playlists' && currentSlotId) slotPlaylists[currentSlotId] = currentPlaylist;
    } catch(err) { console.error('Erro ao embaralhar:', err); }
}

// ─────────────────────────────────────────────────────────────
// PROPAGANDAS
// ─────────────────────────────────────────────────────────────
function checkAdTrigger() {
    if(!advertisements.length) return false;
    const ad = advertisements[adIndex % advertisements.length];
    return musicCount > 0 && musicCount % (ad?.frequency || 3) === 0;
}

function getNextAd() {
    if(!advertisements.length) return null;
    const ad = advertisements[adIndex % advertisements.length];
    adIndex++;
    return ad;
}

async function playAd(ad) {
    updateStatusText(`📢 ${ad.title || 'Propaganda'}`);
    const adAudio = new Audio(ad.audio_url);
    adAudio.volume = audio.volume;
    adAudio.play().catch(() => { advanceTrack(); playCurrentTrack(); });
    adAudio.onended = () => { advanceTrack(); playCurrentTrack(); };
}

// ─────────────────────────────────────────────────────────────
// CHECAGEM DE HORA CERTA
// ─────────────────────────────────────────────────────────────
function startScheduleChecker() {
    setInterval(checkSchedule, 15000);
    checkSchedule();
}

async function checkSchedule() {
    const now  = new Date();
    const hour = now.getHours();
    const min  = now.getMinutes();
    const sec  = now.getSeconds();

    // Só dispara nos primeiros 30s de cada marcação
    const isOnHour   = min === 0  && sec < 30;
    const isOnHalf   = min === 30 && sec < 30;
    if(!isOnHour && !isOnHalf) return;

    const key = `${hour}-${isOnHalf?'half':'hour'}`;
    if(lastScheduleCheck === key) return;

    const entry = scheduleData.find(s => s.hour === hour && s.enabled);
    if(!entry) return;

    const url = isOnHalf ? entry.audio_url_half : entry.audio_url;
    if(!url) return;

    lastScheduleCheck = key;
    await playScheduledAudio(url, hour);
}

async function playScheduledAudio(url, hour) {
    const schAudio = new Audio(url);
    schAudio.volume = audio.volume;
    audio.pause();
    updateStatusText(`🕐 ${String(hour).padStart(2,'0')}:00`);
    await schAudio.play().catch(() => {});
    schAudio.onended = () => {
        advanceTrack();
        playCurrentTrack();
    };
}

// ─────────────────────────────────────────────────────────────
// EMERGÊNCIA
// ─────────────────────────────────────────────────────────────
async function checkEmergencyState() {
    try {
        // Tenta emergency_state primeiro
        let data, err;
        ({ data, error:err } = await supabase.from('emergency_state').select('*').eq('id',1).single());
        if(err) {
            // Fallback: emergency_alert
            ({ data } = await supabase.from('emergency_alert').select('*').eq('id',1).single());
        }
        if(data?.is_active) activateEmergency(data);
        else                deactivateEmergency();
    } catch(e) { /* sem tabela de emergência */ }
}

function activateEmergency(state) {
    if(emergencyActive) return;
    emergencyActive = true;
    audio.pause();

    const repeat = () => {
        if(!emergencyActive) return;
        if(state.audio_url) {
            emergencyAudio = new Audio(state.audio_url);
            emergencyAudio.volume = audio.volume;
            emergencyAudio.play().catch(() => {});
            emergencyAudio.onended = () => {
                emergencyInterval = setTimeout(repeat, (state.repeat_interval || 60) * 1000);
            };
        } else if(state.message || state.tts_text) {
            speakTTS(state.message || state.tts_text, () => {
                emergencyInterval = setTimeout(repeat, (state.repeat_interval || 60) * 1000);
            });
        }
    };

    repeat();
    updateStatusText('🚨 ALERTA DE EMERGÊNCIA');
    if(liveIndicator) { liveIndicator.style.display = 'flex'; }
    if(liveText) liveText.textContent = '🚨 EMERGÊNCIA';
}

function deactivateEmergency() {
    if(!emergencyActive) return;
    emergencyActive = false;
    if(emergencyInterval) { clearTimeout(emergencyInterval); emergencyInterval = null; }
    if(emergencyAudio)    { emergencyAudio.pause(); emergencyAudio = null; }
    if(liveIndicator) liveIndicator.style.display = 'none';
    if(liveText) liveText.textContent = '🔴 AO VIVO';
    playCurrentTrack();
}

// ─────────────────────────────────────────────────────────────
// TTS
// ─────────────────────────────────────────────────────────────
function speakTTS(text, onEnd) {
    if(!text) { if(onEnd) onEnd(); return; }
    if(window.responsiveVoice && responsiveVoice.voiceSupport()) {
        responsiveVoice.speak(text, 'Brazilian Portuguese Female', { rate:0.9, pitch:1, volume:1, onend: onEnd || null });
        return;
    }
    if(!window.speechSynthesis) { if(onEnd) onEnd(); return; }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = 'pt-BR'; utt.rate = 0.88; utt.pitch = 1.05;
    const voices = speechSynthesis.getVoices();
    const match  = voices.find(v => v.lang.startsWith('pt'));
    if(match) utt.voice = match;
    if(onEnd) utt.onend = onEnd;
    speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────────────────────────
function setupRealtimeSubscription() {
    // Locutor pré-gravado
    supabase.channel('locutor_player')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'locutor_state'}, payload => {
            if(payload.new.is_active) {
                audio.pause(); isPlaying = false;
                updatePlayBtn(false);
                updateStatusText('🎙️ Locutor ao vivo');
                if(liveIndicator) liveIndicator.style.display = 'flex';
            } else {
                if(liveIndicator) liveIndicator.style.display = 'none';
                advanceTrack(); playCurrentTrack();
            }
        }).subscribe();

    // Emergência
    supabase.channel('emergency_player')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_state'},
            payload => { payload.new.is_active ? activateEmergency(payload.new) : deactivateEmergency(); })
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_alert'},
            payload => { payload.new.is_active ? activateEmergency(payload.new) : deactivateEmergency(); })
        .subscribe();

    // TTS broadcast
    supabase.channel('tts_broadcast')
        .on('broadcast', {event:'tts_play'}, ({payload}) => {
            audio.pause(); isPlaying = false; updatePlayBtn(false);
            updateStatusText(`📢 ${payload.title || 'Aviso'}`);
            speakTTS(payload.text, () => { advanceTrack(); playCurrentTrack(); });
        }).subscribe();

    // Locutor ao vivo (microfone)
    supabase.channel('live_locutor_player')
        .on('broadcast', {event:'live_locutor_start'}, () => {
            liveLocutorActive = true;
            audio.pause(); isPlaying = false; updatePlayBtn(false);
            updateStatusText('🎙️ Locutor ao vivo');
            if(liveIndicator) liveIndicator.style.display = 'flex';
            startLiveAudioReceiver();
        })
        .on('broadcast', {event:'live_locutor_stop'}, () => {
            liveLocutorActive = false;
            stopLiveAudioReceiver();
            if(liveIndicator) liveIndicator.style.display = 'none';
            advanceTrack(); playCurrentTrack();
        })
        .on('broadcast', {event:'live_audio_chunk'}, ({payload}) => {
            if(!liveLocutorActive) return;
            receiveLiveChunk(payload.chunk);
        }).subscribe();

    // Mudança de settings (grades ativadas/desativadas)
    supabase.channel('settings_player')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'radio_settings'}, payload => {
            gradesEnabled = payload.new.grades_enabled !== false;
        }).subscribe();

    // Mudança de sazonais
    supabase.channel('seasonal_player')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'seasonal_settings'}, async() => {
            const {data} = await supabase.from('seasonal_settings').select('*');
            seasonalSettings = {};
            (data||[]).forEach(s => { seasonalSettings[s.category] = s; });
            const newSeasonal = getActiveSeasonal();
            if(newSeasonal && currentTable !== 'seasonal_playlists') {
                currentIndex = 0; startSeasonalMode(newSeasonal);
            } else if(!newSeasonal && currentTable === 'seasonal_playlists') {
                currentIndex = 0; startPlayback();
            }
        }).subscribe();
}

// ─────────────────────────────────────────────────────────────
// LOCUTOR AO VIVO — receptor de áudio
// ─────────────────────────────────────────────────────────────
function startLiveAudioReceiver() {
    try {
        liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { console.warn('AudioContext não disponível:', e); }
}

function receiveLiveChunk(base64Chunk) {
    if(!liveAudioCtx || !base64Chunk) return;
    try {
        const binary = atob(base64Chunk);
        const bytes  = new Uint8Array(binary.length);
        for(let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const int16  = new Int16Array(bytes.buffer);
        const float32= new Float32Array(int16.length);
        for(let i=0; i<int16.length; i++) float32[i] = int16[i] / 0x7FFF;
        const buffer = liveAudioCtx.createBuffer(1, float32.length, 44100);
        buffer.copyToChannel(float32, 0);
        const source = liveAudioCtx.createBufferSource();
        source.buffer  = buffer;
        source.connect(liveAudioCtx.destination);
        source.start();
    } catch(e) { /* chunk inválido */ }
}

function stopLiveAudioReceiver() {
    if(liveAudioCtx) {
        liveAudioCtx.close().catch(()=>{});
        liveAudioCtx = null;
    }
}

// ─────────────────────────────────────────────────────────────
// PLAY LOG
// ─────────────────────────────────────────────────────────────
async function logPlay(track) {
    try {
        const slot = currentSlotId ? timeSlots.find(s => s.id === currentSlotId) : null;
        await supabase.from('play_analytics').insert([{
            track_id:     track.id,
            track_title:  track.title || 'Sem título',
            track_table:  currentTable,
            slot_id:      currentSlotId || null,
            slot_name:    slot?.name || null,
            hour_of_day:  new Date().getHours(),
            played_at:    new Date().toISOString()
        }]);
    } catch(err) {
        // Fallback para play_log
        try {
            await supabase.from('play_log').insert([{
                track_id:    track.id,
                track_title: track.title || 'Sem título',
                played_at:   new Date().toISOString()
            }]);
        } catch(e) { /* silencioso */ }
    }
}

// ─────────────────────────────────────────────────────────────
// INTERFACE
// ─────────────────────────────────────────────────────────────
function setupAudioListeners() {
    audio.addEventListener('ended',        handleAudioEnded);
    audio.addEventListener('timeupdate',   updateProgress);
    audio.addEventListener('loadedmetadata', () => { if(durationEl) durationEl.textContent = formatTime(audio.duration); });
    audio.addEventListener('play',  () => { isPlaying = true;  updatePlayBtn(true);  });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayBtn(false); });
    audio.addEventListener('error', () => { console.warn('Erro de áudio, avançando...'); setTimeout(() => { advanceTrack(); playCurrentTrack(); }, 2000); });
    audio.addEventListener('waiting', () => updateStatusText('⏳ Carregando...'));
    audio.addEventListener('canplay',  () => updateStatusText(isPlaying ? '▶️ Tocando' : '⏸️ Pausado'));
}

function setupUIListeners() {
    playBtn?.addEventListener('click', togglePlay);
    volumeSlider?.addEventListener('input', () => { audio.volume = volumeSlider.value / 100; });
    progressBar?.addEventListener('click', e => {
        if(!audio.duration) return;
        const rect = progressBar.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });
    audio.volume = (volumeSlider?.value ?? 80) / 100;
}

function togglePlay() {
    if(isPlaying) { audio.pause(); }
    else {
        if(!audio.src || audio.src === window.location.href) startPlayback();
        else audio.play().catch(() => startPlayback());
    }
}

function updateUI(track, playing) {
    if(trackTitle)  trackTitle.textContent  = track.title  || 'Sem título';
    if(trackArtist) trackArtist.textContent = track.artist || '';
    updateStatusText(playing ? '▶️ Tocando' : '⏸️ Pausado');
    updatePlayBtn(playing);
    document.title = `🎵 ${track.title || 'Rádio Louro'}`;
}

function updateStatusText(text) {
    if(trackStatus) trackStatus.textContent = text;
}

function updatePlayBtn(playing) {
    if(!playBtn) return;
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.classList.toggle('playing', playing);
}

function updateProgress() {
    if(!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    const fill = document.getElementById('progressFill');
    if(fill) fill.style.width = pct + '%';
    if(currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
}

function formatTime(secs) {
    if(!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
}

function showError(msg) {
    updateStatusText('❌ ' + msg);
    if(trackTitle) trackTitle.textContent = msg;
}

// ─────────────────────────────────────────────────────────────
// SUGESTÃO DE MÚSICAS
// ─────────────────────────────────────────────────────────────
function getDeviceId() {
    let id = localStorage.getItem('radio_device_id');
    if(!id) { id = 'dev_' + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem('radio_device_id', id); }
    return id;
}

async function loadSuggestionCount() {
    const today = new Date().toISOString().split('T')[0];
    const {data} = await supabase.from('suggestion_limits').select('count').eq('identifier', deviceId).eq('suggestion_date', today).single();
    suggestionCount = data?.count || 0;
    updateSuggestionCounter();
}

function updateSuggestionCounter() {
    const el = document.getElementById('suggestCounter');
    if(el) el.textContent = `${MAX_SUGGESTIONS - suggestionCount} sugestões restantes hoje`;
}

function setupSuggestionListeners() {
    const input  = document.getElementById('suggestInput');
    const btn    = document.getElementById('suggestSearchBtn');
    const addBtn = document.getElementById('suggestAddBtn');
    if(!input || !btn) return;

    btn.addEventListener('click', handleSuggestSearch);
    input.addEventListener('keydown', e => { if(e.key === 'Enter') handleSuggestSearch(); });
    addBtn?.addEventListener('click', handleSuggestAdd);
}

async function handleSuggestSearch() {
    const query = document.getElementById('suggestInput')?.value.trim();
    if(!query) return;
    const btn = document.getElementById('suggestSearchBtn');
    const res = document.getElementById('suggestResults');
    if(!btn || !res) return;
    btn.textContent = '⏳'; btn.disabled = true;
    res.style.display = 'block';
    res.innerHTML = '<div class="suggest-loading">Buscando...</div>';

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=5&part=snippet&key=${YOUTUBE_API_KEY}`;
        const data = await (await fetch(url)).json();
        if(!data.items?.length) { res.innerHTML = '<div class="suggest-empty">Nenhum resultado.</div>'; return; }
        const filtered = data.items.filter(i => !BLOCKED_TERMS.some(b => i.snippet.title.toLowerCase().includes(b)));
        suggestResults = filtered;
        res.innerHTML = filtered.map((item, i) => `
            <div class="suggest-result-card ${suggestSelectedId===i?'selected':''}" data-idx="${i}">
                <img src="${item.snippet.thumbnails?.default?.url||''}" alt="" class="suggest-result-thumb">
                <div class="suggest-result-info">
                    <div class="suggest-result-title">${item.snippet.title}</div>
                    <div class="suggest-result-channel">${item.snippet.channelTitle}</div>
                </div>
                <button class="suggest-preview-btn" onclick="toggleSuggestPreview(${i},'${item.id.videoId}')">▶️</button>
            </div>
            <iframe id="suggestFrame_${i}" class="suggest-yt-embed" src="" allowfullscreen allow="autoplay"></iframe>`).join('');
        res.querySelectorAll('.suggest-result-card').forEach(card => {
            card.addEventListener('click', () => {
                suggestSelectedId = parseInt(card.dataset.idx);
                res.querySelectorAll('.suggest-result-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                document.getElementById('suggestAddBtn').disabled = false;
            });
        });
    } catch(err) { res.innerHTML = '<div class="suggest-empty">Erro na busca.</div>'; }
    finally { btn.textContent = '🔍 Buscar'; btn.disabled = false; }
}

window.toggleSuggestPreview = function(idx, videoId) {
    const frame = document.getElementById(`suggestFrame_${idx}`);
    if(!frame) return;
    if(frame.style.display === 'block') { frame.src = ''; frame.style.display = 'none'; }
    else { frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`; frame.style.display = 'block'; }
};

async function handleSuggestAdd() {
    if(suggestSelectedId === null || !suggestResults[suggestSelectedId]) return;
    if(suggestionCount >= MAX_SUGGESTIONS) { alert(`Limite de ${MAX_SUGGESTIONS} sugestões por dia atingido.`); return; }

    const item    = suggestResults[suggestSelectedId];
    const videoId = item.id.videoId;
    const title   = item.snippet.title;
    const channel = item.snippet.channelTitle;
    const thumb   = item.snippet.thumbnails?.default?.url || '';

    const name = prompt('Seu nome (opcional):') || 'Funcionário';

    try {
        await supabase.from('music_queue').insert([{
            youtube_url:       `https://www.youtube.com/watch?v=${videoId}`,
            youtube_title:     title,
            youtube_channel:   channel,
            youtube_thumbnail: thumb,
            title:             title,
            source:            'suggestion',
            suggested_by:      name,
            status:            'pending',
            conversion_status: 'pending'
        }]);

        const today = new Date().toISOString().split('T')[0];
        await supabase.from('suggestion_limits').upsert([{
            identifier:       deviceId,
            suggestion_date:  today,
            count:            suggestionCount + 1
        }], { onConflict: 'identifier,suggestion_date' });

        suggestionCount++;
        updateSuggestionCounter();
        alert('✅ Sugestão enviada! O admin irá aprová-la em breve.');

        document.getElementById('suggestInput').value = '';
        document.getElementById('suggestResults').style.display = 'none';
        document.getElementById('suggestAddBtn').disabled = true;
        suggestSelectedId = null;
    } catch(err) { alert('❌ Erro ao enviar sugestão: ' + err.message); }
}
