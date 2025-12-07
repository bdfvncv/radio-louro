// Configuração do Supabase
const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_PASSWORD = 'senhaDev';

// Elementos DOM principais
const loginScreen = document.getElementById('loginScreen');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const hourSelect = document.getElementById('hourSelect');
const audioUrl = document.getElementById('audioUrl');
const audioUrlHalf = document.getElementById('audioUrlHalf');
const enabledCheckbox = document.getElementById('enabledCheckbox');
const editForm = document.getElementById('editForm');
const testBtn = document.getElementById('testBtn');
const testBtnHalf = document.getElementById('testBtnHalf');
const clearBtn = document.getElementById('clearBtn');
const scheduleTableBody = document.getElementById('scheduleTableBody');
const testAudio = document.getElementById('testAudio');

const playlistForm = document.getElementById('playlistForm');
const playlistUrl = document.getElementById('playlistUrl');
const playlistTitle = document.getElementById('playlistTitle');
const playlistOrder = document.getElementById('playlistOrder');
const playlistEnabled = document.getElementById('playlistEnabled');
const testPlaylistBtn = document.getElementById('testPlaylistBtn');
const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
const playlistTableBody = document.getElementById('playlistTableBody');
const forceShuffleBtn = document.getElementById('forceShuffleBtn');

const adsForm = document.getElementById('adsForm');
const adUrl = document.getElementById('adUrl');
const adTitle = document.getElementById('adTitle');
const adAdvertiser = document.getElementById('adAdvertiser');
const adFrequency = document.getElementById('adFrequency');
const adOrder = document.getElementById('adOrder');
const adEnabled = document.getElementById('adEnabled');
const testAdBtn = document.getElementById('testAdBtn');
const clearAdBtn = document.getElementById('clearAdBtn');
const adsTableBody = document.getElementById('adsTableBody');

// Estado
let isAuthenticated = false;
let allSchedules = [];
let backgroundPlaylist = [];
let advertisements = [];
let editingHour = null;
let editingPlaylistId = null;
let editingAdId = null;

// 🎄 NOVO: Estado das playlists temáticas
let seasonalData = {
    natal: { music: [], ads: [] },
    ano_novo: { music: [], ads: [] },
    pascoa: { music: [], ads: [] },
    sao_joao: { music: [], ads: [] }
};
let seasonalSettings = {};
let currentSeasonalTab = 'natal';
let editingSeasonalId = null;

// Inicializar
init();

function init() {
    checkAuth();
    populateHourSelect();
    setupEventListeners();
    setupSeasonalEventListeners();
}

function checkAuth() {
    const authToken = sessionStorage.getItem('radio_admin_auth');
    if (authToken === 'authenticated') {
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

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    editForm.addEventListener('submit', handleSaveSchedule);
    testBtn.addEventListener('click', handleTestAudio);
    if (testBtnHalf) {
        testBtnHalf.addEventListener('click', handleTestAudioHalf);
    }
    clearBtn.addEventListener('click', handleClearForm);
    hourSelect.addEventListener('change', handleHourSelect);
    
    playlistForm.addEventListener('submit', handleSavePlaylist);
    testPlaylistBtn.addEventListener('click', handleTestPlaylistAudio);
    clearPlaylistBtn.addEventListener('click', handleClearPlaylistForm);
    
    if (forceShuffleBtn) {
        forceShuffleBtn.addEventListener('click', handleForceShufflePlaylist);
    }
    
    adsForm.addEventListener('submit', handleSaveAd);
    testAdBtn.addEventListener('click', handleTestAdAudio);
    clearAdBtn.addEventListener('click', handleClearAdForm);
}

// ==========================================
// 🎄 PLAYLISTS TEMÁTICAS - NOVO!
// ==========================================

function setupSeasonalEventListeners() {
    const tabs = document.querySelectorAll('.seasonal-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            switchSeasonalTab(category);
        });
    });

    const toggleBtns = document.querySelectorAll('.toggle-seasonal-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            toggleSeasonalPlaylist(category);
        });
    });

    const seasonalForms = document.querySelectorAll('.seasonal-form');
    seasonalForms.forEach(form => {
        form.addEventListener('submit', handleSeasonalFormSubmit);
    });

    const testButtons = document.querySelectorAll('.seasonal-test');
    testButtons.forEach(btn => {
        btn.addEventListener('click', handleSeasonalTest);
    });

    const clearButtons = document.querySelectorAll('.seasonal-clear');
    clearButtons.forEach(btn => {
        btn.addEventListener('click', handleSeasonalClear);
    });
}

function switchSeasonalTab(category) {
    currentSeasonalTab = category;
    
    document.querySelectorAll('.seasonal-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        }
    });
    
    document.querySelectorAll('.seasonal-panel').forEach(panel => {
        panel.classList.remove('active');
        if (panel.dataset.category === category) {
            panel.classList.add('active');
        }
    });
}

