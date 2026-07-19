const SUPABASE_URL      = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';
const YOUTUBE_API_KEY   = 'AIzaSyCcpLnZ0XHsSEx34Zvkc80FwmHiHIqS6Gs';
const BLOCKED_TERMS     = ['funk','rock pesado','metal','punk','rap','trap'];

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── DOM — declaradas aqui, atribuídas no init ────────────────
let audioPlayer, playBtn, volumeSlider, syncBtn;
let currentTime, countdownTimer, statusText, trackName;

// ── Estado geral ──────────────────────────────────────────────
let isPlaying         = false;
let isShuffling       = false;
let lastKnownDate     = null;

// ── Analytics ────────────────────────────────────────────────
let currentTrackInfo  = null;

// ── Emergência ───────────────────────────────────────────────
let emergencyActive         = false;
let emergencyInterval       = null;
let emergencyAudioEl        = new Audio();
let playerPausedByEmergency = false;

// ── Locutor ao vivo ───────────────────────────────────────────
let liveLocutorChannel = null;
let liveAudioQueue     = [];
let liveAudioCtx       = null;

// ── Playlist legada (fundo / madrugada) ───────────────────────
let allSchedules      = [];
let backgroundPlaylist= [];
let advertisements    = [];
let currentBgIndex    = 0;
let currentAdIndex    = 0;
let tracksPlayedSinceAd = 0;
let isPlayingHourCerta= false;
let isPlayingAd       = false;
let lastPlayedSlot    = null;

// ── Sazonais ──────────────────────────────────────────────────
let seasonalPlaylist  = [];
let seasonalAds       = [];
let activeSeasonalCat = null;
let isSeasonalActive  = false;

// ── Grades horárias ───────────────────────────────────────────
let timeSlots         = [];
let gradesEnabled     = true;
let currentSlot       = null;
let slotPlaylist      = [];
let slotCurrentIndex  = 0;
let slotAdIndex       = 0;
let slotTracksSinceAd = 0;
let isGradeMode       = false;
let lastSlotId        = null;

// ── Vinhetas ──────────────────────────────────────────────────
let jinglesOpening = [], jinglesMiddle = [], jinglesClosing = [];
let isPlayingJingle = false;
let gradeOpeningDone= false;
let gradeMiddle1Done= false;
let gradeMiddle2Done= false;
let gradeStartTime  = null;
let gradeDurationMs = 0;
let lastJingleOpening=null, lastJingleMiddle=null, lastJingleClosing=null;

// ── Blocos sazonais ───────────────────────────────────────────
let seasonalBlocksToday = [];
let seasonalBlockPlaying= false;
let seasonalBlockQueue  = [];
let seasonalBlockIndex  = 0;

// ── Locutor / TTS ─────────────────────────────────────────────
let locutorAudio        = new Audio();
let playerPausedByLoc   = false;
let playerResumePos     = 0;

// ── Sugestão ──────────────────────────────────────────────────
let suggestPendingItem  = null;
let suggestCountToday   = 0;
const SUGGEST_LIMIT     = 20;

// ── Estado persistente ────────────────────────────────────────
let saveStateInterval = null;

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
async function init() {
    try {
        audioPlayer   = document.getElementById('audioPlayer');
        playBtn       = document.getElementById('playBtn');
        volumeSlider  = document.getElementById('volumeSlider');
        syncBtn       = document.getElementById('syncBtn');
        currentTime   = document.getElementById('currentTime');
        countdownTimer= document.getElementById('countdownTimer');
        statusText    = document.getElementById('statusText');
        trackName     = document.getElementById('trackName');

        if(!audioPlayer || !playBtn) {
            console.error('Elementos DOM não encontrados — verifique o index.html');
            return;
        }

        audioPlayer.volume = 0.7;
        updatePlayButtonState(false);

        lastKnownDate = new Date().toISOString().split('T')[0];
        await loadAllData();
        setupEventListeners();
        setupRealtimeSubscription();
        updateClock();
        setInterval(updateClock, 1000);
        setInterval(checkHourChange, 30000);
        setInterval(checkSeasonalStatus, 10000);
        setInterval(checkSlotChange, 60000);

        // 1) Restaura índice da playlist salvo no banco (player_state)
        await restorePlaybackState();
        // 2) Ativa grade horária sem disparar reprodução automática
        await detectAndActivateSlotSilent();
        // 3) Pré-carrega hora certa sem disparar reprodução automática
        await loadCurrentHourAudioSilent();

        startSaveStateInterval();
        initEmergencyListener();
        initLiveLocutorListener();
        initSuggest();
        initLocutorListener();
        initTTSListener();
        initSilenceListener();
        initFlashListener();
        await loadBlacklistPlayer();
    } catch(err){ console.error('Erro init:', err); }
}

// ─────────────────────────────────────────────────────────────
// CARREGAMENTO DE DADOS
// ─────────────────────────────────────────────────────────────
async function loadAllData() {
    try {
        const [schRes,bgRes,adsRes,slotsRes,ssRes,smRes,saRes,settingsRes] = await Promise.all([
            supabase.from('radio_schedule').select('*').order('hour',{ascending:true}),
            supabase.from('background_playlist').select('*').eq('enabled',true).order('daily_order',{ascending:true}),
            supabase.from('advertisements').select('*').eq('enabled',true).order('play_order',{ascending:true}),
            supabase.from('time_slots').select('*').eq('enabled',true).order('sort_order',{ascending:true}),
            supabase.from('seasonal_settings').select('*').eq('is_active',true).maybeSingle(),
            supabase.from('seasonal_playlists').select('*').eq('type','music').eq('enabled',true).order('daily_order',{ascending:true}),
            supabase.from('seasonal_playlists').select('*').eq('type','ad').eq('enabled',true).order('play_order',{ascending:true}),
            supabase.from('radio_settings').select('grades_enabled').eq('id',1).maybeSingle()
        ]);
        allSchedules       = schRes.data  || [];
        backgroundPlaylist = bgRes.data   || [];
        advertisements     = adsRes.data  || [];
        timeSlots          = slotsRes.data|| [];
        gradesEnabled = settingsRes.data?.grades_enabled !== false;

        if(ssRes.data?.category) {
            activeSeasonalCat = ssRes.data.category;
            isSeasonalActive  = true;
            seasonalPlaylist  = (smRes.data||[]).filter(i=>i.category===activeSeasonalCat);
            seasonalAds       = (saRes.data||[]).filter(i=>i.category===activeSeasonalCat);
        } else {
            isSeasonalActive=false; seasonalPlaylist=[]; seasonalAds=[];
        }
    } catch(err){ console.error('Erro loadAllData:', err); }
}

// ─────────────────────────────────────────────────────────────
// EMBARALHAMENTO
// ─────────────────────────────────────────────────────────────
async function checkAndShuffleIfNewDay() { /* desativado — embaralha ao completar */ }

