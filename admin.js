const SUPABASE_URL        = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';
const SUPABASE_SERVICE_KEY= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTU4NTM2NSwiZXhwIjoyMDc1MTYxMzY1fQ.rxDX7YsuxAvoMbImnk1Ovlj7YQ0WI_XwcTZUJpXKQYU';
const YOUTUBE_API_KEY     = 'AIzaSyCcpLnZ0XHsSEx34Zvkc80FwmHiHIqS6Gs';
const ADMIN_PASSWORD      = 'senhaDev';
const BLOCKED_TERMS       = ['funk','rock pesado','metal','punk','rap','trap'];

const supabase      = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Estado ────────────────────────────────────────────────────
let allSchedules=[], backgroundPlaylist=[], advertisements=[];
let timeSlots=[], slotPlaylists={}, slotJingles={};
let seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
let seasonalJingles={natal:[],ano_novo:[],pascoa:[],sao_joao:[]};
let seasonalSettings={};
let musicQueue=[], locutorTracks=[], ttsLibrary=[];
let currentSeasonalTab='natal', currentGradeTab=null;
let editingSeasonalId=null, editingPlaylistId=null, editingAdId=null;
let locutorSelectedId=null, locutorActive=false;
let ytManualData=null;
let bulkSelectedIds=[], bulkTableName=null, bulkTableType=null;
let ttsCheckInterval=null;

// ── Emergência ────────────────────────────────────────────────
let emergencyActive = false;

// ── Locutor ao vivo ───────────────────────────────────────────
let liveStream      = null;
let liveProcessor   = null;
let liveAudioCtx    = null;
let liveActive      = false;
let liveBroadcastCh = null;

// ── DOM ───────────────────────────────────────────────────────
const loginScreen  = document.getElementById('loginScreen');
const adminPanel   = document.getElementById('adminPanel');
const testAudio    = document.getElementById('testAudio');

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
init();

function init() {
    checkAuth();
    populateHourSelect();
    setupLoginListeners();
    setupSeasonalEventListeners();
    setupYouTubeListeners();
    setupGradesTabs();
    setupLocutorListeners();
    setupTTSListeners();
    setupBulkListeners();
    setupAdminSearchListeners();
    setupLiveLocutorListeners();
    setupEmergencyListeners();
}

function checkAuth() {
    if (sessionStorage.getItem('radio_admin_auth')==='authenticated') {
        showAdminPanel(); loadAllData();
    } else { showLoginScreen(); }
}

function showLoginScreen() {
    loginScreen.style.display='flex'; adminPanel.style.display='none';
    document.getElementById('logoutBtn').style.display='none';
}
function showAdminPanel() {
    loginScreen.style.display='none'; adminPanel.style.display='block';
    document.getElementById('logoutBtn').style.display='block';
}

function setupLoginListeners() {
    document.getElementById('loginForm').addEventListener('submit', e => {
        e.preventDefault();
        const pw = document.getElementById('passwordInput').value;
        if (pw === ADMIN_PASSWORD) {
            sessionStorage.setItem('radio_admin_auth','authenticated');
            showAdminPanel(); loadAllData();
            document.getElementById('loginError').classList.remove('show');
        } else {
            document.getElementById('loginError').textContent='❌ Senha incorreta!';
            document.getElementById('loginError').classList.add('show');
            document.getElementById('passwordInput').value='';
        }
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('radio_admin_auth');
        showLoginScreen();
        document.getElementById('passwordInput').value='';
    });
    document.getElementById('editForm').addEventListener('submit', handleSaveSchedule);
    document.getElementById('testBtn').addEventListener('click', () => testAudioUrl(document.getElementById('audioUrl').value));
    document.getElementById('testBtnHalf').addEventListener('click', () => testAudioUrl(document.getElementById('audioUrlHalf').value));
    document.getElementById('clearBtn').addEventListener('click', handleClearForm);
    document.getElementById('hourSelect').addEventListener('change', e => { if(!isNaN(parseInt(e.target.value))) editSchedule(parseInt(e.target.value)); });
    document.getElementById('playlistForm').addEventListener('submit', handleSavePlaylist);
    document.getElementById('testPlaylistBtn').addEventListener('click', () => testAudioUrl(document.getElementById('playlistUrl').value));
    document.getElementById('clearPlaylistBtn').addEventListener('click', handleClearPlaylistForm);
    document.getElementById('forceShuffleBtn').addEventListener('click', handleForceShufflePlaylist);
    document.getElementById('adsForm').addEventListener('submit', handleSaveAd);
    document.getElementById('testAdBtn').addEventListener('click', () => testAudioUrl(document.getElementById('adUrl').value));
    document.getElementById('clearAdBtn').addEventListener('click', handleClearAdForm);
}

// ─────────────────────────────────────────────────────────────
// LOAD ALL DATA
// ─────────────────────────────────────────────────────────────
async function loadAllData() {
    try {
        const [schRes,plRes,adsRes,slotsRes,queueRes,
               smRes,saRes,ssRes,ltRes,ttsRes] = await Promise.all([
            supabase.from('radio_schedule').select('*').order('hour',{ascending:true}),
            supabase.from('background_playlist').select('*').order('original_order',{ascending:true}),
            supabase.from('advertisements').select('*').order('play_order',{ascending:true}),
            supabase.from('time_slots').select('*').order('sort_order',{ascending:true}),
            supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false}),
            supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
            supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true}),
            supabase.from('seasonal_settings').select('*'),
            supabase.from('locutor_tracks').select('*').order('created_at',{ascending:false}),
            supabase.from('tts_library').select('*').order('created_at',{ascending:false})
        ]);
        allSchedules=schRes.data||[]; backgroundPlaylist=plRes.data||[];
        advertisements=adsRes.data||[]; timeSlots=slotsRes.data||[];
        musicQueue=queueRes.data||[]; locutorTracks=ltRes.data||[];
        ttsLibrary=ttsRes.data||[];
        seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
        (smRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
        (saRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
        seasonalSettings={}; (ssRes.data||[]).forEach(s=>{seasonalSettings[s.category]=s;});
        await loadSlotData();
        await loadSeasonalJingles();
        renderAll();
        populateSlotSelects();
        await loadGradesState();
        await loadEmergencyState();
        setupRealtimeSubscription();
        startTTSScheduleChecker();
    } catch(err){ console.error('Erro ao carregar:',err); }
}

async function loadSlotData() {
    if(!timeSlots.length) return;
    const [plRes,jRes] = await Promise.all([
        supabase.from('slot_playlists').select('*').order('original_order',{ascending:true}),
        supabase.from('jingles').select('*').not('slot_id','is',null)
    ]);
    slotPlaylists={}; slotJingles={};
    timeSlots.forEach(s=>{slotPlaylists[s.id]=[]; slotJingles[s.id]=[];});
    (plRes.data||[]).forEach(t=>{if(slotPlaylists[t.slot_id])slotPlaylists[t.slot_id].push(t);});
    (jRes.data||[]).forEach(j=>{if(slotJingles[j.slot_id])slotJingles[j.slot_id].push(j);});
}

async function loadSeasonalJingles() {
    const {data}=await supabase.from('jingles').select('*').not('seasonal_category','is',null);
    seasonalJingles={natal:[],ano_novo:[],pascoa:[],sao_joao:[]};
    (data||[]).forEach(j=>{if(seasonalJingles[j.seasonal_category])seasonalJingles[j.seasonal_category].push(j);});
}

function renderAll() {
    renderScheduleTable(); renderPlaylistTable(); renderAdsTable();
    renderAllSeasonalTables(); renderSeasonalJinglesTables();
    updateSeasonalStatusBadges(); renderGradesTabs();
    renderQueueSection(); renderLocutorTracks(); renderTTSLibrary();
}

// ─────────────────────────────────────────────────────────────
// BUSCA ADMIN
// ─────────────────────────────────────────────────────────────
function setupAdminSearchListeners() {
    const inp = document.getElementById('adminSearchInput');
    const btn = document.getElementById('adminSearchBtn');
    if(!inp||!btn) return;
    btn.addEventListener('click', handleAdminSearch);
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter') handleAdminSearch(); });
}

async function handleAdminSearch() {
    const query = document.getElementById('adminSearchInput').value.trim();
    if(!query) return;
    const btn = document.getElementById('adminSearchBtn');
    btn.textContent='⏳'; btn.disabled=true;
    const resultsEl = document.getElementById('adminSearchResults');
    resultsEl.style.display='block';
    resultsEl.innerHTML='<div class="suggest-loading">Buscando...</div>';
    try {
        const url=`https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=8&part=snippet&key=${YOUTUBE_API_KEY}`;
        const res=await fetch(url); const data=await res.json();
        if(!data.items?.length){ resultsEl.innerHTML='<div class="suggest-empty">Nenhum resultado.</div>'; return; }
        const filtered=data.items.filter(i=>!BLOCKED_TERMS.some(b=>i.snippet.title.toLowerCase().includes(b)));
        resultsEl.innerHTML=filtered.map(item=>`
            <div class="suggest-result-card">
                <img src="${item.snippet.thumbnails?.default?.url||''}" alt="" class="suggest-result-thumb">
                <div class="suggest-result-info">
                    <div class="suggest-result-title">${item.snippet.title}</div>
                    <div class="suggest-result-channel">${item.snippet.channelTitle}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <button class="suggest-btn admin-search-queue-btn"
                        data-id="${item.id.videoId}"
                        data-title="${item.snippet.title.replace(/"/g,'&quot;')}"
                        data-channel="${item.snippet.channelTitle.replace(/"/g,'&quot;')}"
                        data-thumb="${item.snippet.thumbnails?.default?.url||''}">
                        ➕ Para Fila
                    </button>
                </div>
            </div>`).join('');
        resultsEl.querySelectorAll('.admin-search-queue-btn').forEach(b=>{
            b.addEventListener('click', async()=>{
                const slotSel = document.getElementById('ytSlotManual');
                await addToQueueFromSearch({
                    videoId:b.dataset.id, title:b.dataset.title,
                    channel:b.dataset.channel, thumb:b.dataset.thumb,
                    url:`https://www.youtube.com/watch?v=${b.dataset.id}`
                }, slotSel?.value||null, 'manual');
                b.textContent='✅ Adicionado'; b.disabled=true;
            });
        });
    } catch(err){ resultsEl.innerHTML='<div class="suggest-empty">Erro na busca.</div>'; }
    finally{ btn.textContent='🔍 Buscar'; btn.disabled=false; }
}

async function addToQueueFromSearch(item, slotValue, source) {
    await supabaseAdmin.from('music_queue').insert([{
        youtube_url:item.url, youtube_title:item.title,
        youtube_channel:item.channel, youtube_thumbnail:item.thumb,
        title:item.title, source,
        suggested_slot_id: slotValue&&slotValue!=='general'?parseInt(slotValue):null,
        status:'pending', conversion_status:'pending'
    }]);
    const {data}=await supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false});
    musicQueue=data||[]; renderQueueSection();
    showAdminFeedback('✅ Adicionado à fila de aprovação!','success');
}

function showAdminFeedback(msg, type) {
    const el=document.getElementById('adminSearchFeedback');
    if(!el) return;
    el.textContent=msg; el.style.display='block';
    el.className=`suggest-feedback suggest-feedback-${type}`;
    setTimeout(()=>{el.style.display='none';},4000);
}

// ─────────────────────────────────────────────────────────────
// FILA DE APROVAÇÃO — com prévia YouTube
// ─────────────────────────────────────────────────────────────
function renderQueueSection() {
    const badge=document.getElementById('queueBadge');
    const list=document.getElementById('queueList');
    if(!list) return;
    const pending=musicQueue.filter(m=>m.status==='pending');
    if(badge) badge.textContent=pending.length;
    const navBadge=document.getElementById('navQueueBadge');
    if(navBadge){ navBadge.textContent=pending.length; navBadge.style.display=pending.length>0?'inline-flex':'none'; }
    if(!pending.length) {
        list.innerHTML='<div class="queue-empty">✅ Nenhuma música aguardando aprovação.</div>';
        return;
    }
    list.innerHTML=pending.map(m=>`
        <div class="queue-card" id="qcard_${m.id}">
            <img class="queue-thumb" src="${m.youtube_thumbnail||''}" alt="" onerror="this.style.display='none'">
            <div class="queue-info">
                <div class="queue-title">${m.youtube_title||m.title||'Sem título'}</div>
                <div class="queue-meta">${m.youtube_channel||''}</div>
                <div class="queue-source">Origem: ${m.source==='manual'?'🔗 Manual':m.source==='auto'?'🤖 Automático':`💬 ${m.suggested_by||'Funcionário'}`}</div>
                <button class="queue-preview-btn" onclick="toggleYTPreview(${m.id},'${extractVideoId(m.youtube_url)}')">▶️ Ouvir Prévia</button>
                <iframe id="ytframe_${m.id}" class="queue-yt-embed" src="" allowfullscreen allow="autoplay"></iframe>
            </div>
            <div class="queue-actions">
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="font-size:11px;">Grade de destino:</label>
                    <select class="queue-slot-select" id="qslot_${m.id}">
                        <option value="">Selecione o destino</option>
                        <optgroup label="🕐 Grades Horárias">
                        ${timeSlots.filter(s=>s.name!=='Madrugada Aleatória').map(s=>
                            `<option value="slot_${s.id}" ${m.suggested_slot_id===s.id?'selected':''}>${s.name}</option>`
                        ).join('')}
                        </optgroup>
                        <optgroup label="🎭 Playlists Sazonais">
                        <option value="seasonal_natal">🎄 Natal</option>
                        <option value="seasonal_ano_novo">🎆 Ano-Novo</option>
                        <option value="seasonal_pascoa">🐰 Páscoa</option>
                        <option value="seasonal_sao_joao">🔥 São João</option>
                        </optgroup>
                        <optgroup label="🎵 Outros">
                        <option value="general">📋 Playlist Geral (Madrugada)</option>
                        </optgroup>
                    </select>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="submit-btn" style="flex:1;" onclick="approveQueueItem(${m.id})">✅ Aprovar</button>
                    <button class="btn-delete" style="flex:1;padding:8px;" onclick="rejectQueueItem(${m.id})">❌ Rejeitar</button>
                </div>
            </div>
        </div>`).join('');
}

