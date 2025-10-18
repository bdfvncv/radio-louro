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

// Estado
let isAuthenticated = false;
let allSchedules = [];
let editingHour = null;

// Inicializar
init();

function init() {
    // Verificar autenticação
    checkAuth();
    
    // Preencher select de horas
    populateHourSelect();
    
    // Setup listeners
    setupEventListeners();
    
    // Carregar programação se autenticado
    if (isAuthenticated) {
        loadAllSchedules();
        setupRealtimeSubscription();
    }
}

function checkAuth() {
    const authToken = sessionStorage.getItem('radio_admin_auth');
    if (authToken === 'authenticated') {
        isAuthenticated = true;
        showAdminPanel();
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
}

function handleLogin(e) {
    e.preventDefault();
    
    const password = passwordInput.value;
    
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('radio_admin_auth', 'authenticated');
        isAuthenticated = true;
        showAdminPanel();
        loadAllSchedules();
        setupRealtimeSubscription();
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
        alert('Erro ao carregar programação. Verifique se a tabela existe no Supabase.');
    }
}

function renderScheduleTable() {
    scheduleTableBody.innerHTML = '';
    
    // Criar array de 24 horas
    for (let hour = 0; hour < 24; hour++) {
        const schedule = allSchedules.find(s => s.hour === hour);
        
        const tr = document.createElement('tr');
        
        // Hora
        const tdHour = document.createElement('td');
        tdHour.textContent = `${String(hour).padStart(2, '0')}:00`;
        tdHour.style.fontWeight = 'bold';
        tr.appendChild(tdHour);
        
        // Status
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
        
        // URL
        const tdUrl = document.createElement('td');
        const urlSpan = document.createElement('span');
        urlSpan.className = 'audio-url';
        urlSpan.textContent = schedule && schedule.audio_url 
            ? schedule.audio_url 
            : 'Nenhuma URL configurada';
        urlSpan.title = schedule && schedule.audio_url ? schedule.audio_url : '';
        tdUrl.appendChild(urlSpan);
        tr.appendChild(tdUrl);
        
        // Ações
        const tdActions = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'action-btns';
        
        // Botão Editar
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.textContent = '✏️ Editar';
        btnEdit.onclick = () => editSchedule(hour);
        actionsDiv.appendChild(btnEdit);
        
        // Botão Ativar/Desativar
        if (schedule) {
            const btnToggle = document.createElement('button');
            btnToggle.className = 'btn-toggle';
            btnToggle.textContent = schedule.enabled ? '🔴 Desativar' : '🟢 Ativar';
            btnToggle.onclick = () => toggleSchedule(schedule.id, !schedule.enabled);
            actionsDiv.appendChild(btnToggle);
            
            // Botão Deletar
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
    
    // Scroll para o formulário
    editForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight
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
            // Atualizar
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
            // Inserir
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
        await loadAllSchedules();
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
        
        await loadAllSchedules();
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
        await loadAllSchedules();
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