async function shufflePlaylistAfterComplete(table, slotId) {
    if(isShuffling) return;
    isShuffling = true;
    try {
        let query = supabase.from(table).select('id').eq('enabled', true);
        if(slotId !== null) query = query.eq('slot_id', slotId);
        const {data: tracks} = await query;
        if(!tracks?.length) { isShuffling = false; return; }

        const idx = [...Array(tracks.length).keys()];
        for(let i = idx.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [idx[i], idx[j]] = [idx[j], idx[i]];
        }

        const BATCH = 50;
        for(let i = 0; i < tracks.length; i += BATCH) {
            const batch = tracks.slice(i, i + BATCH);
            await Promise.all(batch.map((t, bi) =>
                supabase.from(table).update({ daily_order: idx[i + bi] }).eq('id', t.id)
            ));
        }
    } catch(err) { console.error('Erro shuffle:', err); }
    finally { isShuffling = false; }
}

// ─────────────────────────────────────────────────────────────
// GRADES HORÁRIAS
// ─────────────────────────────────────────────────────────────
function getActiveSlotForHour(hour) {
    if(!gradesEnabled || !timeSlots.length) return null;
    for(const slot of timeSlots) {
        if(slot.name === 'Madrugada Aleatória') continue;
        if(slot.start_hour <= slot.end_hour) {
            if(hour >= slot.start_hour && hour < slot.end_hour) return slot;
        } else {
            if(hour >= slot.start_hour || hour < slot.end_hour) return slot;
        }
    }
    return null;
}

async function detectAndActivateSlot() {
    const hour = new Date().getHours();
    const slot = getActiveSlotForHour(hour);
    if(!slot) { isGradeMode=false; currentSlot=null; lastSlotId=null; return; }
    if(slot.id === lastSlotId) return;
    isGradeMode=true; currentSlot=slot; lastSlotId=slot.id;
    gradeOpeningDone=false; gradeMiddle1Done=false; gradeMiddle2Done=false;
    const gradeStart = new Date(); gradeStart.setMinutes(0,0,0); gradeStart.setHours(slot.start_hour);
    const gradeEnd = new Date(gradeStart); gradeEnd.setHours(slot.end_hour);
    gradeStartTime = gradeStart; gradeDurationMs = gradeEnd - gradeStart;
    await loadSlotPlaylist(slot.id);
    await loadSlotJingles(slot.id);
    if(isSeasonalActive) await ensureSeasonalBlocksToday();
    if(isPlaying && !isPlayingHourCerta) startGrade();
}

// Versão silenciosa: carrega dados da grade sem disparar reprodução (usada no boot)
async function detectAndActivateSlotSilent() {
    const hour = new Date().getHours();
    const slot = getActiveSlotForHour(hour);
    if(!slot) { isGradeMode=false; currentSlot=null; lastSlotId=null; return; }
    // Só atualiza se mudou de grade — preserva slotCurrentIndex restaurado
    if(slot.id !== lastSlotId) {
        isGradeMode=true; currentSlot=slot; lastSlotId=slot.id;
        gradeOpeningDone=false; gradeMiddle1Done=false; gradeMiddle2Done=false;
        const gradeStart = new Date(); gradeStart.setMinutes(0,0,0); gradeStart.setHours(slot.start_hour);
        const gradeEnd = new Date(gradeStart); gradeEnd.setHours(slot.end_hour);
        gradeStartTime = gradeStart; gradeDurationMs = gradeEnd - gradeStart;
        await loadSlotPlaylist(slot.id);
        await loadSlotJingles(slot.id);
    }
    if(isSeasonalActive) await ensureSeasonalBlocksToday();
    // NÃO chama startGrade() — o usuário inicia a reprodução manualmente
}

async function loadSlotPlaylist(slotId) {
    const {data} = await supabase
        .from('slot_playlists').select('*')
        .eq('slot_id', slotId).eq('enabled', true)
        .order('daily_order', {ascending: true});
    slotPlaylist = data || [];
    if(slotCurrentIndex >= slotPlaylist.length) slotCurrentIndex = 0;
    slotAdIndex = 0; slotTracksSinceAd = 0;
}

async function loadSlotJingles(slotId) {
    const {data} = await supabase.from('jingles').select('*').eq('slot_id',slotId).eq('enabled',true);
    jinglesOpening = (data||[]).filter(j=>j.position==='opening');
    jinglesMiddle  = (data||[]).filter(j=>j.position==='middle');
    jinglesClosing = (data||[]).filter(j=>j.position==='closing');
}

async function loadSeasonalJingles(category) {
    const {data} = await supabase.from('jingles').select('*').eq('seasonal_category',category).eq('enabled',true);
    return {
        opening:(data||[]).filter(j=>j.position==='opening'),
        middle: (data||[]).filter(j=>j.position==='middle'),
        closing:(data||[]).filter(j=>j.position==='closing')
    };
}

function checkSlotChange() {
    const hour = new Date().getHours();
    const slot = getActiveSlotForHour(hour);
    if((slot?.id||null) !== lastSlotId) detectAndActivateSlot();
}

// ─────────────────────────────────────────────────────────────
// ESTADO PERSISTENTE
// ─────────────────────────────────────────────────────────────
async function savePlaybackState() {
    try {
        const current_table = isGradeMode
            ? 'slot_playlists'
            : (isSeasonalActive ? 'seasonal_playlists' : 'background_playlist');
        const current_index = isGradeMode ? slotCurrentIndex : currentBgIndex;
        const playlist = isGradeMode ? slotPlaylist
            : (isSeasonalActive ? seasonalPlaylist : backgroundPlaylist);
        const track = playlist[current_index % Math.max(playlist.length, 1)];

        // upsert garante que a linha existe mesmo que a tabela esteja vazia
        await supabase.from('player_state').upsert({
            id:            1,
            current_table,
            current_id:    track?.id    || null,
            current_index,
            slot_id:       currentSlot?.id || null,
            is_grade_mode: isGradeMode,
            updated_at:    new Date().toISOString()
        }, { onConflict: 'id' });
    } catch(err) { console.warn('savePlaybackState:', err); }
}

async function restorePlaybackState() {
    try {
        const { data } = await supabase
            .from('player_state')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if(!data) return false;

        // Restaura modo grade
        if(data.is_grade_mode && data.slot_id) {
            const slot = timeSlots.find(s => s.id === data.slot_id);
            if(slot) {
                currentSlot = slot; lastSlotId = slot.id; isGradeMode = true;
                await loadSlotPlaylist(slot.id);
                await loadSlotJingles(slot.id);
                // Tenta achar pela ID, senão usa o índice salvo
                const idxById = data.current_id
                    ? slotPlaylist.findIndex(t => t.id === data.current_id)
                    : -1;
                slotCurrentIndex = idxById >= 0 ? idxById
                    : Math.min(data.current_index || 0, Math.max(slotPlaylist.length - 1, 0));
                console.log(`▶️ Retomando grade "${slot.name}" na música ${slotCurrentIndex + 1}/${slotPlaylist.length}`);
                return true;
            }
        }

        // Restaura modo playlist geral / sazonal
        if(!data.is_grade_mode && data.current_table === 'background_playlist') {
            isGradeMode = false;
            const idxById = data.current_id
                ? backgroundPlaylist.findIndex(t => t.id === data.current_id)
                : -1;
            currentBgIndex = idxById >= 0 ? idxById
                : Math.min(data.current_index || 0, Math.max(backgroundPlaylist.length - 1, 0));
            console.log(`▶️ Retomando playlist geral na música ${currentBgIndex + 1}/${backgroundPlaylist.length}`);
            return true;
        }

        return false;
    } catch(err) { return false; }
}

