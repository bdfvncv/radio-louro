const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTU4NTM2NSwiZXhwIjoyMDc1MTYxMzY1fQ.rxDX7YsuxAvoMbImnk1Ovlj7YQ0WI_XwcTZUJpXKQYU';
const YOUTUBE_API_KEY = 'AIzaSyCcpLnZ0XHsSEx34Zvkc80FwmHiHIqS6Gs';
const CLOUDINARY_CLOUD = 'dygbrcrr6';
const ADMIN_PASSWORD = 'senhaDev';

const supabase      = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Estado ────────────────────────────────────────────────────
let isAuthenticated = false;
let allSchedules = [], backgroundPlaylist = [], advertisements = [];
let timeSlots = [], slotPlaylists = {}, slotJingles = {};
let seasonalData = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
let seasonalJingles = { natal:[], ano_novo:[], pascoa:[], sao_joao:[] };
let seasonalSettings = {};
let musicQueue = [];
let currentSeasonalTab = 'natal';
let editingSeasonalId = null;
let editingPlaylistId = null;
let editingAdId = null;
let editingJingleId = null;
let currentGradeTab = null;
let ytManualData = null;

// ── DOM ───────────────────────────────────────────────────────
const loginScreen  = document.getElementById('loginScreen');
const adminPanel   = document.getElementById('adminPanel');
const loginForm    = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError   = document.getElementById('loginError');
const logoutBtn    = document.getElementById('logoutBtn');
const testAudio    = document.getElementById('testAudio');

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
init();

function init() {
    checkAuth();
    populateHourSelect();
    setupEventListeners();
    setupSeasonalEventListeners();
    setupYouTubeListeners();
    setupGradesTabs();
}