async function loadSeasonalData() {
    try {
        const { data: musicData, error: musicError } = await supabase
            .from('seasonal_playlists')
            .select('*')
            .eq('type', 'music')
            .order('play_order', { ascending: true });
        
        if (musicError) throw musicError;
        
        const { data: adData, error: adError } = await supabase
            .from('seasonal_playlists')
            .select('*')
            .eq('type', 'ad')
            .order('play_order', { ascending: true });
        
        if (adError) throw adError;
        
        seasonalData = {
            natal: { music: [], ads: [] },
            ano_novo: { music: [], ads: [] },
            pascoa: { music: [], ads: [] },
            sao_joao: { music: [], ads: [] }
        };
        
        musicData.forEach(item => {
            if (seasonalData[item.category]) {
                seasonalData[item.category].music.push(item);
            }
        });
        
        adData.forEach(item => {
            if (seasonalData[item.category]) {
                seasonalData[item.category].ads.push(item);
            }
        });
        
        renderAllSeasonalTables();
        
    } catch (error) {
        console.error('Erro ao carregar dados temáticos:', error);
    }
}

async function loadSeasonalSettings() {
    try {
        const { data, error } = await supabase
            .from('seasonal_settings')
            .select('*');
        
        if (error) throw error;
        
        seasonalSettings = {};
        data.forEach(setting => {
            seasonalSettings[setting.category] = setting;
        });
        
        updateSeasonalStatusBadges();
        
    } catch (error) {
        console.error('Erro ao carregar configurações temáticas:', error);
    }
}

function updateSeasonalStatusBadges() {
    const categories = ['natal', 'ano_novo', 'pascoa', 'sao_joao'];
    const icons = {
        natal: '🎄',
        ano_novo: '🎆',
        pascoa: '🐰',
        sao_joao: '🔥'
    };
    const labels = {
        natal: 'Natal',
        ano_novo: 'Ano-Novo',
        pascoa: 'Páscoa',
        sao_joao: 'São João'
    };
    
    categories.forEach(cat => {
        const statusEl = document.getElementById(`status${cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`);
        const toggleBtn = document.getElementById(`toggle${cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`);
        
        if (statusEl && toggleBtn) {
            const isActive = seasonalSettings[cat]?.is_active || false;
            
            if (isActive) {
                statusEl.textContent = '✅ Ativo';
                statusEl.className = 'status-badge active';
                toggleBtn.textContent = `⏸️ Desativar ${labels[cat]}`;
                toggleBtn.style.background = '#ff4444';
            } else {
                statusEl.textContent = '❌ Inativo';
                statusEl.className = 'status-badge inactive';
                toggleBtn.textContent = `${icons[cat]} Ativar ${labels[cat]}`;
                toggleBtn.style.background = '#00a86b';
            }
        }
    });
}