function extractVideoId(url) {
    if(!url) return '';
    const m=url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m?m[1]:'';
}

function toggleYTPreview(id, videoId) {
    const frame=document.getElementById(`ytframe_${id}`);
    if(!frame||!videoId) return;
    if(frame.style.display==='block') {
        frame.src=''; frame.style.display='none';
    } else {
        frame.src=`https://www.youtube.com/embed/${videoId}?autoplay=1`;
        frame.style.display='block';
    }
}

async function approveQueueItem(id) {
    const item=musicQueue.find(m=>m.id===id);
    if(!item) return;
    const slotValue=document.getElementById(`qslot_${id}`)?.value;
    if(!slotValue){ alert('Selecione o destino antes de aprovar.'); return; }

    const isSeasonal = slotValue.startsWith('seasonal_');
    const isSlot     = slotValue.startsWith('slot_');
    const isGeneral  = slotValue === 'general';
    const slotId     = isSlot     ? parseInt(slotValue.replace('slot_',''))  : null;
    const seasonalCat= isSeasonal ? slotValue.replace('seasonal_','')        : null;

    const btn=document.querySelector(`#qcard_${id} .submit-btn`);
    if(btn){ btn.textContent='🔄 Buscando instância...'; btn.disabled=true; }
    const updateStatus = (msg) => { if(btn) btn.textContent=msg; };

    try {
        let audioUrl = item.audio_url || null;
        if(!audioUrl) {
            updateStatus('🎵 Convertendo MP3...');
            audioUrl = await convertYoutubeToMp3(item.youtube_url, item.youtube_title);
        }
        if(audioUrl && audioUrl.includes('cloudinary')) updateStatus('☁️ Upload feito!');
        else if(audioUrl && !audioUrl.includes('youtube')) updateStatus('✅ Convertido!');
        if(!audioUrl) { audioUrl = item.youtube_url; updateStatus('⚠️ Usando link YouTube...'); }

        const convDone = audioUrl && !audioUrl.includes('youtube.com');
        await supabaseAdmin.from('music_queue').update({
            status:'approved',
            conversion_status: convDone ? 'done' : 'pending',
            audio_url: audioUrl,
            suggested_slot_id: isGeneral ? null : (isSlot ? slotId : null)
        }).eq('id',id);

        let order = 0;
        if(isSlot) {
            const {data:maxD} = await supabase.from('slot_playlists')
                .select('original_order').eq('slot_id', slotId)
                .order('original_order',{ascending:false}).limit(1).maybeSingle();
            order = (maxD?.original_order ?? -1) + 1;
            const {data:dupD} = await supabase.from('slot_playlists')
                .select('id,title').eq('slot_id', slotId).eq('audio_url', audioUrl).maybeSingle();
            if(dupD){ alert(`⚠️ Esta música já está na grade!\n"${dupD.title}"`); if(btn){btn.textContent='✅ Aprovar';btn.disabled=false;} return; }
        } else if(isGeneral) {
            const {data:maxD} = await supabase.from('background_playlist')
                .select('original_order').order('original_order',{ascending:false}).limit(1).maybeSingle();
            order = (maxD?.original_order ?? -1) + 1;
            const {data:dupD} = await supabase.from('background_playlist')
                .select('id,title').eq('audio_url', audioUrl).maybeSingle();
            if(dupD){ alert(`⚠️ Esta música já está na playlist geral!\n"${dupD.title}"`); if(btn){btn.textContent='✅ Aprovar';btn.disabled=false;} return; }
        }

        const trackTitle  = item.title||item.youtube_title||'Música';
        const trackArtist = item.youtube_channel||null;

        if(isSlot) {
            await supabaseAdmin.from('slot_playlists').insert([{
                slot_id: slotId, audio_url: audioUrl,
                title: trackTitle, artist: trackArtist,
                original_order: order, daily_order: order, enabled: true
            }]);
            await refreshSlotPlaylist(slotId);
        } else if(isSeasonal) {
            const {data:maxD} = await supabase.from('seasonal_playlists')
                .select('original_order').eq('category', seasonalCat).eq('type','music')
                .order('original_order',{ascending:false}).limit(1).maybeSingle();
            order = (maxD?.original_order ?? -1) + 1;
            await supabaseAdmin.from('seasonal_playlists').insert([{
                category: seasonalCat, type: 'music',
                audio_url: audioUrl, title: trackTitle,
                play_order: order, original_order: order,
                daily_order: order, enabled: true
            }]);
            const [mRes,aRes] = await Promise.all([
                supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
                supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})
            ]);
            seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
            (mRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
            (aRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
            renderAllSeasonalTables();
            alert(`✅ Música adicionada à playlist de ${seasonalCat.replace('_',' ')}!`);
        } else {
            await supabaseAdmin.from('background_playlist').insert([{
                audio_url: audioUrl, title: trackTitle,
                play_order: order, original_order: order, daily_order: order, enabled: true
            }]);
            const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true});
            backgroundPlaylist=data||[]; renderPlaylistTable();
        }

        musicQueue=musicQueue.filter(m=>m.id!==id);
        renderQueueSection();
        alert('✅ Música aprovada e adicionada!');
    } catch(err){ alert('❌ Erro ao aprovar: '+err.message); if(btn){btn.textContent='✅ Aprovar';btn.disabled=false;} }
}

// ─────────────────────────────────────────────────────────────
// COBALT — converte YouTube → MP3
// ─────────────────────────────────────────────────────────────
async function getCobaltInstance() {
    try {
        const res = await fetch('https://instances.cobalt.best/instances.json', {
            headers: { 'User-Agent': 'RadioLouro/1.0 (+https://supermercadodolouro.com.br)' }
        });
        const data = await res.json();
        const valid = data.filter(inst =>
            inst.online?.api === true &&
            inst.services?.youtube === true &&
            inst.cors === true &&
            inst.trust >= 1 &&
            inst.score >= 50
        ).sort((a, b) => b.score - a.score);
        if (!valid.length) throw new Error('Nenhuma instância disponível');
        return `${valid[0].protocol}://${valid[0].api}`;
    } catch(err) {
        console.warn('Erro ao buscar instância Cobalt:', err);
        return null;
    }
}

async function convertYoutubeToMp3(youtubeUrl, title) {
    try {
        const instance = await getCobaltInstance();
        if (!instance) throw new Error('Sem instância Cobalt disponível');
        const res = await fetch(instance, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'RadioLouro/1.0' },
            body: JSON.stringify({ url: youtubeUrl, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '192' })
        });
        const data = await res.json();
        if(data.status === 'tunnel' || data.status === 'redirect') {
            const cloudUrl = await uploadToCloudinary(data.url, title);
            return cloudUrl || data.url;
        }
        throw new Error(`Cobalt retornou: ${data.status}`);
    } catch(err) { console.warn('Conversão MP3 falhou:', err); return null; }
}

async function uploadToCloudinary(mp3Url, title) {
    try {
        const formData = new FormData();
        formData.append('file', mp3Url);
        formData.append('upload_preset', 'radio_louro_preset');
        formData.append('folder', 'radio_louro');
        formData.append('tags', 'radio_louro');
        const res = await fetch('https://api.cloudinary.com/v1_1/dygbrcrr6/video/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if(data.secure_url) return data.secure_url;
        if(data.error) {
            const fd2 = new FormData();
            fd2.append('file', mp3Url); fd2.append('upload_preset', 'ml_default'); fd2.append('folder', 'radio_louro');
            const res2 = await fetch('https://api.cloudinary.com/v1_1/dygbrcrr6/video/upload', { method: 'POST', body: fd2 });
            const data2 = await res2.json();
            if(data2.secure_url) return data2.secure_url;
        }
        return null;
    } catch(err) { console.error('Upload Cloudinary falhou:', err); return null; }
}

async function rejectQueueItem(id) {
    if(!confirm('Rejeitar esta música?')) return;
    await supabaseAdmin.from('music_queue').update({status:'rejected'}).eq('id',id);
    musicQueue=musicQueue.filter(m=>m.id!==id);
    renderQueueSection();
}

// ─────────────────────────────────────────────────────────────
// LOCUTOR
// ─────────────────────────────────────────────────────────────
function setupLocutorListeners() {
    document.getElementById('locutorPlayBtn')?.addEventListener('click', handleLocutorToggle);
    document.getElementById('locutorForm')?.addEventListener('submit', handleSaveLocutorTrack);
    document.getElementById('locutorTestBtn')?.addEventListener('click', ()=>testAudioUrl(document.getElementById('locutorUrl').value));
    document.getElementById('locutorClearBtn')?.addEventListener('click', ()=>{
        document.getElementById('locutorTitle').value='';
        document.getElementById('locutorDesc').value='';
        document.getElementById('locutorUrl').value='';
    });
    supabase.channel('locutor_admin')
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'locutor_state'}, payload=>{
            locutorActive=payload.new.is_active;
            updateLocutorUI();
        }).subscribe();
}

function renderLocutorTracks() {
    const list=document.getElementById('locutorTracksList');
    if(!list) return;
    if(!locutorTracks.filter(t=>t.enabled).length) {
        list.innerHTML='<div style="color:#999;font-size:13px;padding:10px;">Nenhuma locução cadastrada.</div>';
        return;
    }
    list.innerHTML=locutorTracks.filter(t=>t.enabled).map(t=>`
        <div class="locutor-track-card ${locutorSelectedId===t.id?'selected':''}" onclick="selectLocutorTrack(${t.id})">
            <div class="locutor-track-select-dot"></div>
            <div style="flex:1;">
                <div class="locutor-track-name">${t.title}</div>
                ${t.description?`<div class="locutor-track-desc">${t.description}</div>`:''}
            </div>
            <button class="btn-delete" onclick="event.stopPropagation();deleteLocutorTrack(${t.id})">🗑️</button>
        </div>`).join('');
    const btn=document.getElementById('locutorPlayBtn');
    if(btn) btn.disabled = !locutorSelectedId;
}

function selectLocutorTrack(id) {
    locutorSelectedId = locutorSelectedId===id ? null : id;
    renderLocutorTracks();
    const btn=document.getElementById('locutorPlayBtn');
    if(btn) btn.disabled=!locutorSelectedId;
}

async function handleLocutorToggle() {
    if(locutorActive) {
        await supabaseAdmin.from('locutor_state').update({
            is_active:false, track_id:null, updated_at:new Date().toISOString()
        }).eq('id',1);
        locutorActive=false;
    } else {
        if(!locutorSelectedId){ alert('Selecione uma locução primeiro.'); return; }
        await supabaseAdmin.from('locutor_state').update({
            is_active:true, track_id:locutorSelectedId,
            started_at:new Date().toISOString(), updated_at:new Date().toISOString()
        }).eq('id',1);
        locutorActive=true;
    }
    updateLocutorUI();
}

function updateLocutorUI() {
    const ind=document.getElementById('locutorIndicator');
    const txt=document.getElementById('locutorStatusText');
    const btn=document.getElementById('locutorPlayBtn');
    if(!ind||!txt||!btn) return;
    if(locutorActive) {
        ind.classList.add('active');
        const track=locutorTracks.find(t=>t.id===locutorSelectedId);
        txt.textContent=`🔴 Ao vivo: ${track?.title||'Locutor'}`;
        btn.textContent='⏹️ Encerrar Locutor'; btn.classList.add('active');
    } else {
        ind.classList.remove('active');
        txt.textContent='Locutor inativo — selecione uma locução abaixo';
        btn.textContent='🎙️ Iniciar Locutor'; btn.classList.remove('active');
        btn.disabled=!locutorSelectedId;
    }
}

