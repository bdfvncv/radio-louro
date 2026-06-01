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
    const section=document.getElementById('queueSection');
    const badge=document.getElementById('queueBadge');
    const list=document.getElementById('queueList');
    const pending=musicQueue.filter(m=>m.status==='pending');
    badge.textContent=pending.length;
    section.style.display=pending.length>0?'block':'none';
    if(!pending.length) return;
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
                        <option value="">Selecione a grade</option>
                        ${timeSlots.filter(s=>s.name!=='Madrugada Aleatória').map(s=>
                            `<option value="${s.id}" ${m.suggested_slot_id===s.id?'selected':''}>${s.name}</option>`
                        ).join('')}
                        <option value="general">📋 Playlist Geral</option>
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
    if(!slotValue){ alert('Selecione a grade de destino.'); return; }

    const btn=document.querySelector(`#qcard_${id} .submit-btn`);
    if(btn){ btn.textContent='⏳ Processando...'; btn.disabled=true; }

    try {
        // Converte YouTube → MP3 via RapidAPI
        let audioUrl = item.audio_url || null;
        if(!audioUrl) {
            audioUrl = await convertYoutubeToMp3(item.youtube_url, item.youtube_title);
        }

        await supabaseAdmin.from('music_queue').update({
            status:'approved', conversion_status:'done', audio_url: audioUrl,
            suggested_slot_id: slotValue==='general'?null:parseInt(slotValue)
        }).eq('id',id);

        if(audioUrl) {
            const order = slotValue!=='general'
                ? (slotPlaylists[parseInt(slotValue)]||[]).length
                : backgroundPlaylist.length;
            if(slotValue!=='general') {
                await supabaseAdmin.from('slot_playlists').insert([{
                    slot_id:parseInt(slotValue), audio_url:audioUrl,
                    title:item.title||item.youtube_title||'Música',
                    artist:item.youtube_channel||null,
                    original_order:order, daily_order:order, enabled:true
                }]);
                await refreshSlotPlaylist(parseInt(slotValue));
            } else {
                await supabaseAdmin.from('background_playlist').insert([{
                    audio_url:audioUrl, title:item.title||item.youtube_title||'Música',
                    play_order:order, original_order:order, daily_order:order, enabled:true
                }]);
                const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true});
                backgroundPlaylist=data||[]; renderPlaylistTable();
            }
        }

        musicQueue=musicQueue.filter(m=>m.id!==id);
        renderQueueSection();
        alert('✅ Música aprovada e adicionada!');
    } catch(err){ alert('❌ Erro ao aprovar: '+err.message); if(btn){btn.textContent='✅ Aprovar';btn.disabled=false;} }
}

async function convertYoutubeToMp3(youtubeUrl, title) {
    try {
        const videoId = extractVideoId(youtubeUrl);
        if(!videoId) throw new Error('ID inválido');
        const apiUrl = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
        const response = await fetch(apiUrl, {
            method:'GET',
            headers:{
                'X-RapidAPI-Key':'sign-up-for-free-key',
                'X-RapidAPI-Host':'youtube-mp36.p.rapidapi.com'
            }
        });
        const data = await response.json();
        if(data.status==='ok' && data.link) {
            const uploadRes = await uploadToCloudinary(data.link, title);
            return uploadRes;
        }
        return null;
    } catch(err) {
        console.warn('Conversão MP3 falhou, usando URL YouTube como fallback:', err);
        return null;
    }
}

