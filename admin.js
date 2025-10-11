// ⚠️ AVISO DE SEGURANÇA IMPORTANTE ⚠️
// A senha 'senhaDev' está hardcoded apenas para desenvolvimento
// Em produção, SEMPRE use:
// - Variáveis de ambiente seguras
// - Sistema de autenticação Supabase Auth
// - Backend seguro com autenticação adequada
// NUNCA exponha senhas em código frontend em produção!

const ADMIN_PASSWORD = 'senhaDev'; // INSEGURO - Apenas para desenvolvimento

class AdminPanel {
    constructor() {
        this.isAuthenticated = false;
        this.programs = [];
        this.unsavedChanges = {};
        this.testAudio = document.getElementById('testAudio');
        
        this.init();
    }

    init() {
        this.setupLoginForm();
        this.setupEventListeners();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const passwordInput = document.getElementById('password');
        
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(passwordInput.value);
        });
    }

    handleLogin(password) {
        if (password === ADMIN_PASSWORD) {
            this.isAuthenticated = true;
            this.showAdminPanel();
            this.loadPrograms();
        } else {
            this.showLoginError();
        }
    }

    showLoginError() {
        const errorEl = document.getElementById('loginError');
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 3000);
    }

    showAdminPanel() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
    }

    setupEventListeners() {
        // Botão de logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Botão salvar tudo
        document.getElementById('saveAllBtn').addEventListener('click', () => {
            this.saveAllPrograms();
        });

        // Botão recarregar
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadPrograms();
        });

        // Modal de teste
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeTestModal();
        });

        // Fechar modal ao clicar fora
        document.getElementById('testModal').addEventListener('click', (e) => {
            if (e.target.id === 'testModal') {
                this.closeTestModal();
            }
        });
    }

    async loadPrograms() {
        this.showLoadingMessage();
        
        // Carrega os programas existentes do Supabase
        const programs = await SupabaseService.getAllPrograms();
        
        // Cria um mapa para acesso rápido
        const programMap = {};
        programs.forEach(p => {
            programMap[p.hour] = p;
        });

        // Gera os 24 slots de hora
        this.programs = [];
        for (let hour = 0; hour < 24; hour++) {
            this.programs.push(programMap[hour] || {
                hour: hour,
                url_audio: '',
                enabled: false,
                prioridade: 0
            });
        }

        this.renderHoursGrid();
    }

    renderHoursGrid() {
        const grid = document.getElementById('hoursGrid');
        grid.innerHTML = '';

        this.programs.forEach((program, index) => {
            const hourSlot = this.createHourSlot(program);
            grid.appendChild(hourSlot);
        });
    }

    createHourSlot(program) {
        const div = document.createElement('div');
        div.className = `hour-slot ${program.enabled ? 'active' : ''}`;
        div.dataset.hour = program.hour;

        const hourStr = String(program.hour).padStart(2, '0');
        
        div.innerHTML = `
            <div class="hour-header">
                <span class="hour-time">🕐 ${hourStr}:00</span>
                <span class="status-badge ${program.enabled ? 'active' : 'inactive'}">
                    ${program.enabled ? '✅ Ativo' : '⭕ Inativo'}
                </span>
            </div>
            <div class="hour-controls">
                <label>URL do Áudio (Cloudinary):</label>
                <input type="text" 
                       class="audio-url-input" 
                       data-hour="${program.hour}"
                       value="${program.url_audio || ''}" 
                       placeholder="https://res.cloudinary.com/...">
                
                <div class="checkbox-group">
                    <input type="checkbox" 
                           id="enabled-${program.hour}" 
                           class="enabled-checkbox"
                           data-hour="${program.hour}"
                           ${program.enabled ? 'checked' : ''}>
                    <label for="enabled-${program.hour}">Habilitado para reprodução</label>
                </div>

                <div class="hour-actions">
                    <button class="btn btn-secondary btn-small test-btn" data-hour="${program.hour}">
                        🎵 Testar
                    </button>
                    <button class="btn btn-primary btn-small save-btn" data-hour="${program.hour}">
                        💾 Salvar
                    </button>
                </div>
            </div>
        `;

        // Adiciona event listeners
        const urlInput = div.querySelector('.audio-url-input');
        const enabledCheckbox = div.querySelector('.enabled-checkbox');
        const testBtn = div.querySelector('.test-btn');
        const saveBtn = div.querySelector('.save-btn');

        urlInput.addEventListener('input', (e) => {
            this.handleInputChange(program.hour, 'url_audio', e.target.value);
        });

        enabledCheckbox.addEventListener('change', (e) => {
            this.handleInputChange(program.hour, 'enabled', e.target.checked);
            div.classList.toggle('active', e.target.checked);
        });

        testBtn.addEventListener('click', () => {
            this.testAudio(program.hour);
        });

        saveBtn.addEventListener('click', () => {
            this.saveSingleProgram(program.hour);
        });

        return div;
    }

    handleInputChange(hour, field, value) {
        if (!this.unsavedChanges[hour]) {
            this.unsavedChanges[hour] = {};
        }
        this.unsavedChanges[hour][field] = value;
        
        // Atualiza o programa local
        const program = this.programs.find(p => p.hour === hour);
        if (program) {
            program[field] = value;
        }

        // Marca visualmente que há mudanças não salvas
        const slot = document.querySelector(`.hour-slot[data-hour="${hour}"]`);
        if (slot) {
            slot.style.borderColor = '#ffa726';
        }
    }

    testAudio(hour) {
        const program = this.programs.find(p => p.hour === hour);
        if (!program || !program.url_audio) {
            alert('Por favor, insira uma URL de áudio primeiro');
            return;
        }

        const modal = document.getElementById('testModal');
        const testInfo = document.getElementById('testInfo');
        
        this.testAudio.src = program.url_audio;
        testInfo.textContent = `Testando áudio das ${String(hour).padStart(2, '0')}:00`;
        modal.style.display = 'flex';
        
        this.testAudio.play().catch(err => {
            alert('Erro ao reproduzir áudio: ' + err.message);
        });
    }

    closeTestModal() {
        const modal = document.getElementById('testModal');
        modal.style.display = 'none';
        this.testAudio.pause();
        this.testAudio.src = '';
    }

    async saveSingleProgram(hour) {
        const program = this.programs.find(p => p.hour === hour);
        if (!program) return;

        const btn = document.querySelector(`.save-btn[data-hour="${hour}"]`);
        btn.textContent = '⏳ Salvando...';
        btn.disabled = true;

        const result = await SupabaseService.updateHourProgram(hour, {
            url_audio: program.url_audio,
            enabled: program.enabled,
            prioridade: program.prioridade || 0
        });

        if (result.success) {
            delete this.unsavedChanges[hour];
            const slot = document.querySelector(`.hour-slot[data-hour="${hour}"]`);
            slot.style.borderColor = 'transparent';
            this.showSuccessMessage(`Horário ${String(hour).padStart(2, '0')}:00 salvo com sucesso!`);
        } else {
            this.showErrorMessage(`Erro ao salvar horário ${String(hour).padStart(2, '0')}:00`);
        }

        btn.textContent = '💾 Salvar';
        btn.disabled = false;
    }

    async saveAllPrograms() {
        const btn = document.getElementById('saveAllBtn');
        btn.textContent = '⏳ Salvando...';
        btn.disabled = true;

        // Prepara os dados para salvar
        const programsToSave = this.programs.map(p => ({
            hour: p.hour,
            url_audio: p.url_audio || '',
            enabled: p.enabled || false,
            prioridade: p.prioridade || 0
        }));

        const result = await SupabaseService.saveAllPrograms(programsToSave);

        if (result.success) {
            this.unsavedChanges = {};
            document.querySelectorAll('.hour-slot').forEach(slot => {
                slot.style.borderColor = 'transparent';
            });
            this.showSuccessMessage('Todas as programações foram salvas com sucesso!');
        } else {
            this.showErrorMessage('Erro ao salvar as programações. Tente novamente.');
        }

        btn.textContent = '💾 Salvar Todas as Alterações';
        btn.disabled = false;
    }

    showSuccessMessage(message) {
        this.showNotification(message, 'success');
    }

    showErrorMessage(message) {
        this.showNotification(message, 'error');
    }

    showLoadingMessage() {
        this.showNotification('Carregando programações...', 'loading');
    }

    showNotification(message, type = 'info') {
        // Remove notificação anterior se existir
        const existingNotification = document.querySelector('.notification-toast');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            ${type === 'success' ? 'background: #00a86b;' : ''}
            ${type === 'error' ? 'background: #d32f2f;' : ''}
            ${type === 'loading' ? 'background: #1976d2;' : ''}
            ${type === 'info' ? 'background: #424242;' : ''}
        `;

        document.body.appendChild(notification);

        if (type !== 'loading') {
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    logout() {
        if (confirm('Tem certeza que deseja sair do painel administrativo?')) {
            this.isAuthenticated = false;
            document.getElementById('adminPanel').style.display = 'none';
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('password').value = '';
        }
    }
}

// Adiciona estilos de animação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
    }

    .status-badge.active {
        background: #e8f5e9;
        color: #2e7d32;
    }

    .status-badge.inactive {
        background: #fafafa;
        color: #757575;
    }
`;
document.head.appendChild(style);

// Inicializar o painel quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});