function checkAuth() {
    if (sessionStorage.getItem('radio_admin_auth') === 'authenticated') {
        isAuthenticated = true;
        showAdminPanel();
        loadAllData();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    loginScreen.style.display = 'flex';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
}

function showAdminPanel() {
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'block';
    logoutBtn.style.display = 'block';
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
function setupEventListeners() {
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        if (passwordInput.value === ADMIN_PASSWORD) {
            sessionStorage.setItem('radio_admin_auth', 'authenticated');
            isAuthenticated = true;
            showAdminPanel();
            loadAllData();
            loginError.classList.remove('show');
        } else {
            loginError.textContent = '❌ Senha incorreta!';
            loginError.classList.add('show');
            passwordInput.value = '';
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('radio_admin_auth');
        isAuthenticated = false;
        showLoginScreen();
        passwordInput.value = '';
    });

    document.getElementById('editForm').addEventListener('submit', handleSaveSchedule);
    document.getElementById('testBtn').addEventListener('click', () => testAudioUrl(document.getElementById('audioUrl').value));
    document.getElementById('testBtnHalf').addEventListener('click', () => testAudioUrl(document.getElementById('audioUrlHalf').value));
    document.getElementById('clearBtn').addEventListener('click', handleClearForm);
    document.getElementById('hourSelect').addEventListener('change', e => { if (!isNaN(parseInt(e.target.value))) editSchedule(parseInt(e.target.value)); });

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
        const [scheduleRes, playlistRes, adsRes, timeSlotsRes, queueRes,
               seasonalMusicRes, seasonalAdRes, seasonalSettingsRes] = await Promise.all([
            supabase.from('radio_schedule').select('*').order('hour', { ascending: true }),
            supabase.from('background_playlist').select('*').order('original_order', { ascending: true }),
            supabase.from('advertisements').select('*').order('play_order', { ascending: true }),
            supabase.from('time_slots').select('*').order('sort_order', { ascending: true }),
            supabase.from('music_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
            supabase.from('seasonal_playlists').select('*').eq('type', 'music').order('original_order', { ascending: true }),
            supabase.from('seasonal_playlists').select('*').eq('type', 'ad').order('play_order', { ascending: true }),
            supabase.from('seasonal_settings').select('*')
        ]);

        allSchedules      = scheduleRes.data      || [];
        backgroundPlaylist = playlistRes.data     || [];
        advertisements    = adsRes.data           || [];
        timeSlots         = timeSlotsRes.data     || [];
        musicQueue        = queueRes.data         || [];

        seasonalData = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
        (seasonalMusicRes.data || []).forEach(i => { if (seasonalData[i.category]) seasonalData[i.category].music.push(i); });
        (seasonalAdRes.data   || []).forEach(i => { if (seasonalData[i.category]) seasonalData[i.category].ads.push(i); });

        seasonalSettings = {};
        (seasonalSettingsRes.data || []).forEach(s => { seasonalSettings[s.category] = s; });

        await loadSlotData();
        await loadSeasonalJingles();

        renderAll();
        populateSlotSelects();
        setupRealtimeSubscription();
    } catch (err) {
        console.error('Erro ao carregar dados:', err);
    }
}

async function loadSlotData() {
    if (!timeSlots.length) return;
    try {
        const [playlistsRes, jinglesRes] = await Promise.all([
            supabase.from('slot_playlists').select('*').order('original_order', { ascending: true }),
            supabase.from('jingles').select('*').not('slot_id', 'is', null)
        ]);

        slotPlaylists = {};
        slotJingles   = {};
        timeSlots.forEach(s => { slotPlaylists[s.id] = []; slotJingles[s.id] = []; });
        (playlistsRes.data || []).forEach(t => { if (slotPlaylists[t.slot_id]) slotPlaylists[t.slot_id].push(t); });
        (jinglesRes.data   || []).forEach(j => { if (slotJingles[j.slot_id])   slotJingles[j.slot_id].push(j); });
    } catch (err) {
        console.error('Erro ao carregar dados de grades:', err);
    }
}

async function loadSeasonalJingles() {
    try {
        const { data } = await supabase.from('jingles').select('*').not('seasonal_category', 'is', null);
        seasonalJingles = { natal:[], ano_novo:[], pascoa:[], sao_joao:[] };
        (data || []).forEach(j => { if (seasonalJingles[j.seasonal_category]) seasonalJingles[j.seasonal_category].push(j); });
    } catch (err) {
        console.error('Erro ao carregar vinhetas sazonais:', err);
    }
}

function renderAll() {
    renderScheduleTable();
    renderPlaylistTable();
    renderAdsTable();
    renderAllSeasonalTables();
    renderSeasonalJinglesTables();
    updateSeasonalStatusBadges();
    renderGradesTabs();
    renderQueueSection();
}

// ─────────────────────────────────────────────────────────────
// GRADES HORÁRIAS — TABS E CONTEÚDO
// ─────────────────────────────────────────────────────────────
function setupGradesTabs() {
    document.getElementById('gradesTabs').addEventListener('click', e => {
        const btn = e.target.closest('.grade-tab');
        if (!btn) return;
        const slotId = parseInt(btn.dataset.slotId);
        switchGradeTab(slotId);
    });
}

function renderGradesTabs() {
    const tabsEl = document.getElementById('gradesTabs');
    const contentEl = document.getElementById('gradesContent');

    if (!timeSlots.length) {
        tabsEl.innerHTML = '';
        contentEl.innerHTML = '<div class="grade-empty">Nenhuma grade configurada.</div>';
        return;
    }

    tabsEl.innerHTML = timeSlots.map(s =>
        `<button class="grade-tab${currentGradeTab === s.id ? ' active' : ''}" data-slot-id="${s.id}" style="border-bottom-color:${s.color}">
            <span class="grade-tab-dot" style="background:${s.color}"></span>${s.name}
            <span class="grade-tab-count">${(slotPlaylists[s.id]||[]).length}</span>
        </button>`
    ).join('');

    if (!currentGradeTab && timeSlots.length) {
        currentGradeTab = timeSlots[0].id;
    }

    renderGradeContent(currentGradeTab);
}

function switchGradeTab(slotId) {
    currentGradeTab = slotId;
    document.querySelectorAll('.grade-tab').forEach(t => {
        t.classList.toggle('active', parseInt(t.dataset.slotId) === slotId);
    });
    renderGradeContent(slotId);
}

function renderGradeContent(slotId) {
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;

    const playlist = slotPlaylists[slotId] || [];
    const jingles  = slotJingles[slotId]   || [];
    const opening  = jingles.filter(j => j.position === 'opening');
    const middle   = jingles.filter(j => j.position === 'middle');
    const closing  = jingles.filter(j => j.position === 'closing');

    const contentEl = document.getElementById('gradesContent');
    contentEl.innerHTML = `
        <div class="grade-panel">
            <div class="grade-panel-header" style="border-left:4px solid ${slot.color}">
                <div>
                    <div class="grade-panel-name">${slot.name}</div>
                    <div class="grade-panel-info">${String(slot.start_hour).padStart(2,'0')}h – ${String(slot.end_hour).padStart(2,'0')}h &nbsp;·&nbsp; ${slot.genres || 'Sem gêneros definidos'}</div>
                </div>
                <div class="grade-panel-stats">
                    <span class="grade-stat">${playlist.filter(t=>t.enabled).length} músicas</span>
                    <span class="grade-stat">${jingles.filter(j=>j.enabled).length} vinhetas</span>
                </div>
            </div>

            <!-- MÚSICAS DA GRADE -->
            <div class="grade-subsection">
                <h4>🎵 Músicas — ${slot.name}</h4>
                <form class="edit-form" id="formSlotPlaylist_${slotId}">
                    <div class="form-group"><label>URL do Áudio:</label><input type="url" id="slotUrl_${slotId}" placeholder="https://res.cloudinary.com/..." required></div>
                    <div class="form-group"><label>Título:</label><input type="text" id="slotTitle_${slotId}" placeholder="Ex: Terra Roxa" required></div>
                    <div class="form-group"><label>Artista:</label><input type="text" id="slotArtist_${slotId}" placeholder="Ex: Chitãozinho e Xororó"></div>
                    <div class="form-group"><label>Gênero:</label><input type="text" id="slotGenre_${slotId}" placeholder="Ex: Sertanejo raiz"></div>
                    <div class="form-group"><label>Ordem:</label><input type="number" id="slotOrder_${slotId}" value="0" min="0"></div>
                    <div class="form-actions">
                        <button type="submit" class="submit-btn">💾 Adicionar Música</button>
                        <button type="button" class="test-btn" onclick="testAudioUrl(document.getElementById('slotUrl_${slotId}').value)">▶️ Testar</button>
                        <button type="button" class="clear-btn" onclick="clearSlotForm(${slotId})">🗑️ Limpar</button>
                    </div>
                </form>
                <div class="table-container">
                    <table class="schedule-table">
                        <thead><tr><th>Ordem Original</th><th>Ordem do Dia 🎲</th><th>Título</th><th>Artista</th><th>Status</th><th>Ações</th></tr></thead>
                        <tbody id="tableSlotPlaylist_${slotId}"></tbody>
                    </table>
                </div>
                <div class="shuffle-box">
                    <h4>🎲 Embaralhamento</h4>
                    <p>Embaralhado automaticamente à meia-noite.</p>
                    <button class="test-btn" onclick="handleForceShuffleSlot(${slotId})">🎲 Forçar Agora</button>
                </div>
            </div>

            <!-- VINHETAS DA GRADE -->
            <div class="grade-subsection">
                <h4>🎬 Vinhetas — ${slot.name}</h4>
                <p class="section-description" style="margin-bottom:14px;">Cada posição tem seu próprio banco. Uma é sorteada aleatoriamente em cada aparição.</p>
                <form class="edit-form" id="formSlotJingle_${slotId}">
                    <div class="form-group"><label>URL do Áudio:</label><input type="url" id="jingleUrl_${slotId}" placeholder="https://res.cloudinary.com/..." required></div>
                    <div class="form-group"><label>Título:</label><input type="text" id="jingleTitle_${slotId}" placeholder="Ex: Vinheta Manhã 1" required></div>
                    <div class="form-group"><label>Posição:</label>
                        <select id="jinglePos_${slotId}">
                            <option value="opening">🎬 Abertura (toca 1× ao iniciar)</option>
                            <option value="middle">🎬 Meio (toca 2× durante a grade)</option>
                            <option value="closing">🎬 Encerramento (toca 1× ao finalizar)</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-btn">💾 Adicionar Vinheta</button>
                        <button type="button" class="test-btn" onclick="testAudioUrl(document.getElementById('jingleUrl_${slotId}').value)">▶️ Testar</button>
                        <button type="button" class="clear-btn" onclick="clearJingleForm(${slotId})">🗑️ Limpar</button>
                    </div>
                </form>

                <div class="jingles-grid">
                    <div class="jingle-col">
                        <div class="jingle-col-title">🎬 Abertura (${opening.length})</div>
                        ${renderJingleRows(opening, slotId)}
                    </div>
                    <div class="jingle-col">
                        <div class="jingle-col-title">🎬 Meio (${middle.length})</div>
                        ${renderJingleRows(middle, slotId)}
                    </div>
                    <div class="jingle-col">
                        <div class="jingle-col-title">🎬 Encerramento (${closing.length})</div>
                        ${renderJingleRows(closing, slotId)}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById(`formSlotPlaylist_${slotId}`).addEventListener('submit', e => handleSaveSlotTrack(e, slotId));
    document.getElementById(`formSlotJingle_${slotId}`).addEventListener('submit', e => handleSaveSlotJingle(e, slotId));

    renderSlotPlaylistTable(slotId);
}

function renderJingleRows(list, slotId) {
    if (!list.length) return '<div style="color:#999;font-size:12px;padding:8px;">Nenhuma vinheta cadastrada</div>';
    return list.map(j => `
        <div class="jingle-row">
            <span class="jingle-row-title">${j.title}</span>
            <span class="status-badge ${j.enabled ? 'active' : 'inactive'}" style="font-size:10px;">${j.enabled ? '✅' : '❌'}</span>
            <div class="action-btns">
                <button class="btn-toggle" onclick="toggleJingle(${j.id}, ${!j.enabled}, ${slotId})">${j.enabled ? '🔴' : '🟢'}</button>
                <button class="btn-delete" onclick="deleteJingle(${j.id}, ${slotId})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderSlotPlaylistTable(slotId) {
    const tbody = document.getElementById(`tableSlotPlaylist_${slotId}`);
    if (!tbody) return;
    const tracks = slotPlaylists[slotId] || [];

    if (!tracks.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">Nenhuma música cadastrada nesta grade.</td></tr>';
        return;
    }

    tbody.innerHTML = tracks.map(t => `
        <tr>
            <td style="font-weight:bold;color:#666;">${t.original_order}</td>
            <td><span style="padding:4px 10px;background:#e3f2fd;border-radius:12px;font-weight:bold;color:#1976d2;">🎲 ${t.daily_order}</span></td>
            <td style="font-weight:500;">${t.title}</td>
            <td style="color:#666;">${t.artist || '-'}</td>
            <td><span class="status-badge ${t.enabled ? 'active' : 'inactive'}">${t.enabled ? '✅ Ativo' : '❌ Inativo'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editSlotTrack(${t.id}, ${slotId})">✏️</button>
                    <button class="btn-toggle" onclick="toggleSlotTrack(${t.id}, ${!t.enabled}, ${slotId})">${t.enabled ? '🔴' : '🟢'}</button>
                    <button class="btn-delete" onclick="deleteSlotTrack(${t.id}, ${slotId})">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ── CRUD Slot Playlist ────────────────────────────────────────
async function handleSaveSlotTrack(e, slotId) {
    e.preventDefault();
    const url    = document.getElementById(`slotUrl_${slotId}`).value.trim();
    const title  = document.getElementById(`slotTitle_${slotId}`).value.trim();
    const artist = document.getElementById(`slotArtist_${slotId}`).value.trim();
    const genre  = document.getElementById(`slotGenre_${slotId}`).value.trim();
    const order  = parseInt(document.getElementById(`slotOrder_${slotId}`).value);

    try {
        const payload = { slot_id: slotId, audio_url: url, title, artist: artist||null, genre: genre||null, original_order: order, daily_order: order, enabled: true };
        const { error } = await supabaseAdmin.from('slot_playlists').insert([payload]);
        if (error) throw error;
        alert('✅ Música adicionada!');
        clearSlotForm(slotId);
        await refreshSlotPlaylist(slotId);
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

async function toggleSlotTrack(id, newStatus, slotId) {
    await supabaseAdmin.from('slot_playlists').update({ enabled: newStatus }).eq('id', id);
    await refreshSlotPlaylist(slotId);
}

async function deleteSlotTrack(id, slotId) {
    if (!confirm('Deletar esta música?')) return;
    await supabaseAdmin.from('slot_playlists').delete().eq('id', id);
    await refreshSlotPlaylist(slotId);
}

function editSlotTrack(id, slotId) {
    const track = (slotPlaylists[slotId] || []).find(t => t.id === id);
    if (!track) return;
    document.getElementById(`slotUrl_${slotId}`).value    = track.audio_url;
    document.getElementById(`slotTitle_${slotId}`).value  = track.title;
    document.getElementById(`slotArtist_${slotId}`).value = track.artist || '';
    document.getElementById(`slotGenre_${slotId}`).value  = track.genre  || '';
    document.getElementById(`slotOrder_${slotId}`).value  = track.original_order;
}

function clearSlotForm(slotId) {
    ['slotUrl','slotTitle','slotArtist','slotGenre'].forEach(f => document.getElementById(`${f}_${slotId}`).value = '');
    document.getElementById(`slotOrder_${slotId}`).value = '0';
}

async function handleForceShuffleSlot(slotId) {
    if (!confirm('Embaralhar playlist desta grade agora?')) return;
    try {
        const { data: tracks } = await supabaseAdmin.from('slot_playlists').select('id').eq('slot_id', slotId).eq('enabled', true);
        if (!tracks?.length) { alert('Nenhuma música para embaralhar.'); return; }
        const indices = [...Array(tracks.length).keys()];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const today = new Date().toISOString().split('T')[0];
        await Promise.all(tracks.map((t, i) => supabaseAdmin.from('slot_playlists').update({ daily_order: indices[i], last_shuffle_date: today }).eq('id', t.id)));
        alert('✅ Embaralhado!');
        await refreshSlotPlaylist(slotId);
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

async function refreshSlotPlaylist(slotId) {
    const { data } = await supabase.from('slot_playlists').select('*').eq('slot_id', slotId).order('original_order', { ascending: true });
    slotPlaylists[slotId] = data || [];
    renderSlotPlaylistTable(slotId);
    renderGradesTabs();
}

// ── CRUD Slot Jingles ─────────────────────────────────────────
async function handleSaveSlotJingle(e, slotId) {
    e.preventDefault();
    const url      = document.getElementById(`jingleUrl_${slotId}`).value.trim();
    const title    = document.getElementById(`jingleTitle_${slotId}`).value.trim();
    const position = document.getElementById(`jinglePos_${slotId}`).value;

    try {
        const { error } = await supabaseAdmin.from('jingles').insert([{ slot_id: slotId, position, audio_url: url, title, enabled: true }]);
        if (error) throw error;
        alert('✅ Vinheta adicionada!');
        clearJingleForm(slotId);
        await refreshSlotJingles(slotId);
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

async function toggleJingle(id, newStatus, slotId) {
    await supabaseAdmin.from('jingles').update({ enabled: newStatus }).eq('id', id);
    await refreshSlotJingles(slotId);
}

async function deleteJingle(id, slotId) {
    if (!confirm('Deletar esta vinheta?')) return;
    await supabaseAdmin.from('jingles').delete().eq('id', id);
    await refreshSlotJingles(slotId);
}

function clearJingleForm(slotId) {
    document.getElementById(`jingleUrl_${slotId}`).value   = '';
    document.getElementById(`jingleTitle_${slotId}`).value = '';
}

async function refreshSlotJingles(slotId) {
    const { data } = await supabase.from('jingles').select('*').eq('slot_id', slotId);
    slotJingles[slotId] = data || [];
    renderGradeContent(slotId);
}

// ─────────────────────────────────────────────────────────────
// FILA DE APROVAÇÃO
// ─────────────────────────────────────────────────────────────
function renderQueueSection() {
    const section = document.getElementById('queueSection');
    const badge   = document.getElementById('queueBadge');
    const list    = document.getElementById('queueList');

    const pending = musicQueue.filter(m => m.status === 'pending');
    badge.textContent = pending.length;
    section.style.display = pending.length > 0 ? 'block' : 'none';

    if (!pending.length) return;

    list.innerHTML = pending.map(m => `
        <div class="queue-card" id="qcard_${m.id}">
            <img class="queue-thumb" src="${m.youtube_thumbnail || ''}" alt="" onerror="this.style.display='none'">
            <div class="queue-info">
                <div class="queue-title">${m.youtube_title || m.title || 'Sem título'}</div>
                <div class="queue-meta">${m.youtube_channel || ''} ${m.youtube_duration ? '· ' + formatDuration(m.youtube_duration) : ''}</div>
                <div class="queue-source">Origem: ${m.source === 'manual' ? '🔗 Manual' : m.source === 'auto' ? '🤖 Automático' : `💬 Sugestão de ${m.suggested_by || 'funcionário'}`}</div>
            </div>
            <div class="queue-actions">
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="font-size:11px;">Grade de destino:</label>
                    <select class="queue-slot-select" id="qslot_${m.id}">
                        <option value="">Selecione a grade</option>
                        ${timeSlots.filter(s => s.name !== 'Madrugada Aleatória').map(s =>
                            `<option value="${s.id}" ${m.suggested_slot_id === s.id ? 'selected' : ''}>${s.name}</option>`
                        ).join('')}
                        <option value="general">📋 Playlist Geral</option>
                    </select>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="submit-btn" style="flex:1;" onclick="approveQueueItem(${m.id})">✅ Aprovar</button>
                    <button class="btn-delete" style="flex:1;padding:8px;" onclick="rejectQueueItem(${m.id})">❌ Rejeitar</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function approveQueueItem(id) {
    const item = musicQueue.find(m => m.id === id);
    if (!item) return;

    const slotSelect = document.getElementById(`qslot_${id}`);
    const slotValue  = slotSelect?.value;

    if (!slotValue) { alert('Selecione a grade de destino antes de aprovar.'); return; }

    try {
        await supabaseAdmin.from('music_queue').update({ status: 'approved', suggested_slot_id: slotValue === 'general' ? null : parseInt(slotValue) }).eq('id', id);

        if (slotValue !== 'general' && item.audio_url) {
            const order = (slotPlaylists[parseInt(slotValue)] || []).length;
            await supabaseAdmin.from('slot_playlists').insert([{
                slot_id: parseInt(slotValue),
                audio_url: item.audio_url,
                title: item.title || item.youtube_title || 'Música',
                artist: item.artist || item.youtube_channel || null,
                original_order: order,
                daily_order: order,
                enabled: true
            }]);
            await refreshSlotPlaylist(parseInt(slotValue));
        } else if (slotValue === 'general' && item.audio_url) {
            const order = backgroundPlaylist.length;
            await supabaseAdmin.from('background_playlist').insert([{
                audio_url: item.audio_url,
                title: item.title || item.youtube_title || 'Música',
                play_order: order,
                original_order: order,
                daily_order: order,
                enabled: true
            }]);
        }

        musicQueue = musicQueue.filter(m => m.id !== id);
        renderQueueSection();
        alert('✅ Música aprovada e adicionada!');
    } catch (err) {
        alert('❌ Erro ao aprovar: ' + err.message);
    }
}

async function rejectQueueItem(id) {
    if (!confirm('Rejeitar esta música?')) return;
    try {
        await supabaseAdmin.from('music_queue').update({ status: 'rejected' }).eq('id', id);
        musicQueue = musicQueue.filter(m => m.id !== id);
        renderQueueSection();
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// YOUTUBE
// ─────────────────────────────────────────────────────────────
function populateSlotSelects() {
    const selects = ['ytSlotManual', 'ytSlotAuto'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">Selecione a grade</option>' +
            timeSlots.filter(s => s.name !== 'Madrugada Aleatória').map(s =>
                `<option value="${s.id}">${s.name}</option>`
            ).join('') + '<option value="general">📋 Playlist Geral</option>';
    });
}

function setupYouTubeListeners() {
    document.querySelectorAll('.yt-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.yt-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.yt-panel').forEach(p => p.style.display = 'none');
            btn.classList.add('active');
            document.getElementById(`ytPanel${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`).style.display = 'block';
        });
    });

    document.getElementById('ytPreviewBtn').addEventListener('click', handleYTPreview);
    document.getElementById('ytAddManualBtn').addEventListener('click', handleYTAddManual);
    document.getElementById('ytCancelManualBtn').addEventListener('click', () => {
        document.getElementById('ytPreviewResult').style.display = 'none';
        document.getElementById('ytUrlManual').value = '';
        ytManualData = null;
    });

    document.getElementById('ytAutoSearchBtn').addEventListener('click', handleYTAutoSearch);
    document.getElementById('ytAutoAddSelectedBtn').addEventListener('click', handleYTAutoAddSelected);
    document.getElementById('ytAutoClearBtn').addEventListener('click', () => {
        document.getElementById('ytAutoResults').style.display = 'none';
        document.getElementById('ytAutoResultsList').innerHTML = '';
    });
}