function startSaveStateInterval() {
    if(saveStateInterval) clearInterval(saveStateInterval);
    saveStateInterval = setInterval(() => {
        if(isPlaying && !isPlayingHourCerta && !isPlayingJingle && !isPlayingAd) {
            savePlaybackState();
        }
    }, 30000);
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────
async function logAnalytics(track, table, slotId, slotName) {
    try {
        // Insere em play_log — tabela real do banco
        await supabase.from('play_log').insert([{
            audio_url:    track?.audio_url || null,
            title:        track?.title     || 'Desconhecida',
            artist:       track?.artist    || null,
            source_table: table,
            source_id:    track?.id        || null,
            slot_id:      slotId           || null,
            slot_name:    slotName         || null
        }]);
    } catch(err) { /* silencioso */ }
}

// ─────────────────────────────────────────────────────────────
// BLOCOS SAZONAIS
// ─────────────────────────────────────────────────────────────
async function ensureSeasonalBlocksToday() {
    if(!isSeasonalActive||!activeSeasonalCat) return;
    const today = new Date().toISOString().split('T')[0];
    try {
        const {data:existing} = await supabase.from('seasonal_blocks').select('*').eq('block_date',today).eq('seasonal_category',activeSeasonalCat);
        if(existing?.length===3){ seasonalBlocksToday=existing; return; }
        const windows=[{w:1,s:8,e:12},{w:2,s:12,e:16},{w:3,s:16,e:20}];
        seasonalBlocksToday = windows.map(({w,s,e})=>({
            block_date:today, seasonal_category:activeSeasonalCat,
            window_number:w, scheduled_hour:Math.floor(Math.random()*(e-s))+s, played:false
        }));
    } catch(err){ console.error(err); }
}

function shouldPlaySeasonalBlock() {
    if(!isSeasonalActive||seasonalBlockPlaying) return false;
    const h = new Date().getHours();
    if(h<8||h>=20) return false;
    return seasonalBlocksToday.some(b=>!b.played&&b.scheduled_hour===h);
}

function getNextSeasonalBlock() {
    const h = new Date().getHours();
    return seasonalBlocksToday.find(b=>!b.played&&b.scheduled_hour===h)||null;
}

function markBlockPlayed(wn) {
    const b=seasonalBlocksToday.find(b=>b.window_number===wn);
    if(b) b.played=true;
}

// ─────────────────────────────────────────────────────────────
// VINHETAS
// ─────────────────────────────────────────────────────────────
function pickJingle(list, last) {
    if(!list.length) return null;
    if(list.length===1) return list[0];
    const avail = list.filter(j=>j.id!==last);
    return avail[Math.floor(Math.random()*avail.length)];
}

function playJingle(position, cb) {
    let j=null;
    if(position==='opening'){ j=pickJingle(jinglesOpening,lastJingleOpening); if(j) lastJingleOpening=j.id; }
    else if(position==='middle'){ j=pickJingle(jinglesMiddle,lastJingleMiddle); if(j) lastJingleMiddle=j.id; }
    else if(position==='closing'){ j=pickJingle(jinglesClosing,lastJingleClosing); if(j) lastJingleClosing=j.id; }
    if(!j){ if(cb) cb(); return; }
    isPlayingJingle=true;
    audioPlayer.src=j.audio_url;
    updateDisplay('🎬 Vinheta', j.title);
    audioPlayer._jingleCb = cb;
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

function startGrade() {
    if(jinglesOpening.length>0 && !gradeOpeningDone) {
        gradeOpeningDone=true;
        playJingle('opening', ()=>{ playSlotAd(()=>{ scheduleMiddleJingles(); playSlotTrack(); }); });
    } else {
        playSlotAd(()=>{ scheduleMiddleJingles(); playSlotTrack(); });
    }
}

function scheduleMiddleJingles() {
    if(!jinglesMiddle.length) return;
    const now=Date.now(), end=gradeStartTime.getTime()+gradeDurationMs, rem=end-now;
    if(rem<=0) return;
    const third=rem/3;
    setTimeout(()=>{ if(!gradeMiddle1Done&&isGradeMode&&isPlaying){ gradeMiddle1Done=true; playJingle('middle',()=>playSlotTrack()); } }, third);
    setTimeout(()=>{ if(!gradeMiddle2Done&&isGradeMode&&isPlaying){ gradeMiddle2Done=true; playJingle('middle',()=>playSlotTrack()); } }, third*2);
}

// ─────────────────────────────────────────────────────────────
// REPRODUÇÃO MODO GRADE
// ─────────────────────────────────────────────────────────────
function playSlotTrack() {
    isPlayingJingle=false; isPlayingHourCerta=false; isPlayingAd=false;
    if(shouldPlaySeasonalBlock()){ const b=getNextSeasonalBlock(); if(b){ startSeasonalBlock(b); return; } }
    if(!slotPlaylist.length){ playBgMusic(); return; }
    const freq=(advertisements[slotAdIndex%Math.max(advertisements.length,1)]?.frequency)||3;
    if(advertisements.length>0 && slotTracksSinceAd>=freq){
        playSlotAd(()=>playSlotMusicTrack()); return;
    }
    playSlotMusicTrack();
}

function playSlotMusicTrack() {
    if(!slotPlaylist.length){ playBgMusic(); return; }
    const track = slotPlaylist[slotCurrentIndex % slotPlaylist.length];
    if(!track?.audio_url){ playBgMusic(); return; }
    // Pula músicas na blacklist
    if(isBlacklisted(track.audio_url)) {
        slotCurrentIndex = (slotCurrentIndex + 1) % Math.max(slotPlaylist.length, 1);
        playSlotMusicTrack(); return;
    }
    audioPlayer.src = track.audio_url;
    updateDisplay(currentSlot?`🎵 ${currentSlot.name}`:'Tocando agora', track.title||'Música');
    slotTracksSinceAd++;
    logAnalytics(track, 'slot_playlists', currentSlot?.id, currentSlot?.name);
    savePlaybackState(); // salva posição a cada troca de música
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

function getEligibleAds() {
    const h = new Date().getHours();
    return advertisements.filter(ad => {
        if (!ad.enabled) return false;
        if (ad.start_hour != null && h < ad.start_hour) return false;
        if (ad.end_hour   != null && h > ad.end_hour)   return false;
        return true;
    });
}

function playSlotAd(cb) {
    const eligible = getEligibleAds();
    if(!eligible.length){ if(cb) cb(); return; }
    isPlayingAd=true; slotTracksSinceAd=0;
    const ad = eligible[slotAdIndex % eligible.length];
    slotAdIndex = (slotAdIndex+1) % Math.max(eligible.length,1);
    if(!ad?.audio_url){ if(cb) cb(); return; }
    audioPlayer.src=ad.audio_url; audioPlayer._adCb=cb;
    updateDisplay('📢 Propaganda', ad.title);
    logAdPlay(ad); // registra no histórico
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

// ─────────────────────────────────────────────────────────────
// REPRODUÇÃO MODO LEGADO (bg playlist)
// ─────────────────────────────────────────────────────────────
function playBgMusic() {
    isPlayingJingle=false; isPlayingHourCerta=false; isPlayingAd=false;
    const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
    const ads      = isSeasonalActive ? seasonalAds      : advertisements;
    if(!playlist.length){ handleNoAudio(); return; }
    const freq = (ads[currentAdIndex%Math.max(ads.length,1)]?.frequency)||3;
    if(ads.length>0 && tracksPlayedSinceAd>=freq){ playLegacyAd(); return; }
    const track = playlist[currentBgIndex%playlist.length];
    if(!track?.audio_url){ handleNoAudio(); return; }
    // Pula músicas na blacklist
    if(isBlacklisted(track.audio_url)) {
        currentBgIndex = (currentBgIndex + 1) % Math.max(playlist.length, 1);
        playBgMusic(); return;
    }
    audioPlayer.src=track.audio_url;
    updateDisplay(isSeasonalActive?'🎭 Especial':'Tocando agora', track.title||'Música');
    tracksPlayedSinceAd++;
    logAnalytics(track, isSeasonalActive?'seasonal_playlists':'background_playlist', null, isSeasonalActive?activeSeasonalCat:'Fundo');
    savePlaybackState(); // salva posição a cada troca de música
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

function playLegacyAd() {
    const allAds = isSeasonalActive ? seasonalAds : getEligibleAds();
    if(!allAds.length){ playBgMusic(); return; }
    isPlayingAd=true; tracksPlayedSinceAd=0;
    const ad=allAds[currentAdIndex%allAds.length];
    currentAdIndex=(currentAdIndex+1)%Math.max(allAds.length,1);
    if(!ad?.audio_url){ playBgMusic(); return; }
    audioPlayer.src=ad.audio_url;
    updateDisplay('📢 Propaganda', ad.title);
    logAdPlay(ad); // registra no histórico
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

// ─────────────────────────────────────────────────────────────
// BLOCOS SAZONAIS — reprodução
// ─────────────────────────────────────────────────────────────
async function startSeasonalBlock(block) {
    seasonalBlockPlaying=true; seasonalBlockIndex=0;
    const pool=[...seasonalPlaylist]; seasonalBlockQueue=[];
    for(let i=0;i<4&&pool.length>0;i++){ const idx=Math.floor(Math.random()*pool.length); seasonalBlockQueue.push(pool.splice(idx,1)[0]); }
    if(!seasonalBlockQueue.length){ seasonalBlockPlaying=false; markBlockPlayed(block.window_number); playSlotTrack(); return; }
    const sj = await loadSeasonalJingles(activeSeasonalCat);
    if(sj.opening.length>0){
        const j=sj.opening[Math.floor(Math.random()*sj.opening.length)];
        audioPlayer.src=j.audio_url; updateDisplay('🎭 Especial',j.title);
        audioPlayer._seasonalBlock=block; audioPlayer._seasonalJingles=sj;
        if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
    } else { playSeasonalTrack(block); }
}

function playSeasonalTrack(block) {
    if(seasonalBlockIndex>=seasonalBlockQueue.length){
        seasonalBlockPlaying=false; markBlockPlayed(block.window_number);
        audioPlayer._seasonalBlock=null;
        const sj=audioPlayer._seasonalJingles;
        if(sj?.closing?.length>0){
            const j=sj.closing[Math.floor(Math.random()*sj.closing.length)];
            audioPlayer.src=j.audio_url; updateDisplay('🎭 Especial',j.title);
            audioPlayer._afterSeasonal=true;
            if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
        } else { playSlotTrack(); }
        return;
    }
    const track=seasonalBlockQueue[seasonalBlockIndex++];
    audioPlayer.src=track.audio_url; audioPlayer._seasonalBlock=block;
    updateDisplay('🎭 Especial Sazonal', track.title||'Música Temática');
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

// ─────────────────────────────────────────────────────────────
// HORA CERTA
// ─────────────────────────────────────────────────────────────
async function loadCurrentHourAudio() {
    const now=new Date(), hour=now.getHours(), min=now.getMinutes();
    try {
        const data=allSchedules.find(s=>s.hour===hour&&s.enabled);
        if(!data){ resumeAfterHourCerta(); return; }
        const isExact=min<=2, isHalf=min>=30&&min<=32;
        const slotStr=isExact?`${hour}:00`:`${hour}:30`;
        if(lastPlayedSlot===slotStr){ resumeAfterHourCerta(); return; }
        if(isExact&&data.audio_url?.trim()){
            isPlayingHourCerta=true; audioPlayer.src=data.audio_url;
            updateDisplay('Hora Certa',`${String(hour).padStart(2,'0')}:00`);
            lastPlayedSlot=slotStr;
            if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
        } else if(isHalf&&data.audio_url_half?.trim()){
            isPlayingHourCerta=true; audioPlayer.src=data.audio_url_half;
            updateDisplay('Hora Certa',`${String(hour).padStart(2,'0')}:30`);
            lastPlayedSlot=slotStr;
            if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
        } else { resumeAfterHourCerta(); }
    } catch(err){ console.error(err); resumeAfterHourCerta(); }
}

// Versão silenciosa: apenas pré-carrega hora certa sem reproduzir (usada no boot)
async function loadCurrentHourAudioSilent() {
    const now=new Date(), hour=now.getHours(), min=now.getMinutes();
    try {
        const data=allSchedules.find(s=>s.hour===hour&&s.enabled);
        if(!data) return;
        const isExact=min<=2, isHalf=min>=30&&min<=32;
        const slotStr=isExact?`${hour}:00`:`${hour}:30`;
        if(lastPlayedSlot===slotStr) return;
        // Só marca pendente — a hora certa tocará quando o usuário der play
        if((isExact&&data.audio_url?.trim()) || (isHalf&&data.audio_url_half?.trim())) {
            lastPlayedSlot = null; // garante que tocará quando o play for pressionado
        }
    } catch(err){ console.error(err); }
}

function resumeAfterHourCerta() {
    if(isGradeMode&&slotPlaylist.length>0) playSlotTrack();
    else playBgMusic();
}

// ─────────────────────────────────────────────────────────────
// HANDLE AUDIO ENDED
// ─────────────────────────────────────────────────────────────
async function handleAudioEnded() {
    // Vinheta de grade
    if(isPlayingJingle){
        isPlayingJingle=false;
        const cb=audioPlayer._jingleCb; audioPlayer._jingleCb=null;
        if(cb) cb(); else playSlotTrack();
        return;
    }
    // Propaganda no modo grade
    if(isPlayingAd&&isGradeMode){
        isPlayingAd=false;
        const cb=audioPlayer._adCb; audioPlayer._adCb=null;
        if(cb) cb(); else playSlotMusicTrack();
        return;
    }
    // Vinheta abertura bloco sazonal
    if(audioPlayer._seasonalBlock&&!seasonalBlockPlaying){
        seasonalBlockPlaying=true; playSeasonalTrack(audioPlayer._seasonalBlock); return;
    }
    // Música do bloco sazonal
    if(audioPlayer._seasonalBlock&&seasonalBlockPlaying){
        playSeasonalTrack(audioPlayer._seasonalBlock); return;
    }
    // Encerramento bloco sazonal
    if(audioPlayer._afterSeasonal){
        audioPlayer._afterSeasonal=false; playSlotTrack(); return;
    }
    // Hora certa
    if(isPlayingHourCerta){
        isPlayingHourCerta=false;
        if(isGradeMode){
            slotCurrentIndex = (slotCurrentIndex + 1) % Math.max(slotPlaylist.length, 1);
            playSlotAd(()=>playSlotTrack());
        } else {
            const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
            currentBgIndex = (currentBgIndex + 1) % Math.max(playlist.length, 1);
            if((isSeasonalActive?seasonalAds:advertisements).length>0) playLegacyAd();
            else playBgMusic();
        }
        return;
    }
    // Propaganda legada
    if(isPlayingAd&&!isGradeMode){ isPlayingAd=false; playBgMusic(); return; }
    // Música da grade
    if(isGradeMode){
        const wasLast = slotCurrentIndex >= slotPlaylist.length - 1;
        slotCurrentIndex++;
        if(wasLast) {
            slotCurrentIndex = 0;
            await shufflePlaylistAfterComplete('slot_playlists', currentSlot?.id || null);
            await loadSlotPlaylist(currentSlot?.id);
        }
        playSlotTrack(); return;
    }
    // Música legada
    const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
    const wasLastBg = currentBgIndex >= playlist.length - 1;
    currentBgIndex++;
    if(wasLastBg) {
        currentBgIndex = 0;
        if(isSeasonalActive) {
            await shufflePlaylistAfterComplete('seasonal_playlists', null);
            const {data} = await supabase.from('seasonal_playlists')
                .select('*').eq('type','music').eq('enabled',true)
                .eq('category', activeSeasonalCat).order('daily_order',{ascending:true});
            seasonalPlaylist = data || [];
        } else {
            await shufflePlaylistAfterComplete('background_playlist', null);
            const {data} = await supabase.from('background_playlist')
                .select('*').eq('enabled',true).order('daily_order',{ascending:true});
            backgroundPlaylist = data || [];
        }
    }
    playBgMusic();
}

function handleAudioError() {
    console.error('Erro no áudio, avançando...');
    if(isGradeMode){ slotCurrentIndex=(slotCurrentIndex+1)%Math.max(slotPlaylist.length,1); setTimeout(playSlotTrack,1000); }
    else { currentBgIndex=(currentBgIndex+1)%Math.max(backgroundPlaylist.length,1); setTimeout(playBgMusic,1000); }
}

function handleNoAudio() { audioPlayer.src=''; updateDisplay('Sem programação','Aguardando áudio...'); }

// ─────────────────────────────────────────────────────────────
// SEASONAL STATUS CHECK
// ─────────────────────────────────────────────────────────────
async function checkSeasonalStatus() {
    try {
        const {data}=await supabase.from('seasonal_settings').select('*').eq('is_active',true).maybeSingle();
        const wasCat=activeSeasonalCat;
        if(data?.category){
            if(!isSeasonalActive||wasCat!==data.category){
                const [mRes,aRes]=await Promise.all([
                    supabase.from('seasonal_playlists').select('*').eq('type','music').eq('enabled',true).eq('category',data.category).order('daily_order',{ascending:true}),
                    supabase.from('seasonal_playlists').select('*').eq('type','ad').eq('enabled',true).eq('category',data.category).order('play_order',{ascending:true})
                ]);
                activeSeasonalCat=data.category; isSeasonalActive=true;
                seasonalPlaylist=mRes.data||[]; seasonalAds=aRes.data||[];
                currentBgIndex=0; currentAdIndex=0; tracksPlayedSinceAd=0;
                await ensureSeasonalBlocksToday();
                if(isPlaying&&!isPlayingHourCerta&&!isGradeMode) playBgMusic();
            }
        } else if(isSeasonalActive){
            isSeasonalActive=false; activeSeasonalCat=null;
            seasonalPlaylist=[]; seasonalAds=[]; seasonalBlocksToday=[];
            currentBgIndex=0; currentAdIndex=0; tracksPlayedSinceAd=0;
            if(isPlaying&&!isPlayingHourCerta&&!isGradeMode) playBgMusic();
        }
    } catch(err){ console.error(err); }
}

// ─────────────────────────────────────────────────────────────
// INTERFACE
// ─────────────────────────────────────────────────────────────
function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    volumeSlider.addEventListener('input', ()=>{ audioPlayer.volume=volumeSlider.value/100; });
    syncBtn.addEventListener('click', forceSync);
    audioPlayer.addEventListener('ended', handleAudioEnded);
    audioPlayer.addEventListener('error', handleAudioError);
}

function togglePlay() {
    if(isPlaying){
        audioPlayer.pause(); isPlaying=false; updatePlayButtonState(false);
    } else {
        if(silenceActivePlayer) {
            updateDisplay('🔇 Silêncio', 'Rádio pausada pelo admin'); return;
        }
        isPlaying=true; updatePlayButtonState(true);
        // Se não tem src, escolhe a música correta (posição restaurada ou início)
        if(!audioPlayer.src || audioPlayer.src === window.location.href) {
            // Verifica se há hora certa pendente para este momento
            const now=new Date(), hour=now.getHours(), min=now.getMinutes();
            const sched=allSchedules.find(s=>s.hour===hour&&s.enabled);
            const isExact=min<=2, isHalf=min>=30&&min<=32;
            if(sched && isExact && sched.audio_url?.trim()) {
                isPlayingHourCerta=true;
                const slotStr=`${hour}:00`;
                lastPlayedSlot=slotStr;
                audioPlayer.src=sched.audio_url;
                updateDisplay('Hora Certa',`${String(hour).padStart(2,'0')}:00`);
            } else if(sched && isHalf && sched.audio_url_half?.trim()) {
                isPlayingHourCerta=true;
                const slotStr=`${hour}:30`;
                lastPlayedSlot=slotStr;
                audioPlayer.src=sched.audio_url_half;
                updateDisplay('Hora Certa',`${String(hour).padStart(2,'0')}:30`);
            } else if(isGradeMode && slotPlaylist.length) {
                playSlotTrack();
            } else {
                playBgMusic();
            }
            return; // playSlotTrack/playBgMusic já chamam audioPlayer.play()
        }
        audioPlayer.play().catch(e=>{ console.error(e); isPlaying=false; updatePlayButtonState(false); });
    }
}

function updatePlayButtonState(playing) {
    if(!playBtn) return;
    const pi=playBtn.querySelector('.play-icon'), pa=playBtn.querySelector('.pause-icon');
    if(playing){ playBtn.classList.remove('paused'); playBtn.classList.add('playing'); if(pi) pi.style.display='none'; if(pa) pa.style.display='block'; }
    else { playBtn.classList.remove('playing'); playBtn.classList.add('paused'); if(pi) pi.style.display='block'; if(pa) pa.style.display='none'; }
}

function updateDisplay(status, track) { 
    if(statusText) statusText.textContent=status; 
    if(trackName) trackName.textContent=track; 
}

async function forceSync() {
    syncBtn.disabled=true; syncBtn.textContent='⏳ Sincronizando...';
    try {
        await loadAllData(); await detectAndActivateSlot(); await loadCurrentHourAudio();
        syncBtn.textContent='✅ Sincronizado!';
    } catch(e){ syncBtn.textContent='❌ Erro'; }
    finally { setTimeout(()=>{ syncBtn.textContent='🔄 Sincronizar'; syncBtn.disabled=false; },2000); }
}

function updateClock() {
    const now=new Date();
    const h=String(now.getHours()).padStart(2,'0'), m=String(now.getMinutes()).padStart(2,'0'), s=String(now.getSeconds()).padStart(2,'0');
    if(currentTime) currentTime.textContent=`${h}:${m}:${s}`;
    if(!countdownTimer) return;
    const min=now.getMinutes();
    let next=new Date(now);
    if(min<30) next.setMinutes(30,0,0); else next.setHours(now.getHours()+1,0,0,0);
    const diff=next-now;
    const ml=Math.floor(diff/60000), sl=Math.floor((diff%60000)/1000);
    if(countdownTimer) countdownTimer.textContent=`${String(ml).padStart(2,'0')}:${String(sl).padStart(2,'0')}`;
}

async function checkHourChange() {
    const now=new Date(), h=now.getHours(), min=now.getMinutes();
    if(min===0||min===30){
        const slot=`${h}:${min===0?'00':'30'}`;
        if(lastPlayedSlot!==slot){ lastPlayedSlot=null; await loadCurrentHourAudio(); }
    }
}

// ─────────────────────────────────────────────────────────────
// REALTIME
// ─────────────────────────────────────────────────────────────
function setupRealtimeSubscription() {
    supabase.channel('radio_player')
        .on('postgres_changes',{event:'*',schema:'public',table:'radio_schedule'},async()=>{
            const {data}=await supabase.from('radio_schedule').select('*').order('hour',{ascending:true});
            allSchedules=data||[]; await loadCurrentHourAudio();
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'background_playlist'},async()=>{
            const {data}=await supabase.from('background_playlist').select('*').eq('enabled',true).order('daily_order',{ascending:true});
            backgroundPlaylist=data||[];
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'advertisements'},async()=>{
            const {data}=await supabase.from('advertisements').select('*').eq('enabled',true).order('play_order',{ascending:true});
            advertisements=data||[];
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'seasonal_playlists'},()=>checkSeasonalStatus())
        .on('postgres_changes',{event:'*',schema:'public',table:'seasonal_settings'},()=>checkSeasonalStatus())
        .on('postgres_changes',{event:'*',schema:'public',table:'time_slots'},async()=>{
            const {data}=await supabase.from('time_slots').select('*').eq('enabled',true).order('sort_order',{ascending:true});
            timeSlots=data||[]; await detectAndActivateSlot();
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'slot_playlists'},async()=>{
            if(currentSlot) await loadSlotPlaylist(currentSlot.id);
        })
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'radio_settings'},async payload=>{
            gradesEnabled = payload.new?.grades_enabled !== false;
            await detectAndActivateSlot();
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'jingles'},async()=>{
            if(currentSlot) await loadSlotJingles(currentSlot.id);
        })
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'locutor_state'},payload=>handleLocutorStateChange(payload.new))
        .subscribe();
}

// ─────────────────────────────────────────────────────────────
// EMERGÊNCIA
// ─────────────────────────────────────────────────────────────
function initEmergencyListener() {
    supabase.channel('emergency_player')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_state'},
            payload => handleEmergencyChange(payload.new))
        .subscribe();
}

async function handleEmergencyChange(state) {
    if(state.is_active && !emergencyActive) {
        emergencyActive = true;
        if(isPlaying && audioPlayer.src) {
            audioPlayer.pause();
            playerPausedByEmergency = true;
        }
        updateDisplay('🚨 ALERTA', state.message || 'Atenção!');
        playEmergencyAlert(state);
    } else if(!state.is_active && emergencyActive) {
        emergencyActive = false;
        if(emergencyInterval) { clearInterval(emergencyInterval); emergencyInterval = null; }
        if(window.speechSynthesis) speechSynthesis.cancel();
        if(emergencyAudioEl) { emergencyAudioEl.pause(); emergencyAudioEl.src = ''; }
        if(playerPausedByEmergency && isPlaying) {
            playerPausedByEmergency = false;
            audioPlayer.play().catch(e => console.error(e));
        } else { playerPausedByEmergency = false; }
    }
}

function speakTTS(text, onEnd) {
    if(!window.speechSynthesis) { if(onEnd) onEnd(); return; }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'pt-BR'; utt.rate = 0.88; utt.pitch = 1.05; utt.volume = 1;
    const voices = speechSynthesis.getVoices();
    const best = voices.find(v => v.name.includes('Francisca'))
        || voices.find(v => v.name.includes('Google') && v.lang === 'pt-BR')
        || voices.find(v => v.lang === 'pt-BR')
        || voices.find(v => v.lang.startsWith('pt'));
    if(best) utt.voice = best;
    if(onEnd) utt.onend = onEnd;
    speechSynthesis.speak(utt);
}

function playEmergencyAlert(state) {
    const doPlay = () => {
        if(!emergencyActive) return;
        if(state.use_tts !== false && state.message) {
            speakTTS(state.message, () => { if(emergencyActive) setTimeout(doPlay, 2000); });
        } else if(state.audio_url) {
            emergencyAudioEl.src = state.audio_url;
            emergencyAudioEl.play().catch(e => console.error(e));
            emergencyAudioEl.onended = () => { if(emergencyActive) setTimeout(doPlay, 1000); };
        }
    };
    doPlay();
}

// ─────────────────────────────────────────────────────────────
// LOCUTOR AO VIVO (MICROFONE)
// ─────────────────────────────────────────────────────────────
function initLiveLocutorListener() {
    liveLocutorChannel = supabase.channel('live_locutor_player')
        .on('broadcast', { event: 'live_audio_chunk' }, payload => {
            handleLiveAudioChunk(payload.payload);
        })
        .on('broadcast', { event: 'live_locutor_start' }, () => {
            if(isPlaying && audioPlayer.src) {
                audioPlayer.pause();
                playerPausedByLoc = true;
                playerResumePos = audioPlayer.currentTime;
                updateDisplay('🎙️ Ao Vivo', 'Locutor transmitindo...');
            }
        })
        .on('broadcast', { event: 'live_locutor_stop' }, () => {
            if(playerPausedByLoc && isPlaying) {
                playerPausedByLoc = false;
                audioPlayer.currentTime = playerResumePos;
                audioPlayer.play().catch(e => console.error(e));
            } else { playerPausedByLoc = false; }
        })
        .subscribe();
}

function handleLiveAudioChunk(payload) {
    if(!payload?.chunk) return;
    try {
        if(!liveAudioCtx) liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const binary = atob(payload.chunk);
        const bytes  = new Uint8Array(binary.length);
        for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
        liveAudioCtx.decodeAudioData(bytes.buffer, buf => {
            const src = liveAudioCtx.createBufferSource();
            src.buffer = buf;
            src.connect(liveAudioCtx.destination);
            src.start(0);
        });
    } catch(err) { /* chunk inválido */ }
}

// ─────────────────────────────────────────────────────────────
// LOCUTOR (PRÉ-GRAVADO)
// ─────────────────────────────────────────────────────────────
function initLocutorListener() {
    supabase.channel('locutor_player')
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'locutor_state'},payload=>handleLocutorStateChange(payload.new))
        .subscribe();
}

