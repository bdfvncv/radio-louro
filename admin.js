// Variáveis globais
let isAuthenticated = false;
let programacaoData = [];

// Inicialização do painel admin
function initAdmin() {
  // Verificar autenticação
  checkAuth();
  
  if (isAuthenticated) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminData();
  } else {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
  }
  
  // Configurar eventos
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('adminForm').addEventListener('submit', handleSave);
  document.getElementById('testAudioBtn').addEventListener('click', testAudio);
  
  console.log('Painel admin inicializado');
}

// Verificar autenticação
function checkAuth() {
  const auth = sessionStorage.getItem('admin_auth');
  isAuthenticated = auth === 'true';
}

// Login
function handleLogin() {
  const password = document.getElementById('passwordInput').value;
  
  if (password === CONFIG.admin.password) {
    sessionStorage.setItem('admin_auth', 'true');
    isAuthenticated = true;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminData();
    showAdminMessage('Login realizado com sucesso!', 'success');
  } else {
    showAdminMessage('Senha incorreta!', 'error');
  }
}

// Logout
function handleLogout() {
  sessionStorage.removeItem('admin_auth');
  isAuthenticated = false;
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
  showAdminMessage('Logout realizado', 'info');
}

// Carregar dados do admin
async function loadAdminData() {
  try {
    programacaoData = await getAllProgramacao();
    renderProgramacaoTable();
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    showAdminMessage('Erro ao carregar dados', 'error');
  }
}

// Renderizar tabela de programação
function renderProgramacaoTable() {
  const tbody = document.getElementById('programacaoTableBody');
  tbody.innerHTML = '';
  
  // Criar array com todas as 24 horas
  for (let hour = 0; hour < 24; hour++) {
    const programa = programacaoData.find(p => p.hour === hour);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${String(hour).padStart(2, '0')}:00</td>
      <td class="url-cell">${programa?.url_audio ? '<span class="url-preview">' + programa.url_audio.substring(0, 50) + '...</span>' : '<span class="no-audio">Nenhum áudio</span>'}</td>
      <td>
        <span class="status-badge ${programa?.enabled ? 'status-active' : 'status-inactive'}">
          ${programa?.enabled ? '✓ Ativo' : '✗ Inativo'}
        </span>
      </td>
      <td class="actions-cell">
        <button onclick="editPrograma(${hour})" class="btn-edit">✏️ Editar</button>
        ${programa ? `
          <button onclick="toggleEnabled('${programa.id}', ${!programa.enabled})" class="btn-toggle">
            ${programa.enabled ? '❌ Desativar' : '✅ Ativar'}
          </button>
        ` : ''}
      </td>
    `;
    
    tbody.appendChild(tr);
  }
}

// Editar programa
function editPrograma(hour) {
  const programa = programacaoData.find(p => p.hour === hour);
  
  document.getElementById('hourSelect').value = hour;
  document.getElementById('urlAudio').value = programa?.url_audio || '';
  document.getElementById('enabledCheck').checked = programa?.enabled ?? true;
  document.getElementById('programaId').value = programa?.id || '';
  
  // Scroll para o formulário
  document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
}

// Toggle enabled/disabled
async function toggleEnabled(id, newStatus) {
  try {
    await updateProgramacao(id, { enabled: newStatus });
    showAdminMessage(`Programa ${newStatus ? 'ativado' : 'desativado'} com sucesso!`, 'success');
    loadAdminData();
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    showAdminMessage('Erro ao atualizar status', 'error');
  }
}

// Salvar programa
async function handleSave(event) {
  event.preventDefault();
  
  const hour = parseInt(document.getElementById('hourSelect').value);
  const url_audio = document.getElementById('urlAudio').value.trim();
  const enabled = document.getElementById('enabledCheck').checked;
  const programaId = document.getElementById('programaId').value;
  
  if (!url_audio) {
    showAdminMessage('Por favor, insira a URL do áudio', 'error');
    return;
  }
  
  try {
    const dados = {
      hour,
      url_audio,
      enabled,
      updated_at: new Date().toISOString()
    };
    
    if (programaId) {
      // Update
      await updateProgramacao(programaId, dados);
      showAdminMessage('Programa atualizado com sucesso!', 'success');
    } else {
      // Insert
      await upsertProgramacao(dados);
      showAdminMessage('Programa salvo com sucesso!', 'success');
    }
    
    // Limpar formulário
    document.getElementById('adminForm').reset();
    document.getElementById('programaId').value = '';
    
    // Recarregar dados
    loadAdminData();
  } catch (error) {
    console.error('Erro ao salvar:', error);
    showAdminMessage('Erro ao salvar programa: ' + error.message, 'error');
  }
}

// Testar áudio
function testAudio() {
  const url = document.getElementById('urlAudio').value.trim();
  
  if (!url) {
    showAdminMessage('Insira uma URL de áudio primeiro', 'error');
    return;
  }
  
  const testPlayer = document.getElementById('testAudioPlayer');
  testPlayer.src = url;
  testPlayer.play().then(() => {
    showAdminMessage('Reproduzindo áudio de teste...', 'success');
  }).catch(error => {
    console.error('Erro ao testar áudio:', error);
    showAdminMessage('Erro ao reproduzir áudio: ' + error.message, 'error');
  });
}

// Mostrar mensagem admin
function showAdminMessage(text, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `toast toast-${type}`;
  messageDiv.textContent = text;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    messageDiv.classList.remove('show');
    setTimeout(() => messageDiv.remove(), 300);
  }, 3000);
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
