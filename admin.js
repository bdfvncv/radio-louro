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
// Grades visíveis — exclui "Madrugada Aleatória" (coberta pela Playlist de Fundo)
const visibleSlots = () => timeSlots.filter(s => s.name !== 'Madrugada Aleatória');
let seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
let seasonalJingles={natal:[],ano_novo:[],pascoa:[],sao_joao:[]};
let seasonalSettings={};
let musicQueue=[], locutorTracks=[], ttsLibrary=[];
let currentSeasonalTab='natal', currentGradeTab=null;
let editingSeasonalId=null, editingPlaylistId=null, editingAdId=null;
let locutorSelectedId=null, locutorActive=false;
let ytManualData=null;
let bulkSelectedIds=[], bulkTableName=null;
let ttsCheckInterval=null;

// ── Locutor ao vivo ───────────────────────────────────────────
let liveStream      = null;
let liveProcessor   = null;
let liveAudioCtx    = null;
let liveActive      = false;
let liveBroadcastCh = null;

// ── Emergência ────────────────────────────────────────────────
let emergencyActive = false;

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
    setupEmergencyListeners();
    setupLiveLocutorListeners();
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
        // Carrega módulos novos
        extendedLoadAllData();
    } catch(err){ console.error('Erro ao carregar:',err); }
}

async function loadSlotData() {
    if(!timeSlots.length) return;
    const [plRes,jRes] = await Promise.all([
        supabase.from('slot_playlists').select('*').order('original_order',{ascending:true}),
        supabase.from('jingles').select('*').not('slot_id','is',null)
    ]);
    slotPlaylists={}; slotJingles={};
    visibleSlots().forEach(s=>{slotPlaylists[s.id]=[]; slotJingles[s.id]=[];});
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
// DESTINOS — helper para montar checkboxes de destino
// ─────────────────────────────────────────────────────────────
function buildDestinationsHTML(selectedValue) {
    const destinations = [
        ...visibleSlots().map(s=>({value:`slot_${s.id}`, label:`🕐 ${s.name}`})),
        {value:'seasonal_natal',    label:'🎄 Natal'},
        {value:'seasonal_ano_novo', label:'🎆 Ano-Novo'},
        {value:'seasonal_pascoa',   label:'🐰 Páscoa'},
        {value:'seasonal_sao_joao', label:'🔥 São João'},
        {value:'general',           label:'🎵 Playlist de Fundo'},
    ];
    return destinations.map(d=>`
        <label class="dest-check-label" style="display:flex;align-items:center;gap:6px;padding:5px 4px;font-size:12px;cursor:pointer;border-radius:6px;transition:background .15s;" onmouseover="this.style.background='#f0faf5'" onmouseout="this.style.background=''">
            <input type="checkbox" class="dest-check" value="${d.value}" ${selectedValue===d.value?'checked':''} style="accent-color:#006b3f;width:14px;height:14px;">
            ${d.label}
        </label>`).join('');
}

function getCheckedDestinations(container) {
    if(!container) return [];
    return [...container.querySelectorAll('.dest-check:checked')].map(cb=>cb.value);
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
            <div class="suggest-result-card" style="flex-wrap:wrap;">
                <img src="${item.snippet.thumbnails?.default?.url||''}" alt="" class="suggest-result-thumb">
                <div class="suggest-result-info" style="flex:1;min-width:0;">
                    <div class="suggest-result-title">${item.snippet.title}</div>
                    <div class="suggest-result-channel">${item.snippet.channelTitle}</div>
                    <iframe id="adminsearch_frame_${item.id.videoId}" src="" allowfullscreen allow="autoplay"
                        style="display:none;width:100%;aspect-ratio:16/9;border:none;border-radius:8px;margin-top:6px;"></iframe>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
                    <button class="suggest-preview-btn admin-preview-btn" data-id="${item.id.videoId}">▶️ Prévia</button>
                    <button class="suggest-btn admin-search-queue-btn"
                        data-id="${item.id.videoId}"
                        data-title="${item.snippet.title.replace(/"/g,'&quot;')}"
                        data-channel="${item.snippet.channelTitle.replace(/"/g,'&quot;')}"
                        data-thumb="${item.snippet.thumbnails?.default?.url||''}">
                        ➕ Para Fila
                    </button>
                </div>
            </div>`).join('');
        // Listeners: prévia
        resultsEl.querySelectorAll('.admin-preview-btn').forEach(btn=>{
            btn.addEventListener('click', ()=>{
                const vid=btn.dataset.id;
                const frame=document.getElementById(`adminsearch_frame_${vid}`);
                if(!frame) return;
                if(frame.style.display==='none'){
                    resultsEl.querySelectorAll('iframe').forEach(f=>{f.src='';f.style.display='none';});
                    resultsEl.querySelectorAll('.admin-preview-btn').forEach(b=>b.textContent='▶️ Prévia');
                    frame.src=`https://www.youtube.com/embed/${vid}?autoplay=1`;
                    frame.style.display='block';
                    btn.textContent='⏹ Fechar';
                } else {
                    frame.src=''; frame.style.display='none'; btn.textContent='▶️ Prévia';
                }
            });
        });
        resultsEl.querySelectorAll('.admin-search-queue-btn').forEach(b=>{
            b.addEventListener('click', async()=>{
                await addToQueueFromSearch({
                    videoId:b.dataset.id, title:b.dataset.title,
                    channel:b.dataset.channel, thumb:b.dataset.thumb,
                    url:`https://www.youtube.com/watch?v=${b.dataset.id}`
                }, null, 'manual');
                b.textContent='✅ Adicionado'; b.disabled=true;
            });
        });
    } catch(err){ resultsEl.innerHTML='<div class="suggest-empty">Erro na busca.</div>'; }
    finally{ btn.textContent='🔍 Buscar'; btn.disabled=false; }
}

async function addToQueueFromSearch(item, dest, source) {
    const slotId = dest&&dest.startsWith('slot_') ? parseInt(dest.replace('slot_','')) : null;
    await supabaseAdmin.from('music_queue').insert([{
        youtube_url:item.url, youtube_title:item.title,
        youtube_channel:item.channel, youtube_thumbnail:item.thumb,
        title:item.title, source,
        suggested_slot_id: slotId,
        status:'pending', conversion_status:'pending'
    }]);
    const {data}=await supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false});
    musicQueue=data||[]; renderQueueSection();
    showAdminFeedback('✅ Adicionado à fila!','success');
}

function showAdminFeedback(msg, type) {
    const el=document.getElementById('adminSearchFeedback');
    if(!el) return;
    el.textContent=msg; el.style.display='block';
    el.className=`suggest-feedback suggest-feedback-${type}`;
    setTimeout(()=>{el.style.display='none';},4000);
}