async function toggleSeasonalPlaylist(category) {
    try {
        const currentStatus = seasonalSettings[category]?.is_active || false;
        const newStatus = !currentStatus;
        
        if (newStatus) {
            const categories = ['natal', 'ano_novo', 'pascoa', 'sao_joao'];
            for (const cat of categories) {
                if (cat !== category) {
                    await supabase
                        .from('seasonal_settings')
                        .update({ 
                            is_active: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq('category', cat);
                }
            }
        }
        
        const { error } = await supabase
            .from('seasonal_settings')
            .update({ 
                is_active: newStatus,
                activated_at: newStatus ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('category', category);
        
        if (error) throw error;
        
        await loadSeasonalSettings();
        
        const labels = {
            natal: 'Natal',
            ano_novo: 'Ano-Novo',
            pascoa: 'Páscoa',
            sao_joao: 'São João'
        };
        
        if (newStatus) {
            alert(`✅ Playlist de ${labels[category]} ativada!\n\nAs músicas e propagandas temáticas substituirão temporariamente a playlist normal.\n\n⚠️ As horas certas continuam funcionando normalmente.`);
        } else {
            alert(`⏸️ Playlist de ${labels[category]} desativada!\n\nO sistema voltará à playlist normal.`);
        }
        
    } catch (error) {
        console.error('Erro ao alternar playlist temática:', error);
        alert('❌ Erro ao alternar playlist: ' + error.message);
    }
}

function renderAllSeasonalTables() {
    const categories = ['natal', 'ano_novo', 'pascoa', 'sao_joao'];
    
    categories.forEach(cat => {
        const catName = cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        renderSeasonalTable(cat, 'music', `tableMusic${catName}`);
        renderSeasonalTable(cat, 'ad', `tableAd${catName}`);
    });
}

function renderSeasonalTable(category, type, tableId) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const items = type === 'music' ? seasonalData[category].music : seasonalData[category].ads;
    
    if (items.length === 0) {
        const tr = document.createElement('tr');
        const colspan = type === 'music' ? 4 : 6;
        tr.innerHTML = `<td colspan="${colspan}" style="text-align: center; padding: 30px; color: #999;">Nenhum item cadastrado</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    items.forEach(item => {
        const tr = document.createElement('tr');
        
        const tdOrder = document.createElement('td');
        tdOrder.textContent = item.play_order;
        tdOrder.style.fontWeight = 'bold';
        tr.appendChild(tdOrder);
        
        const tdTitle = document.createElement('td');
        tdTitle.textContent = item.title;
        tdTitle.style.fontWeight = '500';
        tr.appendChild(tdTitle);
        
        if (type === 'ad') {
            const tdAdvertiser = document.createElement('td');
            tdAdvertiser.textContent = item.advertiser || '-';
            tr.appendChild(tdAdvertiser);
            
            const tdFreq = document.createElement('td');
            const freqBadge = document.createElement('span');
            freqBadge.style.padding = '5px 10px';
            freqBadge.style.background = '#e3f2fd';
            freqBadge.style.borderRadius = '15px';
            freqBadge.style.fontWeight = 'bold';
            freqBadge.style.color = '#1976d2';
            freqBadge.textContent = `A cada ${item.frequency} músicas`;
            tdFreq.appendChild(freqBadge);
            tr.appendChild(tdFreq);
        }
        
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        if (item.enabled) {
            statusBadge.textContent = '✅ Ativo';
            statusBadge.classList.add('active');
        } else {
            statusBadge.textContent = '❌ Inativo';
            statusBadge.classList.add('inactive');
        }
        tdStatus.appendChild(statusBadge);
        tr.appendChild(tdStatus);
        
        const tdActions = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'action-btns';
        
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.textContent = '✏️ Editar';
        btnEdit.onclick = () => editSeasonalItem(item.id, category, type);
        actionsDiv.appendChild(btnEdit);
        
        const btnToggle = document.createElement('button');
        btnToggle.className = 'btn-toggle';
        btnToggle.textContent = item.enabled ? '🔴 Desativar' : '🟢 Ativar';
        btnToggle.onclick = () => toggleSeasonalItem(item.id, !item.enabled);
        actionsDiv.appendChild(btnToggle);
        
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete';
        btnDelete.textContent = '🗑️ Deletar';
        btnDelete.onclick = () => deleteSeasonalItem(item.id);
        actionsDiv.appendChild(btnDelete);
        
        tdActions.appendChild(actionsDiv);
        tr.appendChild(tdActions);
        
        tbody.appendChild(tr);
    });
}

async function handleSeasonalFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formId = form.id;
    
    const match = formId.match(/form(Music|Ad)(\w+)/);
    if (!match) return;
    
    const type = match[1] === 'Music' ? 'music' : 'ad';
    const categoryRaw = match[2];
    const category = categoryRaw === 'AnoNovo' ? 'ano_novo' : categoryRaw === 'SaoJoao' ? 'sao_joao' : categoryRaw.toLowerCase();
    
    const url = form.querySelector('.seasonal-url').value.trim();
    const title = form.querySelector('.seasonal-title').value.trim();
    const order = parseInt(form.querySelector('.seasonal-order').value);
    
    let advertiser = null;
    let frequency = 3;
    
    if (type === 'ad') {
        const advertiserInput = form.querySelector('.seasonal-advertiser');
        const frequencyInput = form.querySelector('.seasonal-frequency');
        advertiser = advertiserInput ? advertiserInput.value.trim() : null;
        frequency = frequencyInput ? parseInt(frequencyInput.value) : 3;
    }
    
    try {
        const itemData = {
            category: category,
            type: type,
            audio_url: url,
            title: title,
            play_order: order,
            enabled: true
        };
        
        if (type === 'ad') {
            itemData.advertiser = advertiser || null;
            itemData.frequency = frequency;
        }
        
        if (editingSeasonalId) {
            const { error } = await supabase
                .from('seasonal_playlists')
                .update({
                    ...itemData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingSeasonalId);
            
            if (error) throw error;
            alert('✅ Item atualizado com sucesso!');
        } else {
            const { error } = await supabase
                .from('seasonal_playlists')
                .insert([itemData]);
            
            if (error) throw error;
            alert('✅ Item adicionado com sucesso!');
        }
        
        form.reset();
        form.querySelector('.seasonal-order').value = '0';
        if (type === 'ad') {
            form.querySelector('.seasonal-frequency').value = '3';
        }
        editingSeasonalId = null;
        
        await loadSeasonalData();
        
    } catch (error) {
        console.error('Erro ao salvar item temático:', error);
        alert('❌ Erro ao salvar: ' + error.message);
    }
}

function editSeasonalItem(id, category, type) {
    const items = type === 'music' ? seasonalData[category].music : seasonalData[category].ads;
    const item = items.find(i => i.id === id);
    
    if (!item) return;
    
    editingSeasonalId = id;
    
    const categoryName = category === 'ano_novo' ? 'AnoNovo' : category === 'sao_joao' ? 'SaoJoao' : category.charAt(0).toUpperCase() + category.slice(1);
    const typeStr = type === 'music' ? 'Music' : 'Ad';
    const formId = `form${typeStr}${categoryName}`;
    const form = document.getElementById(formId);
    
    if (!form) return;
    
    form.querySelector('.seasonal-url').value = item.audio_url;
    form.querySelector('.seasonal-title').value = item.title;
    form.querySelector('.seasonal-order').value = item.play_order;
    
    if (type === 'ad') {
        form.querySelector('.seasonal-advertiser').value = item.advertiser || '';
        form.querySelector('.seasonal-frequency').value = item.frequency || 3;
    }
    
    switchSeasonalTab(category);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function toggleSeasonalItem(id, newStatus) {
    try {
        const { error } = await supabase
            .from('seasonal_playlists')
            .update({ 
                enabled: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        await loadSeasonalData();
    } catch (error) {
        console.error('Erro ao alternar status:', error);
        alert('❌ Erro ao alternar status: ' + error.message);
    }
}

async function deleteSeasonalItem(id) {
    if (!confirm('Tem certeza que deseja deletar este item?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('seasonal_playlists')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('✅ Item deletado com sucesso!');
        await loadSeasonalData();
    } catch (error) {
        console.error('Erro ao deletar:', error);
        alert('❌ Erro ao deletar: ' + error.message);
    }
}

function handleSeasonalTest(e) {
    const form = e.target.closest('form');
    const url = form.querySelector('.seasonal-url').value.trim();
    
    if (!url) {
        alert('Por favor, insira uma URL para testar!');
        return;
    }
    
    testAudio.src = url;
    testAudio.play()
        .then(() => {
            alert('▶️ Reproduzindo áudio de teste...\nClique em OK para parar.');
            testAudio.pause();
            testAudio.currentTime = 0;
        })
        .catch(error => {
            console.error('Erro ao testar áudio:', error);
            alert('❌ Erro ao reproduzir áudio. Verifique se a URL está correta.');
        });
}

function handleSeasonalClear(e) {
    const form = e.target.closest('form');
    form.reset();
    form.querySelector('.seasonal-order').value = '0';
    const freqInput = form.querySelector('.seasonal-frequency');
    if (freqInput) {
        freqInput.value = '3';
    }
    editingSeasonalId = null;
}

// ==========================================
// FIM - PLAYLISTS TEMÁTICAS
// ==========================================

function handleLogin(e) {
    e.preventDefault();
    
    const password = passwordInput.value;
    
    if (password === ADMIN_PASSWORD) {
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
}

function handleLogout() {
    sessionStorage.removeItem('radio_admin_auth');
    isAuthenticated = false;
    showLoginScreen();
    passwordInput.value = '';
}

function populateHourSelect() {
    for (let i = 0; i < 24; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${String(i).padStart(2, '0')}:00`;
        hourSelect.appendChild(option);
    }
}

function loadAllData() {
    loadAllSchedules();
    loadBackgroundPlaylist();
    loadAdvertisements();
    loadSeasonalData();
    loadSeasonalSettings();
    setupRealtimeSubscription();
}

function setupRealtimeSubscription() {
    supabase
        .channel('admin_schedule_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            () => {
                console.log('Atualização detectada, recarregando...');
                loadAllSchedules();
            }
        )
        .subscribe();
    
    supabase
        .channel('seasonal_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_playlists' },
            () => {
                console.log('Playlists temáticas atualizadas');
                loadSeasonalData();
            }
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_settings' },
            () => {
                console.log('Configurações temáticas atualizadas');
                loadSeasonalSettings();
            }
        )
        .subscribe();
}
async function loadAllSchedules() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .order('hour', { ascending: true });
        
        if (error) throw error;
        
        allSchedules = data || [];
        renderScheduleTable();
    } catch (error) {
        console.error('Erro ao carregar programação:', error);
    }
}

