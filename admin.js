// Configuração do Supabase
const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Senha do admin
const ADMIN_PASSWORD = 'senhaDev';

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const hourSelect = document.getElementById('hourSelect');
const audioUrl = document.getElementById('audioUrl');
const enabledCheckbox = document.getElementById('enabledCheckbox');
const editForm = document.getElementById('editForm');
const testBtn = document.getElementById('testBtn');
const clearBtn = document.getElementById('clearBtn');
const scheduleTableBody = document.getElementById('scheduleTableBody');
const testAudio = document.getElementById('testAudio');

// Playlist elements
const playlistForm = document.getElementById('playlistForm');
const playlistUrl = document.getElementById('playlistUrl');
const playlistTitle = document.getElementById('playlistTitle');
const playlistOrder = document.getElementById('playlistOrder');
const playlistEnabled = document.getElementById('playlistEnabled');
const testPlaylistBtn = document.getElementById('testPlaylistBtn');
const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
const playlistTableBody = document.getElementById('playlistTableBody');

// Ads elements
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

// Inicializar
init();

function init() {
    checkAuth();
    populateHourSelect();
    setupEventListeners();
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
}

function showAdminPanel() {
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'block';
}

function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    editForm.addEventListener('submit', handleSaveSchedule);
    testBtn.addEventListener('click', handleTestAudio);
    clearBtn.addEventListener('click', handleClearForm);
    hourSelect.addEventListener('change', handleHourSelect);
    
    playlistForm.addEventListener('submit', handleSavePlaylist);
    testPlaylistBtn.addEventListener('click', handleTestPlaylistAudio);
    clearPlaylistBtn.addEventListener('click', handleClearPlaylistForm);
    
    adsForm.addEventListener('submit', handleSaveAd);
    testAdBtn.addEventListener('click', handleTestAdAudio);
    clearAdBtn.addEventListener('click', handleClearAdForm);
}

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
        urlSpan.textContent = schedule && schedule.audio_url ? schedule.audio_url : 'Nenhuma URL configurada';
        urlSpan.title = schedule && schedule.audio_url ? schedule.audio_url : '';
        tdUrl.appendChild(urlSpan);
        tr.appendChild(tdUrl);
        
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
    enabledCheckbox.checked = schedule ? schedule.enabled : true;
    
    editForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    audioUrl.focus();
}

async function handleSaveSchedule(e) {
    e.preventDefault();
    
    const hour = parseInt(hourSelect.value);
    const url = audioUrl.value.trim();
    const enabled = enabledCheckbox.checked;
    
    if (!url) {
        alert('Por favor, insira uma URL válida!');
        return;
    }
    
    try {
        const existingSchedule = allSchedules.find(s => s.hour === hour);
        
        if (existingSchedule) {
            const { error } = await supabase
                .from('radio_schedule')
                .update({
                    audio_url: url,
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
    enabledCheckbox.checked = true;
    editingHour = null;
}

function handleHourSelect() {
    const hour = parseInt(hourSelect.value);
    if (!isNaN(hour)) {
        editSchedule(hour);
    }
}

async function loadBackgroundPlaylist() {
    try {
        const { data, error } = await supabase
            .from('background_playlist')
            .select('*')
            .order('play_order', { ascending: true });
        
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
        tr.innerHTML = '<td colspan="5" style="text-align: center; padding: 30px; color: #999;">Nenhuma música na playlist. Adicione músicas usando o formulário acima.</td>';
        playlistTableBody.appendChild(tr);
        return;
    }
    
    backgroundPlaylist.forEach(track => {
        const tr = document.createElement('tr');
        
        const tdOrder = document.createElement('td');
        tdOrder.textContent = track.play_order;
        tdOrder.style.fontWeight = 'bold';
        tr.appendChild(tdOrder);
        
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
            .from('background_playlist')
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
    
    if (frequency < 1 || frequency > 10) {
        alert('A frequência deve estar entre 1 e 10!');
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