function extractYTVideoId(url) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
}

function parseDuration(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1]||0)*3600) + (parseInt(m[2]||0)*60) + parseInt(m[3]||0);
}

async function fetchYTVideoData(videoId) {
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items?.length) throw new Error('Vídeo não encontrado');
    const item = data.items[0];
    return {
        id: videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        duration: parseDuration(item.contentDetails.duration),
        url: `https://www.youtube.com/watch?v=${videoId}`
    };
}

async function handleYTPreview() {
    const url = document.getElementById('ytUrlManual').value.trim();
    if (!url) { alert('Cole um link do YouTube.'); return; }
    const videoId = extractYTVideoId(url);
    if (!videoId) { alert('Link inválido. Use um link do YouTube.'); return; }

    const btn = document.getElementById('ytPreviewBtn');
    btn.textContent = '⏳ Buscando...'; btn.disabled = true;

    try {
        const data = await fetchYTVideoData(videoId);
        ytManualData = data;
        document.getElementById('ytPreviewThumb').src = data.thumbnail;
        document.getElementById('ytPreviewTitle').textContent = data.title;
        document.getElementById('ytPreviewChannel').textContent = data.channel;
        document.getElementById('ytPreviewDuration').textContent = formatDuration(data.duration);
        document.getElementById('ytPreviewResult').style.display = 'block';
    } catch (err) {
        alert('❌ Erro ao buscar vídeo: ' + err.message);
    } finally {
        btn.textContent = '🔍 Visualizar'; btn.disabled = false;
    }
}