function renderScheduleTable() {
    scheduleTableBody.innerHTML = '';
    
    for (let hour = 0; hour < 24; hour++) {
        const schedule = allSchedules.find(s => s.hour === hour);
        
        const tr = document.createElement('tr');
        
        const tdHour = document.createElement('td');
        tdHour.textContent = `${String(hour).padStart(2, '0')}:00`;
        tdHour.style.fontWeight = 'bold';
        tr.appendChild(tdHour);
        
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        if (schedule && schedule.enabled) {
            statusBadge.textContent = '✅ Ativo';
            statusBadge.classList.add('active');
        } else if (schedule && !schedule.enabled) {
            statusBadge.textContent = '❌ Inativo';
            statusBadge.classList.add('inactive');
        } else {
            statusBadge.textContent = '⚪ Não configurado';
            statusBadge.classList.add('inactive');
        }
        tdStatus.appendChild(statusBadge);
        tr.appendChild(tdStatus);
        
        const tdUrl = document.createElement('td');
        const urlSpan = document.createElement('span');
        urlSpan.className = 'audio-url';
        urlSpan.textContent = schedule && schedule.audio_url ? schedule.audio_url : 'Nenhuma URL (:00)';
        urlSpan.title = schedule && schedule.audio_url ? schedule.audio_url : '';
        tdUrl.appendChild(urlSpan);
        tr.appendChild(tdUrl);
        
        const tdUrlHalf = document.createElement('td');
        const urlHalfSpan = document.createElement('span');
        urlHalfSpan.className = 'audio-url';
        urlHalfSpan.textContent = schedule && schedule.audio_url_half ? schedule.audio_url_half : 'Nenhuma URL (:30)';
        urlHalfSpan.title = schedule && schedule.audio_url_half ? schedule.audio_url_half : '';
        urlHalfSpan.style.color = schedule && schedule.audio_url_half ? '#333' : '#999';
        tdUrlHalf.appendChild(urlHalfSpan);
        tr.appendChild(tdUrlHalf);
        
        const tdActions = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'action-btns';
        
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.textContent = '✏️ Editar';
        btnEdit.onclick = () => editSchedule(hour);
        actionsDiv.appendChild(btnEdit);
        
        if (schedule) {
            const btnToggle = document.createElement('button');
            btnToggle.className = 'btn-toggle';
            btnToggle.textContent = schedule.enabled ? '🔴 Desativar' : '🟢 Ativar';
            btnToggle.onclick = () => toggleSchedule(schedule.id, !schedule.enabled);
            actionsDiv.appendChild(btnToggle);
            
            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-delete';
            btnDelete.textContent = '🗑️ Deletar';
            btnDelete.onclick = () => deleteSchedule(schedule.id);
            actionsDiv.appendChild(btnDelete);
        }
        
        tdActions.appendChild(actionsDiv);
        tr.appendChild(tdActions);
        
        scheduleTableBody.appendChild(tr);
    }
}