async function handleSaveLocutorTrack(e) {
    e.preventDefault();
    const title=document.getElementById('locutorTitle').value.trim();
    const desc =document.getElementById('locutorDesc').value.trim();
    const url  =document.getElementById('locutorUrl').value.trim();
    if(!title||!url){ alert('Preencha título e URL.'); return; }
    try {
        const {error}=await supabaseAdmin.from('locutor_tracks').insert([{title,description:desc||null,audio_url:url,enabled:true}]);
        if(error) throw error;
        alert('✅ Locução salva!');
        document.getElementById('locutorTitle').value='';
        document.getElementById('locutorDesc').value='';
        document.getElementById('locutorUrl').value='';
        const {data}=await supabase.from('locutor_tracks').select('*').order('created_at',{ascending:false});
        locutorTracks=data||[]; renderLocutorTracks();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

async function deleteLocutorTrack(id) {
    if(!confirm('Deletar esta locução?')) return;
    await supabaseAdmin.from('locutor_tracks').delete().eq('id',id);
    if(locutorSelectedId===id) locutorSelectedId=null;
    const {data}=await supabase.from('locutor_tracks').select('*').order('created_at',{ascending:false});
    locutorTracks=data||[]; renderLocutorTracks();
}

// ─────────────────────────────────────────────────────────────
// LOCUTOR AO VIVO — microfone em tempo real
// ─────────────────────────────────────────────────────────────
function setupLiveLocutorListeners() {
    document.getElementById('liveLocutorBtn')?.addEventListener('click', startLiveLocutor);
}

async function startLiveLocutor() {
    if(liveActive) { stopLiveLocutor(); return; }
    try {
        liveStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = liveAudioCtx.createMediaStreamSource(liveStream);
        liveProcessor = liveAudioCtx.createScriptProcessor(4096, 1, 1);

        liveBroadcastCh = supabase.channel('live_locutor_admin');
        await liveBroadcastCh.subscribe();
        await liveBroadcastCh.send({ type:'broadcast', event:'live_locutor_start', payload:{} });

        liveProcessor.onaudioprocess = async (e) => {
            if(!liveActive) return;
            const inputData  = e.inputBuffer.getChannelData(0);
            const outputData = e.outputBuffer.getChannelData(0);
            outputData.set(inputData);
            const buf  = new ArrayBuffer(inputData.length * 2);
            const view = new DataView(buf);
            for(let i=0;i<inputData.length;i++) view.setInt16(i*2, Math.max(-1,Math.min(1,inputData[i]))*0x7FFF, true);
            const bytes = new Uint8Array(buf);
            let binary = '';
            for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
            const chunk = btoa(binary);
            await liveBroadcastCh.send({ type:'broadcast', event:'live_audio_chunk', payload:{ chunk } });
        };

        source.connect(liveProcessor);
        liveProcessor.connect(liveAudioCtx.destination);
        liveActive = true;
        updateLiveLocutorUI(true);
    } catch(err) {
        alert('❌ Não foi possível acessar o microfone: ' + err.message);
    }
}

async function stopLiveLocutor() {
    liveActive = false;
    if(liveProcessor) { liveProcessor.disconnect(); liveProcessor = null; }
    if(liveAudioCtx)  { await liveAudioCtx.close(); liveAudioCtx = null; }
    if(liveStream)    { liveStream.getTracks().forEach(t => t.stop()); liveStream = null; }
    if(liveBroadcastCh) {
        await liveBroadcastCh.send({ type:'broadcast', event:'live_locutor_stop', payload:{} });
        supabase.removeChannel(liveBroadcastCh);
        liveBroadcastCh = null;
    }
    updateLiveLocutorUI(false);
}

function updateLiveLocutorUI(active) {
    const btn = document.getElementById('liveLocutorBtn');
    const ind = document.getElementById('liveLocutorIndicator');
    const txt = document.getElementById('liveLocutorStatus');
    if(!btn) return;
    if(active) {
        btn.textContent = '⏹️ Parar Transmissão';
        btn.classList.add('active');
        if(ind) ind.classList.add('active');
        if(txt) txt.textContent = '🔴 Transmitindo ao vivo...';
    } else {
        btn.textContent = '🎙️ Iniciar ao vivo';
        btn.classList.remove('active');
        if(ind) ind.classList.remove('active');
        if(txt) txt.textContent = 'Inativo';
    }
}

// ─────────────────────────────────────────────────────────────
// TTS
// ─────────────────────────────────────────────────────────────
function setupTTSListeners() {
    const textarea=document.getElementById('ttsTextInput');
    if(textarea) textarea.addEventListener('input', ()=>{
        document.getElementById('ttsCharCount').textContent=textarea.value.length;
    });
    document.getElementById('ttsPlayNowBtn')?.addEventListener('click', handleTTSPlayNow);
    document.getElementById('ttsSaveBtn')?.addEventListener('click', handleTTSSave);
    document.getElementById('ttsVoiceTestBtn')?.addEventListener('click', ()=>{
        speakLocally('Olá! Esta é uma demonstração da voz selecionada. Bem-vindo ao Supermercado do Louro!');
    });
    document.getElementById('ttsClearBtn')?.addEventListener('click', ()=>{
        document.getElementById('ttsTextInput').value='';
        document.getElementById('ttsTitleInput').value='';
        document.getElementById('ttsCharCount').textContent='0';
        document.getElementById('ttsScheduleTime').value='';
        document.querySelectorAll('.tts-day-check').forEach(c=>c.checked=false);
    });
}

function renderTTSLibrary() {
    const grid=document.getElementById('ttsLibraryGrid');
    if(!grid) return;
    if(!ttsLibrary.filter(t=>t.enabled).length) {
        grid.innerHTML='<div style="color:#999;font-size:13px;padding:10px;">Nenhum texto salvo.</div>';
        return;
    }
    const catIcons={promocao:'🏷️',aviso:'📣',saudacao:'👋',encerramento:'🌙',geral:'📝'};
    grid.innerHTML=ttsLibrary.filter(t=>t.enabled).map(t=>`
        <div class="tts-lib-card" onclick="loadTTSText(${t.id})">
            <div class="tts-lib-title">${t.title}</div>
            <div class="tts-lib-preview">${t.text_content}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
                <span class="tts-lib-category">${catIcons[t.category]||'📝'} ${t.category}</span>
                <div style="display:flex;gap:4px;">
                    <button class="suggest-btn" style="font-size:10px;padding:4px 8px;" onclick="event.stopPropagation();playTTSFromLib(${t.id})">🔊 Falar</button>
                    <button class="btn-delete" style="padding:4px 6px;font-size:11px;" onclick="event.stopPropagation();deleteTTSItem(${t.id})">🗑️</button>
                </div>
            </div>
            ${t.scheduled_time?`<div style="font-size:10px;color:#888;margin-top:4px;">⏰ ${t.scheduled_time} — ${t.auto_enabled?'✅ Agendado':'⏸️ Pausado'}</div>`:''}
        </div>`).join('');
}

function loadTTSText(id) {
    const item=ttsLibrary.find(t=>t.id===id);
    if(!item) return;
    document.getElementById('ttsTextInput').value=item.text_content;
    document.getElementById('ttsTitleInput').value=item.title;
    document.getElementById('ttsCategoryInput').value=item.category||'geral';
    document.getElementById('ttsCharCount').textContent=item.text_content.length;
    if(item.scheduled_time) document.getElementById('ttsScheduleTime').value=item.scheduled_time.substring(0,5);
    document.getElementById('ttsTextInput').focus();
}

async function playTTSFromLib(id) {
    const item=ttsLibrary.find(t=>t.id===id);
    if(!item) return;
    await dispatchTTS(item.text_content, item.title);
    await supabaseAdmin.from('tts_library').update({
        last_played_at:new Date().toISOString(),
        play_count:(item.play_count||0)+1
    }).eq('id',id);
    item.play_count=(item.play_count||0)+1;
}

async function handleTTSPlayNow() {
    const text=document.getElementById('ttsTextInput').value.trim();
    const title=document.getElementById('ttsTitleInput').value.trim()||'Aviso';
    if(!text){ alert('Digite o texto antes de falar.'); return; }
    const btn=document.getElementById('ttsPlayNowBtn');
    btn.textContent='🔊 Falando...'; btn.disabled=true;
    try {
        await dispatchTTS(text, title);
        setTimeout(()=>{ btn.textContent='🔊 Falar Agora'; btn.disabled=false; }, 3000);
    } catch(err){ alert('❌ Erro: '+err.message); btn.textContent='🔊 Falar Agora'; btn.disabled=false; }
}

async function dispatchTTS(text, title) {
    await supabase.channel('tts_broadcast').send({
        type:'broadcast', event:'tts_play', payload:{ text, title }
    });
    speakLocally(text);
}

function speakLocally(text, onEnd) {
    const voiceSelect = document.getElementById('ttsVoiceSelect');
    const voiceName = voiceSelect ? voiceSelect.value : 'Brazilian Portuguese Female';
    if(window.responsiveVoice && responsiveVoice.voiceSupport()) {
        responsiveVoice.speak(text, voiceName, { rate:0.9, pitch:1, volume:1, onend:onEnd||null });
        return;
    }
    if(!window.speechSynthesis) { if(onEnd) onEnd(); return; }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang='pt-BR'; utt.rate=0.88; utt.pitch=1.05;
    const voices=speechSynthesis.getVoices();
    const isFem=voiceName.toLowerCase().includes('female');
    const match=voices.find(v=>v.lang.startsWith('pt')&&(isFem?(v.name.toLowerCase().includes('female')||v.name.toLowerCase().includes('feminina')):(v.name.toLowerCase().includes('male')&&!v.name.toLowerCase().includes('female'))))||voices.find(v=>v.lang.startsWith('pt'));
    if(match) utt.voice=match;
    if(onEnd) utt.onend=onEnd;
    speechSynthesis.speak(utt);
}

async function handleTTSSave() {
    const text=document.getElementById('ttsTextInput').value.trim();
    const title=document.getElementById('ttsTitleInput').value.trim();
    const category=document.getElementById('ttsCategoryInput').value;
    const schedTime=document.getElementById('ttsScheduleTime').value;
    const days=[...document.querySelectorAll('.tts-day-check:checked')].map(c=>c.value);
    if(!text||!title){ alert('Preencha título e texto.'); return; }
    try {
        const payload={ title, text_content:text, category, scheduled_time:schedTime||null, scheduled_days:days.length?days:null, auto_enabled:!!(schedTime&&days.length), enabled:true };
        const {error}=await supabaseAdmin.from('tts_library').insert([payload]);
        if(error) throw error;
        alert('✅ Texto salvo na biblioteca!');
        const {data}=await supabase.from('tts_library').select('*').order('created_at',{ascending:false});
        ttsLibrary=data||[]; renderTTSLibrary();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

async function deleteTTSItem(id) {
    if(!confirm('Deletar este texto?')) return;
    await supabaseAdmin.from('tts_library').delete().eq('id',id);
    ttsLibrary=ttsLibrary.filter(t=>t.id!==id); renderTTSLibrary();
}

function startTTSScheduleChecker() {
    if(ttsCheckInterval) clearInterval(ttsCheckInterval);
    ttsCheckInterval=setInterval(checkTTSSchedule, 30000);
}

function checkTTSSchedule() {
    const now=new Date();
    const currentDay=String(now.getDay());
    const currentTime=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    ttsLibrary.filter(t=>t.enabled&&t.auto_enabled&&t.scheduled_time&&t.scheduled_days).forEach(t=>{
        const tTime=t.scheduled_time.substring(0,5);
        if(tTime===currentTime && t.scheduled_days.includes(currentDay)) {
            const lastPlayed=t.last_played_at?new Date(t.last_played_at):null;
            const diffMin=lastPlayed?(now-lastPlayed)/60000:999;
            if(diffMin>2) playTTSFromLib(t.id);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// SELEÇÃO EM MASSA
// ─────────────────────────────────────────────────────────────
function setupBulkListeners() {
    document.getElementById('bulkActivateBtn')?.addEventListener('click',   ()=>executeBulk('activate'));
    document.getElementById('bulkDeactivateBtn')?.addEventListener('click', ()=>executeBulk('deactivate'));
    document.getElementById('bulkDeleteBtn')?.addEventListener('click',     ()=>executeBulk('delete'));
    document.getElementById('bulkCancelBtn')?.addEventListener('click',     clearBulkSelection);
    document.addEventListener('change', e=>{
        if(e.target.classList.contains('bulk-select-all')) {
            const tableId=e.target.dataset.table;
            const tbody=document.getElementById(tableId);
            if(!tbody) return;
            tbody.querySelectorAll('.row-checkbox').forEach(cb=>{ cb.checked=e.target.checked; });
            updateBulkBar(tableId);
        }
        if(e.target.classList.contains('row-checkbox')) {
            const tbody=e.target.closest('tbody');
            if(tbody) updateBulkBar(tbody.id);
        }
    });
}

function updateBulkBar(tableId) {
    const tbody=document.getElementById(tableId);
    if(!tbody) return;
    const checked=[...tbody.querySelectorAll('.row-checkbox:checked')];
    bulkSelectedIds=checked.map(cb=>parseInt(cb.dataset.id));
    bulkTableName=tableId;
    const bar=document.getElementById('bulkBar');
    const count=document.getElementById('bulkCount');
    if(bulkSelectedIds.length>0) {
        bar.classList.add('visible');
        count.textContent=`${bulkSelectedIds.length} selecionada${bulkSelectedIds.length>1?'s':''}`;
    } else { bar.classList.remove('visible'); }
}

function clearBulkSelection() {
    document.querySelectorAll('.row-checkbox,.bulk-select-all').forEach(cb=>cb.checked=false);
    bulkSelectedIds=[]; bulkTableName=null;
    document.getElementById('bulkBar').classList.remove('visible');
}

async function executeBulk(action) {
    if(!bulkSelectedIds.length) return;
    const count=bulkSelectedIds.length;
    if(action==='delete'&&!confirm(`Deletar ${count} item${count>1?'s':''}?`)) return;
    let tableName='background_playlist';
    if(bulkTableName==='playlistTableBody')         tableName='background_playlist';
    else if(bulkTableName?.startsWith('tableMusic')||bulkTableName?.startsWith('tableMusicS')) tableName='seasonal_playlists';
    else if(bulkTableName?.includes('Slot'))        tableName='slot_playlists';
    try {
        if(action==='activate')   await Promise.all(bulkSelectedIds.map(id=>supabaseAdmin.from(tableName).update({enabled:true}).eq('id',id)));
        if(action==='deactivate') await Promise.all(bulkSelectedIds.map(id=>supabaseAdmin.from(tableName).update({enabled:false}).eq('id',id)));
        if(action==='delete')     await Promise.all(bulkSelectedIds.map(id=>supabaseAdmin.from(tableName).delete().eq('id',id)));
        alert(`✅ ${count} item${count>1?'s':''} ${action==='activate'?'ativado(s)':action==='deactivate'?'desativado(s)':'deletado(s)'}!`);
        clearBulkSelection();
        await refreshTableAfterBulk(tableName);
    } catch(err){ alert('❌ Erro: '+err.message); }
}

async function refreshTableAfterBulk(tableName) {
    if(tableName==='background_playlist') {
        const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true});
        backgroundPlaylist=data||[]; renderPlaylistTable();
    } else if(tableName==='seasonal_playlists') {
        const [mRes,aRes]=await Promise.all([
            supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
            supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})
        ]);
        seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
        (mRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
        (aRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
        renderAllSeasonalTables();
    } else if(tableName==='slot_playlists') {
        await loadSlotData();
        if(currentGradeTab) renderGradeContent(currentGradeTab);
    }
}

// ─────────────────────────────────────────────────────────────
// GRADES HORÁRIAS
// ─────────────────────────────────────────────────────────────
function setupGradesTabs() {
    document.getElementById('gradesTabs')?.addEventListener('click', e=>{
        const btn=e.target.closest('.grade-tab');
        if(!btn) return;
        switchGradeTab(parseInt(btn.dataset.slotId));
    });
}

function renderGradesTabs() {
    const tabsEl=document.getElementById('gradesTabs');
    const contentEl=document.getElementById('gradesContent');
    if(!timeSlots.length){ tabsEl.innerHTML=''; contentEl.innerHTML='<div class="grade-empty">Nenhuma grade.</div>'; return; }
    tabsEl.innerHTML=timeSlots.map(s=>`
        <button class="grade-tab${currentGradeTab===s.id?' active':''}" data-slot-id="${s.id}" style="border-bottom-color:${s.color}">
            <span class="grade-tab-dot" style="background:${s.color}"></span>${s.name}
            <span class="grade-tab-count">${(slotPlaylists[s.id]||[]).length}</span>
        </button>`).join('');
    if(!currentGradeTab&&timeSlots.length) currentGradeTab=timeSlots[0].id;
    renderGradeContent(currentGradeTab);
}

function switchGradeTab(slotId) {
    currentGradeTab=slotId;
    document.querySelectorAll('.grade-tab').forEach(t=>t.classList.toggle('active',parseInt(t.dataset.slotId)===slotId));
    renderGradeContent(slotId);
}

function renderGradeContent(slotId) {
    const slot=timeSlots.find(s=>s.id===slotId);
    if(!slot) return;
    const playlist=slotPlaylists[slotId]||[];
    const jingles=slotJingles[slotId]||[];
    const opening=jingles.filter(j=>j.position==='opening');
    const middle=jingles.filter(j=>j.position==='middle');
    const closing=jingles.filter(j=>j.position==='closing');
    const contentEl=document.getElementById('gradesContent');
    contentEl.innerHTML=`
        <div class="grade-panel">
            <div class="grade-panel-header" style="border-left:4px solid ${slot.color}">
                <div>
                    <div class="grade-panel-name">${slot.name}</div>
                    <div class="grade-panel-info">${String(slot.start_hour).padStart(2,'0')}h – ${String(slot.end_hour).padStart(2,'0')}h · ${slot.genres||'Sem gêneros'}</div>
                </div>
                <div class="grade-panel-stats">
                    <span class="grade-stat">${playlist.filter(t=>t.enabled).length} músicas</span>
                    <span class="grade-stat">${jingles.filter(j=>j.enabled).length} vinhetas</span>
                </div>
            </div>
            <div class="grade-subsection">
                <h4>🎵 Músicas — ${slot.name}</h4>
                <form class="edit-form" id="formSlotPlaylist_${slotId}">
                    <div class="form-group"><label>URL:</label><input type="url" id="slotUrl_${slotId}" placeholder="https://res.cloudinary.com/..." required></div>
                    <div class="form-group"><label>Título:</label><input type="text" id="slotTitle_${slotId}" placeholder="Ex: Terra Roxa" required></div>
                    <div class="form-group"><label>Artista:</label><input type="text" id="slotArtist_${slotId}" placeholder="Ex: Chitãozinho e Xororó"></div>
                    <div class="form-group"><label>Gênero:</label><input type="text" id="slotGenre_${slotId}" placeholder="Ex: Sertanejo raiz"></div>
                    <div class="form-group" style="display:none;"><label>Ordem:</label><input type="number" id="slotOrder_${slotId}" value="0" min="0"></div>
                    <div class="form-actions">
                        <button type="submit" class="submit-btn">💾 Adicionar</button>
                        <button type="button" class="test-btn" onclick="testAudioUrl(document.getElementById('slotUrl_${slotId}').value)">▶️ Testar</button>
                        <button type="button" class="clear-btn" onclick="clearSlotForm(${slotId})">🗑️ Limpar</button>
                    </div>
                </form>
                <div class="table-container">
                    <table class="schedule-table">
                        <thead><tr>
                            <th><input type="checkbox" class="bulk-select-all" data-table="tableSlotPlaylist_${slotId}"></th>
                            <th>Ordem</th><th>Dia 🎲</th><th>Título</th><th>Artista</th><th>Status</th><th>Ações</th>
                        </tr></thead>
                        <tbody id="tableSlotPlaylist_${slotId}"></tbody>
                    </table>
                </div>
                <div class="shuffle-box"><h4>🎲 Embaralhamento</h4><p>Automático ao completar a playlist.</p><button class="test-btn" onclick="handleForceShuffleSlot(${slotId})">🎲 Forçar Agora</button></div>
            </div>
            <div class="grade-subsection">
                <h4>🎬 Vinhetas — ${slot.name}</h4>
                <form class="edit-form" id="formSlotJingle_${slotId}">
                    <div class="form-group"><label>URL:</label><input type="url" id="jingleUrl_${slotId}" placeholder="https://res.cloudinary.com/..." required></div>
                    <div class="form-group"><label>Título:</label><input type="text" id="jingleTitle_${slotId}" placeholder="Ex: Vinheta Manhã 1" required></div>
                    <div class="form-group"><label>Posição:</label>
                        <select id="jinglePos_${slotId}">
                            <option value="opening">🎬 Abertura (1× ao iniciar)</option>
                            <option value="middle">🎬 Meio (2× durante a grade)</option>
                            <option value="closing">🎬 Encerramento (1× ao finalizar)</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-btn">💾 Adicionar Vinheta</button>
                        <button type="button" class="test-btn" onclick="testAudioUrl(document.getElementById('jingleUrl_${slotId}').value)">▶️ Testar</button>
                        <button type="button" class="clear-btn" onclick="clearJingleForm(${slotId})">🗑️ Limpar</button>
                    </div>
                </form>
                <div class="jingles-grid">
                    <div class="jingle-col"><div class="jingle-col-title">🎬 Abertura (${opening.length})</div>${renderJingleRows(opening,slotId)}</div>
                    <div class="jingle-col"><div class="jingle-col-title">🎬 Meio (${middle.length})</div>${renderJingleRows(middle,slotId)}</div>
                    <div class="jingle-col"><div class="jingle-col-title">🎬 Encerramento (${closing.length})</div>${renderJingleRows(closing,slotId)}</div>
                </div>
            </div>
        </div>`;
    document.getElementById(`formSlotPlaylist_${slotId}`)?.addEventListener('submit',e=>handleSaveSlotTrack(e,slotId));
    document.getElementById(`formSlotJingle_${slotId}`)?.addEventListener('submit',e=>handleSaveSlotJingle(e,slotId));
    renderSlotPlaylistTable(slotId);
}

function renderJingleRows(list,slotId) {
    if(!list.length) return '<div style="color:#999;font-size:12px;padding:8px;">Nenhuma vinheta</div>';
    return list.map(j=>`
        <div class="jingle-row">
            <span class="jingle-row-title">${j.title}</span>
            <span class="status-badge ${j.enabled?'active':'inactive'}" style="font-size:10px;">${j.enabled?'✅':'❌'}</span>
            <div class="action-btns">
                <button class="btn-toggle" onclick="toggleJingle(${j.id},${!j.enabled},${slotId})">${j.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete" onclick="deleteJingle(${j.id},${slotId})">🗑️</button>
            </div>
        </div>`).join('');
}

function renderSlotPlaylistTable(slotId) {
    const tbody=document.getElementById(`tableSlotPlaylist_${slotId}`);
    if(!tbody) return;
    const tracks=slotPlaylists[slotId]||[];
    if(!tracks.length){ tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">Nenhuma música nesta grade.</td></tr>`; return; }
    tbody.innerHTML=tracks.map(t=>`
        <tr>
            <td><input type="checkbox" class="row-checkbox" data-id="${t.id}"></td>
            <td style="font-weight:bold;color:#666;">${t.original_order}</td>
            <td><span style="padding:4px 10px;background:#e3f2fd;border-radius:12px;font-weight:bold;color:#1976d2;font-size:11px;">🎲 ${t.daily_order}</span></td>
            <td style="font-weight:500;">${t.title}</td>
            <td style="color:#666;">${t.artist||'-'}</td>
            <td><span class="status-badge ${t.enabled?'active':'inactive'}">${t.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td><div class="action-btns">
                <button class="btn-edit slot-edit-btn" data-id="${t.id}" data-slot="${slotId}">✏️</button>
                <button class="btn-toggle slot-toggle-btn" data-id="${t.id}" data-enabled="${t.enabled}" data-slot="${slotId}">${t.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete slot-delete-btn" data-id="${t.id}" data-slot="${slotId}">🗑️</button>
            </div></td>
        </tr>`).join('');
    tbody.querySelectorAll('.slot-edit-btn').forEach(b=>b.addEventListener('click',()=>editSlotTrack(parseInt(b.dataset.id),parseInt(b.dataset.slot))));
    tbody.querySelectorAll('.slot-toggle-btn').forEach(b=>b.addEventListener('click',()=>toggleSlotTrack(parseInt(b.dataset.id),b.dataset.enabled!=='true',parseInt(b.dataset.slot))));
    tbody.querySelectorAll('.slot-delete-btn').forEach(b=>b.addEventListener('click',()=>deleteSlotTrack(parseInt(b.dataset.id),parseInt(b.dataset.slot))));
}

async function handleSaveSlotTrack(e,slotId) {
    e.preventDefault();
    const url=document.getElementById(`slotUrl_${slotId}`).value.trim();
    const title=document.getElementById(`slotTitle_${slotId}`).value.trim();
    const artist=document.getElementById(`slotArtist_${slotId}`).value.trim();
    const genre=document.getElementById(`slotGenre_${slotId}`).value.trim();
    if(!url||!title){ alert('Preencha URL e Título!'); return; }
    try {
        const {data:existing} = await supabase.from('slot_playlists').select('id,title').eq('slot_id',slotId).eq('audio_url',url).maybeSingle();
        if(existing) { alert(`⚠️ Esta música já está na grade!\n"${existing.title}"`); return; }
        const {data:maxData} = await supabase.from('slot_playlists').select('original_order').eq('slot_id',slotId).order('original_order',{ascending:false}).limit(1).maybeSingle();
        const nextOrder = (maxData?.original_order ?? -1) + 1;
        const {error}=await supabaseAdmin.from('slot_playlists').insert([{ slot_id:slotId, audio_url:url, title, artist:artist||null, genre:genre||null, original_order:nextOrder, daily_order:nextOrder, enabled:true }]);
        if(error) throw error;
        alert(`✅ Música adicionada! Numeração: ${nextOrder}`);
        clearSlotForm(slotId);
        await refreshSlotPlaylist(slotId);
    } catch(err){ alert('❌ Erro: '+err.message); }
}

function editSlotTrack(id,slotId) {
    const t=(slotPlaylists[slotId]||[]).find(t=>t.id===id);
    if(!t) return;
    document.getElementById(`slotUrl_${slotId}`).value=t.audio_url;
    document.getElementById(`slotTitle_${slotId}`).value=t.title;
    document.getElementById(`slotArtist_${slotId}`).value=t.artist||'';
    document.getElementById(`slotGenre_${slotId}`).value=t.genre||'';
    document.getElementById(`slotOrder_${slotId}`).value=t.original_order;
}

async function toggleSlotTrack(id,newStatus,slotId) {
    await supabaseAdmin.from('slot_playlists').update({enabled:newStatus}).eq('id',id);
    await refreshSlotPlaylist(slotId);
}

async function deleteSlotTrack(id,slotId) {
    if(!confirm('Deletar?')) return;
    await supabaseAdmin.from('slot_playlists').delete().eq('id',id);
    await refreshSlotPlaylist(slotId);
}

function clearSlotForm(slotId) {
    ['slotUrl','slotTitle','slotArtist','slotGenre'].forEach(f=>document.getElementById(`${f}_${slotId}`).value='');
    document.getElementById(`slotOrder_${slotId}`).value='0';
}

async function handleForceShuffleSlot(slotId) {
    if(!confirm('Embaralhar esta grade agora?')) return;
    const {data:tracks}=await supabaseAdmin.from('slot_playlists').select('id').eq('slot_id',slotId).eq('enabled',true);
    if(!tracks?.length){ alert('Nenhuma música ativa.'); return; }
    const idx=[...Array(tracks.length).keys()];
    for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]];}
    const today=new Date().toISOString().split('T')[0];
    await Promise.all(tracks.map((t,i)=>supabaseAdmin.from('slot_playlists').update({daily_order:idx[i],last_shuffle_date:today}).eq('id',t.id)));
    alert('✅ Embaralhado!');
    await refreshSlotPlaylist(slotId);
}

async function refreshSlotPlaylist(slotId) {
    const {data}=await supabase.from('slot_playlists').select('*').eq('slot_id',slotId).order('original_order',{ascending:true});
    slotPlaylists[slotId]=data||[];
    renderSlotPlaylistTable(slotId); renderGradesTabs();
}

async function handleSaveSlotJingle(e,slotId) {
    e.preventDefault();
    const url=document.getElementById(`jingleUrl_${slotId}`).value.trim();
    const title=document.getElementById(`jingleTitle_${slotId}`).value.trim();
    const position=document.getElementById(`jinglePos_${slotId}`).value;
    const {error}=await supabaseAdmin.from('jingles').insert([{slot_id:slotId,position,audio_url:url,title,enabled:true}]);
    if(error){ alert('❌ Erro: '+error.message); return; }
    alert('✅ Vinheta adicionada!'); clearJingleForm(slotId);
    await refreshSlotJingles(slotId);
}

async function toggleJingle(id,newStatus,slotId) {
    await supabaseAdmin.from('jingles').update({enabled:newStatus}).eq('id',id);
    await refreshSlotJingles(slotId);
}

async function deleteJingle(id,slotId) {
    if(!confirm('Deletar vinheta?')) return;
    await supabaseAdmin.from('jingles').delete().eq('id',id);
    await refreshSlotJingles(slotId);
}

function clearJingleForm(slotId) {
    document.getElementById(`jingleUrl_${slotId}`).value='';
    document.getElementById(`jingleTitle_${slotId}`).value='';
}

async function refreshSlotJingles(slotId) {
    const {data}=await supabase.from('jingles').select('*').eq('slot_id',slotId);
    slotJingles[slotId]=data||[]; renderGradeContent(slotId);
}

// ─────────────────────────────────────────────────────────────
// YOUTUBE
// ─────────────────────────────────────────────────────────────
function populateSlotSelects() {
    const slotOptions =
        '<option value="">Selecione o destino</option>' +
        '<optgroup label="🕐 Grades Horárias">' +
        timeSlots.filter(s=>s.name!=='Madrugada Aleatória').map(s=>`<option value="slot_${s.id}">${s.name}</option>`).join('') +
        '</optgroup>' +
        '<optgroup label="🎭 Playlists Sazonais">' +
        '<option value="seasonal_natal">🎄 Natal</option>' +
        '<option value="seasonal_ano_novo">🎆 Ano-Novo</option>' +
        '<option value="seasonal_pascoa">🐰 Páscoa</option>' +
        '<option value="seasonal_sao_joao">🔥 São João</option>' +
        '</optgroup>' +
        '<optgroup label="🎵 Outros">' +
        '<option value="general">📋 Playlist Geral (Madrugada)</option>' +
        '</optgroup>';
    ['ytSlotManual','ytSlotAuto'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.innerHTML=slotOptions; });
}

function setupYouTubeListeners() {
    document.querySelectorAll('.yt-tab').forEach(btn=>btn.addEventListener('click',()=>{
        document.querySelectorAll('.yt-tab').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.yt-panel').forEach(p=>p.style.display='none');
        btn.classList.add('active');
        document.getElementById(`ytPanel${btn.dataset.tab.charAt(0).toUpperCase()+btn.dataset.tab.slice(1)}`).style.display='block';
    }));
    document.getElementById('ytPreviewBtn')?.addEventListener('click', handleYTPreview);
    document.getElementById('ytAddManualBtn')?.addEventListener('click', handleYTAddManual);
    document.getElementById('ytCancelManualBtn')?.addEventListener('click',()=>{
        document.getElementById('ytPreviewResult').style.display='none';
        document.getElementById('ytUrlManual').value=''; ytManualData=null;
    });
    document.getElementById('ytAutoSearchBtn')?.addEventListener('click', handleYTAutoSearch);
    document.getElementById('ytAutoAddSelectedBtn')?.addEventListener('click', handleYTAutoAddSelected);
    document.getElementById('ytAutoClearBtn')?.addEventListener('click',()=>{
        document.getElementById('ytAutoResults').style.display='none';
        document.getElementById('ytAutoResultsList').innerHTML='';
    });
}

function extractYTVideoId(url) { const m=url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null; }
function parseDuration(iso) { const m=iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if(!m) return 0; return(parseInt(m[1]||0)*3600)+(parseInt(m[2]||0)*60)+parseInt(m[3]||0); }
function formatDuration(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

async function fetchYTVideoData(videoId) {
    const res=await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`);
    const data=await res.json();
    if(!data.items?.length) throw new Error('Vídeo não encontrado');
    const item=data.items[0];
    return { id:videoId, title:item.snippet.title, channel:item.snippet.channelTitle, thumbnail:item.snippet.thumbnails?.medium?.url, duration:parseDuration(item.contentDetails.duration), url:`https://www.youtube.com/watch?v=${videoId}` };
}

async function handleYTPreview() {
    const url=document.getElementById('ytUrlManual').value.trim();
    if(!url){ alert('Cole um link do YouTube.'); return; }
    const videoId=extractYTVideoId(url);
    if(!videoId){ alert('Link inválido.'); return; }
    const btn=document.getElementById('ytPreviewBtn'); btn.textContent='⏳'; btn.disabled=true;
    try {
        const data=await fetchYTVideoData(videoId); ytManualData=data;
        document.getElementById('ytPreviewThumb').src=data.thumbnail;
        document.getElementById('ytPreviewTitle').textContent=data.title;
        document.getElementById('ytPreviewChannel').textContent=data.channel;
        document.getElementById('ytPreviewDuration').textContent=formatDuration(data.duration);
        document.getElementById('ytPreviewResult').style.display='block';
    } catch(err){ alert('❌ Erro: '+err.message); }
    finally{ btn.textContent='🔍 Visualizar'; btn.disabled=false; }
}

async function handleYTAddManual() {
    if(!ytManualData) return;
    const slotValue=document.getElementById('ytSlotManual').value;
    await addToQueueFromSearch(ytManualData, slotValue, 'manual');
    document.getElementById('ytPreviewResult').style.display='none';
    document.getElementById('ytUrlManual').value=''; ytManualData=null;
}

async function handleYTAutoSearch() {
    const query=document.getElementById('ytAutoQuery').value.trim();
    const qty=parseInt(document.getElementById('ytAutoQty').value);
    if(!query){ alert('Digite o gênero ou estilo.'); return; }
    const btn=document.getElementById('ytAutoSearchBtn'); btn.textContent='⏳'; btn.disabled=true;
    try {
        const url=`https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query+' música oficial')}&type=video&videoCategoryId=10&maxResults=${qty*2}&part=snippet&key=${YOUTUBE_API_KEY}`;
        const res=await fetch(url); const data=await res.json();
        if(!data.items?.length){ alert('Nenhum resultado.'); return; }
        const filtered=data.items.filter(i=>!BLOCKED_TERMS.some(b=>i.snippet.title.toLowerCase().includes(b))).slice(0,qty);
        const slotValue=document.getElementById('ytSlotAuto').value;
        document.getElementById('ytAutoResultsList').innerHTML=filtered.map((item,i)=>`
            <div class="yt-result-row">
                <input type="checkbox" class="yt-result-check" id="ytcheck_${i}" data-id="${item.id.videoId}" data-title="${item.snippet.title.replace(/"/g,'')}" data-channel="${item.snippet.channelTitle.replace(/"/g,'')}" data-thumb="${item.snippet.thumbnails?.default?.url||''}" data-slot="${slotValue}" checked>
                <img src="${item.snippet.thumbnails?.default?.url}" alt="" style="width:60px;border-radius:4px;">
                <div><div style="font-size:13px;font-weight:500;">${item.snippet.title}</div><div style="font-size:11px;color:#666;">${item.snippet.channelTitle}</div></div>
            </div>`).join('');
        document.getElementById('ytAutoResults').style.display='block';
    } catch(err){ alert('❌ Erro: '+err.message); }
    finally{ btn.textContent='🔍 Buscar'; btn.disabled=false; }
}

async function handleYTAutoAddSelected() {
    const checked=document.querySelectorAll('.yt-result-check:checked');
    if(!checked.length){ alert('Selecione pelo menos uma música.'); return; }
    const slotValue=document.getElementById('ytSlotAuto').value;
    let count=0;
    for(const cb of checked) {
        try {
            await supabaseAdmin.from('music_queue').insert([{
                youtube_url:`https://www.youtube.com/watch?v=${cb.dataset.id}`,
                youtube_title:cb.dataset.title, youtube_channel:cb.dataset.channel,
                youtube_thumbnail:cb.dataset.thumb, title:cb.dataset.title,
                suggested_slot_id:slotValue&&slotValue!=='general'?parseInt(slotValue):null,
                source:'auto', status:'pending', conversion_status:'pending'
            }]); count++;
        } catch(err){ console.error(err); }
    }
    alert(`✅ ${count} música(s) na fila!`);
    document.getElementById('ytAutoResults').style.display='none';
    document.getElementById('ytAutoResultsList').innerHTML='';
    document.getElementById('ytAutoQuery').value='';
    const {data}=await supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false});
    musicQueue=data||[]; renderQueueSection();
}

// ─────────────────────────────────────────────────────────────
// SAZONAIS
// ─────────────────────────────────────────────────────────────
function setupSeasonalEventListeners() {
    document.querySelectorAll('.seasonal-tab').forEach(tab=>tab.addEventListener('click',()=>{
        currentSeasonalTab=tab.dataset.category;
        document.querySelectorAll('.seasonal-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.seasonal-panel').forEach(p=>p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.seasonal-panel[data-category="${currentSeasonalTab}"]`)?.classList.add('active');
    }));
    document.querySelectorAll('.toggle-seasonal-btn').forEach(btn=>btn.addEventListener('click',()=>toggleSeasonalPlaylist(btn.dataset.category)));
    document.querySelectorAll('.seasonal-form').forEach(form=>{ if(!form.id.startsWith('formJingle')) form.addEventListener('submit',handleSeasonalFormSubmit); });
    document.querySelectorAll('.seasonal-test').forEach(btn=>btn.addEventListener('click',e=>testAudioUrl(e.target.closest('form').querySelector('.seasonal-url').value.trim())));
    document.querySelectorAll('.seasonal-clear').forEach(btn=>btn.addEventListener('click',e=>{
        const f=e.target.closest('form'); f.reset();
        f.querySelector('.seasonal-order').value='0';
        const fr=f.querySelector('.seasonal-frequency'); if(fr) fr.value='3';
        editingSeasonalId=null;
    }));
    document.querySelectorAll('.shuffle-seasonal-btn').forEach(btn=>btn.addEventListener('click',()=>handleSeasonalShuffle(btn.dataset.category,btn.dataset.type)));
    setupSeasonalJingleListeners();
}

function setupSeasonalJingleListeners() {
    ['natal','ano_novo','pascoa','sao_joao'].forEach(cat=>{
        const names={natal:'Natal',ano_novo:'AnoNovo',pascoa:'Pascoa',sao_joao:'SaoJoao'};
        const form=document.getElementById(`formJingle${names[cat]}`);
        if(form) {
            form.addEventListener('submit',e=>handleSaveSeasonalJingle(e,cat));
            form.querySelector('.jingle-test')?.addEventListener('click',e=>testAudioUrl(e.target.closest('form').querySelector('.jingle-url').value.trim()));
            form.querySelector('.jingle-clear')?.addEventListener('click',e=>{ const f=e.target.closest('form'); f.querySelector('.jingle-url').value=''; f.querySelector('.jingle-title').value=''; });
        }
    });
}

function renderAllSeasonalTables() {
    const names={natal:'Natal',ano_novo:'AnoNovo',pascoa:'Pascoa',sao_joao:'SaoJoao'};
    ['natal','ano_novo','pascoa','sao_joao'].forEach(cat=>{ renderSeasonalTable(cat,'music',`tableMusic${names[cat]}`); renderSeasonalTable(cat,'ad',`tableAd${names[cat]}`); });
}

function renderSeasonalTable(category,type,tableId) {
    const tbody=document.getElementById(tableId); if(!tbody) return;
    const items=type==='music'?seasonalData[category].music:seasonalData[category].ads;
    if(!items.length){ tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Nenhum item.</td></tr>`; return; }
    tbody.innerHTML=items.map(item=>`
        <tr>
            ${type==='music'?`<td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>`:''}
            ${type==='music'
                ?`<td style="font-weight:bold;color:#666;">${item.original_order??0}</td><td><span style="padding:3px 8px;background:#fff3e0;border-radius:10px;font-weight:bold;color:#e65100;font-size:11px;">🎲 ${item.daily_order??0}</span></td>`
                :`<td style="font-weight:bold;">${item.play_order}</td>`}
            <td style="font-weight:500;">${item.title}</td>
            ${type==='ad'?`<td>${item.advertiser||'-'}</td><td><span style="padding:3px 8px;background:#e3f2fd;border-radius:10px;font-size:11px;font-weight:bold;color:#1976d2;">A cada ${item.frequency}</span></td>`:''}
            <td><span class="status-badge ${item.enabled?'active':'inactive'}">${item.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td><div class="action-btns">
                <button class="btn-edit seas-edit-btn" data-id="${item.id}" data-cat="${category}" data-type="${type}">✏️</button>
                <button class="btn-toggle seas-toggle-btn" data-id="${item.id}" data-enabled="${item.enabled}">${item.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete seas-delete-btn" data-id="${item.id}">🗑️</button>
            </div></td>
        </tr>`).join('');
    tbody.querySelectorAll('.seas-edit-btn').forEach(b=>b.addEventListener('click',()=>editSeasonalItem(parseInt(b.dataset.id),b.dataset.cat,b.dataset.type)));
    tbody.querySelectorAll('.seas-toggle-btn').forEach(b=>b.addEventListener('click',()=>toggleSeasonalItem(parseInt(b.dataset.id),b.dataset.enabled!=='true')));
    tbody.querySelectorAll('.seas-delete-btn').forEach(b=>b.addEventListener('click',()=>deleteSeasonalItem(parseInt(b.dataset.id))));
}

function renderSeasonalJinglesTables() {
    const names={natal:'Natal',ano_novo:'AnoNovo',pascoa:'Pascoa',sao_joao:'SaoJoao'};
    const posLabels={opening:'🎬 Abertura',middle:'🎬 Meio',closing:'🎬 Encerramento'};
    ['natal','ano_novo','pascoa','sao_joao'].forEach(cat=>{
        const tbody=document.getElementById(`tableJingle${names[cat]}`); if(!tbody) return;
        const list=seasonalJingles[cat]||[];
        if(!list.length){ tbody.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">Nenhuma vinheta.</td></tr>'; return; }
        tbody.innerHTML=list.map(j=>`
            <tr>
                <td><span style="padding:3px 8px;background:#EEEDFE;border-radius:10px;font-size:11px;color:#3C3489;">${posLabels[j.position]||j.position}</span></td>
                <td style="font-weight:500;">${j.title}</td>
                <td><span class="status-badge ${j.enabled?'active':'inactive'}">${j.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
                <td><div class="action-btns">
                    <button class="btn-toggle" onclick="toggleSeasonalJingle(${j.id},${!j.enabled},'${cat}')">${j.enabled?'🔴':'🟢'}</button>
                    <button class="btn-delete" onclick="deleteSeasonalJingle(${j.id},'${cat}')">🗑️</button>
                </div></td>
            </tr>`).join('');
    });
}

function updateSeasonalStatusBadges() {
    const labels={natal:'Natal',ano_novo:'Ano-Novo',pascoa:'Páscoa',sao_joao:'São João'};
    const icons={natal:'🎄',ano_novo:'🎆',pascoa:'🐰',sao_joao:'🔥'};
    Object.keys(labels).forEach(cat=>{
        const key=cat.split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');
        const statusEl=document.getElementById(`status${key}`); const toggleBtn=document.getElementById(`toggle${key}`);
        if(!statusEl||!toggleBtn) return;
        const isActive=seasonalSettings[cat]?.is_active||false;
        statusEl.textContent=isActive?'✅ Ativo':'❌ Inativo'; statusEl.className=`status-badge ${isActive?'active':'inactive'}`;
        toggleBtn.textContent=isActive?`⏸️ Desativar ${labels[cat]}`:`${icons[cat]} Ativar ${labels[cat]}`;
        toggleBtn.style.background=isActive?'#ff4444':'#006b3f';
    });
}

async function toggleSeasonalPlaylist(category) {
    const newStatus=!(seasonalSettings[category]?.is_active||false);
    if(newStatus) await Promise.all(['natal','ano_novo','pascoa','sao_joao'].filter(c=>c!==category).map(c=>supabaseAdmin.from('seasonal_settings').update({is_active:false}).eq('category',c)));
    await supabaseAdmin.from('seasonal_settings').update({is_active:newStatus,activated_at:newStatus?new Date().toISOString():null}).eq('category',category);
    const {data}=await supabase.from('seasonal_settings').select('*');
    seasonalSettings={}; (data||[]).forEach(s=>{seasonalSettings[s.category]=s;}); updateSeasonalStatusBadges();
    const labels={natal:'Natal',ano_novo:'Ano-Novo',pascoa:'Páscoa',sao_joao:'São João'};
    alert(newStatus?`✅ ${labels[category]} ativado!`:`⏸️ ${labels[category]} desativado.`);
}

async function handleSeasonalFormSubmit(e) {
    e.preventDefault();
    const form=e.target; const match=form.id.match(/form(Music|Ad)(\w+)/); if(!match) return;
    const type=match[1]==='Music'?'music':'ad';
    const rawCat=match[2]; const category=rawCat==='AnoNovo'?'ano_novo':rawCat==='SaoJoao'?'sao_joao':rawCat.toLowerCase();
    const url=form.querySelector('.seasonal-url').value.trim();
    const title=form.querySelector('.seasonal-title').value.trim();
    const order=parseInt(form.querySelector('.seasonal-order').value);
    const advertiser=form.querySelector('.seasonal-advertiser')?.value.trim()||null;
    const frequency=parseInt(form.querySelector('.seasonal-frequency')?.value||3);
    try {
        let nextOrder = order;
        if(!editingSeasonalId) {
            const {data:dup} = await supabase.from('seasonal_playlists').select('id,title').eq('audio_url',url).eq('category',category).maybeSingle();
            if(dup){ alert(`⚠️ Esta música já está na playlist de ${category}!\n"${dup.title}"`); return; }
            const {data:maxData} = await supabase.from('seasonal_playlists').select('play_order').eq('category',category).eq('type',type).order('play_order',{ascending:false}).limit(1).maybeSingle();
            nextOrder = (maxData?.play_order ?? -1) + 1;
        }
        const payload={category,type,audio_url:url,title,play_order:nextOrder,enabled:true};
        if(type==='music'){payload.original_order=nextOrder;payload.daily_order=nextOrder;}
        if(type==='ad'){payload.advertiser=advertiser;payload.frequency=frequency;}
        if(editingSeasonalId){ await supabaseAdmin.from('seasonal_playlists').update(payload).eq('id',editingSeasonalId); alert('✅ Atualizado!'); }
        else { await supabaseAdmin.from('seasonal_playlists').insert([payload]); alert(`✅ Adicionado! Numeração: ${nextOrder}`); }
        form.reset(); form.querySelector('.seasonal-order').value='0';
        if(form.querySelector('.seasonal-frequency')) form.querySelector('.seasonal-frequency').value='3';
        editingSeasonalId=null;
        const [mRes,aRes]=await Promise.all([supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})]);
        seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
        (mRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
        (aRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
        renderAllSeasonalTables();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

function editSeasonalItem(id,category,type) {
    const items=type==='music'?seasonalData[category].music:seasonalData[category].ads;
    const item=items.find(i=>i.id===id); if(!item) return;
    editingSeasonalId=id;
    const names={natal:'Natal',ano_novo:'AnoNovo',pascoa:'Pascoa',sao_joao:'SaoJoao'};
    const form=document.getElementById(`form${type==='music'?'Music':'Ad'}${names[category]}`); if(!form) return;
    form.querySelector('.seasonal-url').value=item.audio_url;
    form.querySelector('.seasonal-title').value=item.title;
    form.querySelector('.seasonal-order').value=type==='music'?(item.original_order||0):item.play_order;
    if(type==='ad'){ if(form.querySelector('.seasonal-advertiser')) form.querySelector('.seasonal-advertiser').value=item.advertiser||''; if(form.querySelector('.seasonal-frequency')) form.querySelector('.seasonal-frequency').value=item.frequency||3; }
    form.scrollIntoView({behavior:'smooth',block:'center'});
}

async function toggleSeasonalItem(id,newStatus) {
    await supabaseAdmin.from('seasonal_playlists').update({enabled:newStatus}).eq('id',id);
    const [mRes,aRes]=await Promise.all([supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})]);
    seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
    (mRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
    (aRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
    renderAllSeasonalTables();
}

async function deleteSeasonalItem(id) {
    if(!confirm('Deletar?')) return;
    await supabaseAdmin.from('seasonal_playlists').delete().eq('id',id);
    const [mRes,aRes]=await Promise.all([supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})]);
    seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
    (mRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
    (aRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
    renderAllSeasonalTables();
}

async function handleSeasonalShuffle(category,type) {
    if(!confirm('Embaralhar agora?')) return;
    const {data:tracks}=await supabaseAdmin.from('seasonal_playlists').select('id').eq('category',category).eq('type',type).eq('enabled',true);
    if(!tracks?.length){ alert('Nenhuma música.'); return; }
    const idx=[...Array(tracks.length).keys()];
    for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]];}
    const today=new Date().toISOString().split('T')[0];
    await Promise.all(tracks.map((t,i)=>supabaseAdmin.from('seasonal_playlists').update({daily_order:idx[i],last_shuffle_date:today}).eq('id',t.id)));
    alert('✅ Embaralhado!');
}

async function handleSaveSeasonalJingle(e,category) {
    e.preventDefault();
    const form=e.target;
    const url=form.querySelector('.jingle-url').value.trim();
    const title=form.querySelector('.jingle-title').value.trim();
    const position=form.querySelector('.jingle-position').value;
    const {error}=await supabaseAdmin.from('jingles').insert([{seasonal_category:category,position,audio_url:url,title,enabled:true}]);
    if(error){ alert('❌ Erro: '+error.message); return; }
    alert('✅ Vinheta adicionada!');
    form.querySelector('.jingle-url').value=''; form.querySelector('.jingle-title').value='';
    await loadSeasonalJingles(); renderSeasonalJinglesTables();
}

async function toggleSeasonalJingle(id,newStatus,cat) {
    await supabaseAdmin.from('jingles').update({enabled:newStatus}).eq('id',id);
    await loadSeasonalJingles(); renderSeasonalJinglesTables();
}

async function deleteSeasonalJingle(id,cat) {
    if(!confirm('Deletar vinheta?')) return;
    await supabaseAdmin.from('jingles').delete().eq('id',id);
    await loadSeasonalJingles(); renderSeasonalJinglesTables();
}

// ─────────────────────────────────────────────────────────────
// HORAS CERTAS
// ─────────────────────────────────────────────────────────────
function populateHourSelect() {
    const sel=document.getElementById('hourSelect'); if(!sel) return;
    for(let i=0;i<24;i++){ const o=document.createElement('option'); o.value=i; o.textContent=`${String(i).padStart(2,'0')}:00`; sel.appendChild(o); }
}

function renderScheduleTable() {
    const tbody=document.getElementById('scheduleTableBody'); if(!tbody) return;
    tbody.innerHTML='';
    for(let hour=0;hour<24;hour++){
        const s=allSchedules.find(s=>s.hour===hour);
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="font-weight:bold;">${String(hour).padStart(2,'0')}:00</td>
            <td><span class="status-badge ${s?.enabled?'active':'inactive'}">${s?(s.enabled?'✅ Ativo':'❌ Inativo'):'⚪ Não configurado'}</span></td>
            <td><span class="audio-url" title="${s?.audio_url||''}">${s?.audio_url||'Nenhuma URL (:00)'}</span></td>
            <td><span class="audio-url" style="color:${s?.audio_url_half?'#333':'#999'}" title="${s?.audio_url_half||''}">${s?.audio_url_half||'Nenhuma URL (:30)'}</span></td>
            <td><div class="action-btns">
                <button class="btn-edit sch-edit-btn" data-hour="${hour}">✏️ Editar</button>
                ${s?`<button class="btn-toggle sch-toggle-btn" data-id="${s.id}" data-enabled="${s.enabled}">${s.enabled?'🔴 Desativar':'🟢 Ativar'}</button><button class="btn-delete sch-delete-btn" data-id="${s.id}">🗑️ Deletar</button>`:''}
            </div></td>`;
        tr.querySelector('.sch-edit-btn')?.addEventListener('click',e=>editSchedule(parseInt(e.currentTarget.dataset.hour)));
        tr.querySelector('.sch-toggle-btn')?.addEventListener('click',e=>toggleSchedule(parseInt(e.currentTarget.dataset.id),e.currentTarget.dataset.enabled!=='true'));
        tr.querySelector('.sch-delete-btn')?.addEventListener('click',e=>deleteSchedule(parseInt(e.currentTarget.dataset.id)));
        tbody.appendChild(tr);
    }
}

function editSchedule(hour) {
    const s=allSchedules.find(s=>s.hour===hour);
    document.getElementById('hourSelect').value=hour;
    document.getElementById('audioUrl').value=s?.audio_url||'';
    document.getElementById('audioUrlHalf').value=s?.audio_url_half||'';
    document.getElementById('enabledCheckbox').checked=s?s.enabled:true;
    document.getElementById('editForm').scrollIntoView({behavior:'smooth',block:'center'});
}

async function handleSaveSchedule(e) {
    e.preventDefault();
    const hour=parseInt(document.getElementById('hourSelect').value);
    const url=document.getElementById('audioUrl').value.trim();
    const urlHalf=document.getElementById('audioUrlHalf').value.trim();
    const enabled=document.getElementById('enabledCheckbox').checked;
    if(!url){ alert('Insira a URL para :00!'); return; }
    try {
        const existing=allSchedules.find(s=>s.hour===hour);
        if(existing){ await supabaseAdmin.from('radio_schedule').update({audio_url:url,audio_url_half:urlHalf||null,enabled}).eq('id',existing.id); }
        else { await supabaseAdmin.from('radio_schedule').insert([{hour,audio_url:url,audio_url_half:urlHalf||null,enabled}]); }
        alert('✅ Salvo!'); handleClearForm();
        const {data}=await supabase.from('radio_schedule').select('*').order('hour',{ascending:true});
        allSchedules=data||[]; renderScheduleTable();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

async function toggleSchedule(id,newStatus) {
    await supabaseAdmin.from('radio_schedule').update({enabled:newStatus}).eq('id',id);
    const {data}=await supabase.from('radio_schedule').select('*').order('hour',{ascending:true}); allSchedules=data||[]; renderScheduleTable();
}

async function deleteSchedule(id) {
    if(!confirm('Deletar?')) return;
    await supabaseAdmin.from('radio_schedule').delete().eq('id',id);
    const {data}=await supabase.from('radio_schedule').select('*').order('hour',{ascending:true}); allSchedules=data||[]; renderScheduleTable();
}

function handleClearForm() {
    document.getElementById('hourSelect').value=''; document.getElementById('audioUrl').value='';
    document.getElementById('audioUrlHalf').value=''; document.getElementById('enabledCheckbox').checked=true;
}

// ─────────────────────────────────────────────────────────────
// PLAYLIST DE FUNDO
// ─────────────────────────────────────────────────────────────
function renderPlaylistTable() {
    const tbody=document.getElementById('playlistTableBody'); if(!tbody) return;
    if(!backgroundPlaylist.length){ tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">Nenhuma música.</td></tr>'; return; }
    tbody.innerHTML=backgroundPlaylist.map(t=>`
        <tr>
            <td><input type="checkbox" class="row-checkbox" data-id="${t.id}"></td>
            <td style="font-weight:bold;color:#666;">${t.original_order||0}</td>
            <td><span style="padding:3px 8px;background:#e3f2fd;border-radius:10px;font-weight:bold;color:#1976d2;font-size:11px;">🎲 ${t.daily_order??0}</span></td>
            <td style="font-weight:500;">${t.title||'Sem título'}</td>
            <td><span class="status-badge ${t.enabled?'active':'inactive'}">${t.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td><span class="audio-url" title="${t.audio_url}">${t.audio_url}</span></td>
            <td><div class="action-btns">
                <button class="btn-edit pl-edit-btn" data-id="${t.id}">✏️</button>
                <button class="btn-toggle pl-toggle-btn" data-id="${t.id}" data-enabled="${t.enabled}">${t.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete pl-delete-btn" data-id="${t.id}">🗑️</button>
            </div></td>
        </tr>`).join('');
    tbody.querySelectorAll('.pl-edit-btn').forEach(b=>b.addEventListener('click',()=>editPlaylist(parseInt(b.dataset.id))));
    tbody.querySelectorAll('.pl-toggle-btn').forEach(b=>b.addEventListener('click',()=>togglePlaylist(parseInt(b.dataset.id),b.dataset.enabled!=='true')));
    tbody.querySelectorAll('.pl-delete-btn').forEach(b=>b.addEventListener('click',()=>deletePlaylist(parseInt(b.dataset.id))));
}

async function handleSavePlaylist(e) {
    e.preventDefault();
    const url=document.getElementById('playlistUrl').value.trim();
    const title=document.getElementById('playlistTitle').value.trim();
    const enabled=document.getElementById('playlistEnabled').checked;
    if(!url||!title){ alert('Preencha URL e Título!'); return; }
    try {
        if(editingPlaylistId){
            await supabaseAdmin.from('background_playlist').update({audio_url:url,title,enabled}).eq('id',editingPlaylistId);
            alert('✅ Atualizado!');
        } else {
            const {data:dup} = await supabase.from('background_playlist').select('id,title').eq('audio_url',url).maybeSingle();
            if(dup){ alert(`⚠️ Esta música já está na playlist!\n"${dup.title}"`); return; }
            const {data:maxData} = await supabase.from('background_playlist').select('original_order').order('original_order',{ascending:false}).limit(1).maybeSingle();
            const nextOrder = (maxData?.original_order ?? -1) + 1;
            await supabaseAdmin.from('background_playlist').insert([{ audio_url:url, title, play_order:nextOrder, original_order:nextOrder, daily_order:nextOrder, enabled }]);
            alert(`✅ Adicionado! Numeração: ${nextOrder}`);
        }
        handleClearPlaylistForm();
        const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true});
        backgroundPlaylist=data||[]; renderPlaylistTable();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

function editPlaylist(id) {
    const t=backgroundPlaylist.find(t=>t.id===id); if(!t) return;
    editingPlaylistId=id;
    document.getElementById('playlistUrl').value=t.audio_url;
    document.getElementById('playlistTitle').value=t.title||'';
    document.getElementById('playlistOrder').value=t.play_order;
    document.getElementById('playlistEnabled').checked=t.enabled;
    document.getElementById('playlistForm').scrollIntoView({behavior:'smooth',block:'center'});
}

async function togglePlaylist(id,newStatus) {
    await supabaseAdmin.from('background_playlist').update({enabled:newStatus}).eq('id',id);
    const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true}); backgroundPlaylist=data||[]; renderPlaylistTable();
}

async function deletePlaylist(id) {
    if(!confirm('Deletar?')) return;
    await supabaseAdmin.from('background_playlist').delete().eq('id',id);
    const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true}); backgroundPlaylist=data||[]; renderPlaylistTable();
}

function handleClearPlaylistForm() {
    document.getElementById('playlistUrl').value=''; document.getElementById('playlistTitle').value='';
    document.getElementById('playlistOrder').value='0'; document.getElementById('playlistEnabled').checked=true;
    editingPlaylistId=null;
    document.getElementById('playlistForm').querySelector('.submit-btn').textContent='💾 Adicionar';
}

async function handleForceShufflePlaylist() {
    if(!confirm('Embaralhar agora?')) return;
    const {data:tracks}=await supabaseAdmin.from('background_playlist').select('id').eq('enabled',true);
    if(!tracks?.length){ alert('Nenhuma música ativa.'); return; }
    const idx=[...Array(tracks.length).keys()];
    for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]];}
    const today=new Date().toISOString().split('T')[0];
    await Promise.all(tracks.map((t,i)=>supabaseAdmin.from('background_playlist').update({daily_order:idx[i],last_shuffle_date:today}).eq('id',t.id)));
    alert('✅ Embaralhado!');
    const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true}); backgroundPlaylist=data||[]; renderPlaylistTable();
}

// ─────────────────────────────────────────────────────────────
// PROPAGANDAS
// ─────────────────────────────────────────────────────────────
function renderAdsTable() {
    const tbody=document.getElementById('adsTableBody'); if(!tbody) return;
    if(!advertisements.length){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">Nenhuma propaganda.</td></tr>'; return; }
    tbody.innerHTML=advertisements.map(ad=>`
        <tr>
            <td style="font-weight:bold;">${ad.play_order}</td>
            <td style="font-weight:500;">${ad.title}</td>
            <td>${ad.advertiser||'-'}</td>
            <td><span style="padding:3px 8px;background:#e3f2fd;border-radius:10px;font-size:11px;font-weight:bold;color:#1976d2;">A cada ${ad.frequency}</span></td>
            <td><span class="status-badge ${ad.enabled?'active':'inactive'}">${ad.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td><div class="action-btns">
                <button class="btn-edit ad-edit-btn" data-id="${ad.id}">✏️</button>
                <button class="btn-toggle ad-toggle-btn" data-id="${ad.id}" data-enabled="${ad.enabled}">${ad.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete ad-delete-btn" data-id="${ad.id}">🗑️</button>
            </div></td>
        </tr>`).join('');
    tbody.querySelectorAll('.ad-edit-btn').forEach(b=>b.addEventListener('click',()=>editAd(parseInt(b.dataset.id))));
    tbody.querySelectorAll('.ad-toggle-btn').forEach(b=>b.addEventListener('click',()=>toggleAd(parseInt(b.dataset.id),b.dataset.enabled!=='true')));
    tbody.querySelectorAll('.ad-delete-btn').forEach(b=>b.addEventListener('click',()=>deleteAd(parseInt(b.dataset.id))));
}

async function handleSaveAd(e) {
    e.preventDefault();
    const url=document.getElementById('adUrl').value.trim();
    const title=document.getElementById('adTitle').value.trim();
    const advertiser=document.getElementById('adAdvertiser').value.trim();
    const frequency=parseInt(document.getElementById('adFrequency').value);
    const order=parseInt(document.getElementById('adOrder').value);
    const enabled=document.getElementById('adEnabled').checked;
    if(!url||!title){ alert('Preencha URL e Título!'); return; }
    if(frequency<1||frequency>100){ alert('Frequência entre 1 e 100!'); return; }
    try {
        const payload={audio_url:url,title,advertiser:advertiser||null,frequency,play_order:order,enabled};
        if(editingAdId){ await supabaseAdmin.from('advertisements').update(payload).eq('id',editingAdId); alert('✅ Atualizado!'); }
        else { await supabaseAdmin.from('advertisements').insert([payload]); alert('✅ Adicionado!'); }
        handleClearAdForm();
        const {data}=await supabase.from('advertisements').select('*').order('play_order',{ascending:true}); advertisements=data||[]; renderAdsTable();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

function editAd(id) {
    const ad=advertisements.find(a=>a.id===id); if(!ad) return;
    editingAdId=id;
    document.getElementById('adUrl').value=ad.audio_url; document.getElementById('adTitle').value=ad.title;
    document.getElementById('adAdvertiser').value=ad.advertiser||''; document.getElementById('adFrequency').value=ad.frequency;
    document.getElementById('adOrder').value=ad.play_order; document.getElementById('adEnabled').checked=ad.enabled;
    document.getElementById('adsForm').scrollIntoView({behavior:'smooth',block:'center'});
    document.getElementById('adsForm').querySelector('.submit-btn').textContent='💾 Atualizar';
}

async function toggleAd(id,newStatus) {
    await supabaseAdmin.from('advertisements').update({enabled:newStatus}).eq('id',id);
    const {data}=await supabase.from('advertisements').select('*').order('play_order',{ascending:true}); advertisements=data||[]; renderAdsTable();
}

async function deleteAd(id) {
    if(!confirm('Deletar?')) return;
    await supabaseAdmin.from('advertisements').delete().eq('id',id);
    const {data}=await supabase.from('advertisements').select('*').order('play_order',{ascending:true}); advertisements=data||[]; renderAdsTable();
}

function handleClearAdForm() {
    ['adUrl','adTitle','adAdvertiser'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('adFrequency').value='3'; document.getElementById('adOrder').value='0';
    document.getElementById('adEnabled').checked=true; editingAdId=null;
    document.getElementById('adsForm').querySelector('.submit-btn').textContent='💾 Adicionar Propaganda';
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS — usa tabela play_analytics
// ─────────────────────────────────────────────────────────────
async function loadAnalytics() {
    const el = document.getElementById('analyticsContent');
    if(!el) return;
    el.innerHTML = '<div class="grade-empty">Carregando analytics...</div>';
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: topTracks } = await supabase
            .from('play_analytics')
            .select('track_title, track_table, slot_name')
            .gte('played_at', thirtyDaysAgo.toISOString())
            .order('played_at', { ascending: false });

        if(!topTracks) { el.innerHTML='<div class="grade-empty">Sem dados ainda.</div>'; return; }

        const trackCount = {};
        topTracks.forEach(t => { const k=t.track_title; trackCount[k]=(trackCount[k]||0)+1; });
        const top10 = Object.entries(trackCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
        const total = topTracks.length;

        const { data: byHour } = await supabase.from('play_analytics').select('hour_of_day').gte('played_at', thirtyDaysAgo.toISOString());
        const hourCount = Array(24).fill(0);
        (byHour||[]).forEach(r=>{ hourCount[r.hour_of_day]++; });
        const peakHour = hourCount.indexOf(Math.max(...hourCount));

        const gradeCount = {};
        topTracks.forEach(t=>{ if(t.slot_name) gradeCount[t.slot_name]=(gradeCount[t.slot_name]||0)+1; });

        const maxHour = Math.max(...hourCount,1);
        el.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card analytics-card-wide">
                    <div class="analytics-title">🎵 Top 10 Músicas (últimos 30 dias)</div>
                    <div class="analytics-list">
                        ${top10.map(([title,count],i)=>`
                        <div class="analytics-row">
                            <span class="analytics-rank">#${i+1}</span>
                            <span class="analytics-name">${title}</span>
                            <span class="analytics-count">${count}×</span>
                            <div class="analytics-bar-wrap"><div class="analytics-bar" style="width:${Math.round((count/top10[0][1])*100)}%"></div></div>
                        </div>`).join('')}
                        ${top10.length===0?'<div style="color:#999;padding:20px;text-align:center;">Nenhum dado ainda</div>':''}
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-title">⏰ Atividade por Hora</div>
                    <div class="analytics-hours">
                        ${hourCount.map((c,h)=>`<div class="analytics-hour-col" title="${h}h: ${c} reproduções"><div class="analytics-hour-bar" style="height:${Math.round((c/maxHour)*60)}px"></div><div class="analytics-hour-label">${h}</div></div>`).join('')}
                    </div>
                    <div class="analytics-peak">Horário de pico: ${String(peakHour).padStart(2,'0')}h</div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-title">🕐 Por Grade Horária</div>
                    <div class="analytics-list">
                        ${Object.entries(gradeCount).sort((a,b)=>b[1]-a[1]).map(([grade,count])=>`<div class="analytics-row"><span class="analytics-name">${grade}</span><span class="analytics-count">${count}×</span></div>`).join('')}
                        ${Object.keys(gradeCount).length===0?'<div style="color:#999;padding:10px;">Nenhum dado</div>':''}
                    </div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-title">📊 Resumo</div>
                    <div class="analytics-summary" style="flex-direction:column;">
                        <div class="analytics-stat"><div class="analytics-stat-num">${total}</div><div class="analytics-stat-label">Reproduções (30 dias)</div></div>
                        <div class="analytics-stat"><div class="analytics-stat-num">${Math.round(total/30)}</div><div class="analytics-stat-label">Média por dia</div></div>
                        <div class="analytics-stat"><div class="analytics-stat-num">${top10.length}</div><div class="analytics-stat-label">Músicas distintas</div></div>
                    </div>
                </div>
            </div>`;
    } catch(err) {
        el.innerHTML = `<div class="grade-empty">Erro ao carregar: ${err.message}</div>`;
    }
}

// ─────────────────────────────────────────────────────────────
// ALERTA DE EMERGÊNCIA — usa tabela emergency_state
// ─────────────────────────────────────────────────────────────
async function loadEmergencyState() {
    try {
        const { data } = await supabase.from('emergency_state').select('*').eq('id',1).single();
        emergencyActive = data?.is_active || false;
        renderEmergencyUI(data);
    } catch(err) {
        // Tenta emergency_alert como fallback
        try {
            const { data } = await supabase.from('emergency_alert').select('*').eq('id',1).single();
            emergencyActive = data?.is_active || false;
            renderEmergencyUI(data);
        } catch(err2) { console.error('Erro ao carregar emergência:', err2); }
    }
}

function renderEmergencyUI(state) {
    const btn = document.getElementById('emergencyBtn');
    const ind = document.getElementById('emergencyIndicator');
    const txt = document.getElementById('emergencyStatusText');
    if(!btn) return;
    if(state?.is_active) {
        btn.textContent = '⏹️ Encerrar Alerta';
        btn.classList.add('active');
        if(ind) ind.classList.add('active');
        if(txt) txt.textContent = '🚨 ALERTA ATIVO — todos os players estão em modo de emergência';
    } else {
        btn.textContent = '🚨 Disparar Alerta';
        btn.classList.remove('active');
        if(ind) ind.classList.remove('active');
        if(txt) txt.textContent = 'Alerta inativo';
    }
}

async function toggleEmergency() {
    const newStatus = !emergencyActive;
    const message   = document.getElementById('emergencyMessage')?.value.trim();
    const audioUrl  = document.getElementById('emergencyAudioUrl')?.value.trim();
    const useTTS    = document.getElementById('emergencyUseTTS')?.checked !== false;
    const voice     = document.getElementById('emergencyVoice')?.value || 'Brazilian Portuguese Female';

    if(newStatus && !message && !audioUrl) {
        alert('Preencha a mensagem de texto ou a URL do áudio de emergência.'); return;
    }

    const payload = {
        is_active:    newStatus,
        message:      message  || null,
        audio_url:    audioUrl || null,
        use_tts:      useTTS,
        voice:        voice,
        activated_at: newStatus ? new Date().toISOString() : null,
        updated_at:   new Date().toISOString()
    };

    try {
        // Tenta emergency_state primeiro, senão emergency_alert
        let err1;
        ({ error: err1 } = await supabaseAdmin.from('emergency_state').update(payload).eq('id',1));
        if(err1) await supabaseAdmin.from('emergency_alert').update({ is_active: newStatus, tts_text: message||null, audio_url: audioUrl||null, updated_at: new Date().toISOString() }).eq('id',1);
        emergencyActive = newStatus;
        renderEmergencyUI({ is_active: newStatus });
    } catch(err) { alert('❌ Erro: ' + err.message); }
}

function setupEmergencyListeners() {
    document.getElementById('emergencyMode')?.addEventListener('change', e => {
        const isTTS = e.target.value === 'tts';
        document.getElementById('emergencyTtsRow').style.display = isTTS ? 'block' : 'none';
        document.getElementById('emergencyAudioRow').style.display = isTTS ? 'none' : 'block';
    });
    supabase.channel('emergency_admin')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_state'},
            payload => { emergencyActive = payload.new.is_active; renderEmergencyUI(payload.new); })
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_alert'},
            payload => { emergencyActive = payload.new.is_active; renderEmergencyUI(payload.new); })
        .subscribe();
}

window.setEmergencyMessage = function(msg) {
    const el = document.getElementById('emergencyMessage');
    if(el) { el.value = msg; }
    const ttsRadio = document.getElementById('emergencyUseTTS');
    if(ttsRadio) {
        ttsRadio.checked = true;
        document.getElementById('emergencyTTSGroup').style.display = 'block';
        document.getElementById('emergencyAudioGroup').style.display = 'none';
    }
};

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function testAudioUrl(url) {
    if(!url){ alert('Insira uma URL!'); return; }
    testAudio.src=url;
    testAudio.play().then(()=>{ alert('▶️ Reproduzindo...\nClique OK para parar.'); testAudio.pause(); testAudio.currentTime=0; }).catch(()=>alert('❌ Erro ao reproduzir.'));
}

function setupRealtimeSubscription() {
    supabase.channel('admin_realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'music_queue'},async()=>{
            const {data}=await supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false});
            musicQueue=data||[]; renderQueueSection();
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'seasonal_settings'},async()=>{
            const {data}=await supabase.from('seasonal_settings').select('*');
            seasonalSettings={}; (data||[]).forEach(s=>{seasonalSettings[s.category]=s;}); updateSeasonalStatusBadges();
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'locutor_state'},payload=>{
            locutorActive=payload.new.is_active; updateLocutorUI();
        })
        .subscribe();
}

// ─────────────────────────────────────────────────────────────
// NAVEGAÇÃO POR SEÇÕES
// ─────────────────────────────────────────────────────────────
function goSection(name) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const sec = document.getElementById(`section-${name}`);
    if(sec) sec.classList.add('active');
    const nav = document.querySelector(`.nav-item[data-section="${name}"]`);
    if(nav) nav.classList.add('active');
    document.getElementById('adminSidebar')?.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => goSection(btn.dataset.section));
    });
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('adminSidebar')?.classList.toggle('open');
    });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE GRADES HORÁRIAS
