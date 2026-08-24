// ═════════════════════════════════════════════════════════════
// PAINEL CENTRAL — gestão da rede de rádios
//
// Este painel roda num projeto Supabase PRÓPRIO, separado de todas as
// empresas clientes — ele só guarda o REGISTRO das empresas (nome, URL,
// código secreto, validade da licença). Nunca guarda a chave mestra de
// nenhuma empresa.
// ═════════════════════════════════════════════════════════════

// ⚠️ TROQUE PELOS DADOS DO SEU PROJETO CENTRAL (criado só pra isso):
const SUPABASE_URL      = 'https:https://pywaparoutgpcrizpjlt.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5d2FwYXJvdXRncGNyaXpwamx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NDk4MzksImV4cCI6MjEwMzEyNTgzOX0.qlnkr_VHH1L_h32pAsymm3VMcsVEAOjgxsWTmHRPW5o';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let clients = [];
let clientsSearchTerm = '';
let catalogItems = [];
let catalogSearchTerm = '';
let sendModalItem = null;

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
async function checkAuth() {
    const { data } = await supabase.auth.getSession();
    if (data?.session) { showPanel(); loadClients(); loadCatalog(); }
    else showLogin();
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('centralPanel').style.display = 'none';
}
function showPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('centralPanel').style.display = 'block';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent = ''; errEl.classList.remove('show');
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showPanel(); loadClients(); loadCatalog();
    } catch (err) {
        errEl.textContent = 'E-mail ou senha incorretos.';
        errEl.classList.add('show');
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    showLogin();
}

// ─────────────────────────────────────────────────────────────
// TEMPORIZADOR DE LICENÇA
// ─────────────────────────────────────────────────────────────
// Calcula quantos dias faltam e classifica: ok (verde) / warn (amarelo,
// vencendo em até 15 dias) / danger (vermelho, vencida)
function getLicenseStatus(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    let status = 'ok';
    if (daysLeft <= 0) status = 'danger';
    else if (daysLeft <= 15) status = 'warn';
    return { daysLeft, status };
}

// Barra de progresso: assume ciclo de 365 dias como referência visual
// (não é exato pra todo mundo, mas dá uma noção rápida do "quanto falta")
function getTimerBarPct(daysLeft) {
    const pct = Math.max(0, Math.min(100, (daysLeft / 365) * 100));
    return pct;
}

// ─────────────────────────────────────────────────────────────
// CRUD DE EMPRESAS
// ─────────────────────────────────────────────────────────────
async function loadClients() {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) { console.error(error); return; }
    clients = data || [];
    renderClients();
    renderSummary();
}