async function handleYTAddManual() {
    if (!ytManualData) return;
    const slotValue = document.getElementById('ytSlotManual').value;

    try {
        const { error } = await supabaseAdmin.from('music_queue').insert([{
            youtube_url: ytManualData.url,
            youtube_title: ytManualData.title,
            youtube_channel: ytManualData.channel,
            youtube_thumbnail: ytManualData.thumbnail,
            youtube_duration: ytManualData.duration,
            title: ytManualData.title,
            suggested_slot_id: slotValue && slotValue !== 'general' ? parseInt(slotValue) : null,
            source: 'manual',
            status: 'pending'
        }]);
        if (error) throw error;

        alert('✅ Adicionado à fila de aprovação!');
        document.getElementById('ytPreviewResult').style.display = 'none';
        document.getElementById('ytUrlManual').value = '';
        ytManualData = null;

        const { data } = await supabase.from('music_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false });
        musicQueue = data || [];
        renderQueueSection();
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

async function handleYTAutoSearch() {
    const query   = document.getElementById('ytAutoQuery').value.trim();
    const qty     = parseInt(document.getElementById('ytAutoQty').value);
    const slotId  = document.getElementById('ytSlotAuto').value;

    if (!query) { alert('Digite um comando de busca.'); return; }

    const blockedTerms = ['funk', 'rock', 'metal', 'punk', 'rap', 'trap', 'pagodão', 'brega'];
    const searchQuery  = encodeURIComponent(query + ' letra oficial');

    const btn = document.getElementById('ytAutoSearchBtn');
    btn.textContent = '⏳ Buscando...'; btn.disabled = true;

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?q=${searchQuery}&type=video&videoCategoryId=10&maxResults=${qty * 2}&part=snippet&key=${YOUTUBE_API_KEY}`;
        const res  = await fetch(url);
        const data = await res.json();

        if (!data.items?.length) { alert('Nenhum resultado encontrado.'); return; }

        const filtered = data.items.filter(item => {
            const titleLower = item.snippet.title.toLowerCase();
            return !blockedTerms.some(t => titleLower.includes(t));
        }).slice(0, qty);

        const resultsEl = document.getElementById('ytAutoResultsList');
        resultsEl.innerHTML = filtered.map((item, i) => `
            <div class="yt-result-row">
                <input type="checkbox" class="yt-result-check" id="ytcheck_${i}" data-id="${item.id.videoId}" data-title="${item.snippet.title.replace(/"/g,'')}" data-channel="${item.snippet.channelTitle.replace(/"/g,'')}" data-thumb="${item.snippet.thumbnails?.default?.url || ''}" data-slot="${slotId}" checked>
                <img src="${item.snippet.thumbnails?.default?.url}" alt="" style="width:60px;border-radius:4px;">
                <div>
                    <div style="font-size:13px;font-weight:500;">${item.snippet.title}</div>
                    <div style="font-size:11px;color:#666;">${item.snippet.channelTitle}</div>
                </div>
            </div>
        `).join('');

        document.getElementById('ytAutoResults').style.display = 'block';
    } catch (err) {
        alert('❌ Erro na busca: ' + err.message);
    } finally {
        btn.textContent = '🔍 Buscar no YouTube'; btn.disabled = false;
    }
}

async function handleYTAutoAddSelected() {
    const checked = document.querySelectorAll('.yt-result-check:checked');
    if (!checked.length) { alert('Selecione pelo menos uma música.'); return; }

    const slotValue = document.getElementById('ytSlotAuto').value;

    let count = 0;
    for (const cb of checked) {
        const videoId = cb.dataset.id;
        try {
            await supabaseAdmin.from('music_queue').insert([{
                youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
                youtube_title: cb.dataset.title,
                youtube_channel: cb.dataset.channel,
                youtube_thumbnail: cb.dataset.thumb,
                title: cb.dataset.title,
                suggested_slot_id: slotValue && slotValue !== 'general' ? parseInt(slotValue) : null,
                source: 'auto',
                status: 'pending'
            }]);
            count++;
        } catch (err) {
            console.error('Erro ao adicionar:', err);
        }
    }

    alert(`✅ ${count} música(s) enviadas para a fila de aprovação!`);
    document.getElementById('ytAutoResults').style.display = 'none';
    document.getElementById('ytAutoResultsList').innerHTML = '';
    document.getElementById('ytAutoQuery').value = '';

    const { data } = await supabase.from('music_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    musicQueue = data || [];
    renderQueueSection();
}

// ─────────────────────────────────────────────────────────────
// VINHETAS SAZONAIS
// ─────────────────────────────────────────────────────────────
function setupSeasonalJingleListeners() {
    const categories = ['natal','ano_novo','pascoa','sao_joao'];
    categories.forEach(cat => {
        const formId = `formJingle${cat === 'ano_novo' ? 'AnoNovo' : cat === 'sao_joao' ? 'SaoJoao' : cat.charAt(0).toUpperCase() + cat.slice(1)}`;
        const form = document.getElementById(formId);
        if (form) form.addEventListener('submit', e => handleSaveSeasonalJingle(e, cat));

        const testBtns = form ? form.querySelectorAll('.jingle-test') : [];
        testBtns.forEach(btn => btn.addEventListener('click', e => {
            const url = e.target.closest('form').querySelector('.jingle-url').value.trim();
            testAudioUrl(url);
        }));

        const clearBtns = form ? form.querySelectorAll('.jingle-clear') : [];
        clearBtns.forEach(btn => btn.addEventListener('click', e => {
            const f = e.target.closest('form');
            f.querySelector('.jingle-url').value = '';
            f.querySelector('.jingle-title').value = '';
        }));
    });
}

async function handleSaveSeasonalJingle(e, category) {
    e.preventDefault();
    const form     = e.target;
    const url      = form.querySelector('.jingle-url').value.trim();
    const title    = form.querySelector('.jingle-title').value.trim();
    const position = form.querySelector('.jingle-position').value;

    try {
        const { error } = await supabaseAdmin.from('jingles').insert([{ seasonal_category: category, position, audio_url: url, title, enabled: true }]);
        if (error) throw error;
        alert('✅ Vinheta adicionada!');
        form.querySelector('.jingle-url').value = '';
        form.querySelector('.jingle-title').value = '';
        await loadSeasonalJingles();
        renderSeasonalJinglesTables();
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

function renderSeasonalJinglesTables() {
    const categories = ['natal','ano_novo','pascoa','sao_joao'];
    const catNames = { natal:'Natal', ano_novo:'AnoNovo', pascoa:'Pascoa', sao_joao:'SaoJoao' };

    categories.forEach(cat => {
        const tbody = document.getElementById(`tableJingle${catNames[cat]}`);
        if (!tbody) return;
        const list = seasonalJingles[cat] || [];

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">Nenhuma vinheta cadastrada.</td></tr>';
            return;
        }

        const posLabels = { opening:'🎬 Abertura', middle:'🎬 Meio', closing:'🎬 Encerramento' };
        tbody.innerHTML = list.map(j => `
            <tr>
                <td><span style="padding:3px 8px;background:#EEEDFE;border-radius:10px;font-size:11px;color:#3C3489;">${posLabels[j.position]||j.position}</span></td>
                <td style="font-weight:500;">${j.title}</td>
                <td><span class="status-badge ${j.enabled?'active':'inactive'}">${j.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-toggle" onclick="toggleSeasonalJingle(${j.id}, ${!j.enabled}, '${cat}')">${j.enabled?'🔴':'🟢'}</button>
                        <button class="btn-delete" onclick="deleteSeasonalJingle(${j.id}, '${cat}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    });
}

async function toggleSeasonalJingle(id, newStatus, cat) {
    await supabaseAdmin.from('jingles').update({ enabled: newStatus }).eq('id', id);
    await loadSeasonalJingles();
    renderSeasonalJinglesTables();
}

async function deleteSeasonalJingle(id, cat) {
    if (!confirm('Deletar esta vinheta?')) return;
    await supabaseAdmin.from('jingles').delete().eq('id', id);
    await loadSeasonalJingles();
    renderSeasonalJinglesTables();
}

// ─────────────────────────────────────────────────────────────
// HORAS CERTAS (legado — inalterado)
// ─────────────────────────────────────────────────────────────
function populateHourSelect() {
    const sel = document.getElementById('hourSelect');
    for (let i = 0; i < 24; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${String(i).padStart(2,'0')}:00`;
        sel.appendChild(opt);
    }
}

function renderScheduleTable() {
    const tbody = document.getElementById('scheduleTableBody');
    tbody.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
        const s = allSchedules.find(s => s.hour === hour);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold;">${String(hour).padStart(2,'0')}:00</td>
            <td><span class="status-badge ${s?.enabled ? 'active' : 'inactive'}">${s ? (s.enabled ? '✅ Ativo' : '❌ Inativo') : '⚪ Não configurado'}</span></td>
            <td><span class="audio-url" title="${s?.audio_url||''}">${s?.audio_url || 'Nenhuma URL (:00)'}</span></td>
            <td><span class="audio-url" style="color:${s?.audio_url_half?'#333':'#999'}" title="${s?.audio_url_half||''}">${s?.audio_url_half || 'Nenhuma URL (:30)'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editSchedule(${hour})">✏️ Editar</button>
                    ${s ? `<button class="btn-toggle" onclick="toggleSchedule(${s.id}, ${!s.enabled})">${s.enabled?'🔴 Desativar':'🟢 Ativar'}</button>
                    <button class="btn-delete" onclick="deleteSchedule(${s.id})">🗑️ Deletar</button>` : ''}
                </div>
            </td>`;
        tbody.appendChild(tr);
    }
}

function editSchedule(hour) {
    const s = allSchedules.find(s => s.hour === hour);
    document.getElementById('hourSelect').value   = hour;
    document.getElementById('audioUrl').value     = s?.audio_url || '';
    document.getElementById('audioUrlHalf').value = s?.audio_url_half || '';
    document.getElementById('enabledCheckbox').checked = s ? s.enabled : true;
    document.getElementById('editForm').scrollIntoView({ behavior:'smooth', block:'center' });
}

async function handleSaveSchedule(e) {
    e.preventDefault();
    const hour    = parseInt(document.getElementById('hourSelect').value);
    const url     = document.getElementById('audioUrl').value.trim();
    const urlHalf = document.getElementById('audioUrlHalf').value.trim();
    const enabled = document.getElementById('enabledCheckbox').checked;
    if (!url) { alert('Insira pelo menos a URL para :00!'); return; }
    try {
        const existing = allSchedules.find(s => s.hour === hour);
        if (existing) {
            const { error } = await supabaseAdmin.from('radio_schedule').update({ audio_url: url, audio_url_half: urlHalf||null, enabled }).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin.from('radio_schedule').insert([{ hour, audio_url: url, audio_url_half: urlHalf||null, enabled }]);
            if (error) throw error;
        }
        alert('✅ Programação salva!');
        handleClearForm();
        const { data } = await supabase.from('radio_schedule').select('*').order('hour', { ascending: true });
        allSchedules = data || [];
        renderScheduleTable();
    } catch (err) {
        alert('❌ Erro: ' + err.message);
    }
}

async function toggleSchedule(id, newStatus) {
    await supabaseAdmin.from('radio_schedule').update({ enabled: newStatus }).eq('id', id);
    const { data } = await supabase.from('radio_schedule').select('*').order('hour', { ascending: true });
    allSchedules = data || [];
    renderScheduleTable();
}

async function deleteSchedule(id) {
    if (!confirm('Deletar esta programação?')) return;
    await supabaseAdmin.from('radio_schedule').delete().eq('id', id);
    const { data } = await supabase.from('radio_schedule').select('*').order('hour', { ascending: true });
    allSchedules = data || [];
    renderScheduleTable();
}

function handleClearForm() {
    document.getElementById('hourSelect').value = '';
    document.getElementById('audioUrl').value = '';
    document.getElementById('audioUrlHalf').value = '';
    document.getElementById('enabledCheckbox').checked = true;
}

// ─────────────────────────────────────────────────────────────
// PLAYLIST DE FUNDO (legado — inalterado)
// ─────────────────────────────────────────────────────────────
function renderPlaylistTable() {
    const tbody = document.getElementById('playlistTableBody');
    if (!backgroundPlaylist.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">Nenhuma música cadastrada.</td></tr>';
        return;
    }
    tbody.innerHTML = backgroundPlaylist.map(t => `
        <tr>
            <td style="font-weight:bold;color:#666;">${t.original_order||0}</td>
            <td><span style="padding:4px 10px;background:#e3f2fd;border-radius:12px;font-weight:bold;color:#1976d2;">🎲 ${t.daily_order??0}</span></td>
            <td style="font-weight:500;">${t.title||'Sem título'}</td>
            <td><span class="status-badge ${t.enabled?'active':'inactive'}">${t.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td><span class="audio-url" title="${t.audio_url}">${t.audio_url}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editPlaylist(${t.id})">✏️</button>
                    <button class="btn-toggle" onclick="togglePlaylist(${t.id}, ${!t.enabled})">${t.enabled?'🔴':'🟢'}</button>
                    <button class="btn-delete" onclick="deletePlaylist(${t.id})">🗑️</button>
                </div>
            </td>
        </tr>`).join('');
}

async function handleSavePlaylist(e) {
    e.preventDefault();
    const url = document.getElementById('playlistUrl').value.trim();
    const title = document.getElementById('playlistTitle').value.trim();
    const order = parseInt(document.getElementById('playlistOrder').value);
    const enabled = document.getElementById('playlistEnabled').checked;
    if (!url || !title) { alert('Preencha URL e Título!'); return; }
    try {
        if (editingPlaylistId) {
            await supabaseAdmin.from('background_playlist').update({ audio_url:url, title, play_order:order, original_order:order, enabled }).eq('id', editingPlaylistId);
            alert('✅ Atualizado!');
        } else {
            await supabaseAdmin.from('background_playlist').insert([{ audio_url:url, title, play_order:order, original_order:order, daily_order:order, enabled }]);
            alert('✅ Adicionado!');
        }
        handleClearPlaylistForm();
        const { data } = await supabase.from('background_playlist').select('*').order('original_order', { ascending: true });
        backgroundPlaylist = data || [];
        renderPlaylistTable();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

function editPlaylist(id) {
    const t = backgroundPlaylist.find(t => t.id === id);
    if (!t) return;
    editingPlaylistId = id;
    document.getElementById('playlistUrl').value = t.audio_url;
    document.getElementById('playlistTitle').value = t.title || '';
    document.getElementById('playlistOrder').value = t.play_order;
    document.getElementById('playlistEnabled').checked = t.enabled;
    document.getElementById('playlistForm').scrollIntoView({ behavior:'smooth', block:'center' });
}

async function togglePlaylist(id, newStatus) {
    await supabaseAdmin.from('background_playlist').update({ enabled: newStatus }).eq('id', id);
    const { data } = await supabase.from('background_playlist').select('*').order('original_order', { ascending: true });
    backgroundPlaylist = data || []; renderPlaylistTable();
}

async function deletePlaylist(id) {
    if (!confirm('Deletar esta música?')) return;
    await supabaseAdmin.from('background_playlist').delete().eq('id', id);
    const { data } = await supabase.from('background_playlist').select('*').order('original_order', { ascending: true });
    backgroundPlaylist = data || []; renderPlaylistTable();
}

function handleClearPlaylistForm() {
    document.getElementById('playlistUrl').value = '';
    document.getElementById('playlistTitle').value = '';
    document.getElementById('playlistOrder').value = '0';
    document.getElementById('playlistEnabled').checked = true;
    editingPlaylistId = null;
    document.getElementById('playlistForm').querySelector('.submit-btn').textContent = '💾 Adicionar à Playlist';
}

async function handleForceShufflePlaylist() {
    if (!confirm('Embaralhar a playlist agora?')) return;
    try {
        const { data: tracks } = await supabaseAdmin.from('background_playlist').select('id').eq('enabled', true);
        if (!tracks?.length) { alert('Nenhuma música ativa.'); return; }
        const indices = [...Array(tracks.length).keys()];
        for (let i = indices.length-1; i > 0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [indices[i],indices[j]] = [indices[j],indices[i]];
        }
        const today = new Date().toISOString().split('T')[0];
        await Promise.all(tracks.map((t,i) => supabaseAdmin.from('background_playlist').update({ daily_order:indices[i], last_shuffle_date:today }).eq('id',t.id)));
        alert('✅ Embaralhado!');
        const { data } = await supabase.from('background_playlist').select('*').order('original_order', { ascending: true });
        backgroundPlaylist = data || []; renderPlaylistTable();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

// ─────────────────────────────────────────────────────────────
// PROPAGANDAS (legado — inalterado)
// ─────────────────────────────────────────────────────────────
function renderAdsTable() {
    const tbody = document.getElementById('adsTableBody');
    if (!advertisements.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;">Nenhuma propaganda cadastrada.</td></tr>';
        return;
    }
    tbody.innerHTML = advertisements.map(ad => `
        <tr>
            <td style="font-weight:bold;">${ad.play_order}</td>
            <td style="font-weight:500;">${ad.title}</td>
            <td>${ad.advertiser||'-'}</td>
            <td><span style="padding:4px 10px;background:#e3f2fd;border-radius:12px;font-weight:bold;color:#1976d2;">A cada ${ad.frequency} músicas</span></td>
            <td><span class="status-badge ${ad.enabled?'active':'inactive'}">${ad.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editAd(${ad.id})">✏️</button>
                    <button class="btn-toggle" onclick="toggleAd(${ad.id}, ${!ad.enabled})">${ad.enabled?'🔴':'🟢'}</button>
                    <button class="btn-delete" onclick="deleteAd(${ad.id})">🗑️</button>
                </div>
            </td>
        </tr>`).join('');
}

async function handleSaveAd(e) {
    e.preventDefault();
    const url = document.getElementById('adUrl').value.trim();
    const title = document.getElementById('adTitle').value.trim();
    const advertiser = document.getElementById('adAdvertiser').value.trim();
    const frequency = parseInt(document.getElementById('adFrequency').value);
    const order = parseInt(document.getElementById('adOrder').value);
    const enabled = document.getElementById('adEnabled').checked;
    if (!url || !title) { alert('Preencha URL e Título!'); return; }
    if (frequency < 1 || frequency > 100) { alert('Frequência entre 1 e 100!'); return; }
    try {
        const payload = { audio_url:url, title, advertiser:advertiser||null, frequency, play_order:order, enabled };
        if (editingAdId) {
            await supabaseAdmin.from('advertisements').update(payload).eq('id', editingAdId);
            alert('✅ Atualizado!');
        } else {
            await supabaseAdmin.from('advertisements').insert([payload]);
            alert('✅ Adicionado!');
        }
        handleClearAdForm();
        const { data } = await supabase.from('advertisements').select('*').order('play_order', { ascending: true });
        advertisements = data || []; renderAdsTable();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

function editAd(id) {
    const ad = advertisements.find(a => a.id === id);
    if (!ad) return;
    editingAdId = id;
    document.getElementById('adUrl').value = ad.audio_url;
    document.getElementById('adTitle').value = ad.title;
    document.getElementById('adAdvertiser').value = ad.advertiser || '';
    document.getElementById('adFrequency').value = ad.frequency;
    document.getElementById('adOrder').value = ad.play_order;
    document.getElementById('adEnabled').checked = ad.enabled;
    document.getElementById('adsForm').scrollIntoView({ behavior:'smooth', block:'center' });
    document.getElementById('adsForm').querySelector('.submit-btn').textContent = '💾 Atualizar';
}

async function toggleAd(id, newStatus) {
    await supabaseAdmin.from('advertisements').update({ enabled: newStatus }).eq('id', id);
    const { data } = await supabase.from('advertisements').select('*').order('play_order', { ascending: true });
    advertisements = data || []; renderAdsTable();
}

async function deleteAd(id) {
    if (!confirm('Deletar esta propaganda?')) return;
    await supabaseAdmin.from('advertisements').delete().eq('id', id);
    const { data } = await supabase.from('advertisements').select('*').order('play_order', { ascending: true });
    advertisements = data || []; renderAdsTable();
}

function handleClearAdForm() {
    ['adUrl','adTitle','adAdvertiser'].forEach(f => document.getElementById(f).value = '');
    document.getElementById('adFrequency').value = '3';
    document.getElementById('adOrder').value = '0';
    document.getElementById('adEnabled').checked = true;
    editingAdId = null;
    document.getElementById('adsForm').querySelector('.submit-btn').textContent = '💾 Adicionar Propaganda';
}

// ─────────────────────────────────────────────────────────────
// SAZONAIS (legado — inalterado + vinhetas novas)
// ─────────────────────────────────────────────────────────────
function setupSeasonalEventListeners() {
    document.querySelectorAll('.seasonal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentSeasonalTab = tab.dataset.category;
            document.querySelectorAll('.seasonal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.seasonal-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.seasonal-panel[data-category="${currentSeasonalTab}"]`)?.classList.add('active');
        });
    });

    document.querySelectorAll('.toggle-seasonal-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleSeasonalPlaylist(btn.dataset.category));
    });

    document.querySelectorAll('.seasonal-form').forEach(form => {
        if (!form.id.startsWith('formJingle')) {
            form.addEventListener('submit', handleSeasonalFormSubmit);
        }
    });

    document.querySelectorAll('.seasonal-test').forEach(btn => btn.addEventListener('click', e => {
        testAudioUrl(e.target.closest('form').querySelector('.seasonal-url').value.trim());
    }));

    document.querySelectorAll('.seasonal-clear').forEach(btn => btn.addEventListener('click', e => {
        const form = e.target.closest('form');
        form.reset();
        form.querySelector('.seasonal-order').value = '0';
        const f = form.querySelector('.seasonal-frequency');
        if (f) f.value = '3';
        editingSeasonalId = null;
    }));

    document.querySelectorAll('.shuffle-seasonal-btn').forEach(btn => btn.addEventListener('click', () => {
        handleSeasonalShuffle(btn.dataset.category, btn.dataset.type);
    }));

    setupSeasonalJingleListeners();
}

function renderAllSeasonalTables() {
    const cats = ['natal','ano_novo','pascoa','sao_joao'];
    const names = { natal:'Natal', ano_novo:'AnoNovo', pascoa:'Pascoa', sao_joao:'SaoJoao' };
    cats.forEach(cat => {
        renderSeasonalTable(cat, 'music', `tableMusic${names[cat]}`);
        renderSeasonalTable(cat, 'ad',    `tableAd${names[cat]}`);
    });
}

function renderSeasonalTable(category, type, tableId) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    const items = type === 'music' ? seasonalData[category].music : seasonalData[category].ads;
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="${type==='music'?5:6}" style="text-align:center;padding:20px;color:#999;">Nenhum item cadastrado</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(item => `
        <tr>
            ${type==='music'
                ? `<td style="font-weight:bold;color:#666;">${item.original_order??item.play_order??0}</td>
                   <td><span style="padding:4px 10px;background:#fff3e0;border-radius:12px;font-weight:bold;color:#e65100;">🎲 ${item.daily_order??item.play_order??0}</span></td>`
                : `<td style="font-weight:bold;">${item.play_order}</td>`}
            <td style="font-weight:500;">${item.title}</td>
            ${type==='ad' ? `<td>${item.advertiser||'-'}</td><td><span style="padding:4px 8px;background:#e3f2fd;border-radius:12px;font-size:11px;font-weight:bold;color:#1976d2;">A cada ${item.frequency}</span></td>` : ''}
            <td><span class="status-badge ${item.enabled?'active':'inactive'}">${item.enabled?'✅ Ativo':'❌ Inativo'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editSeasonalItem(${item.id},'${category}','${type}')">✏️</button>
                    <button class="btn-toggle" onclick="toggleSeasonalItem(${item.id},${!item.enabled})">${item.enabled?'🔴':'🟢'}</button>
                    <button class="btn-delete" onclick="deleteSeasonalItem(${item.id})">🗑️</button>
                </div>
            </td>
        </tr>`).join('');
}

function updateSeasonalStatusBadges() {
    const labels = { natal:'Natal', ano_novo:'Ano-Novo', pascoa:'Páscoa', sao_joao:'São João' };
    const icons  = { natal:'🎄', ano_novo:'🎆', pascoa:'🐰', sao_joao:'🔥' };
    Object.keys(labels).forEach(cat => {
        const key = cat.split('_').map(w => w.charAt(0).toUpperCase()+w.slice(1)).join('');
        const statusEl = document.getElementById(`status${key}`);
        const toggleBtn = document.getElementById(`toggle${key}`);
        if (!statusEl || !toggleBtn) return;
        const isActive = seasonalSettings[cat]?.is_active || false;
        statusEl.textContent  = isActive ? '✅ Ativo' : '❌ Inativo';
        statusEl.className    = `status-badge ${isActive ? 'active' : 'inactive'}`;
        toggleBtn.textContent = isActive ? `⏸️ Desativar ${labels[cat]}` : `${icons[cat]} Ativar ${labels[cat]}`;
        toggleBtn.style.background = isActive ? '#ff4444' : '#006b3f';
    });
}

async function toggleSeasonalPlaylist(category) {
    try {
        const newStatus = !(seasonalSettings[category]?.is_active || false);
        if (newStatus) {
            await Promise.all(['natal','ano_novo','pascoa','sao_joao'].filter(c => c !== category).map(c =>
                supabaseAdmin.from('seasonal_settings').update({ is_active: false }).eq('category', c)
            ));
        }
        await supabaseAdmin.from('seasonal_settings').update({ is_active: newStatus, activated_at: newStatus ? new Date().toISOString() : null }).eq('category', category);
        const { data } = await supabase.from('seasonal_settings').select('*');
        seasonalSettings = {};
        (data||[]).forEach(s => { seasonalSettings[s.category] = s; });
        updateSeasonalStatusBadges();
        const labels = { natal:'Natal', ano_novo:'Ano-Novo', pascoa:'Páscoa', sao_joao:'São João' };
        alert(newStatus ? `✅ Playlist de ${labels[category]} ativada!` : `⏸️ Playlist de ${labels[category]} desativada.`);
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function handleSeasonalFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const match = form.id.match(/form(Music|Ad)(\w+)/);
    if (!match) return;
    const type = match[1] === 'Music' ? 'music' : 'ad';
    const rawCat = match[2];
    const category = rawCat === 'AnoNovo' ? 'ano_novo' : rawCat === 'SaoJoao' ? 'sao_joao' : rawCat.toLowerCase();
    const url   = form.querySelector('.seasonal-url').value.trim();
    const title = form.querySelector('.seasonal-title').value.trim();
    const order = parseInt(form.querySelector('.seasonal-order').value);
    const advertiser = form.querySelector('.seasonal-advertiser')?.value.trim() || null;
    const frequency  = parseInt(form.querySelector('.seasonal-frequency')?.value || 3);
    try {
        const payload = { category, type, audio_url:url, title, play_order:order, enabled:true };
        if (type === 'music') { payload.original_order = order; payload.daily_order = order; payload.last_shuffle_date = new Date().toISOString().split('T')[0]; }
        if (type === 'ad')    { payload.advertiser = advertiser; payload.frequency = frequency; }
        if (editingSeasonalId) {
            await supabaseAdmin.from('seasonal_playlists').update(payload).eq('id', editingSeasonalId);
            alert('✅ Atualizado!');
        } else {
            await supabaseAdmin.from('seasonal_playlists').insert([payload]);
            alert('✅ Adicionado!');
        }
        form.reset();
        form.querySelector('.seasonal-order').value = '0';
        if (form.querySelector('.seasonal-frequency')) form.querySelector('.seasonal-frequency').value = '3';
        editingSeasonalId = null;
        const [musicRes, adRes] = await Promise.all([
            supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
            supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})
        ]);
        seasonalData = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
        (musicRes.data||[]).forEach(i => { if(seasonalData[i.category]) seasonalData[i.category].music.push(i); });
        (adRes.data||[]).forEach(i   => { if(seasonalData[i.category]) seasonalData[i.category].ads.push(i);   });
        renderAllSeasonalTables();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

function editSeasonalItem(id, category, type) {
    const items = type === 'music' ? seasonalData[category].music : seasonalData[category].ads;
    const item  = items.find(i => i.id === id);
    if (!item) return;
    editingSeasonalId = id;
    const names = { natal:'Natal', ano_novo:'AnoNovo', pascoa:'Pascoa', sao_joao:'SaoJoao' };
    const form  = document.getElementById(`form${type==='music'?'Music':'Ad'}${names[category]}`);
    if (!form) return;
    form.querySelector('.seasonal-url').value   = item.audio_url;
    form.querySelector('.seasonal-title').value = item.title;
    form.querySelector('.seasonal-order').value = type==='music' ? (item.original_order||0) : item.play_order;
    if (type === 'ad') {
        if (form.querySelector('.seasonal-advertiser')) form.querySelector('.seasonal-advertiser').value = item.advertiser||'';
        if (form.querySelector('.seasonal-frequency'))  form.querySelector('.seasonal-frequency').value  = item.frequency||3;
    }
    form.scrollIntoView({ behavior:'smooth', block:'center' });
}

async function toggleSeasonalItem(id, newStatus) {
    await supabaseAdmin.from('seasonal_playlists').update({ enabled: newStatus }).eq('id', id);
    const [musicRes, adRes] = await Promise.all([
        supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
        supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})
    ]);
    seasonalData = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
    (musicRes.data||[]).forEach(i => { if(seasonalData[i.category]) seasonalData[i.category].music.push(i); });
    (adRes.data||[]).forEach(i   => { if(seasonalData[i.category]) seasonalData[i.category].ads.push(i);   });
    renderAllSeasonalTables();
}

async function deleteSeasonalItem(id) {
    if (!confirm('Deletar este item?')) return;
    await supabaseAdmin.from('seasonal_playlists').delete().eq('id', id);
    const [musicRes, adRes] = await Promise.all([
        supabase.from('seasonal_playlists').select('*').eq('type','music').order('original_order',{ascending:true}),
        supabase.from('seasonal_playlists').select('*').eq('type','ad').order('play_order',{ascending:true})
    ]);
    seasonalData = { natal:{music:[],ads:[]}, ano_novo:{music:[],ads:[]}, pascoa:{music:[],ads:[]}, sao_joao:{music:[],ads:[]} };
    (musicRes.data||[]).forEach(i => { if(seasonalData[i.category]) seasonalData[i.category].music.push(i); });
    (adRes.data||[]).forEach(i   => { if(seasonalData[i.category]) seasonalData[i.category].ads.push(i);   });
    renderAllSeasonalTables();
}

async function handleSeasonalShuffle(category, type) {
    const labels = { natal:'Natal', ano_novo:'Ano-Novo', pascoa:'Páscoa', sao_joao:'São João' };
    if (!confirm(`Embaralhar músicas de ${labels[category]} agora?`)) return;
    try {
        const { data: tracks } = await supabaseAdmin.from('seasonal_playlists').select('id').eq('category', category).eq('type', type).eq('enabled', true);
        if (!tracks?.length) { alert('Nenhuma música para embaralhar.'); return; }
        const indices = [...Array(tracks.length).keys()];
        for (let i = indices.length-1; i > 0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [indices[i],indices[j]] = [indices[j],indices[i]];
        }
        const today = new Date().toISOString().split('T')[0];
        await Promise.all(tracks.map((t,i) => supabaseAdmin.from('seasonal_playlists').update({ daily_order:indices[i], last_shuffle_date:today }).eq('id',t.id)));
        alert('✅ Embaralhado!');
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function testAudioUrl(url) {
    if (!url) { alert('Insira uma URL para testar!'); return; }
    testAudio.src = url;
    testAudio.play()
        .then(() => { alert('▶️ Reproduzindo...\nClique OK para parar.'); testAudio.pause(); testAudio.currentTime = 0; })
        .catch(() => { alert('❌ Erro ao reproduzir. Verifique a URL.'); });
}

function setupRealtimeSubscription() {
    supabase.channel('admin_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'music_queue' }, async () => {
            const { data } = await supabase.from('music_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            musicQueue = data || [];
            renderQueueSection();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'seasonal_settings' }, async () => {
            const { data } = await supabase.from('seasonal_settings').select('*');
            seasonalSettings = {};
            (data||[]).forEach(s => { seasonalSettings[s.category] = s; });
            updateSeasonalStatusBadges();
        })
        .subscribe();
    }
