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
let gradesEnabled     = true;   // controlado pelo botão no admin
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

// ── Blocos sazonais v2 ────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
async function init() {
    try {
        // Atribui elementos do DOM aqui — garantido que existem
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
        await loadCurrentHourAudio();
        await detectAndActivateSlot();
        // Embaralhamento por conclusão de playlist — não precisa verificar ao iniciar
        // Embaralhamento agora acontece ao completar a playlist — não por data
        initSuggest();
        initLocutorListener();
        initTTSListener();
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

        // grades_enabled vem da tabela radio_settings
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
// EMBARALHAMENTO — verifica mudança de dia ao iniciar e a cada 5min
// ─────────────────────────────────────────────────────────────
// ── Embaralhamento por conclusão de playlist ──────────────────
// Não embaralha mais por data/meia-noite.
// O embaralhamento acontece quando a ÚLTIMA música da lista toca.
// checkAndShuffleIfNewDay mantido vazio para não quebrar chamadas.
async function checkAndShuffleIfNewDay() { /* desativado */ }

async function shufflePlaylistAfterComplete(table, slotId) {
    if(isShuffling) return;
    isShuffling = true;
    try {
        let query = supabase.from(table).select('id').eq('enabled', true);
        if(slotId !== null) query = query.eq('slot_id', slotId);
        const {data: tracks} = await query;
        if(!tracks?.length) { isShuffling = false; return; }

        // Fisher-Yates shuffle
        const idx = [...Array(tracks.length).keys()];
        for(let i = idx.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [idx[i], idx[j]] = [idx[j], idx[i]];
        }

        // Salva nova ordem no banco em batches
        const BATCH = 50;
        for(let i = 0; i < tracks.length; i += BATCH) {
            const batch = tracks.slice(i, i + BATCH);
            await Promise.all(batch.map((t, bi) =>
                supabase.from(table).update({ daily_order: idx[i + bi] }).eq('id', t.id)
            ));
        }
        console.log(`🎲 Playlist embaralhada após completar: ${table} ${slotId||''}`);
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

async function loadSlotPlaylist(slotId) {
    const {data} = await supabase
        .from('slot_playlists').select('*')
        .eq('slot_id', slotId).eq('enabled', true)
        .order('daily_order', {ascending: true});
    slotPlaylist = data || [];
    // Não reseta índice — mantém posição atual se recarregar mid-play
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
    let j=null, lastRef=null;
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
    audioPlayer.src = track.audio_url;
    updateDisplay(currentSlot?`🎵 ${currentSlot.name}`:'Tocando agora', track.title||'Música');
    slotTracksSinceAd++;
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

function playSlotAd(cb) {
    if(!advertisements.length){ if(cb) cb(); return; }
    isPlayingAd=true; slotTracksSinceAd=0;
    const ad = advertisements[slotAdIndex%advertisements.length];
    slotAdIndex = (slotAdIndex+1)%Math.max(advertisements.length,1);
    if(!ad?.audio_url){ if(cb) cb(); return; }
    audioPlayer.src=ad.audio_url; audioPlayer._adCb=cb;
    updateDisplay('📢 Propaganda', ad.title);
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
    audioPlayer.src=track.audio_url;
    updateDisplay(isSeasonalActive?'🎭 Especial':'Tocando agora', track.title||'Música');
    tracksPlayedSinceAd++;
    if(isPlaying) audioPlayer.play().catch(e=>console.error(e));
}

function playLegacyAd() {
    const ads = isSeasonalActive ? seasonalAds : advertisements;
    if(!ads.length){ playBgMusic(); return; }
    isPlayingAd=true; tracksPlayedSinceAd=0;
    const ad=ads[currentAdIndex%ads.length];
    currentAdIndex=(currentAdIndex+1)%Math.max(ads.length,1);
    if(!ad?.audio_url){ playBgMusic(); return; }
    audioPlayer.src=ad.audio_url;
    updateDisplay('📢 Propaganda', ad.title);
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

function resumeAfterHourCerta() {
    if(isGradeMode&&slotPlaylist.length>0) playSlotTrack();
    else playBgMusic();
}

// ─────────────────────────────────────────────────────────────
// HANDLE AUDIO ENDED — roteamento central
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
        if(isGradeMode) playSlotAd(()=>playSlotTrack());
        else if((isSeasonalActive?seasonalAds:advertisements).length>0) playLegacyAd();
        else playBgMusic();
        return;
    }
    // Propaganda legada
    if(isPlayingAd&&!isGradeMode){ isPlayingAd=false; playBgMusic(); return; }
    // Música da grade — avança índice, embaralha ao completar
    if(isGradeMode){
        const wasLast = slotCurrentIndex >= slotPlaylist.length - 1;
        slotCurrentIndex++;
        if(wasLast) {
            // Chegou na última — embaralha e recomeça
            slotCurrentIndex = 0;
            await shufflePlaylistAfterComplete('slot_playlists', currentSlot?.id || null);
            await loadSlotPlaylist(currentSlot?.id);
        }
        playSlotTrack(); return;
    }
    // Música legada — avança índice, embaralha ao completar
    const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
    const wasLastBg = currentBgIndex >= playlist.length - 1;
    currentBgIndex++;
    if(wasLastBg) {
        currentBgIndex = 0;
        if(isSeasonalActive) {
            await shufflePlaylistAfterComplete('seasonal_playlists', null);
            // Recarrega playlist sazonal
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
    if(!audioPlayer.src) return;
    if(isPlaying){
        audioPlayer.pause(); isPlaying=false; updatePlayButtonState(false);
    } else {
        audioPlayer.play().then(()=>{ isPlaying=true; updatePlayButtonState(true); }).catch(e=>console.error(e));
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
// LOCUTOR
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

    const voiceName = data.voice || 'Brazilian Portuguese Female';

    const onEnd = () => {
        if(wasPaused && isPlaying) {
            audioPlayer.currentTime = playerResumePos;
            audioPlayer.play().catch(e => console.error(e));
        }
    };

    // ResponsiveVoice — mais natural
    if(window.responsiveVoice && responsiveVoice.voiceSupport()) {
        responsiveVoice.speak(data.text, voiceName, {
            rate: 0.9, pitch: 1, volume: 1,
            onend: onEnd
        });
        return;
    }

    // Fallback Web Speech API
    if(!window.speechSynthesis) { onEnd(); return; }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(data.text);
    utt.lang = 'pt-BR'; utt.rate = 0.88; utt.pitch = 1.05;
    const voices = speechSynthesis.getVoices();
    const fem = voices.find(v => v.lang.startsWith('pt') &&
        (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('feminina'))
    ) || voices.find(v => v.lang.startsWith('pt'));
    if(fem) utt.voice = fem;
    utt.onend = onEnd;
    speechSynthesis.speak(utt);
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
                </div>
                <button class="suggest-btn" data-id="${item.id.videoId}" data-title="${item.snippet.title.replace(/"/g,'&quot;')}" data-channel="${item.snippet.channelTitle.replace(/"/g,'&quot;')}" data-thumb="${item.snippet.thumbnails?.default?.url||''}">💌 Sugerir</button>
            </div>`).join('');
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
// BOOTSTRAP — garante que DOM existe antes de inicializar
// ─────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM já pronto (script carregado após o HTML)
    init();
}