async function handleClientSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('clientName').value.trim();
    const url = document.getElementById('clientUrl').value.trim().replace(/\/$/, '');
    const secret = document.getElementById('clientSecret').value.trim();
    const periodDays = parseInt(document.getElementById('clientPeriod').value, 10);
    const notes = document.getElementById('clientNotes').value.trim();

    if (!name || !url || !secret) { alert('Preencha nome, URL e código secreto.'); return; }

    const expiresAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    try {
        const { error } = await supabase.from('clients').insert([{
            name, supabase_url: url, sync_secret: secret,
            license_expires_at: expiresAt, notes: notes || null,
        }]);
        if (error) throw error;
        document.getElementById('clientForm').reset();
        document.getElementById('clientPeriod').value = '365';
        showToast('✅ Empresa cadastrada!');
        await loadClients();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function renewClient(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    const days = prompt(`Renovar a licença de "${client.name}" por quantos dias?\n\n(Ex: 365 = 1 ano, 30 = 1 mês)`, '365');
    if (!days || isNaN(parseInt(days, 10))) return;
    const periodDays = parseInt(days, 10);

    // Renova a partir de HOJE se já estiver vencida, ou a partir do
    // vencimento atual se ainda estiver em dia (soma o período extra)
    const base = new Date(client.license_expires_at) > new Date() ? new Date(client.license_expires_at) : new Date();
    const newExpiresAt = new Date(base.getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    try {
        // 1) Atualiza o registro local (painel central)
        await supabase.from('clients').update({
            license_expires_at: newExpiresAt, updated_at: new Date().toISOString(),
        }).eq('id', id);

        // 2) Empurra a nova validade pro banco de dados da EMPRESA em si,
        //    via content-sync — sem isso, o painel central sabe que renovou
        //    mas o sistema da empresa continua achando que está vencido.
        const res = await fetch(`${client.supabase_url}/functions/v1/content-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-sync-secret': client.sync_secret },
            body: JSON.stringify({ type: 'license', expires_at: newExpiresAt, company_name: client.name }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Erro ${res.status} ao avisar a empresa`);
        }

        showToast(`✅ Licença de "${client.name}" renovada!`);
        await loadClients();
    } catch (err) {
        alert(`⚠️ O registro local foi atualizado, mas não consegui avisar o sistema da empresa: ${err.message}\n\nConfira se a Edge Function content-sync está publicada e se o código secreto está certo.`);
        await loadClients();
    }
}

async function editClient(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    const newName = prompt('Nome da empresa:', client.name);
    if (newName === null) return;
    const newUrl = prompt('URL do Supabase:', client.supabase_url);
    if (newUrl === null) return;
    const newSecret = prompt('Código secreto (SYNC_SECRET):', client.sync_secret);
    if (newSecret === null) return;
    const newNotes = prompt('Observações:', client.notes || '');

    try {
        await supabase.from('clients').update({
            name: newName.trim(), supabase_url: newUrl.trim().replace(/\/$/, ''),
            sync_secret: newSecret.trim(), notes: newNotes?.trim() || null,
            updated_at: new Date().toISOString(),
        }).eq('id', id);
        showToast('✅ Empresa atualizada!');
        await loadClients();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function deleteClient(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    if (!confirm(`Remover "${client.name}" do painel central?\n\nIsso NÃO afeta o sistema da empresa, só tira ela da sua lista de gestão.`)) return;
    await supabase.from('clients').delete().eq('id', id);
    showToast('🗑️ Empresa removida.');
    await loadClients();
}

// ─────────────────────────────────────────────────────────────
// RENDERIZAÇÃO
// ─────────────────────────────────────────────────────────────
function renderSummary() {
    let ok = 0, warn = 0, danger = 0;
    clients.forEach(c => {
        const { status } = getLicenseStatus(c.license_expires_at);
        if (status === 'ok') ok++; else if (status === 'warn') warn++; else danger++;
    });
    document.getElementById('summaryTotal').textContent = clients.length;
    document.getElementById('summaryOk').textContent = ok;
    document.getElementById('summaryWarn').textContent = warn;
    document.getElementById('summaryExpired').textContent = danger;
}

function renderClients() {
    const listEl = document.getElementById('clientsList');
    const term = clientsSearchTerm.toLowerCase();
    const filtered = clients.filter(c => c.name.toLowerCase().includes(term));

    if (!filtered.length) {
        listEl.innerHTML = `<div style="text-align:center;padding:30px;color:#999;">${clients.length ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa cadastrada ainda.'}</div>`;
        return;
    }

    // Ordena: vencidas primeiro, depois vencendo, depois em dia
    const order = { danger: 0, warn: 1, ok: 2 };
    const sorted = [...filtered].sort((a, b) => {
        const sa = getLicenseStatus(a.license_expires_at).status;
        const sb = getLicenseStatus(b.license_expires_at).status;
        return order[sa] - order[sb];
    });

    listEl.innerHTML = sorted.map(c => {
        const { daysLeft, status } = getLicenseStatus(c.license_expires_at);
        const pct = getTimerBarPct(daysLeft);
        const dateStr = new Date(c.license_expires_at).toLocaleDateString('pt-BR');
        const daysLabel = daysLeft <= 0
            ? `Vencida há ${Math.abs(daysLeft)} dia(s)`
            : `${daysLeft} dia(s) restante(s)`;

        return `
        <div class="client-card status-${status}">
            <div class="client-card-info">
                <div class="client-card-name">${escapeHtml(c.name)}</div>
                <div class="client-card-url">${escapeHtml(c.supabase_url)}</div>
                ${c.notes ? `<div class="client-card-notes">${escapeHtml(c.notes)}</div>` : ''}
            </div>
            <div class="client-timer">
                <div class="client-timer-days">${daysLeft <= 0 ? '⚠️' : daysLeft}</div>
                <div class="client-timer-label">${daysLabel}</div>
                <div class="client-timer-date">vence em ${dateStr}</div>
                <div class="client-timer-bar"><div class="client-timer-bar-fill" style="width:${pct}%;"></div></div>
            </div>
            <div class="client-card-actions">
                <button class="btn-edit" onclick="renewClient(${c.id})">🔄 Renovar</button>
                <button class="btn-toggle" style="background:#6b7280;" onclick="editClient(${c.id})">✏️ Editar</button>
                <button class="btn-delete" onclick="deleteClient(${c.id})">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

window.renewClient = renewClient;
window.editClient = editClient;
window.deleteClient = deleteClient;

// ─────────────────────────────────────────────────────────────
// CATÁLOGO CENTRAL
// ─────────────────────────────────────────────────────────────
async function loadCatalog() {
    const { data, error } = await supabase.from('catalog_items').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    catalogItems = data || [];
    renderCatalog();
}

async function handleCatalogSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('catalogType').value;
    const category = document.getElementById('catalogCategory').value.trim();
    const title = document.getElementById('catalogTitle').value.trim();
    const audioUrl = document.getElementById('catalogUrl').value.trim();
    if (!title || !audioUrl) { alert('Preencha título e URL do áudio.'); return; }

    try {
        const { error } = await supabase.from('catalog_items').insert([{
            type, title, audio_url: audioUrl, category: category || null,
        }]);
        if (error) throw error;
        document.getElementById('catalogForm').reset();
        showToast('✅ Adicionado ao catálogo!');
        await loadCatalog();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}

async function deleteCatalogItem(id) {
    if (!confirm('Remover este item do catálogo central?')) return;
    await supabase.from('catalog_items').delete().eq('id', id);
    showToast('🗑️ Removido do catálogo.');
    await loadCatalog();
}

function renderCatalog() {
    const listEl = document.getElementById('catalogList');
    const term = catalogSearchTerm.toLowerCase();
    const filtered = catalogItems.filter(i => i.title.toLowerCase().includes(term));
    const typeLabel = { music: '🎵 Música', jingle: '🎬 Vinheta', ad: '📢 Propaganda' };

    if (!filtered.length) {
        listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#999;">${catalogItems.length ? 'Nenhum item encontrado.' : 'Catálogo vazio — adicione o primeiro item acima.'}</div>`;
        return;
    }

    listEl.innerHTML = filtered.map(item => `
        <div class="catalog-item">
            <div class="catalog-item-info">
                <span class="catalog-item-type">${typeLabel[item.type] || item.type}</span>
                <div class="catalog-item-title">${escapeHtml(item.title)}</div>
                ${item.category ? `<div class="catalog-item-category">${escapeHtml(item.category)}</div>` : ''}
            </div>
            <div class="action-btns">
                <button class="btn-toggle" style="background:#17a2b8;" onclick="testAudioUrl('${item.audio_url}')">▶️</button>
                <button class="btn-edit" onclick="openSendModal(${item.id})">📤 Enviar</button>
                <button class="btn-delete" onclick="deleteCatalogItem(${item.id})">🗑️</button>
            </div>
        </div>`).join('');
}

function testAudioUrl(url) {
    if (!url) { alert('Nenhuma URL de áudio.'); return; }
    new Audio(url).play().catch(e => alert('❌ Não foi possível tocar: ' + e.message));
}

// ─────────────────────────────────────────────────────────────
// MODAL DE ENVIO — escolhe empresas e dispara pra cada uma via content-sync
// ─────────────────────────────────────────────────────────────
function openSendModal(itemId) {
    sendModalItem = catalogItems.find(i => i.id === itemId);
    if (!sendModalItem) return;
    document.getElementById('sendModalTitle').textContent = `📤 Enviar: ${sendModalItem.title}`;
    document.getElementById('sendResults').innerHTML = '';
    document.getElementById('sendSelectAll').checked = false;

    const boxEl = document.getElementById('sendClientsCheckboxes');
    if (!clients.length) {
        boxEl.innerHTML = '<p style="color:#999;font-size:13px;">Nenhuma empresa cadastrada ainda.</p>';
    } else {
        boxEl.innerHTML = clients.map(c => `
            <label class="send-client-row">
                <input type="checkbox" class="send-client-checkbox" value="${c.id}">
                ${escapeHtml(c.name)}
            </label>`).join('');
    }
    document.getElementById('sendModalOverlay').style.display = 'flex';
}

function closeSendModal() {
    document.getElementById('sendModalOverlay').style.display = 'none';
    sendModalItem = null;
}

async function confirmSend() {
    const checked = [...document.querySelectorAll('.send-client-checkbox:checked')].map(cb => parseInt(cb.value, 10));
    if (!checked.length) { alert('Marque pelo menos uma empresa.'); return; }
    if (!sendModalItem) return;

    const resultsEl = document.getElementById('sendResults');
    resultsEl.innerHTML = '⏳ Enviando...';
    const results = [];

    for (const clientId of checked) {
        const client = clients.find(c => c.id === clientId);
        if (!client) continue;
        try {
            const res = await fetch(`${client.supabase_url}/functions/v1/content-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-sync-secret': client.sync_secret },
                body: JSON.stringify({
                    type: sendModalItem.type, title: sendModalItem.title,
                    audio_url: sendModalItem.audio_url, category: sendModalItem.category,
                    central_id: sendModalItem.id,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Erro ${res.status}`);
            }
            results.push(`✅ ${client.name}`);
        } catch (err) {
            results.push(`❌ ${client.name}: ${err.message}`);
        }
    }

    resultsEl.innerHTML = results.map(r => `<div>${escapeHtml(r)}</div>`).join('');
    showToast('Envio concluído — confira o resultado por empresa.');
}

window.openSendModal = openSendModal;
window.deleteCatalogItem = deleteCatalogItem;
window.testAudioUrl = testAudioUrl;

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('loginForm').addEventListener('submit', e => { e.preventDefault(); handleLogin(); });
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('clientForm').addEventListener('submit', handleClientSubmit);
    document.getElementById('clientSearchInput').addEventListener('input', e => {
        clientsSearchTerm = e.target.value; renderClients();
    });
    document.getElementById('catalogForm').addEventListener('submit', handleCatalogSubmit);
    document.getElementById('catalogSearchInput').addEventListener('input', e => {
        catalogSearchTerm = e.target.value; renderCatalog();
    });
    document.getElementById('sendSelectAll').addEventListener('change', e => {
        document.querySelectorAll('.send-client-checkbox').forEach(cb => cb.checked = e.target.checked);
    });
    document.getElementById('sendConfirmBtn').addEventListener('click', confirmSend);
    document.getElementById('sendCancelBtn').addEventListener('click', closeSendModal);
    // Recalcula os temporizadores a cada minuto, sem precisar recarregar a página
    setInterval(() => { renderClients(); renderSummary(); }, 60 * 1000);
});