// ─────────────────────────────────────────────────────────────
// FILA DE APROVAÇÃO
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
                    <label style="font-size:11px;font-weight:700;color:#006b3f;">Destinos (selecione um ou mais):</label>
                    <div id="qdest_${m.id}" style="max-height:200px;overflow-y:auto;border:2px solid #e9ecef;border-radius:8px;padding:6px;margin-top:4px;background:#fafafa;">
                        ${buildDestinationsHTML(m.suggested_slot_id?`slot_${m.suggested_slot_id}`:'')}
                    </div>
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
    const destContainer = document.getElementById(`qdest_${id}`);
    const dests = getCheckedDestinations(destContainer);
    if(!dests.length){ alert('Selecione pelo menos um destino antes de aprovar.'); return; }

    const btn=document.querySelector(`#qcard_${id} .submit-btn`);
    if(btn){ btn.textContent='🔄 Convertendo...'; btn.disabled=true; }

    const updateStatus = (msg) => { if(btn) btn.textContent=msg; };

    try {
        let audioUrl = item.audio_url || null;
        if(!audioUrl) {
            audioUrl = await convertYoutubeToMp3(
                item.youtube_url,
                item.youtube_title,
                updateStatus
            );
        }

        if(!audioUrl) {
            if(btn){ btn.textContent='✅ Aprovar'; btn.disabled=false; }
            alert('❌ A conversão falhou.\n\nPossíveis causas:\n• Edge Function não foi deployada no Supabase\n• Música removida do YouTube\n• YouTube bloqueou temporariamente\n\nAguarde alguns minutos e tente novamente.');
            return;
        }

        if(audioUrl.includes('youtube.com') || audioUrl.includes('youtu.be')) {
            if(btn){ btn.textContent='✅ Aprovar'; btn.disabled=false; }
            alert('❌ A URL retornada ainda é do YouTube — Edge Function pode precisar ser redeploy.');
            return;
        }

        const convDone = true;
        await supabaseAdmin.from('music_queue').update({
            status:'approved',
            conversion_status: convDone ? 'done' : 'pending',
            audio_url: audioUrl,
            suggested_slot_id: null
        }).eq('id',id);

        const trackTitle  = item.title||item.youtube_title||'Música';
        const trackArtist = item.youtube_channel||null;
        let addedCount = 0;

        for(const dest of dests) {
            const isSeasonal = dest.startsWith('seasonal_');
            const isSlot     = dest.startsWith('slot_');
            const slotId     = isSlot     ? parseInt(dest.replace('slot_','')) : null;
            const seasonalCat= isSeasonal ? dest.replace('seasonal_','')       : null;

            let order = 0;
            if(isSlot) {
                const {data:maxD} = await supabase.from('slot_playlists')
                    .select('original_order').eq('slot_id',slotId)
                    .order('original_order',{ascending:false}).limit(1).maybeSingle();
                order = (maxD?.original_order??-1)+1;
                const {data:dup} = await supabase.from('slot_playlists')
                    .select('id').eq('slot_id',slotId).eq('audio_url',audioUrl).maybeSingle();
                if(dup) continue;
                await supabaseAdmin.from('slot_playlists').insert([{
                    slot_id:slotId, audio_url:audioUrl,
                    title:trackTitle, artist:trackArtist,
                    original_order:order, daily_order:order, enabled:true
                }]);
                await refreshSlotPlaylist(slotId);
            } else if(isSeasonal) {
                const {data:maxD} = await supabase.from('seasonal_playlists')
                    .select('play_order').eq('category',seasonalCat).eq('type','music')
                    .order('play_order',{ascending:false}).limit(1).maybeSingle();
                order = (maxD?.play_order??-1)+1;
                const {data:dup} = await supabase.from('seasonal_playlists')
                    .select('id').eq('category',seasonalCat).eq('audio_url',audioUrl).maybeSingle();
                if(dup) continue;
                await supabaseAdmin.from('seasonal_playlists').insert([{
                    category:seasonalCat, type:'music',
                    audio_url:audioUrl, title:trackTitle,
                    play_order:order, original_order:order, daily_order:order, enabled:true
                }]);
            } else {
                const {data:maxD} = await supabase.from('background_playlist')
                    .select('original_order').order('original_order',{ascending:false}).limit(1).maybeSingle();
                order = (maxD?.original_order??-1)+1;
                const {data:dup} = await supabase.from('background_playlist')
                    .select('id').eq('audio_url',audioUrl).maybeSingle();
                if(dup) continue;
                await supabaseAdmin.from('background_playlist').insert([{
                    audio_url:audioUrl, title:trackTitle,
                    play_order:order, original_order:order, daily_order:order, enabled:true
                }]);
                const {data}=await supabase.from('background_playlist').select('*').order('original_order',{ascending:true});
                backgroundPlaylist=data||[]; renderPlaylistTable();
            }
            addedCount++;
        }

        if(dests.some(d=>d.startsWith('seasonal_'))) {
            const [mRes,aRes] = await Promise.all([
                supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
                supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})
            ]);
            seasonalData={natal:{music:[],ads:[]},ano_novo:{music:[],ads:[]},pascoa:{music:[],ads:[]},sao_joao:{music:[],ads:[]}};
            (mRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].music.push(i);});
            (aRes.data||[]).forEach(i=>{if(seasonalData[i.category])seasonalData[i.category].ads.push(i);});
            renderAllSeasonalTables();
        }

        musicQueue=musicQueue.filter(m=>m.id!==id);
        renderQueueSection();
        setTimeout(()=>populateSlotSelects(), 100);
        alert(`✅ Música aprovada e adicionada em ${addedCount} destino(s)!`);
    } catch(err){ alert('❌ Erro ao aprovar: '+err.message); if(btn){btn.textContent='✅ Aprovar';btn.disabled=false;} }
}

// ─────────────────────────────────────────────────────────────
// CONVERSÃO YOUTUBE → MP3 via Supabase Edge Function
// A Edge Function roda no servidor: sem CORS, sem limite de download
// Fluxo: Cobalt (servidor) → upload Cloudinary → URL permanente
// ─────────────────────────────────────────────────────────────

const CONVERT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/convert-youtube`;
// Se configurou FUNCTION_SECRET no Supabase, coloque aqui:
const FUNCTION_SECRET = 'minhasenhasecreta123';

async function convertYoutubeToMp3(youtubeUrl, title, onProgress) {
    try {
        if (onProgress) onProgress('☁️ Convertendo via servidor...');

        const headers = {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        };
        if (FUNCTION_SECRET) headers['x-function-secret'] = FUNCTION_SECRET;

        const res = await fetch(CONVERT_FUNCTION_URL, {
            method:  'POST',
            headers,
            body:    JSON.stringify({ youtube_url: youtubeUrl, title }),
        });

        const data = await res.json();

        if (!res.ok || !data.audio_url) {
            console.warn('Edge Function erro:', data.error || data);
            return null;
        }

        if (onProgress) onProgress('✅ Convertido!');
        return data.audio_url; // URL permanente do Cloudinary

    } catch (err) {
        console.warn('convertYoutubeToMp3 erro:', err);
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
// DIAGNÓSTICO — detecta e permite corrigir músicas com URL inválida
// (salvas como youtube.com em vez de Cloudinary/MP3)
// ─────────────────────────────────────────────────────────────
async function scanAndFixBrokenTracks() {
    const btn = document.getElementById('scanBrokenBtn');
    if(btn) { btn.textContent = '🔍 Verificando...'; btn.disabled = true; }

    const container = document.getElementById('brokenTracksContainer');
    if(container) container.innerHTML = '<div style="color:#666;font-size:13px;padding:10px;">Varrendo todas as grades e playlists...</div>';

    // Varre TODAS as tabelas que contêm áudio — incluindo grades já publicadas
    const tables = [
        { name: 'slot_playlists',      label: 'Grades Horárias',   cols: 'id, title, audio_url, slot_id' },
        { name: 'background_playlist', label: 'Playlist de Fundo', cols: 'id, title, audio_url' },
        { name: 'seasonal_playlists',  label: 'Sazonais',          cols: 'id, title, audio_url, category' },
    ];

    let broken = [];
    let total  = 0;

    for (const t of tables) {
        try {
            const { data, error } = await supabase.from(t.name).select(t.cols);
            if(error) { console.error(t.name, error); continue; }
            total += (data||[]).length;
            (data || []).forEach(row => {
                const url = row.audio_url || '';
                const isBroken =
                    url.includes('youtube.com') ||
                    url.includes('youtu.be')    ||
                    url.includes('cobalt')       ||
                    url === ''                   ||
                    // não é Cloudinary nem arquivo de áudio direto
                    (!url.includes('cloudinary') &&
                     !url.endsWith('.mp3') &&
                     !url.endsWith('.wav') &&
                     !url.endsWith('.ogg') &&
                     !url.endsWith('.m4a') &&
                     !url.endsWith('.aac'));
                if (isBroken) {
                    broken.push({
                        ...row,
                        table:      t.name,
                        tableLabel: t.label,
                        context:    row.slot_id ? `Grade #${row.slot_id}` : (row.category || 'Geral')
                    });
                }
            });
        } catch(err) { console.error(t.name, err); }
    }

    if (!container) { if(btn){ btn.textContent='🔍 Verificar Músicas'; btn.disabled=false; } return; }

    if (!broken.length) {
        container.innerHTML = `<div style="color:#155724;background:#d4edda;padding:12px 16px;border-radius:8px;font-weight:600;">✅ Tudo certo! ${total} músicas verificadas — nenhuma URL inválida encontrada.</div>`;
        if(btn){ btn.textContent='🔍 Verificar Músicas'; btn.disabled=false; }
        return;
    }

    // Agrupa por tabela para facilitar a leitura
    const byTable = {};
    broken.forEach(b => {
        if(!byTable[b.tableLabel]) byTable[b.tableLabel] = [];
        byTable[b.tableLabel].push(b);
    });

    container.innerHTML = `
        <div style="color:#721c24;background:#f8d7da;padding:12px 16px;border-radius:8px;margin-bottom:14px;font-weight:600;">
            ⚠️ ${broken.length} música(s) com URL inválida em ${total} verificadas — essas não reproduzem no player
        </div>
        <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="submit-btn" style="background:#e65100;font-size:12px;padding:7px 14px;"
                onclick="reconvertAllBroken()">🔄 Reconverter Todas Automaticamente</button>
            <small style="color:#666;align-self:center;">ou corrija individualmente abaixo</small>
        </div>
        ${Object.entries(byTable).map(([label, items]) => `
            <div style="margin-bottom:16px;">
                <h4 style="color:#495057;font-size:13px;margin-bottom:8px;padding:6px 10px;background:#f8f9fa;border-radius:6px;">
                    📁 ${label} — ${items.length} música(s)
                </h4>
                ${items.map(t => `
                <div style="border:1px solid #ddd;border-radius:10px;padding:12px 14px;margin-bottom:8px;background:#fff;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
                        <div style="flex:1;">
                            <div style="font-weight:700;font-size:13px;">${t.title || '(sem título)'}</div>
                            <div style="font-size:11px;color:#666;margin-top:2px;">${t.context}</div>
                            <div style="font-size:11px;color:#dc3545;word-break:break-all;margin-top:4px;">${t.audio_url || '(vazio)'}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;">
                        <button class="submit-btn" style="font-size:11px;padding:5px 10px;background:#17a2b8;"
                            id="reconvBtn_${t.table}_${t.id}"
                            onclick="reconvertSingle('${t.table}', ${t.id}, '${(t.audio_url||'').replace(/'/g,'').slice(0,200)}', '${(t.title||'').replace(/'/g,'')}')">
                            🔄 Reconverter
                        </button>
                        <button class="btn-delete" style="font-size:11px;padding:5px 10px;"
                            onclick="deleteBrokenTrack('${t.table}', ${t.id}, this)">
                            🗑️ Remover
                        </button>
                    </div>
                    <div id="reconvStatus_${t.table}_${t.id}" style="font-size:11px;color:#006b3f;margin-top:6px;display:none;"></div>
                </div>`).join('')}
            </div>`).join('')}`;

    if(btn){ btn.textContent='🔍 Verificar Músicas'; btn.disabled=false; }
}