// ─────────────────────────────────────────────────────────────
async function toggleGrades() {
    const btn = document.getElementById('gradesToggleBtn');
    if(!btn) return;
    const isActive = btn.classList.contains('active');
    const newStatus = !isActive;
    try {
        await supabaseAdmin.from('radio_settings').update({ grades_enabled: newStatus, updated_at: new Date().toISOString() }).eq('id', 1);
        btn.classList.toggle('active', newStatus);
        btn.classList.toggle('inactive', !newStatus);
        btn.textContent = newStatus ? '✅ Ativadas' : '⏸️ Desativadas';
        alert(newStatus ? '✅ Grades horárias ativadas!' : '⏸️ Grades desativadas. O player voltará para a Playlist de Fundo geral.');
    } catch(err) { alert('❌ Erro: ' + err.message); }
}

async function loadGradesState() {
    try {
        const {data} = await supabase.from('radio_settings').select('grades_enabled').eq('id',1).single();
        const btn = document.getElementById('gradesToggleBtn');
        if(!btn) return;
        const enabled = data?.grades_enabled !== false;
        btn.classList.toggle('active', enabled);
        btn.classList.toggle('inactive', !enabled);
        btn.textContent = enabled ? '✅ Ativadas' : '⏸️ Desativadas';
    } catch(err) { console.error(err); }
}