async function handleLocutorStateChange(state) {
    if(state.is_active){
        if(isPlaying&&audioPlayer.src){ playerResumePos=audioPlayer.currentTime; playerPausedByLoc=true; audioPlayer.pause(); updateDisplay('🎙️ Locutor','Ao vivo...'); }
        if(state.track_id){
            const {data}=await supabase.from('locutor_tracks').select('audio_url,title').eq('id',state.track_id).single();
            if(data){ locutorAudio.src=data.audio_url; locutorAudio.volume=audioPlayer.volume; locutorAudio.play().catch(e=>console.error(e)); updateDisplay('🎙️ Locutor',data.title); }
        }
    } else {
        locutorAudio.pause(); locutorAudio.src='';
        if(playerPausedByLoc&&isPlaying){ playerPausedByLoc=false; audioPlayer.currentTime=playerResumePos; audioPlayer.play().catch(e=>console.error(e)); }
        else { playerPausedByLoc=false; }
    }
}

// ─────────────────────────────────────────────────────────────
// TTS
// ─────────────────────────────────────────────────────────────
function initTTSListener() {
    supabase.channel('tts_player')
        .on('broadcast',{event:'tts_play'},payload=>handleTTSPlay(payload.payload))
        .subscribe();
}

function handleTTSPlay(data) {
    if(!data?.text) return;
    let wasPaused = false;
    if(isPlaying && audioPlayer.src) {
        playerResumePos = audioPlayer.currentTime;
        wasPaused = true;
        audioPlayer.pause();
        updateDisplay('📢 Aviso', data.title || 'Promoção');
    }

    const onEnd = () => {
        if(wasPaused && isPlaying) {
            audioPlayer.currentTime = playerResumePos;
            audioPlayer.play().catch(e => console.error(e));
        }
    };

    speakTTS(data.text, onEnd);
}