// Reconverte uma música individual: extrai ID do YouTube da URL salva, converte de novo
async function reconvertSingle(table, id, youtubeUrl, title) {
    const btn    = document.getElementById(`reconvBtn_${table}_${id}`);
    const status = document.getElementById(`reconvStatus_${table}_${id}`);
    if(btn)    { btn.textContent = '⏳ Convertendo...'; btn.disabled = true; }
    if(status) { status.style.display='block'; status.textContent='☁️ Chamando servidor...'; }

    // Se a URL salva já é do YouTube, usa ela direto
    // Se não, tenta extrair o video ID de alguma forma
    let ytUrl = youtubeUrl;
    if (!ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be')) {
        if(btn)    { btn.textContent='🔄 Reconverter'; btn.disabled=false; }
        if(status) { status.textContent='❌ URL não é do YouTube — cole manualmente no Cloudinary.'; status.style.color='#dc3545'; }
        return;
    }

    try {
        const newUrl = await convertYoutubeToMp3(ytUrl, title, (msg) => {
            if(status) status.textContent = msg;
        });
        if (!newUrl || newUrl.includes('youtube.com')) {
            throw new Error('Conversão retornou URL inválida');
        }
        await supabaseAdmin.from(table).update({ audio_url: newUrl }).eq('id', id);
        if(status) { status.textContent = `✅ Corrigido! ${newUrl.slice(0,60)}...`; status.style.color='#006b3f'; }
        if(btn)    { btn.textContent = '✅ Pronto'; btn.disabled = true; btn.style.background='#28a745'; }
    } catch(err) {
        if(status) { status.textContent = `❌ Falhou: ${err.message}`; status.style.color='#dc3545'; }
        if(btn)    { btn.textContent = '🔄 Tentar de Novo'; btn.disabled = false; }
    }
}

// Reconverte todas as músicas quebradas em sequência
async function reconvertAllBroken() {
    if(!confirm('Isso tentará reconverter TODAS as músicas com URL inválida automaticamente. Pode demorar alguns minutos. Continuar?')) return;
    const allBtns = document.querySelectorAll('[id^="reconvBtn_"]');
    for (const btn of allBtns) {
        if(!btn.disabled) btn.click();
        await new Promise(r => setTimeout(r, 3000)); // aguarda 3s entre cada
    }
}

async function fixBrokenTrack(table, id) {
    const inp = document.getElementById(`fix_${table}_${id}`);
    const newUrl = inp?.value?.trim();
    if (!newUrl) { alert('Cole a URL do Cloudinary antes de salvar.'); return; }
    if (newUrl.includes('youtube.com') || newUrl.includes('youtu.be')) {
        alert('Esta URL ainda é do YouTube. Faça o upload no Cloudinary primeiro.'); return;
    }
    try {
        await supabaseAdmin.from(table).update({ audio_url: newUrl }).eq('id', id);
        alert('✅ URL corrigida!');
        scanAndFixBrokenTracks();
    } catch(err) { alert('❌ Erro: ' + err.message); }
}

async function deleteBrokenTrack(table, id, btnEl) {
    if (!confirm('Remover esta música da playlist?')) return;
    try {
        await supabaseAdmin.from(table).delete().eq('id', id);
        btnEl.closest('div[style*="border"]').remove();
    } catch(err) { alert('❌ Erro: ' + err.message); }
}

window.scanAndFixBrokenTracks = scanAndFixBrokenTracks;
window.fixBrokenTrack         = fixBrokenTrack;
window.deleteBrokenTrack      = deleteBrokenTrack;
window.reconvertSingle        = reconvertSingle;
window.reconvertAllBroken     = reconvertAllBroken;

// ─────────────────────────────────────────────────────────────
// YOUTUBE — adicionar músicas
// ─────────────────────────────────────────────────────────────
function populateSlotSelects() {
    // Popula selects simples (manual/auto preview, não os de destino)
    const slotOptions =
        '<option value="">Selecione o destino</option>' +
        visibleSlots().map(s=>
            `<option value="slot_${s.id}">${s.name}</option>`
        ).join('') +
        '<option value="seasonal_natal">🎄 Natal</option>' +
        '<option value="seasonal_ano_novo">🎆 Ano-Novo</option>' +
        '<option value="seasonal_pascoa">🐰 Páscoa</option>' +
        '<option value="seasonal_sao_joao">🔥 São João</option>' +
        '<option value="general">🎵 Playlist de Fundo</option>';

    document.querySelectorAll('#ytSlotManual, #ytSlotAuto').forEach(el => { el.innerHTML = slotOptions; });

    // Reconstrói checkboxes dos destinos do YouTube manual e automático
    const ytDestManual = document.getElementById('ytDestManualContainer');
    const ytDestAuto   = document.getElementById('ytDestAutoContainer');
    if(ytDestManual) ytDestManual.innerHTML = buildDestinationsHTML('');
    if(ytDestAuto)   ytDestAuto.innerHTML   = buildDestinationsHTML('');
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
        document.getElementById('ytUrlManual').value='';
        const f=document.getElementById('ytManualPreviewFrame');
        if(f){f.src='';f.style.display='none';}
        const b=document.getElementById('ytManualPreviewBtn');
        if(b) b.textContent='▶️ Ouvir Prévia';
        ytManualData=null;
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
        // Botão/iframe de prévia no card
        const prevBtn=document.getElementById('ytManualPreviewBtn');
        const prevFrame=document.getElementById('ytManualPreviewFrame');
        if(prevBtn&&prevFrame){
            prevBtn.onclick=()=>{
                if(prevFrame.style.display==='none'){
                    prevFrame.src=`https://www.youtube.com/embed/${data.id}?autoplay=1`;
                    prevFrame.style.display='block'; prevBtn.textContent='⏹ Fechar Prévia';
                } else {
                    prevFrame.src=''; prevFrame.style.display='none'; prevBtn.textContent='▶️ Ouvir Prévia';
                }
            };
        }
        document.getElementById('ytPreviewResult').style.display='block';
    } catch(err){ alert('❌ Erro: '+err.message); }
    finally{ btn.textContent='🔍 Visualizar'; btn.disabled=false; }
}

async function handleYTAddManual() {
    if(!ytManualData) return;
    const destContainer = document.getElementById('ytDestManualContainer');
    const destinations = getCheckedDestinations(destContainer);
    if(!destinations.length){ alert('Selecione pelo menos um destino.'); return; }

    const btn = document.getElementById('ytAddManualBtn');
    btn.textContent='⏳ Enviando...'; btn.disabled=true;

    try {
        for(const dest of destinations) {
            const slotId = dest.startsWith('slot_') ? parseInt(dest.replace('slot_','')) : null;
            await supabaseAdmin.from('music_queue').insert([{
                youtube_url: ytManualData.url,
                youtube_title: ytManualData.title,
                youtube_channel: ytManualData.channel,
                youtube_thumbnail: ytManualData.thumbnail,
                title: ytManualData.title,
                suggested_slot_id: slotId,
                source: 'manual',
                status: 'pending',
                conversion_status: 'pending'
            }]);
        }
        document.getElementById('ytPreviewResult').style.display='none';
        document.getElementById('ytUrlManual').value=''; ytManualData=null;
        const {data}=await supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false});
        musicQueue=data||[]; renderQueueSection();
        alert(`✅ Adicionado à fila para ${destinations.length} destino(s)!`);
    } catch(err){ alert('❌ Erro: '+err.message); }
    finally{ btn.textContent='➕ Enviar para Fila'; btn.disabled=false; }
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
        document.getElementById('ytAutoResultsList').innerHTML=filtered.map((item,i)=>`
            <div class="yt-result-row">
                <input type="checkbox" class="yt-result-check" id="ytcheck_${i}"
                    data-id="${item.id.videoId}"
                    data-title="${item.snippet.title.replace(/"/g,'')}"
                    data-channel="${item.snippet.channelTitle.replace(/"/g,'')}"
                    data-thumb="${item.snippet.thumbnails?.default?.url||''}"
                    checked>
                <img src="${item.snippet.thumbnails?.default?.url}" alt="" style="width:60px;border-radius:4px;">
                <div>
                    <div style="font-size:13px;font-weight:500;">${item.snippet.title}</div>
                    <div style="font-size:11px;color:#666;">${item.snippet.channelTitle}</div>
                </div>
            </div>`).join('');
        document.getElementById('ytAutoResults').style.display='block';
    } catch(err){ alert('❌ Erro: '+err.message); }
    finally{ btn.textContent='🔍 Buscar'; btn.disabled=false; }
}