async function uploadToCloudinary(mp3Url, title) {
    try {
        const formData = new FormData();
        formData.append('file', mp3Url);
        formData.append('upload_preset', 'ml_default');
        formData.append('folder', 'radio_louro');
        formData.append('public_id', `radio_louro/${Date.now()}_${title?.replace(/[^a-z0-9]/gi,'_').toLowerCase()}`);
        const res = await fetch(`https://api.cloudinary.com/v1_1/dygbrcrr6/video/upload`, {method:'POST', body:formData});
        const data = await res.json();
        return data.secure_url || null;
    } catch(err) {
        console.error('Upload Cloudinary falhou:', err);
        return null;
    }
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
// TTS
// ─────────────────────────────────────────────────────────────
function setupTTSListeners() {
    const textarea=document.getElementById('ttsTextInput');
    if(textarea) textarea.addEventListener('input', ()=>{
        document.getElementById('ttsCharCount').textContent=textarea.value.length;
    });
    document.getElementById('ttsPlayNowBtn')?.addEventListener('click', handleTTSPlayNow);
    document.getElementById('ttsSaveBtn')?.addEventListener('click', handleTTSSave);
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

function speakLocally(text) {
    if(!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utt=new SpeechSynthesisUtterance(text);
    utt.lang='pt-BR'; utt.rate=0.92; utt.pitch=1.1;
    const voices=speechSynthesis.getVoices();
    const fem=voices.find(v=>v.lang.startsWith('pt')&&(v.name.toLowerCase().includes('female')||v.name.toLowerCase().includes('feminina')||v.name.includes('Google')))
              ||voices.find(v=>v.lang.startsWith('pt'));
    if(fem) utt.voice=fem;
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
        const payload={
            title, text_content:text, category,
            scheduled_time:schedTime||null,
            scheduled_days:days.length?days:null,
            auto_enabled:!!(schedTime&&days.length),
            enabled:true
        };
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
    } else {
        bar.classList.remove('visible');
    }
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
                    <div class="form-group"><label>Ordem:</label><input type="number" id="slotOrder_${slotId}" value="0" min="0"></div>
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
                <div class="shuffle-box"><h4>🎲 Embaralhamento</h4><p>Automático à meia-noite.</p><button class="test-btn" onclick="handleForceShuffleSlot(${slotId})">🎲 Forçar Agora</button></div>
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
                <button class="btn-edit" onclick="editSlotTrack(${t.id},${slotId})">✏️</button>
                <button class="btn-toggle" onclick="toggleSlotTrack(${t.id},${!t.enabled},${slotId})">${t.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete" onclick="deleteSlotTrack(${t.id},${slotId})">🗑️</button>
            </div></td>
        </tr>`).join('');
}

async function handleSaveSlotTrack(e,slotId) {
    e.preventDefault();
    const url=document.getElementById(`slotUrl_${slotId}`).value.trim();
    const title=document.getElementById(`slotTitle_${slotId}`).value.trim();
    const artist=document.getElementById(`slotArtist_${slotId}`).value.trim();
    const genre=document.getElementById(`slotGenre_${slotId}`).value.trim();
    const order=parseInt(document.getElementById(`slotOrder_${slotId}`).value);
    try {
        const {error}=await supabaseAdmin.from('slot_playlists').insert([{slot_id:slotId,audio_url:url,title,artist:artist||null,genre:genre||null,original_order:order,daily_order:order,enabled:true}]);
        if(error) throw error;
        alert('✅ Música adicionada!');
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
    alert('✅ Embaralhado!'); await refreshSlotPlaylist(slotId);
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
    ['ytSlotManual','ytSlotAuto'].forEach(id=>{
        const el=document.getElementById(id); if(!el) return;
        el.innerHTML='<option value="">Selecione a grade</option>'+
            timeSlots.filter(s=>s.name!=='Madrugada Aleatória').map(s=>`<option value="${s.id}">${s.name}</option>`).join('')+
            '<option value="general">📋 Playlist Geral</option>';
    });
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
    if(!items.length){ tbody.innerHTML=`<tr><td colspan="${type==='music'?6:6}" style="text-align:center;padding:20px;color:#999;">Nenhum item.</td></tr>`; return; }
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
                <button class="btn-edit" onclick="editSeasonalItem(${item.id},'${category}','${type}')">✏️</button>
                <button class="btn-toggle" onclick="toggleSeasonalItem(${item.id},${!item.enabled})">${item.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete" onclick="deleteSeasonalItem(${item.id})">🗑️</button>
            </div></td>
        </tr>`).join('');
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
        const payload={category,type,audio_url:url,title,play_order:order,enabled:true};
        if(type==='music'){payload.original_order=order;payload.daily_order=order;payload.last_shuffle_date=new Date().toISOString().split('T')[0];}
        if(type==='ad'){payload.advertiser=advertiser;payload.frequency=frequency;}
        if(editingSeasonalId){ await supabaseAdmin.from('seasonal_playlists').update(payload).eq('id',editingSeasonalId); alert('✅ Atualizado!'); }
        else { await supabaseAdmin.from('seasonal_playlists').insert([payload]); alert('✅ Adicionado!'); }
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
                <button class="btn-edit" onclick="editSchedule(${hour})">✏️ Editar</button>
                ${s?`<button class="btn-toggle" onclick="toggleSchedule(${s.id},${!s.enabled})">${s.enabled?'🔴 Desativar':'🟢 Ativar'}</button><button class="btn-delete" onclick="deleteSchedule(${s.id})">🗑️ Deletar</button>`:''}
            </div></td>`;
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
                <button class="btn-edit" onclick="editPlaylist(${t.id})">✏️</button>
                <button class="btn-toggle" onclick="togglePlaylist(${t.id},${!t.enabled})">${t.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete" onclick="deletePlaylist(${t.id})">🗑️</button>
            </div></td>
        </tr>`).join('');
}

async function handleSavePlaylist(e) {
    e.preventDefault();
    const url=document.getElementById('playlistUrl').value.trim();
    const title=document.getElementById('playlistTitle').value.trim();
    const order=parseInt(document.getElementById('playlistOrder').value);
    const enabled=document.getElementById('playlistEnabled').checked;
    if(!url||!title){ alert('Preencha URL e Título!'); return; }
    try {
        if(editingPlaylistId){ await supabaseAdmin.from('background_playlist').update({audio_url:url,title,play_order:order,original_order:order,enabled}).eq('id',editingPlaylistId); alert('✅ Atualizado!'); }
        else { await supabaseAdmin.from('background_playlist').insert([{audio_url:url,title,play_order:order,original_order:order,daily_order:order,enabled}]); alert('✅ Adicionado!'); }
        handleClearPlaylistForm();
        const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true}); backgroundPlaylist=data||[]; renderPlaylistTable();
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
                <button class="btn-edit" onclick="editAd(${ad.id})">✏️</button>
                <button class="btn-toggle" onclick="toggleAd(${ad.id},${!ad.enabled})">${ad.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete" onclick="deleteAd(${ad.id})">🗑️</button>
            </div></td>
        </tr>`).join('');
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