// ─────────────────────────────────────────────────────────────
// SUGESTÃO DE MÚSICAS
// ─────────────────────────────────────────────────────────────
function initSuggest() {
    const inp=document.getElementById('suggestSearchInput');
    const btn=document.getElementById('suggestSearchBtn');
    if(!inp||!btn) return;
    loadSuggestCount();
    btn.addEventListener('click', handleSuggestSearch);
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter') handleSuggestSearch(); });
    document.getElementById('suggestConfirmBtn')?.addEventListener('click', handleSuggestConfirm);
    document.getElementById('suggestCancelBtn')?.addEventListener('click',()=>{
        document.getElementById('suggestNameModal').style.display='none';
        suggestPendingItem=null;
    });
}

async function loadSuggestCount() {
    const id=getSuggestId(), today=new Date().toISOString().split('T')[0];
    try {
        const {data}=await supabase.from('suggestion_limits').select('count').eq('identifier',id).eq('suggestion_date',today).maybeSingle();
        suggestCountToday=data?.count||0; updateSuggestBadge();
    } catch(e){ console.error(e); }
}

function getSuggestId() {
    let id=localStorage.getItem('radio_suggest_id');
    if(!id){ id='user_'+Math.random().toString(36).substr(2,9); localStorage.setItem('radio_suggest_id',id); }
    return id;
}