async function handleYTAutoAddSelected() {
    const checked=document.querySelectorAll('.yt-result-check:checked');
    if(!checked.length){ alert('Selecione pelo menos uma música.'); return; }
    const destContainer = document.getElementById('ytDestAutoContainer');
    const destinations = getCheckedDestinations(destContainer);
    if(!destinations.length){ alert('Selecione pelo menos um destino.'); return; }

    const btn = document.getElementById('ytAutoAddSelectedBtn');
    btn.textContent='⏳ Enviando...'; btn.disabled=true;

    let count=0;
    try {
        for(const cb of checked) {
            for(const dest of destinations) {
                const slotId = dest.startsWith('slot_') ? parseInt(dest.replace('slot_','')) : null;
                await supabaseAdmin.from('music_queue').insert([{
                    youtube_url:`https://www.youtube.com/watch?v=${cb.dataset.id}`,
                    youtube_title:cb.dataset.title, youtube_channel:cb.dataset.channel,
                    youtube_thumbnail:cb.dataset.thumb, title:cb.dataset.title,
                    suggested_slot_id: slotId,
                    source:'auto', status:'pending', conversion_status:'pending'
                }]); count++;
            }
        }
        alert(`✅ ${count} entrada(s) na fila (${checked.length} música(s) × ${destinations.length} destino(s))!`);
        document.getElementById('ytAutoResults').style.display='none';
        document.getElementById('ytAutoResultsList').innerHTML='';
        document.getElementById('ytAutoQuery').value='';
        const {data}=await supabase.from('music_queue').select('*').eq('status','pending').order('created_at',{ascending:false});
        musicQueue=data||[]; renderQueueSection();
    } catch(err){ alert('❌ Erro: '+err.message); }
    finally{ btn.textContent='➕ Enviar Selecionadas'; btn.disabled=false; }
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
    populateTTSVoices(); // preenche select com vozes nativas do navegador
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

// ─── TTS: Web Speech API nativa (gratuita, sem cadastro, sem chave) ──────────
function populateTTSVoices() {
    const sel = document.getElementById('ttsVoiceSelect');
    if(!sel || !window.speechSynthesis) return;
    const fill = () => {
        const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('pt'));
        if(!voices.length) return;
        sel.innerHTML = voices.map(v =>
            `<option value="${v.name}">${v.name} (${v.lang})</option>`
        ).join('');
        // Prioriza Microsoft Francisca (Windows) > Google Português > qualquer pt-BR
        const preferred = voices.find(v => v.name.includes('Francisca'))
            || voices.find(v => v.name.includes('Google') && v.lang === 'pt-BR')
            || voices.find(v => v.lang === 'pt-BR')
            || voices[0];
        if(preferred) sel.value = preferred.name;
    };
    fill();
    speechSynthesis.onvoiceschanged = fill;
}

function speakLocally(text, onEnd) {
    if(!window.speechSynthesis) { if(onEnd) onEnd(); return; }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'pt-BR';
    utt.rate = 0.88;
    utt.pitch = 1.05;
    utt.volume = 1;
    const sel = document.getElementById('ttsVoiceSelect');
    const selectedName = sel?.value;
    const voices = speechSynthesis.getVoices();
    const match = selectedName
        ? voices.find(v => v.name === selectedName)
        : voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt'));
    if(match) utt.voice = match;
    if(onEnd) utt.onend = onEnd;
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
    else if(bulkTableName?.startsWith('tableMusic')) tableName='seasonal_playlists';
    else if(bulkTableName?.includes('Slot'))         tableName='slot_playlists';

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
    const slots=visibleSlots();
    if(!slots.length){ tabsEl.innerHTML=''; contentEl.innerHTML='<div class="grade-empty">Nenhuma grade configurada.</div>'; return; }
    tabsEl.innerHTML=slots.map(s=>`
        <button class="grade-tab${currentGradeTab===s.id?' active':''}" data-slot-id="${s.id}" style="border-bottom-color:${s.color}">
            <span class="grade-tab-dot" style="background:${s.color}"></span>${s.name}
            <span class="grade-tab-count">${(slotPlaylists[s.id]||[]).length}</span>
        </button>`).join('');
    if(!currentGradeTab&&slots.length) currentGradeTab=slots[0].id;
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
        const {data:existing} = await supabase.from('slot_playlists')
            .select('id,title').eq('slot_id',slotId).eq('audio_url',url).maybeSingle();
        if(existing) { alert(`⚠️ Esta música já está na grade!\n"${existing.title}"`); return; }

        const {data:maxData} = await supabase.from('slot_playlists')
            .select('original_order').eq('slot_id',slotId)
            .order('original_order',{ascending:false}).limit(1).maybeSingle();
        const nextOrder = (maxData?.original_order ?? -1) + 1;

        const {error}=await supabaseAdmin.from('slot_playlists').insert([{
            slot_id:slotId, audio_url:url, title,
            artist:artist||null, genre:genre||null,
            original_order:nextOrder, daily_order:nextOrder, enabled:true
        }]);
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
    ['slotUrl','slotTitle','slotArtist','slotGenre'].forEach(f=>{
        const el=document.getElementById(`${f}_${slotId}`);
        if(el) el.value='';
    });
    const ord=document.getElementById(`slotOrder_${slotId}`);
    if(ord) ord.value='0';
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
    const u=document.getElementById(`jingleUrl_${slotId}`);
    const t=document.getElementById(`jingleTitle_${slotId}`);
    if(u) u.value='';
    if(t) t.value='';
}