// ─────────────────────────────────────────────────────────────
// FUNÇÕES GLOBAIS
// ─────────────────────────────────────────────────────────────
window.editSlotTrack        = editSlotTrack;
window.toggleSlotTrack      = toggleSlotTrack;
window.deleteSlotTrack      = deleteSlotTrack;
window.clearSlotForm        = clearSlotForm;
window.handleForceShuffleSlot = handleForceShuffleSlot;
window.editPlaylist         = editPlaylist;
window.togglePlaylist       = togglePlaylist;
window.deletePlaylist       = deletePlaylist;
window.editAd               = editAd;
window.toggleAd             = toggleAd;
window.deleteAd             = deleteAd;
window.editSeasonalItem     = editSeasonalItem;
window.toggleSeasonalItem   = toggleSeasonalItem;
window.deleteSeasonalItem   = deleteSeasonalItem;
window.toggleJingle         = toggleJingle;
window.deleteJingle         = deleteJingle;
window.clearJingleForm      = clearJingleForm;
window.toggleSeasonalJingle = toggleSeasonalJingle;
window.deleteSeasonalJingle = deleteSeasonalJingle;
window.testAudioUrl         = testAudioUrl;
window.approveQueueItem     = approveQueueItem;
window.rejectQueueItem      = rejectQueueItem;
window.toggleYTPreview      = toggleYTPreview;
window.selectLocutorTrack   = selectLocutorTrack;
window.deleteLocutorTrack   = deleteLocutorTrack;
window.loadTTSText          = loadTTSText;
window.playTTSFromLib       = playTTSFromLib;
window.deleteTTSItem        = deleteTTSItem;
window.goSection            = goSection;
window.toggleGrades         = toggleGrades;
window.loadAnalytics        = loadAnalytics;
window.toggleEmergency      = toggleEmergency;
window.startLiveLocutor     = startLiveLocutor;