function updateSuggestBadge() {
    const b=document.getElementById('suggestLimitBadge'); if(!b) return;
    b.textContent=`${suggestCountToday}/${SUGGEST_LIMIT} hoje`;
    b.style.background=suggestCountToday>=SUGGEST_LIMIT?'#f8d7da':'#d4edda';
    b.style.color=suggestCountToday>=SUGGEST_LIMIT?'#721c24':'#155724';
}

async function handleSuggestSearch() {
    const query=document.getElementById('suggestSearchInput').value.trim(); if(!query) return;
    const btn=document.getElementById('suggestSearchBtn'); btn.textContent='⏳'; btn.disabled=true;
    const resultsEl=document.getElementById('suggestResults'); resultsEl.style.display='block';
    resultsEl.innerHTML='<div class="suggest-loading">Buscando...</div>';
    try {
        const url=`https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=5&part=snippet&key=${YOUTUBE_API_KEY}`;
        const res=await fetch(url); const data=await res.json();
        if(!data.items?.length){ resultsEl.innerHTML='<div class="suggest-empty">Nenhum resultado.</div>'; return; }
        const filtered=data.items.filter(i=>!BLOCKED_TERMS.some(b=>i.snippet.title.toLowerCase().includes(b)));
        if(!filtered.length){ resultsEl.innerHTML='<div class="suggest-empty">Nenhum resultado adequado.</div>'; return; }
        resultsEl.innerHTML=filtered.map(item=>`
            <div class="suggest-result-card">
                <img src="${item.snippet.thumbnails?.default?.url||''}" alt="" class="suggest-result-thumb">
                <div class="suggest-result-info">
                    <div class="suggest-result-title">${item.snippet.title}</div>
                    <div class="suggest-result-channel">${item.snippet.channelTitle}</div>
                    <iframe id="preview_${item.id.videoId}" class="suggest-preview-frame" src="" allowfullscreen allow="autoplay" style="display:none;width:100%;aspect-ratio:16/9;border:none;border-radius:8px;margin-top:6px;"></iframe>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
                    <button class="suggest-preview-btn" data-id="${item.id.videoId}">▶️ Prévia</button>
                    <button class="suggest-btn" data-id="${item.id.videoId}" data-title="${item.snippet.title.replace(/"/g,'&quot;')}" data-channel="${item.snippet.channelTitle.replace(/"/g,'&quot;')}" data-thumb="${item.snippet.thumbnails?.default?.url||''}">💌 Sugerir</button>
                </div>
            </div>`).join('');

        resultsEl.querySelectorAll('.suggest-preview-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const vid = e.currentTarget.dataset.id;
                const frame = document.getElementById(`preview_${vid}`);
                if(!frame) return;
                if(frame.style.display === 'none') {
                    resultsEl.querySelectorAll('.suggest-preview-frame').forEach(f => {
                        f.src = ''; f.style.display = 'none';
                    });
                    resultsEl.querySelectorAll('.suggest-preview-btn').forEach(b => b.textContent = '▶️ Prévia');
                    frame.src = `https://www.youtube.com/embed/${vid}?autoplay=1`;
                    frame.style.display = 'block';
                    e.currentTarget.textContent = '⏹ Fechar';
                } else {
                    frame.src = ''; frame.style.display = 'none';
                    e.currentTarget.textContent = '▶️ Prévia';
                }
            });
        });
        resultsEl.querySelectorAll('.suggest-btn').forEach(b=>{
            b.addEventListener('click',e=>{
                const btn=e.currentTarget;
                openSuggestModal({videoId:btn.dataset.id,title:btn.dataset.title,channel:btn.dataset.channel,thumb:btn.dataset.thumb,url:`https://www.youtube.com/watch?v=${btn.dataset.id}`});
            });
        });
    } catch(err){ resultsEl.innerHTML='<div class="suggest-empty">Erro na busca.</div>'; }
    finally { btn.textContent='🔍 Buscar'; btn.disabled=false; }
}