async function refreshSlotJingles(slotId) {
    const {data}=await supabase.from('jingles').select('*').eq('slot_id',slotId);
    slotJingles[slotId]=data||[]; renderGradeContent(slotId);
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
        const ord=f.querySelector('.seasonal-order'); if(ord) ord.value='0';
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
            form.querySelector('.jingle-clear')?.addEventListener('click',e=>{ const f=e.target.closest('form'); const u=f.querySelector('.jingle-url'); const t=f.querySelector('.jingle-title'); if(u)u.value=''; if(t)t.value=''; });
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
            const {data:dup} = await supabase.from('seasonal_playlists')
                .select('id,title').eq('audio_url',url).eq('category',category).maybeSingle();
            if(dup){ alert(`⚠️ Esta música já está na playlist de ${category}!\n"${dup.title}"`); return; }

            const {data:maxData} = await supabase.from('seasonal_playlists')
                .select('play_order').eq('category',category).eq('type',type)
                .order('play_order',{ascending:false}).limit(1).maybeSingle();
            nextOrder = (maxData?.play_order ?? -1) + 1;
        }

        const payload={category,type,audio_url:url,title,play_order:nextOrder,enabled:true};
        if(type==='music'){payload.original_order=nextOrder;payload.daily_order=nextOrder;}
        if(type==='ad'){payload.advertiser=advertiser;payload.frequency=frequency;}
        if(editingSeasonalId){ await supabaseAdmin.from('seasonal_playlists').update(payload).eq('id',editingSeasonalId); alert('✅ Atualizado!'); }
        else { await supabaseAdmin.from('seasonal_playlists').insert([payload]); alert(`✅ Adicionado! Numeração: ${nextOrder}`); }
        form.reset();
        const ord=form.querySelector('.seasonal-order'); if(ord) ord.value='0';
        const frq=form.querySelector('.seasonal-frequency'); if(frq) frq.value='3';
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
    const ord=form.querySelector('.seasonal-order'); if(ord) ord.value=type==='music'?(item.original_order||0):item.play_order;
    if(type==='ad'){
        const adv=form.querySelector('.seasonal-advertiser'); if(adv) adv.value=item.advertiser||'';
        const frq=form.querySelector('.seasonal-frequency'); if(frq) frq.value=item.frequency||3;
    }
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
            await supabaseAdmin.from('background_playlist')
                .update({audio_url:url,title,enabled})
                .eq('id',editingPlaylistId);
            alert('✅ Atualizado!');
        } else {
            const {data:dup} = await supabase.from('background_playlist')
                .select('id,title').eq('audio_url',url).maybeSingle();
            if(dup){ alert(`⚠️ Esta música já está na playlist!\n"${dup.title}"`); return; }

            const {data:maxData} = await supabase.from('background_playlist')
                .select('original_order').order('original_order',{ascending:false}).limit(1).maybeSingle();
            const nextOrder = (maxData?.original_order ?? -1) + 1;

            await supabaseAdmin.from('background_playlist').insert([{
                audio_url:url, title,
                play_order:nextOrder, original_order:nextOrder,
                daily_order:nextOrder, enabled
            }]);
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
    if(!advertisements.length){ tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:30px;color:#999;">Nenhuma propaganda.</td></tr>'; return; }
    tbody.innerHTML=advertisements.map(ad=>{
        const horario = (ad.start_hour!=null && ad.end_hour!=null)
            ? `${String(ad.start_hour).padStart(2,'0')}h–${String(ad.end_hour).padStart(2,'0')}h`
            : '🕐 Sempre';
        const lastPlayed = ad.last_played
            ? new Date(ad.last_played).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
            : '-';
        return `<tr>
            <td style="font-weight:bold;">${ad.play_order}</td>
            <td style="font-weight:500;">${ad.title}</td>
            <td>${ad.advertiser||'-'}</td>
            <td><span style="padding:3px 8px;background:#e3f2fd;border-radius:10px;font-size:11px;font-weight:bold;color:#1976d2;">A cada ${ad.frequency}</span></td>
            <td style="font-size:12px;color:#555;">${horario}</td>
            <td><span style="padding:3px 8px;background:#e6f4ed;border-radius:10px;font-size:11px;font-weight:bold;color:#006b3f;">${ad.play_count||0}×</span></td>
            <td style="font-size:11px;color:#888;">${lastPlayed}</td>
            <td><span class="status-badge ${ad.enabled?'active':'inactive'}">${ad.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td><div class="action-btns">
                <button class="btn-edit ad-edit-btn" data-id="${ad.id}">✏️</button>
                <button class="btn-toggle ad-toggle-btn" data-id="${ad.id}" data-enabled="${ad.enabled}">${ad.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete ad-delete-btn" data-id="${ad.id}">🗑️</button>
            </div></td>
        </tr>`;
    }).join('');
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
    const startHourVal=document.getElementById('adStartHour')?.value;
    const endHourVal=document.getElementById('adEndHour')?.value;
    const startHour=startHourVal!==''&&startHourVal!=null?parseInt(startHourVal):null;
    const endHour=endHourVal!==''&&endHourVal!=null?parseInt(endHourVal):null;
    if(!url||!title){ alert('Preencha URL e Título!'); return; }
    if(frequency<1||frequency>100){ alert('Frequência entre 1 e 100!'); return; }
    try {
        const payload={audio_url:url,title,advertiser:advertiser||null,frequency,play_order:order,enabled,
            start_hour:startHour,end_hour:endHour};
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
    const sh=document.getElementById('adStartHour'); const eh=document.getElementById('adEndHour');
    if(sh) sh.value=ad.start_hour!=null?ad.start_hour:'';
    if(eh) eh.value=ad.end_hour!=null?ad.end_hour:'';
    document.getElementById('adsForm').scrollIntoView({behavior:'smooth',block:'center'});
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
    ['adUrl','adTitle','adAdvertiser','adStartHour','adEndHour'].forEach(f=>{
        const el=document.getElementById(f); if(el) el.value='';
    });
    document.getElementById('adFrequency').value='3'; document.getElementById('adOrder').value='0';
    document.getElementById('adEnabled').checked=true; editingAdId=null;
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────
async function loadAnalytics() {
    const container = document.getElementById('analyticsContent') || document.getElementById('analyticsContainer');
    if(!container) return;
    container.innerHTML = '<div class="grade-empty">Carregando analytics...</div>';
    try {
        const {count: totalCount} = await supabase.from('play_log').select('*', {count:'exact', head:true});
        const {data: topTracks} = await supabase
            .from('play_log').select('title, artist, slot_name')
            .not('title','is',null)
            .order('played_at', {ascending:false})
            .limit(500);

        const freq = {};
        (topTracks||[]).forEach(t => {
            const key = t.title;
            if(!freq[key]) freq[key] = {title:t.title, artist:t.artist, slot:t.slot_name, count:0};
            freq[key].count++;
        });
        const sorted = Object.values(freq).sort((a,b) => b.count - a.count).slice(0,10);

        const {data: bySlot} = await supabase
            .from('play_log').select('slot_name')
            .not('slot_name','is',null)
            .order('played_at', {ascending:false})
            .limit(1000);

        const slotFreq = {};
        (bySlot||[]).forEach(r => { slotFreq[r.slot_name] = (slotFreq[r.slot_name]||0) + 1; });
        const slotSorted = Object.entries(slotFreq).sort((a,b)=>b[1]-a[1]);

        const {data: recent} = await supabase
            .from('play_log').select('*')
            .order('played_at', {ascending:false})
            .limit(10);

        container.innerHTML = `
            <div class="analytics-summary">
                <div class="analytics-stat"><div class="as-num">${totalCount||0}</div><div class="as-label">Reproduções totais</div></div>
                <div class="analytics-stat"><div class="as-num">${sorted.length}</div><div class="as-label">Músicas únicas</div></div>
                <div class="analytics-stat"><div class="as-num">${slotSorted.length}</div><div class="as-label">Grades ativas</div></div>
            </div>
            <h4 style="margin:20px 0 10px;color:#333;">🏆 Músicas mais tocadas</h4>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>#</th><th>Título</th><th>Artista</th><th>Grade</th><th>Reproduções</th></tr></thead>
                    <tbody>${sorted.map((t,i)=>`<tr><td style="font-weight:700;color:#006b3f;">${i+1}</td><td style="font-weight:500;">${t.title||'-'}</td><td style="color:#666;">${t.artist||'-'}</td><td style="color:#666;">${t.slot||'-'}</td><td><span style="padding:3px 10px;background:#e6f4ed;border-radius:10px;font-weight:700;color:#006b3f;">${t.count}×</span></td></tr>`).join('')}</tbody>
                </table>
            </div>
            <h4 style="margin:20px 0 10px;color:#333;">🕐 Reproduções por grade</h4>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>Grade</th><th>Reproduções</th></tr></thead>
                    <tbody>${slotSorted.map(([slot,count])=>`<tr><td style="font-weight:500;">${slot}</td><td><span style="padding:3px 10px;background:#e3f2fd;border-radius:10px;font-weight:700;color:#1976d2;">${count}×</span></td></tr>`).join('')}</tbody>
                </table>
            </div>
            <h4 style="margin:20px 0 10px;color:#333;">🕐 Últimas reproduções</h4>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>Título</th><th>Grade</th><th>Horário</th></tr></thead>
                    <tbody>${(recent||[]).map(r=>`<tr><td style="font-weight:500;">${r.title||'-'}</td><td style="color:#666;">${r.slot_name||'-'}</td><td style="color:#999;font-size:11px;">${new Date(r.played_at).toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div style="margin-top:12px;"><button class="clear-btn" onclick="clearAnalytics()">🗑️ Limpar histórico</button></div>
        `;
    } catch(err) {
        container.innerHTML = `<div class="grade-empty">Erro ao carregar analytics: ${err.message}</div>`;
    }
}

async function clearAnalytics() {
    if(!confirm('Deletar todo o histórico de reproduções?')) return;
    await supabaseAdmin.from('play_log').delete().neq('id', 0);
    loadAnalytics();
}

// ─────────────────────────────────────────────────────────────
// ALERTA DE EMERGÊNCIA
// ─────────────────────────────────────────────────────────────
async function loadEmergencyState() {
    try {
        const {data} = await supabase.from('emergency_state').select('*').eq('id',1).single();
        if(!data) return;
        emergencyActive = data.is_active;
        renderEmergencyUI(data);
    } catch(err) { console.error(err); }
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
        if(txt) txt.textContent = '🚨 ALERTA ATIVO — todos os players em modo de emergência';
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
    const useTTS    = document.querySelector('input[name="emergencyType"]:checked')?.value !== 'audio';
    const voice     = document.getElementById('emergencyVoice')?.value || 'Brazilian Portuguese Female';

    if(newStatus && !message && !audioUrl) {
        alert('Preencha a mensagem de texto ou a URL do áudio de emergência.'); return;
    }

    try {
        await supabaseAdmin.from('emergency_state').update({
            is_active:    newStatus,
            message:      message  || null,
            audio_url:    audioUrl || null,
            use_tts:      useTTS,
            voice:        voice,
            activated_at: newStatus ? new Date().toISOString() : null,
            updated_at:   new Date().toISOString()
        }).eq('id', 1);

        emergencyActive = newStatus;
        renderEmergencyUI({ is_active: newStatus });
    } catch(err) { alert('❌ Erro: ' + err.message); }
}

function setupEmergencyListeners() {
    document.getElementById('emergencyBtn')?.addEventListener('click', toggleEmergency);
    supabase.channel('emergency_admin')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_state'},
            payload => { emergencyActive = payload.new.is_active; renderEmergencyUI(payload.new); })
        .subscribe();
}

window.setEmergencyMessage = function(msg) {
    const el = document.getElementById('emergencyMessage');
    if(el) el.value = msg;
    const ttsRadio = document.getElementById('emergencyUseTTS');
    if(ttsRadio) {
        ttsRadio.checked = true;
        document.getElementById('emergencyTTSGroup').style.display = 'block';
        document.getElementById('emergencyAudioGroup').style.display = 'none';
    }
};

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
            const buf    = new ArrayBuffer(inputData.length * 2);
            const view   = new DataView(buf);
            for(let i=0;i<inputData.length;i++) view.setInt16(i*2, Math.max(-1,Math.min(1,inputData[i]))*0x7FFF, true);
            const bytes  = new Uint8Array(buf);
            let binary   = '';
            for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
            const chunk  = btoa(binary);
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
        btn.textContent = '🎙️ Iniciar ao Vivo';
        btn.classList.remove('active');
        if(ind) ind.classList.remove('active');
        if(txt) txt.textContent = 'Microfone inativo';
    }
}

// ─────────────────────────────────────────────────────────────
// GRADES — toggle ativo/inativo
// ─────────────────────────────────────────────────────────────
async function toggleGrades() {
    const btn = document.getElementById('gradesToggleBtn');
    if(!btn) return;
    const isActive = btn.classList.contains('active');
    const newStatus = !isActive;
    try {
        await supabaseAdmin.from('radio_settings')
            .update({ grades_enabled: newStatus, updated_at: new Date().toISOString() })
            .eq('id', 1);
        btn.classList.toggle('active', newStatus);
        btn.classList.toggle('inactive', !newStatus);
        btn.textContent = newStatus ? '✅ Ativadas' : '⏸️ Desativadas';
        alert(newStatus
            ? '✅ Grades horárias ativadas!'
            : '⏸️ Grades desativadas. O player usará a Playlist de Fundo.');
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
// REALTIME
// ─────────────────────────────────────────────────────────────
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
// NAVEGAÇÃO
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
    // Novos módulos — registra listeners após DOM pronto
    setupBlacklistListeners();
    setupCreateGradeListeners();
    setupSilenceListeners();
    setupFlashListeners();
});

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function testAudioUrl(url) {
    if(!url){ alert('Insira uma URL!'); return; }
    testAudio.src=url;
    testAudio.play().then(()=>{ alert('▶️ Reproduzindo...\nClique OK para parar.'); testAudio.pause(); testAudio.currentTime=0; }).catch(()=>alert('❌ Erro ao reproduzir.'));
}

// ─────────────────────────────────────────────────────────────
// GLOBAIS — acessíveis via onclick no HTML gerado
// ─────────────────────────────────────────────────────────────
window.editSlotTrack          = editSlotTrack;
window.toggleSlotTrack        = toggleSlotTrack;
window.deleteSlotTrack        = deleteSlotTrack;
window.clearSlotForm          = clearSlotForm;
window.handleForceShuffleSlot = handleForceShuffleSlot;
window.editPlaylist           = editPlaylist;
window.togglePlaylist         = togglePlaylist;
window.deletePlaylist         = deletePlaylist;
window.editAd                 = editAd;
window.toggleAd               = toggleAd;
window.deleteAd               = deleteAd;
window.editSeasonalItem       = editSeasonalItem;
window.toggleSeasonalItem     = toggleSeasonalItem;
window.deleteSeasonalItem     = deleteSeasonalItem;
window.toggleJingle           = toggleJingle;
window.deleteJingle           = deleteJingle;
window.clearJingleForm        = clearJingleForm;
window.toggleSeasonalJingle   = toggleSeasonalJingle;
window.deleteSeasonalJingle   = deleteSeasonalJingle;
window.testAudioUrl           = testAudioUrl;
window.approveQueueItem       = approveQueueItem;
window.rejectQueueItem        = rejectQueueItem;
window.toggleYTPreview        = toggleYTPreview;
window.selectLocutorTrack     = selectLocutorTrack;
window.deleteLocutorTrack     = deleteLocutorTrack;
window.loadTTSText            = loadTTSText;
window.playTTSFromLib         = playTTSFromLib;
window.deleteTTSItem          = deleteTTSItem;
window.goSection              = goSection;
window.toggleGrades           = toggleGrades;
window.loadAnalytics          = loadAnalytics;
window.clearAnalytics         = clearAnalytics;
window.loadEmergencyState     = loadEmergencyState;
window.startLiveLocutor       = startLiveLocutor;

// ═════════════════════════════════════════════════════════════
// BLACKLIST DE MÚSICAS
// ═════════════════════════════════════════════════════════════
let blacklist = [];

async function loadBlacklist() {
    const { data } = await supabase.from('music_blacklist').select('*').order('created_at', { ascending: false });
    blacklist = data || [];
    renderBlacklist();
}

function renderBlacklist() {
    const tbody = document.getElementById('blacklistTableBody');
    if (!tbody) return;
    if (!blacklist.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">Nenhuma música bloqueada.</td></tr>';
        return;
    }
    tbody.innerHTML = blacklist.map(b => `
        <tr>
            <td style="font-weight:500;">${b.title || '-'}</td>
            <td>${b.artist || '-'}</td>
            <td style="font-size:12px;color:#666;">${b.reason || '-'}</td>
            <td style="font-size:12px;">${b.blocked_by || '-'}</td>
            <td style="font-size:11px;color:#888;">${new Date(b.created_at).toLocaleDateString('pt-BR')}</td>
            <td><button class="btn-delete bl-remove-btn" data-id="${b.id}" data-url="${b.audio_url}">🔓 Desbloquear</button></td>
        </tr>`).join('');
    tbody.querySelectorAll('.bl-remove-btn').forEach(b => b.addEventListener('click', () => removeFromBlacklist(parseInt(b.dataset.id), b.dataset.url)));
}

function setupBlacklistListeners() {
    document.getElementById('blacklistForm')?.addEventListener('submit', handleAddBlacklist);
}

async function handleAddBlacklist(e) {
    e.preventDefault();
    const url    = document.getElementById('blacklistUrl').value.trim();
    const title  = document.getElementById('blacklistTitle').value.trim();
    const artist = document.getElementById('blacklistArtist').value.trim();
    const reason = document.getElementById('blacklistReason').value.trim();
    const by     = document.getElementById('blacklistBy').value.trim();
    if (!url) { alert('Informe a URL!'); return; }
    try {
        await supabaseAdmin.from('music_blacklist').insert([{
            audio_url: url, title: title || null, artist: artist || null,
            reason: reason || null, blocked_by: by || null
        }]);
        // Desativa a música em todas as grades onde ela aparecer
        await Promise.all([
            supabaseAdmin.from('slot_playlists').update({ enabled: false }).eq('audio_url', url),
            supabaseAdmin.from('background_playlist').update({ enabled: false }).eq('audio_url', url),
            supabaseAdmin.from('seasonal_playlists').update({ enabled: false }).eq('audio_url', url)
        ]);
        alert('🚫 Música bloqueada e desativada em todas as grades!');
        clearBlacklistForm();
        await loadBlacklist();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function removeFromBlacklist(id, url) {
    if (!confirm('Desbloquear esta música? Ela não será reativada automaticamente nas grades.')) return;
    await supabaseAdmin.from('music_blacklist').delete().eq('id', id);
    blacklist = blacklist.filter(b => b.id !== id);
    renderBlacklist();
}

function clearBlacklistForm() {
    ['blacklistUrl','blacklistTitle','blacklistArtist','blacklistReason','blacklistBy'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
}
window.clearBlacklistForm = clearBlacklistForm;

// ═════════════════════════════════════════════════════════════
// CRIAR GRADE HORÁRIA
// ═════════════════════════════════════════════════════════════
function showCreateGradeForm() {
    const card = document.getElementById('createGradeCard');
    if (card) { card.style.display = 'block'; card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
function hideCreateGradeForm() {
    const card = document.getElementById('createGradeCard');
    if (card) card.style.display = 'none';
}
window.showCreateGradeForm = showCreateGradeForm;
window.hideCreateGradeForm = hideCreateGradeForm;

function setupCreateGradeListeners() {
    document.getElementById('createGradeForm')?.addEventListener('submit', handleCreateGrade);
}

async function handleCreateGrade(e) {
    e.preventDefault();
    const name      = document.getElementById('newGradeName').value.trim();
    const desc      = document.getElementById('newGradeDesc').value.trim();
    const genres    = document.getElementById('newGradeGenres').value.trim();
    const startHour = parseInt(document.getElementById('newGradeStart').value);
    const endHour   = parseInt(document.getElementById('newGradeEnd').value);
    const color     = document.getElementById('newGradeColor').value;
    const adFreq    = parseInt(document.getElementById('newGradeAdFreq').value) || 3;

    if (!name) { alert('Informe o nome da grade!'); return; }
    if (isNaN(startHour) || isNaN(endHour)) { alert('Informe as horas de início e fim!'); return; }
    if (startHour === endHour) { alert('Início e fim não podem ser iguais!'); return; }

    // Verifica conflito com grades existentes
    const conflict = timeSlots.find(s => {
        if (s.name === 'Madrugada Aleatória') return false;
        if (s.start_hour <= s.end_hour) {
            return !(endHour <= s.start_hour || startHour >= s.end_hour);
        }
        return true; // simplificado para grades que cruzam meia-noite
    });
    if (conflict) {
        if (!confirm(`⚠️ Possível conflito de horário com a grade "${conflict.name}". Criar mesmo assim?`)) return;
    }

    const sortOrder = timeSlots.length;
    try {
        const { data, error } = await supabaseAdmin.from('time_slots').insert([{
            name, description: desc || null, genres: genres || null,
            start_hour: startHour, end_hour: endHour,
            color, sort_order: sortOrder, enabled: true,
            ad_frequency: adFreq
        }]).select().single();
        if (error) throw error;
        alert(`✅ Grade "${name}" criada!`);
        hideCreateGradeForm();
        document.getElementById('createGradeForm').reset();
        // Recarrega grades
        const { data: slots } = await supabase.from('time_slots').select('*').order('sort_order', { ascending: true });
        timeSlots = slots || [];
        await loadSlotData();
        renderGradesTabs();
        populateSlotSelects();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

// ═════════════════════════════════════════════════════════════
// MODO SILÊNCIO
// ═════════════════════════════════════════════════════════════
let silenceActive = false;
let silenceSchedules = [];
let silenceCountdownInterval = null;

async function loadSilenceState() {
    try {
        const { data } = await supabase.from('silence_state').select('*').eq('id', 1).single();
        if (!data) return;
        silenceActive = data.is_active;
        renderSilenceUI(data);
    } catch(err) { console.error(err); }
}

async function loadSilenceSchedules() {
    const { data } = await supabase.from('silence_schedules').select('*').order('start_time', { ascending: true });
    silenceSchedules = data || [];
    renderSilenceSchedules();
}

function renderSilenceUI(state) {
    const ind  = document.getElementById('silenceIndicator');
    const txt  = document.getElementById('silenceStatusText');
    const btn  = document.getElementById('silenceManualBtn');
    if (!btn) return;
    if (state?.is_active) {
        if (ind) ind.classList.add('active');
        let msg = `🔇 Silêncio ativo${state.reason ? ` — ${state.reason}` : ''}`;
        if (state.end_at) {
            const rem = Math.max(0, Math.round((new Date(state.end_at) - new Date()) / 60000));
            msg += ` (${rem} min restantes)`;
        }
        if (txt) txt.textContent = msg;
        btn.textContent = '▶️ Retomar Rádio';
        btn.style.background = '#006b3f';
    } else {
        if (ind) ind.classList.remove('active');
        if (txt) txt.textContent = 'Rádio tocando normalmente';
        btn.textContent = '🔇 Silenciar Agora';
        btn.style.background = '';
    }
}

function setupSilenceListeners() {
    document.getElementById('silenceManualBtn')?.addEventListener('click', toggleSilenceManual);
    document.getElementById('silenceScheduleForm')?.addEventListener('submit', handleSaveSilenceSchedule);
    // Realtime
    supabase.channel('silence_admin')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'silence_state' },
            payload => { silenceActive = payload.new.is_active; renderSilenceUI(payload.new); })
        .subscribe();
}

async function toggleSilenceManual() {
    const newActive = !silenceActive;
    const dur  = parseInt(document.getElementById('silenceManualDuration')?.value || 0);
    const reason = document.getElementById('silenceManualReason')?.value.trim() || null;
    const end_at = newActive && dur > 0
        ? new Date(Date.now() + dur * 60000).toISOString()
        : null;
    try {
        await supabaseAdmin.from('silence_state').update({
            is_active: newActive, reason, end_at,
            activated_at: newActive ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        }).eq('id', 1);
        silenceActive = newActive;
        renderSilenceUI({ is_active: newActive, reason, end_at });
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

function renderSilenceSchedules() {
    const tbody = document.getElementById('silenceScheduleBody');
    if (!tbody) return;
    const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    if (!silenceSchedules.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">Nenhum agendamento.</td></tr>';
        return;
    }
    tbody.innerHTML = silenceSchedules.map(s => `
        <tr>
            <td style="font-weight:500;">${s.label}</td>
            <td>${s.start_time?.substring(0,5)}</td>
            <td>${s.end_time?.substring(0,5)}</td>
            <td style="font-size:12px;">${(s.days||[]).map(d=>dayNames[parseInt(d)]).join(', ')}</td>
            <td><span class="status-badge ${s.enabled?'active':'inactive'}">${s.enabled?'✅':'❌'}</span></td>
            <td><div class="action-btns">
                <button class="btn-toggle" onclick="toggleSilenceSchedule(${s.id},${!s.enabled})">${s.enabled?'🔴':'🟢'}</button>
                <button class="btn-delete" onclick="deleteSilenceSchedule(${s.id})">🗑️</button>
            </div></td>
        </tr>`).join('');
}

async function handleSaveSilenceSchedule(e) {
    e.preventDefault();
    const label = document.getElementById('silenceLabel').value.trim();
    const start = document.getElementById('silenceStart').value;
    const end   = document.getElementById('silenceEnd').value;
    const days  = [...document.querySelectorAll('.silence-day-check:checked')].map(c => c.value);
    if (!label || !start || !end) { alert('Preencha todos os campos!'); return; }
    if (!days.length) { alert('Selecione pelo menos um dia!'); return; }
    try {
        await supabaseAdmin.from('silence_schedules').insert([{ label, start_time: start, end_time: end, days, enabled: true }]);
        alert('✅ Agendamento salvo!');
        clearSilenceForm();
        await loadSilenceSchedules();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function toggleSilenceSchedule(id, newStatus) {
    await supabaseAdmin.from('silence_schedules').update({ enabled: newStatus }).eq('id', id);
    await loadSilenceSchedules();
}

async function deleteSilenceSchedule(id) {
    if (!confirm('Deletar agendamento?')) return;
    await supabaseAdmin.from('silence_schedules').delete().eq('id', id);
    silenceSchedules = silenceSchedules.filter(s => s.id !== id);
    renderSilenceSchedules();
}

function clearSilenceForm() {
    document.getElementById('silenceLabel').value = '';
    document.getElementById('silenceStart').value = '';
    document.getElementById('silenceEnd').value   = '';
    document.querySelectorAll('.silence-day-check').forEach(c => c.checked = false);
}
window.clearSilenceForm          = clearSilenceForm;
window.toggleSilenceSchedule     = toggleSilenceSchedule;
window.deleteSilenceSchedule     = deleteSilenceSchedule;

// Verifica agendamentos de silêncio a cada 30s
function checkSilenceSchedules() {
    if (!silenceSchedules.length) return;
    const now = new Date();
    const day = String(now.getDay());
    const hm  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    for (const s of silenceSchedules.filter(s => s.enabled)) {
        if (!s.days?.includes(day)) continue;
        if (hm >= s.start_time?.substring(0,5) && hm < s.end_time?.substring(0,5)) {
            if (!silenceActive) toggleSilenceManual();
            return;
        }
    }
    // Se o silêncio estava ativo por agendamento e o horário passou, desativa
    if (silenceActive) {
        supabase.from('silence_state').select('end_at').eq('id',1).single().then(({data}) => {
            if (data?.end_at && new Date(data.end_at) < now) toggleSilenceManual();
        });
    }
}

// ═════════════════════════════════════════════════════════════
// PROMOÇÃO RELÂMPAGO
// ═════════════════════════════════════════════════════════════
let flashActive = false;
let flashCountdownTimer = null;

async function loadFlashState() {
    try {
        const { data } = await supabase.from('flash_state').select('*').eq('id', 1).single();
        if (!data) return;
        flashActive = data.is_active;
        renderFlashUI(data);
        if (data.is_active && data.ends_at) startFlashCountdown(new Date(data.ends_at));
    } catch(err) { console.error(err); }
}

function renderFlashUI(state) {
    const ind  = document.getElementById('flashIndicator');
    const txt  = document.getElementById('flashStatusText');
    const stop = document.getElementById('flashStopBtn');
    const cd   = document.getElementById('flashCountdown');
    if (!txt) return;
    if (state?.is_active) {
        if (ind) ind.classList.add('active');
        txt.textContent = `⚡ Ativa: ${state.title || 'Promoção Relâmpago'}`;
        if (stop) stop.style.display = 'block';
        if (cd)  cd.style.display   = 'block';
    } else {
        if (ind) ind.classList.remove('active');
        txt.textContent = 'Nenhuma promoção ativa';
        if (stop) stop.style.display = 'none';
        if (cd)  { cd.style.display = 'none'; cd.textContent = ''; }
    }
}

function startFlashCountdown(endsAt) {
    if (flashCountdownTimer) clearInterval(flashCountdownTimer);
    const cd = document.getElementById('flashCountdown');
    const update = () => {
        const rem = Math.max(0, endsAt - new Date());
        if (!cd) return;
        const m = Math.floor(rem / 60000);
        const s = Math.floor((rem % 60000) / 1000);
        cd.textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} restantes`;
        if (rem <= 0) {
            clearInterval(flashCountdownTimer);
            flashCountdownTimer = null;
            stopFlashPromotion();
        }
    };
    update();
    flashCountdownTimer = setInterval(update, 1000);
}

function setupFlashListeners() {
    document.getElementById('flashForm')?.addEventListener('submit', handleFlashSubmit);
    document.getElementById('flashStopBtn')?.addEventListener('click', stopFlashPromotion);
    // Realtime
    supabase.channel('flash_admin')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flash_state' }, payload => {
            flashActive = payload.new.is_active;
            renderFlashUI(payload.new);
            if (payload.new.is_active && payload.new.ends_at) startFlashCountdown(new Date(payload.new.ends_at));
            else if (flashCountdownTimer) { clearInterval(flashCountdownTimer); flashCountdownTimer = null; }
        }).subscribe();
}

async function handleFlashSubmit(e) {
    e.preventDefault();
    const title   = document.getElementById('flashTitle').value.trim();
    const text    = document.getElementById('flashText').value.trim();
    const durMin  = parseInt(document.getElementById('flashDuration').value) || 15;
    if (!title || !text) { alert('Preencha título e texto!'); return; }
    const endsAt  = new Date(Date.now() + durMin * 60000);
    try {
        // Salva no histórico
        await supabaseAdmin.from('flash_promotions').insert([{
            title, tts_text: text, duration_min: durMin,
            is_active: true, started_at: new Date().toISOString(), ends_at: endsAt.toISOString()
        }]);
        // Atualiza estado ativo (broadcast para players)
        await supabaseAdmin.from('flash_state').update({
            is_active: true, tts_text: text, title,
            ends_at: endsAt.toISOString(), updated_at: new Date().toISOString()
        }).eq('id', 1);
        // Dispara TTS imediatamente
        await dispatchTTS(text, title);
        // Avisa quando restar 2 minutos
        const warn2min = durMin * 60000 - 120000;
        if (warn2min > 0) {
            setTimeout(() => {
                if (flashActive) dispatchTTS(`Atenção! Restam apenas 2 minutos da promoção: ${title}. Aproveite!`, 'Aviso de Encerramento');
            }, warn2min);
        }
        // Encerra automaticamente no fim
        setTimeout(() => { if (flashActive) stopFlashPromotion(); }, durMin * 60000);
        flashActive = true;
        renderFlashUI({ is_active: true, title, ends_at: endsAt.toISOString() });
        startFlashCountdown(endsAt);
        loadFlashHistory();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function stopFlashPromotion() {
    try {
        await supabaseAdmin.from('flash_state').update({
            is_active: false, tts_text: null, title: null, ends_at: null,
            updated_at: new Date().toISOString()
        }).eq('id', 1);
        // Atualiza ended_at no histórico
        const { data: promos } = await supabase.from('flash_promotions')
            .select('id').eq('is_active', true).order('started_at', { ascending: false }).limit(1);
        if (promos?.length) {
            await supabaseAdmin.from('flash_promotions')
                .update({ is_active: false }).eq('id', promos[0].id);
        }
        flashActive = false;
        if (flashCountdownTimer) { clearInterval(flashCountdownTimer); flashCountdownTimer = null; }
        renderFlashUI({ is_active: false });
        loadFlashHistory();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function loadFlashHistory() {
    const tbody = document.getElementById('flashHistoryBody');
    if (!tbody) return;
    const { data } = await supabase.from('flash_promotions')
        .select('*').order('started_at', { ascending: false }).limit(20);
    if (!data?.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">Nenhum histórico.</td></tr>';
        return;
    }
    tbody.innerHTML = data.map(p => `<tr>
        <td style="font-weight:500;">${p.title}</td>
        <td>${p.duration_min} min</td>
        <td style="font-size:12px;">${new Date(p.started_at).toLocaleString('pt-BR')}</td>
        <td style="font-size:12px;">${p.ends_at ? new Date(p.ends_at).toLocaleString('pt-BR') : p.is_active ? '🔴 Em andamento' : '-'}</td>
    </tr>`).join('');
}

function setFlashPreset(title, text, dur) {
    const t = document.getElementById('flashTitle');
    const tx = document.getElementById('flashText');
    const d = document.getElementById('flashDuration');
    if (t) t.value = title;
    if (tx) tx.value = text;
    if (d) d.value = dur;
}
window.setFlashPreset = setFlashPreset;

// ═════════════════════════════════════════════════════════════
// ATIVAÇÃO AUTOMÁTICA SAZONAL POR DATA
// ═════════════════════════════════════════════════════════════
async function saveSeasonalAutoConfig(category) {
    const sm = document.querySelector(`.seasonal-auto-start-month[data-cat="${category}"]`)?.value;
    const sd = document.querySelector(`.seasonal-auto-start-day[data-cat="${category}"]`)?.value;
    const em = document.querySelector(`.seasonal-auto-end-month[data-cat="${category}"]`)?.value;
    const ed = document.querySelector(`.seasonal-auto-end-day[data-cat="${category}"]`)?.value;
    const autoEnabled = document.querySelector(`.seasonal-auto-enabled[data-cat="${category}"]`)?.checked;
    const requireMusic = document.querySelector(`.seasonal-require-music[data-cat="${category}"]`)?.checked;

    try {
        await supabaseAdmin.from('seasonal_settings').update({
            auto_start_month : sm ? parseInt(sm) : null,
            auto_start_day   : sd ? parseInt(sd) : null,
            auto_end_month   : em ? parseInt(em) : null,
            auto_end_day     : ed ? parseInt(ed) : null,
            auto_enabled     : !!autoEnabled,
            require_music    : requireMusic !== false
        }).eq('category', category);
        alert('✅ Configuração de ativação automática salva!');
        await loadSeasonalAutoStatuses();
    } catch(err) { alert('❌ Erro: ' + err.message); }
}

async function loadSeasonalAutoStatuses() {
    const { data } = await supabase.from('seasonal_settings').select('*');
    if (!data) return;
    data.forEach(s => {
        // Preenche campos do formulário
        const cat = s.category;
        const sm = document.querySelector(`.seasonal-auto-start-month[data-cat="${cat}"]`);
        const sd = document.querySelector(`.seasonal-auto-start-day[data-cat="${cat}"]`);
        const em = document.querySelector(`.seasonal-auto-end-month[data-cat="${cat}"]`);
        const ed = document.querySelector(`.seasonal-auto-end-day[data-cat="${cat}"]`);
        const ae = document.querySelector(`.seasonal-auto-enabled[data-cat="${cat}"]`);
        const rm = document.querySelector(`.seasonal-require-music[data-cat="${cat}"]`);
        if (sm && s.auto_start_month) sm.value = s.auto_start_month;
        if (sd && s.auto_start_day)   sd.value = s.auto_start_day;
        if (em && s.auto_end_month)   em.value = s.auto_end_month;
        if (ed && s.auto_end_day)     ed.value = s.auto_end_day;
        if (ae) ae.checked = !!s.auto_enabled;
        if (rm) rm.checked = s.require_music !== false;

        // Status textual
        const statusEl = document.getElementById(`autoStatus${cat.split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('')}`);
        if (!statusEl) return;
        if (!s.auto_enabled) {
            statusEl.textContent = '⏸️ Ativação automática desligada';
            statusEl.style.color = '#999';
        } else if (!s.auto_start_month) {
            statusEl.textContent = '⚠️ Datas não configuradas — ativação automática não funcionará';
            statusEl.style.color = '#e65100';
        } else {
            statusEl.textContent = `✅ Ativa automaticamente de ${s.auto_start_day}/${s.auto_start_month} até ${s.auto_end_day}/${s.auto_end_month}${s.require_music?' (somente com músicas)':''}`;
            statusEl.style.color = '#006b3f';
        }
    });
    seasonalSettings = {};
    data.forEach(s => { seasonalSettings[s.category] = s; });
    updateSeasonalStatusBadges();
}

// Verifica ativação automática sazonal a cada 10min
async function checkSeasonalAutoActivation() {
    const now  = new Date();
    const month = now.getMonth() + 1;
    const day   = now.getDate();
    for (const cat of ['natal','ano_novo','pascoa','sao_joao']) {
        const s = seasonalSettings[cat];
        if (!s?.auto_enabled || !s.auto_start_month) continue;
        // Verifica se hoje está no intervalo
        const inRange = isDateInRange(month, day, s.auto_start_month, s.auto_start_day, s.auto_end_month, s.auto_end_day);
        if (inRange && !s.is_active) {
            // Verifica se tem músicas (se require_music)
            if (s.require_music) {
                const { count } = await supabase.from('seasonal_playlists')
                    .select('*', { count: 'exact', head: true })
                    .eq('category', cat).eq('type', 'music').eq('enabled', true);
                if (!count) continue; // sem músicas, não ativa
            }
            await toggleSeasonalPlaylist(cat);
        } else if (!inRange && s.is_active) {
            await toggleSeasonalPlaylist(cat); // desativa automaticamente
        }
    }
}

function isDateInRange(month, day, sm, sd, em, ed) {
    const cur = month * 100 + day;
    const start = sm * 100 + sd;
    const end   = em * 100 + ed;
    if (start <= end) return cur >= start && cur <= end;
    // Intervalo que cruza virada de ano (ex: 27/12 a 02/01)
    return cur >= start || cur <= end;
}

// ═════════════════════════════════════════════════════════════
// HISTÓRICO DE PROPAGANDAS
// ═════════════════════════════════════════════════════════════
async function loadAdHistory() {
    const el = document.getElementById('adHistoryContent');
    if (!el) return;
    el.innerHTML = '<div class="grade-empty">Carregando...</div>';
    try {
        const { data } = await supabase.from('ad_log')
            .select('*').order('played_at', { ascending: false }).limit(100);
        if (!data?.length) { el.innerHTML = '<div class="grade-empty">Nenhum histórico ainda.</div>'; return; }

        // Agrupa por propaganda para mostrar total
        const totals = {};
        data.forEach(r => {
            const key = r.title || r.ad_id;
            if (!totals[key]) totals[key] = { title: r.title, advertiser: r.advertiser, count: 0 };
            totals[key].count++;
        });
        const topList = Object.values(totals).sort((a,b) => b.count - a.count).slice(0,10);

        el.innerHTML = `
            <h4 style="margin:0 0 10px;color:#333;font-size:14px;">🏆 Mais tocadas (últimas 100)</h4>
            <div class="table-container" style="margin-bottom:16px;">
                <table class="data-table"><thead><tr><th>Propaganda</th><th>Anunciante</th><th>Vezes tocada</th></tr></thead>
                <tbody>${topList.map(t=>`<tr>
                    <td style="font-weight:500;">${t.title||'-'}</td>
                    <td>${t.advertiser||'-'}</td>
                    <td><span style="padding:3px 10px;background:#e6f4ed;border-radius:10px;font-weight:700;color:#006b3f;">${t.count}×</span></td>
                </tr>`).join('')}</tbody></table>
            </div>
            <h4 style="margin:0 0 10px;color:#333;font-size:14px;">🕐 Últimas reproduções</h4>
            <div class="table-container">
                <table class="data-table"><thead><tr><th>Propaganda</th><th>Grade</th><th>Horário</th></tr></thead>
                <tbody>${data.slice(0,30).map(r=>`<tr>
                    <td style="font-weight:500;">${r.title||'-'}</td>
                    <td style="color:#666;">${r.slot_name||'-'}</td>
                    <td style="font-size:11px;color:#888;">${new Date(r.played_at).toLocaleString('pt-BR')}</td>
                </tr>`).join('')}</tbody></table>
            </div>`;
    } catch(err) { el.innerHTML = `<div class="grade-empty">Erro: ${err.message}</div>`; }
}
window.loadAdHistory = loadAdHistory;

// ═════════════════════════════════════════════════════════════
// CARGA DE MÓDULOS NOVOS (chamada dentro de loadAllData)
// ═════════════════════════════════════════════════════════════
async function extendedLoadAllData() {
    await loadBlacklist();
    await loadSilenceState();
    await loadSilenceSchedules();
    await loadFlashState();
    await loadFlashHistory();
    await loadSeasonalAutoStatuses();
    setInterval(checkSilenceSchedules, 30000);
    setInterval(checkSeasonalAutoActivation, 600000); // a cada 10min
    checkSeasonalAutoActivation(); // verifica imediatamente ao carregar
}

// ── Novos globais ────────────────────────────────────────────
window.saveSeasonalAutoConfig  = saveSeasonalAutoConfig;
window.loadFlashHistory        = loadFlashHistory;
window.loadSilenceSchedules    = loadSilenceSchedules;
window.removeFromBlacklist = removeFromBlacklist;
window.stopFlashPromotion  = stopFlashPromotion;
window.loadAdHistory       = loadAdHistory;