function editSchedule(hour) {
    const schedule = allSchedules.find(s => s.hour === hour);
    
    editingHour = hour;
    hourSelect.value = hour;
    audioUrl.value = schedule ? schedule.audio_url : '';
    audioUrlHalf.value = schedule ? (schedule.audio_url_half || '') : '';
    enabledCheckbox.checked = schedule ? schedule.enabled : true;
    
    editForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    audioUrl.focus();
}

async function handleSaveSchedule(e) {
    e.preventDefault();
    
    const hour = parseInt(hourSelect.value);
    const url = audioUrl.value.trim();
    const urlHalf = audioUrlHalf.value.trim();
    const enabled = enabledCheckbox.checked;
    
    if (!url) {
        alert('Por favor, insira pelo menos a URL para :00!');
        return;
    }
    
    try {
        const existingSchedule = allSchedules.find(s => s.hour === hour);
        
        if (existingSchedule) {
            const { error } = await supabase
                .from('radio_schedule')
                .update({
                    audio_url: url,
                    audio_url_half: urlHalf || null,
                    enabled: enabled,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSchedule.id);
            
            if (error) throw error;
            alert('✅ Programação atualizada com sucesso!');
        } else {
            const { error } = await supabase
                .from('radio_schedule')
                .insert([{
                    hour: hour,
                    audio_url: url,
                    audio_url_half: urlHalf || null,
                    enabled: enabled
                }]);
            
            if (error) throw error;
            alert('✅ Programação salva com sucesso!');
        }
        
        handleClearForm();
        loadAllSchedules();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('❌ Erro ao salvar programação: ' + error.message);
    }
}

async function toggleSchedule(id, newStatus) {
    try {
        const { error } = await supabase
            .from('radio_schedule')
            .update({ 
                enabled: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        loadAllSchedules();
    } catch (error) {
        console.error('Erro ao alternar status:', error);
        alert('❌ Erro ao alternar status: ' + error.message);
    }
}

async function deleteSchedule(id) {
    if (!confirm('Tem certeza que deseja deletar esta programação?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('radio_schedule')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('✅ Programação deletada com sucesso!');
        loadAllSchedules();
    } catch (error) {
        console.error('Erro ao deletar:', error);
        alert('❌ Erro ao deletar programação: ' + error.message);
    }
}

function handleTestAudio() {
    const url = audioUrl.value.trim();
    
    if (!url) {
        alert('Por favor, insira uma URL para testar!');
        return;
    }
    
    testAudio.src = url;
    testAudio.play()
        .then(() => {
            alert('▶️ Reproduzindo áudio de teste...\nClique em OK para parar.');
            testAudio.pause();
            testAudio.currentTime = 0;
        })
        .catch(error => {
            console.error('Erro ao testar áudio:', error);
            alert('❌ Erro ao reproduzir áudio. Verifique se a URL está correta.');
        });
}

function handleClearForm() {
    hourSelect.value = '';
    audioUrl.value = '';
    audioUrlHalf.value = '';
    enabledCheckbox.checked = true;
    editingHour = null;
}

function handleHourSelect() {
    const hour = parseInt(hourSelect.value);
    if (!isNaN(hour)) {
        editSchedule(hour);
    }
}

function handleTestAudioHalf() {
    const url = audioUrlHalf.value.trim();
    
    if (!url) {
        alert('Por favor, insira uma URL para :30 para testar!');
        return;
    }
    
    testAudio.src = url;
    testAudio.play()
        .then(() => {
            alert('▶️ Reproduzindo áudio de :30...\nClique em OK para parar.');
            testAudio.pause();
            testAudio.currentTime = 0;
        })
        .catch(error => {
            console.error('Erro ao testar áudio:', error);
            alert('❌ Erro ao reproduzir áudio. Verifique se a URL está correta.');
        });
}

async function handleForceShufflePlaylist() {
    if (!confirm('🎲 Deseja embaralhar a playlist agora?\n\nIsso criará uma nova ordem aleatória para reprodução hoje.')) {
        return;
    }
    
    try {
        const { data: allTracks, error: fetchError } = await supabase
            .from('background_playlist')
            .select('id, original_order')
            .eq('enabled', true)
            .order('original_order', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        if (!allTracks || allTracks.length === 0) {
            alert('❌ Nenhuma música ativa para embaralhar!');
            return;
        }
        
        const shuffledIndices = [...Array(allTracks.length).keys()];
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        
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
        
        alert('🎲 Playlist embaralhada com sucesso!\n\n✅ Nova ordem de reprodução aplicada.');
        loadBackgroundPlaylist();
        
    } catch (error) {
        console.error('Erro ao embaralhar:', error);
        alert('❌ Erro ao embaralhar playlist: ' + error.message);
    }
}

async function loadBackgroundPlaylist() {
    try {
        const { data, error } = await supabase
            .from('background_playlist')
            .select('*')
            .order('original_order', { ascending: true });
        
        if (error) throw error;
        
        backgroundPlaylist = data || [];
        renderPlaylistTable();
    } catch (error) {
        console.error('Erro ao carregar playlist:', error);
    }
}

function renderPlaylistTable() {
    playlistTableBody.innerHTML = '';
    
    if (backgroundPlaylist.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" style="text-align: center; padding: 30px; color: #999;">Nenhuma música na playlist. Adicione músicas usando o formulário acima.</td>';
        playlistTableBody.appendChild(tr);
        return;
    }
    
    backgroundPlaylist.forEach(track => {
        const tr = document.createElement('tr');
        
        const tdOriginalOrder = document.createElement('td');
        tdOriginalOrder.textContent = track.original_order || track.play_order || 0;
        tdOriginalOrder.style.fontWeight = 'bold';
        tdOriginalOrder.style.color = '#666';
        tr.appendChild(tdOriginalOrder);
        
        const tdDailyOrder = document.createElement('td');
        const dailyBadge = document.createElement('span');
        dailyBadge.style.padding = '5px 12px';
        dailyBadge.style.background = '#e3f2fd';
        dailyBadge.style.borderRadius = '15px';
        dailyBadge.style.fontWeight = 'bold';
        dailyBadge.style.color = '#1976d2';
        dailyBadge.textContent = `🎲 ${track.daily_order !== undefined ? track.daily_order : (track.play_order || 0)}`;
        tdDailyOrder.appendChild(dailyBadge);
        tr.appendChild(tdDailyOrder);
        
        const tdTitle = document.createElement('td');
        tdTitle.textContent = track.title || 'Sem título';
        tdTitle.style.fontWeight = '500';
        tr.appendChild(tdTitle);
        
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        if (track.enabled) {
            statusBadge.textContent = '✅ Ativo';
            statusBadge.classList.add('active');
        } else {
            statusBadge.textContent = '❌ Inativo';
            statusBadge.classList.add('inactive');
        }
        tdStatus.appendChild(statusBadge);
        tr.appendChild(tdStatus);
        
        const tdUrl = document.createElement('td');
        const urlSpan = document.createElement('span');
        urlSpan.className = 'audio-url';
        urlSpan.textContent = track.audio_url;
        urlSpan.title = track.audio_url;
        tdUrl.appendChild(urlSpan);
        tr.appendChild(tdUrl);
        
        const tdActions = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'action-btns';
        
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.textContent = '✏️ Editar';
        btnEdit.onclick = () => editPlaylist(track.id);
        actionsDiv.appendChild(btnEdit);
        
        const btnToggle = document.createElement('button');
        btnToggle.className = 'btn-toggle';
        btnToggle.textContent = track.enabled ? '🔴 Desativar' : '🟢 Ativar';
        btnToggle.onclick = () => togglePlaylist(track.id, !track.enabled);
        actionsDiv.appendChild(btnToggle);
        
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete';
        btnDelete.textContent = '🗑️ Deletar';
        btnDelete.onclick = () => deletePlaylist(track.id);
        actionsDiv.appendChild(btnDelete);
        
        tdActions.appendChild(actionsDiv);
        tr.appendChild(tdActions);
        
        playlistTableBody.appendChild(tr);
    });
}

async function handleSavePlaylist(e) {
    e.preventDefault();
    
    const url = playlistUrl.value.trim();
    const title = playlistTitle.value.trim();
    const order = parseInt(playlistOrder.value);
    const enabled = playlistEnabled.checked;
    
    if (!url || !title) {
        alert('Por favor, preencha todos os campos obrigatórios!');
        return;
    }
    
    try {
        if (editingPlaylistId) {
            const { error } = await supabase
                .from('background_playlist')
                .update({
                    audio_url: url,
                    title: title,
                    play_order: order,
                    original_order: order,
                    enabled: enabled,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingPlaylistId);
            
            if (error) throw error;
            alert('✅ Música atualizada com sucesso!');
        } else {
            const { error } = await supabase
                .from('background_playlist')
                .insert([{
                    audio_url: url,
                    title: title,
                    play_order: order,
                    original_order: order,
                    daily_order: order,
                    enabled: enabled
                }]);
            
            if (error) throw error;
            alert('✅ Música adicionada à playlist com sucesso!');
        }
        
        handleClearPlaylistForm();
        loadBackgroundPlaylist();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('❌ Erro ao salvar música: ' + error.message);
    }
}

function editPlaylist(id) {
    const track = backgroundPlaylist.find(t => t.id === id);
    
    if (track) {
        editingPlaylistId = id;
        playlistUrl.value = track.audio_url;
        playlistTitle.value = track.title || '';
        playlistOrder.value = track.play_order;
        playlistEnabled.checked = track.enabled;
        
        playlistForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const submitBtn = playlistForm.querySelector('.submit-btn');
        submitBtn.textContent = '💾 Atualizar Música';
        
        playlistTitle.focus();
    }
}

async function togglePlaylist(id, newStatus) {
    try {
        const { error } = await supabase
            .from('background_playlist')
            .update({ 
                enabled: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        loadBackgroundPlaylist();
    } catch (error) {
        console.error('Erro ao alternar status:', error);
        alert('❌ Erro ao alternar status: ' + error.message);
    }
}

async function deletePlaylist(id) {
    if (!confirm('Tem certeza que deseja deletar esta música da playlist?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('radio_schedule')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('✅ Música deletada com sucesso!');
        loadBackgroundPlaylist();
    } catch (error) {
        console.error('Erro ao deletar:', error);
        alert('❌ Erro ao deletar música: ' + error.message);
    }
}

function handleTestPlaylistAudio() {
    const url = playlistUrl.value.trim();
    
    if (!url) {
        alert('Por favor, insira uma URL para testar!');
        return;
    }
    
    testAudio.src = url;
    testAudio.play()
        .then(() => {
            alert('▶️ Reproduzindo áudio de teste...\nClique em OK para parar.');
            testAudio.pause();
            testAudio.currentTime = 0;
        })
        .catch(error => {
            console.error('Erro ao testar áudio:', error);
            alert('❌ Erro ao reproduzir áudio. Verifique se a URL está correta.');
        });
}

function handleClearPlaylistForm() {
    playlistUrl.value = '';
    playlistTitle.value = '';
    playlistOrder.value = '0';
    playlistEnabled.checked = true;
    editingPlaylistId = null;
    
    const submitBtn = playlistForm.querySelector('.submit-btn');
    submitBtn.textContent = '💾 Adicionar à Playlist';
}

async function loadAdvertisements() {
    try {
        const { data, error } = await supabase
            .from('advertisements')
            .select('*')
            .order('play_order', { ascending: true });
        
        if (error) throw error;
        
        advertisements = data || [];
        renderAdsTable();
    } catch (error) {
        console.error('Erro ao carregar propagandas:', error);
    }
}

function renderAdsTable() {
    adsTableBody.innerHTML = '';
    
    if (advertisements.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" style="text-align: center; padding: 30px; color: #999;">Nenhuma propaganda cadastrada. Adicione anúncios usando o formulário acima.</td>';
        adsTableBody.appendChild(tr);
        return;
    }
    
    advertisements.forEach(ad => {
        const tr = document.createElement('tr');
        
        const tdOrder = document.createElement('td');
        tdOrder.textContent = ad.play_order;
        tdOrder.style.fontWeight = 'bold';
        tr.appendChild(tdOrder);
        
        const tdTitle = document.createElement('td');
        tdTitle.textContent = ad.title;
        tdTitle.style.fontWeight = '500';
        tr.appendChild(tdTitle);
        
        const tdAdvertiser = document.createElement('td');
        tdAdvertiser.textContent = ad.advertiser || '-';
        tr.appendChild(tdAdvertiser);
        
        const tdFreq = document.createElement('td');
        const freqBadge = document.createElement('span');
        freqBadge.style.padding = '5px 10px';
        freqBadge.style.background = '#e3f2fd';
        freqBadge.style.borderRadius = '15px';
        freqBadge.style.fontWeight = 'bold';
        freqBadge.style.color = '#1976d2';
        freqBadge.textContent = `A cada ${ad.frequency} músicas`;
        tdFreq.appendChild(freqBadge);
        tr.appendChild(tdFreq);
        
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        if (ad.enabled) {
            statusBadge.textContent = '✅ Ativo';
            statusBadge.classList.add('active');
        } else {
            statusBadge.textContent = '❌ Inativo';
            statusBadge.classList.add('inactive');
        }
        tdStatus.appendChild(statusBadge);
        tr.appendChild(tdStatus);
        
        const tdActions = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'action-btns';
        
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.textContent = '✏️ Editar';
        btnEdit.onclick = () => editAd(ad.id);
        actionsDiv.appendChild(btnEdit);
        
        const btnToggle = document.createElement('button');
        btnToggle.className = 'btn-toggle';
        btnToggle.textContent = ad.enabled ? '🔴 Desativar' : '🟢 Ativar';
        btnToggle.onclick = () => toggleAd(ad.id, !ad.enabled);
        actionsDiv.appendChild(btnToggle);
        
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete';
        btnDelete.textContent = '🗑️ Deletar';
        btnDelete.onclick = () => deleteAd(ad.id);
        actionsDiv.appendChild(btnDelete);
        
        tdActions.appendChild(actionsDiv);
        tr.appendChild(tdActions);
        
        adsTableBody.appendChild(tr);
    });
}

async function handleSaveAd(e) {
    e.preventDefault();
    
    const url = adUrl.value.trim();
    const title = adTitle.value.trim();
    const advertiser = adAdvertiser.value.trim();
    const frequency = parseInt(adFrequency.value);
    const order = parseInt(adOrder.value);
    const enabled = adEnabled.checked;
    
    if (!url || !title) {
        alert('Por favor, preencha os campos obrigatórios (URL e Título)!');
        return;
    }
    
    if (frequency < 1 || frequency > 100) {
        alert('A frequência deve estar entre 1 e 100!');
        return;
    }
    
    try {
        if (editingAdId) {
            const { error } = await supabase
                .from('advertisements')
                .update({
                    audio_url: url,
                    title: title,
                    advertiser: advertiser || null,
                    frequency: frequency,
                    play_order: order,
                    enabled: enabled,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingAdId);
            
            if (error) throw error;
            alert('✅ Propaganda atualizada com sucesso!');
        } else {
            const { error } = await supabase
                .from('advertisements')
                .insert([{
                    audio_url: url,
                    title: title,
                    advertiser: advertiser || null,
                    frequency: frequency,
                    play_order: order,
                    enabled: enabled
                }]);
            
            if (error) throw error;
            alert('✅ Propaganda adicionada com sucesso!');
        }
        
        handleClearAdForm();
        loadAdvertisements();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('❌ Erro ao salvar propaganda: ' + error.message);
    }
}

function editAd(id) {
    const ad = advertisements.find(a => a.id === id);
    
    if (ad) {
        editingAdId = id;
        adUrl.value = ad.audio_url;
        adTitle.value = ad.title;
        adAdvertiser.value = ad.advertiser || '';
        adFrequency.value = ad.frequency;
        adOrder.value = ad.play_order;
        adEnabled.checked = ad.enabled;
        
        adsForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const submitBtn = adsForm.querySelector('.submit-btn');
        submitBtn.textContent = '💾 Atualizar Propaganda';
        
        adTitle.focus();
    }
}

async function toggleAd(id, newStatus) {
    try {
        const { error } = await supabase
            .from('advertisements')
            .update({ 
                enabled: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        loadAdvertisements();
    } catch (error) {
        console.error('Erro ao alternar status:', error);
        alert('❌ Erro ao alternar status: ' + error.message);
    }
}

async function deleteAd(id) {
    if (!confirm('Tem certeza que deseja deletar esta propaganda?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('advertisements')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('✅ Propaganda deletada com sucesso!');
        loadAdvertisements();
    } catch (error) {
        console.error('Erro ao deletar:', error);
        alert('❌ Erro ao deletar propaganda: ' + error.message);
    }
}

function handleTestAdAudio() {
    const url = adUrl.value.trim();
    
    if (!url) {
        alert('Por favor, insira uma URL para testar!');
        return;
    }
    
    testAudio.src = url;
    testAudio.play()
        .then(() => {
            alert('▶️ Reproduzindo propaganda de teste...\nClique em OK para parar.');
            testAudio.pause();
            testAudio.currentTime = 0;
        })
        .catch(error => {
            console.error('Erro ao testar áudio:', error);
            alert('❌ Erro ao reproduzir áudio. Verifique se a URL está correta.');
        });
}

function handleClearAdForm() {
    adUrl.value = '';
    adTitle.value = '';
    adAdvertiser.value = '';
    adFrequency.value = '3';
    adOrder.value = '0';
    adEnabled.checked = true;
    editingAdId = null;
    
    const submitBtn = adsForm.querySelector('.submit-btn');
    submitBtn.textContent = '💾 Adicionar Propaganda';
}