function openSuggestModal(item) {
    if(suggestCountToday>=SUGGEST_LIMIT){ showSuggestFeedback('❌ Você atingiu o limite de 20 sugestões hoje.','error'); return; }
    suggestPendingItem=item;
    document.getElementById('suggestNameInput').value=localStorage.getItem('radio_suggest_name')||'';
    document.getElementById('suggestNameModal').style.display='flex';
    setTimeout(()=>document.getElementById('suggestNameInput').focus(),100);
}

async function handleSuggestConfirm() {
    const name=document.getElementById('suggestNameInput').value.trim();
    if(!name){ alert('Informe seu nome.'); return; }
    if(!suggestPendingItem) return;
    const btn=document.getElementById('suggestConfirmBtn'); btn.textContent='⏳'; btn.disabled=true;
    try {
        localStorage.setItem('radio_suggest_name',name);
        const {error}=await supabase.from('music_queue').insert([{youtube_url:suggestPendingItem.url,youtube_title:suggestPendingItem.title,youtube_channel:suggestPendingItem.channel,youtube_thumbnail:suggestPendingItem.thumb,title:suggestPendingItem.title,source:'suggestion',suggested_by:name,status:'pending',conversion_status:'pending'}]);
        if(error) throw error;
        const id=getSuggestId(), today=new Date().toISOString().split('T')[0];
        const {data:ex}=await supabase.from('suggestion_limits').select('id,count').eq('identifier',id).eq('suggestion_date',today).maybeSingle();
        if(ex) await supabase.from('suggestion_limits').update({count:ex.count+1}).eq('id',ex.id);
        else await supabase.from('suggestion_limits').insert([{identifier:id,suggestion_date:today,count:1}]);
        suggestCountToday++; updateSuggestBadge();
        const title=suggestPendingItem.title; suggestPendingItem=null;
        document.getElementById('suggestNameModal').style.display='none';
        document.getElementById('suggestResults').style.display='none';
        document.getElementById('suggestSearchInput').value='';
        showSuggestFeedback(`✅ Sugestão enviada! Você tem ${SUGGEST_LIMIT-suggestCountToday} restantes hoje.`,'success');
    } catch(err){ showSuggestFeedback('❌ Erro ao enviar. Tente novamente.','error'); }
    finally { btn.textContent='✅ Enviar'; btn.disabled=false; }
}

function showSuggestFeedback(msg,type) {
    const el=document.getElementById('suggestFeedback'); if(!el) return;
    el.textContent=msg; el.style.display='block';
    el.className=`suggest-feedback suggest-feedback-${type}`;
    setTimeout(()=>{ el.style.display='none'; },5000);
}

// ─────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ═════════════════════════════════════════════════════════════
// MODO SILÊNCIO — listener no player
// ═════════════════════════════════════════════════════════════
let silenceActivePlayer = false;
let playerPausedBySilence = false;

function initSilenceListener() {
    supabase.channel('silence_player')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'silence_state' },
            payload => handleSilenceChange(payload.new))
        .subscribe();
}

function handleSilenceChange(state) {
    if (state.is_active && !silenceActivePlayer) {
        silenceActivePlayer = true;
        if (isPlaying && audioPlayer.src) {
            audioPlayer.pause();
            playerPausedBySilence = true;
        }
        if (window.speechSynthesis) speechSynthesis.cancel();
        updateDisplay('🔇 Silêncio', state.reason || 'Modo silêncio ativo');
    } else if (!state.is_active && silenceActivePlayer) {
        silenceActivePlayer = false;
        if (playerPausedBySilence && isPlaying) {
            playerPausedBySilence = false;
            audioPlayer.play().catch(e => console.error(e));
        } else {
            playerPausedBySilence = false;
        }
    }
}

// ═════════════════════════════════════════════════════════════
// PROMOÇÃO RELÂMPAGO — listener e exibição de contagem no player
// ═════════════════════════════════════════════════════════════
let flashCountdownEl = null;
let flashTimerPlayer = null;

function initFlashListener() {
    supabase.channel('flash_player')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flash_state' },
            payload => handleFlashChange(payload.new))
        .subscribe();
    // Verifica estado inicial
    supabase.from('flash_state').select('*').eq('id', 1).single()
        .then(({ data }) => { if (data?.is_active) handleFlashChange(data); });
}

function handleFlashChange(state) {
    ensureFlashDisplay();
    if (state.is_active) {
        if (flashCountdownEl) {
            flashCountdownEl.style.display = 'block';
            updateFlashCountdown(state.ends_at ? new Date(state.ends_at) : null);
            if (state.ends_at) {
                if (flashTimerPlayer) clearInterval(flashTimerPlayer);
                flashTimerPlayer = setInterval(() => updateFlashCountdown(new Date(state.ends_at)), 1000);
            }
        }
    } else {
        if (flashCountdownEl) flashCountdownEl.style.display = 'none';
        if (flashTimerPlayer) { clearInterval(flashTimerPlayer); flashTimerPlayer = null; }
    }
}

function ensureFlashDisplay() {
    if (flashCountdownEl) return;
    // Cria banner de contagem regressiva no player
    flashCountdownEl = document.createElement('div');
    flashCountdownEl.id = 'flashPlayerBanner';
    flashCountdownEl.style.cssText = `
        display:none; position:fixed; top:0; left:0; right:0; z-index:999;
        background:linear-gradient(90deg,#f59e0b,#d97706);
        color:#fff; text-align:center; padding:10px 16px;
        font-family:'Sora',sans-serif; font-weight:700; font-size:15px;
        box-shadow:0 2px 8px rgba(0,0,0,.2);
    `;
    document.body.prepend(flashCountdownEl);
}

function updateFlashCountdown(endsAt) {
    if (!flashCountdownEl) return;
    const rem = endsAt ? Math.max(0, endsAt - new Date()) : 0;
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    flashCountdownEl.textContent = `⚡ PROMOÇÃO RELÂMPAGO — ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} restantes`;
    if (rem <= 0) {
        flashCountdownEl.style.display = 'none';
        if (flashTimerPlayer) { clearInterval(flashTimerPlayer); flashTimerPlayer = null; }
    }
}

// ═════════════════════════════════════════════════════════════
// BLACKLIST — verifica músicas antes de tocar
// ═════════════════════════════════════════════════════════════
let blacklistedUrls = new Set();

async function loadBlacklistPlayer() {
    try {
        const { data } = await supabase.from('music_blacklist').select('audio_url');
        blacklistedUrls = new Set((data || []).map(b => b.audio_url));
    } catch(err) { console.warn('blacklist:', err); }
}

function isBlacklisted(url) {
    return url && blacklistedUrls.has(url);
}

// ═════════════════════════════════════════════════════════════
// LOG DE PROPAGANDAS — registra cada propaganda tocada
// ═════════════════════════════════════════════════════════════
async function logAdPlay(ad) {
    try {
        await supabase.from('ad_log').insert([{
            ad_id:      ad.id       || null,
            title:      ad.title    || null,
            advertiser: ad.advertiser || null,
            audio_url:  ad.audio_url  || null,
            slot_name:  currentSlot?.name || (isGradeMode ? 'Grade' : 'Fundo')
        }]);
        // Atualiza contador e timestamp na tabela advertisements
        await supabase.from('advertisements').update({
            play_count:  (ad.play_count || 0) + 1,
            last_played: new Date().toISOString()
        }).eq('id', ad.id);
        ad.play_count = (ad.play_count || 0) + 1;
    } catch(err) { /* silencioso */ }
}
