// ═════════════════════════════════════════════════════════════
// PAINEL DO LOCUTOR — acesso restrito
// Só Alerta de Emergência, Promoção Relâmpago e Locutor/TTS.
// Usa a MESMA autenticação real do Supabase (não é uma senha decorativa) —
// só que a tela de login esconde o e-mail e usa um valor fixo por trás,
// pra parecer "só senha" pra quem usa.
// ═════════════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';
const CLOUDINARY_CLOUD_NAME    = 'dygbrcrr6';
const CLOUDINARY_UPLOAD_PRESET = 'radio_louro_preset';

// E-mail fixo da conta "locutor" no Supabase Auth — a pessoa que usa esse
// painel só digita a senha, nunca vê nem precisa saber desse e-mail.
// Você (admin principal) cria essa conta no painel do Supabase.
const LOCUTOR_FIXED_EMAIL = 'locutor@radiolouro.interno';

const FUNCTION_SECRET   = 'Deno@123#';
const TTS_FUNCTION_URL  = `${SUPABASE_URL}/functions/v1/tts-generate`;
const DELETE_ASSET_URL  = `${SUPABASE_URL}/functions/v1/delete-cloudinary-asset`;
const ELEVENLABS_MONTHLY_LIMIT = 10000;

const TTS_VOICES = {
    elevenlabs: [
        { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Rachel (Feminina, natural) ⚠️ descontinua fim de 2026' },
        { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold (Masculino, grave) ⚠️ descontinua fim de 2026' },
        { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (Masculino, médio) ⚠️ descontinua fim de 2026' },
    ],
};
const selectedTTSEngine = 'elevenlabs';

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

let supabase;
let testAudio;

// ─────────────────────────────────────────────────────────────
// LOGIN (só pede senha)
// ─────────────────────────────────────────────────────────────
async function handleLogin() {
    const password = document.getElementById('passwordInput').value;
    const errEl = document.getElementById('loginError');
    errEl.classList.remove('show');
    try {
        const { error } = await supabase.auth.signInWithPassword({ email: LOCUTOR_FIXED_EMAIL, password });
        if (error) throw error;
        showPanel();
    } catch (err) {
        // Mostra o motivo real (ajuda a diagnosticar: senha errada vs.
        // conta não confirmada vs. conta não existe com esse e-mail)
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('email not confirmed')) {
            errEl.textContent = 'Conta ainda não confirmada. Peça pro admin confirmar o e-mail no Supabase (Authentication → Users → editar usuário → Auto Confirm).';
        } else if (msg.includes('invalid login credentials')) {
            errEl.textContent = 'Senha incorreta (ou a conta ainda não foi criada no Supabase).';
        } else {
            errEl.textContent = 'Erro ao entrar: ' + (err.message || 'desconhecido');
        }
        errEl.classList.add('show');
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    showLogin();
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('locutorPanel').style.display = 'none';
    stopIdleTimer();
}
function showPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('locutorPanel').style.display = 'block';
    startIdleTimer();
    loadEverything();
}

// Expira sessão após 1h sem atividade (mesma proteção do admin principal)
const IDLE_LIMIT_MS = 60 * 60 * 1000;
let idleTimer = null;
function resetIdleTimer() {
    if (document.getElementById('locutorPanel').style.display !== 'block') return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
        await supabase.auth.signOut();
        showLogin();
        alert('⏱️ Sua sessão expirou por inatividade (1 hora). Faça login novamente.');
    }, IDLE_LIMIT_MS);
}
function startIdleTimer() {
    resetIdleTimer();
    ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer, { passive: true }));
}
function stopIdleTimer() {
    clearTimeout(idleTimer); idleTimer = null;
    ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(evt =>
        document.removeEventListener(evt, resetIdleTimer));
}

async function loadEverything() {
    await loadEmergencyState();
    await loadFlashState();
    await loadFlashHistory();
    await loadLocutorTracks();
    await loadTTSLibrary();
    populateEngineVoices(selectedTTSEngine);
    loadElevenLabsUsage('elevenLabsUsageBar');
    setupAllListeners();
}

// ═════════════════════════════════════════════════════════════
// ALERTA DE EMERGÊNCIA
// ═════════════════════════════════════════════════════════════
let emergencyActive = false;

async function loadEmergencyState() {
    try {
        const {data} = await supabase.from('emergency_alert').select('*').eq('id',1).single();
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
        btn.textContent = '⏹️ Encerrar Alerta'; btn.classList.add('active');
        if(ind) ind.classList.add('active');
        if(txt) txt.textContent = '🚨 ALERTA ATIVO — todos os players em modo de emergência';
    } else {
        btn.textContent = '🚨 Disparar Alerta'; btn.classList.remove('active');
        if(ind) ind.classList.remove('active');
        if(txt) txt.textContent = 'Alerta inativo';
    }
    if(state?.tts_text != null) { const el=document.getElementById('emergencyMessage'); if(el) el.value = state.tts_text; }
    if(state?.audio_url != null) { const el=document.getElementById('emergencyAudioUrl'); if(el) el.value = state.audio_url; }
    if(state?.repeat_interval_sec != null) { const el=document.getElementById('emergencyRepeatSec'); if(el) el.value = state.repeat_interval_sec; }
    if(state?.mode === 'audio') {
        const r = document.getElementById('emergencyUseAudio');
        if(r) { r.checked = true; document.getElementById('emergencyTTSGroup').style.display='none'; document.getElementById('emergencyAudioGroup').style.display='block'; }
    }
}
async function toggleEmergency() {
    const newStatus = !emergencyActive;
    const message   = document.getElementById('emergencyMessage')?.value.trim();
    const audioUrl  = document.getElementById('emergencyAudioUrl')?.value.trim();
    const useTTS    = document.querySelector('input[name="emergencyType"]:checked')?.value !== 'audio';
    const repeatSec = parseInt(document.getElementById('emergencyRepeatSec')?.value, 10) || 30;
    if(newStatus && !message && !audioUrl) { alert('Preencha a mensagem de texto ou a URL do áudio de emergência.'); return; }
    try {
        await supabase.from('emergency_alert').update({
            is_active: newStatus, tts_text: message || null, audio_url: audioUrl || null,
            mode: useTTS ? 'tts' : 'audio', repeat_interval_sec: repeatSec,
            activated_at: newStatus ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        }).eq('id', 1);
        emergencyActive = newStatus;
        renderEmergencyUI({ is_active: newStatus });
    } catch(err) { alert('❌ Erro: ' + err.message); }
}
window.setEmergencyMessage = function(msg) {
    document.getElementById('emergencyMessage').value = msg;
    const ttsRadio = document.getElementById('emergencyUseTTS');
    if(ttsRadio) {
        ttsRadio.checked = true;
        document.getElementById('emergencyTTSGroup').style.display = 'block';
        document.getElementById('emergencyAudioGroup').style.display = 'none';
    }
};

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
    const ind = document.getElementById('flashIndicator');
    const txt = document.getElementById('flashStatusText');
    const stop = document.getElementById('flashStopBtn');
    const cd = document.getElementById('flashCountdown');
    if (!txt) return;
    if (state?.is_active) {
        if (ind) ind.classList.add('active');
        txt.textContent = `⚡ Ativa: ${state.title || 'Promoção Relâmpago'}`;
        if (stop) stop.style.display = 'block';
        if (cd) cd.style.display = 'block';
    } else {
        if (ind) ind.classList.remove('active');
        txt.textContent = 'Nenhuma promoção ativa';
        if (stop) stop.style.display = 'none';
        if (cd) { cd.style.display = 'none'; cd.textContent = ''; }
    }
}
function startFlashCountdown(endsAt) {
    if (flashCountdownTimer) clearInterval(flashCountdownTimer);
    const cd = document.getElementById('flashCountdown');
    const update = () => {
        const rem = Math.max(0, endsAt - new Date());
        if (!cd) return;
        const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
        cd.textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} restantes`;
        if (rem <= 0) { clearInterval(flashCountdownTimer); flashCountdownTimer = null; stopFlashPromotion(); }
    };
    update();
    flashCountdownTimer = setInterval(update, 1000);
}
async function handleFlashSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('flashTitle').value.trim();
    const text = document.getElementById('flashText').value.trim();
    const durMin = parseInt(document.getElementById('flashDuration').value) || 15;
    if (!title || !text) { alert('Preencha título e texto!'); return; }
    const endsAt = new Date(Date.now() + durMin * 60000);
    try {
        await supabase.from('flash_promotions').insert([{
            title, tts_text: text, duration_min: durMin,
            is_active: true, started_at: new Date().toISOString(), ends_at: endsAt.toISOString()
        }]);
        await supabase.from('flash_state').update({
            is_active: true, tts_text: text, title,
            ends_at: endsAt.toISOString(), updated_at: new Date().toISOString()
        }).eq('id', 1);
        await dispatchTTS(text, title);
        const warn2min = durMin * 60000 - 120000;
        if (warn2min > 0) setTimeout(() => {
            if (flashActive) dispatchTTS(`Atenção! Restam apenas 2 minutos da promoção: ${title}. Aproveite!`, 'Aviso de Encerramento');
        }, warn2min);
        setTimeout(() => { if (flashActive) stopFlashPromotion(); }, durMin * 60000);
        flashActive = true;
        renderFlashUI({ is_active: true, title, ends_at: endsAt.toISOString() });
        startFlashCountdown(endsAt);
        loadFlashHistory();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}
async function stopFlashPromotion() {
    try {
        await supabase.from('flash_state').update({
            is_active: false, tts_text: null, title: null, ends_at: null, updated_at: new Date().toISOString()
        }).eq('id', 1);
        const { data: promos } = await supabase.from('flash_promotions')
            .select('id').eq('is_active', true).order('started_at', { ascending: false }).limit(1);
        if (promos?.length) await supabase.from('flash_promotions').update({ is_active: false }).eq('id', promos[0].id);
        flashActive = false;
        if (flashCountdownTimer) { clearInterval(flashCountdownTimer); flashCountdownTimer = null; }
        renderFlashUI({ is_active: false });
        loadFlashHistory();
    } catch (err) { alert('❌ Erro: ' + err.message); }
}
async function loadFlashHistory() {
    const tbody = document.getElementById('flashHistoryBody');
    if (!tbody) return;
    const { data } = await supabase.from('flash_promotions').select('*').order('started_at', { ascending: false }).limit(20);
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">Nenhum histórico.</td></tr>'; return; }
    tbody.innerHTML = data.map(p => `<tr>
        <td style="font-weight:500;">${escapeHtml(p.title)}</td>
        <td>${p.duration_min} min</td>
        <td style="font-size:12px;">${new Date(p.started_at).toLocaleString('pt-BR')}</td>
        <td style="font-size:12px;">${p.ends_at ? new Date(p.ends_at).toLocaleString('pt-BR') : p.is_active ? '🔴 Em andamento' : '-'}</td>
    </tr>`).join('');
}
window.setFlashPreset = function(title, text, dur) {
    document.getElementById('flashTitle').value = title;
    document.getElementById('flashText').value = text;
    document.getElementById('flashDuration').value = dur;
};
window.loadFlashHistory = loadFlashHistory;

// ═════════════════════════════════════════════════════════════
// LOCUTOR (pré-gravado + ao vivo) + CHAMADA DE FUNCIONÁRIO + TTS
// ═════════════════════════════════════════════════════════════
let locutorTracks = [], locutorActive = false, locutorSelectedId = null, editingLocutorId = null;
let ttsLibrary = [];
let liveStream = null, liveProcessor = null, liveAudioCtx = null, liveActive = false, liveBroadcastCh = null;

async function loadLocutorTracks() {
    const {data} = await supabase.from('locutor_tracks').select('*').order('created_at',{ascending:false});
    locutorTracks = data || []; renderLocutorTracks();
}
function renderLocutorTracks() {
    const list = document.getElementById('locutorTracksList');
    if(!list) return;
    const enabled = locutorTracks.filter(t=>t.enabled);
    if(!enabled.length) { list.innerHTML='<div style="color:#999;font-size:13px;padding:10px;">Nenhuma locução cadastrada.</div>'; return; }
    list.innerHTML = enabled.map(t=>`
        <div class="locutor-track-card ${locutorSelectedId===t.id?'selected':''}" onclick="selectLocutorTrack(${t.id})">
            <div class="locutor-track-select-dot"></div>
            <div style="flex:1;">
                <div class="locutor-track-name">${escapeHtml(t.title)}</div>
                ${t.description?`<div class="locutor-track-desc">${escapeHtml(t.description)}</div>`:''}
            </div>
            <button class="btn-edit" onclick="event.stopPropagation();editLocutorTrack(${t.id})">✏️</button>
            <button class="btn-delete" onclick="event.stopPropagation();deleteLocutorTrack(${t.id})">🗑️</button>
        </div>`).join('');
    const btn = document.getElementById('locutorPlayBtn');
    if(btn) btn.disabled = !locutorSelectedId;
}
window.selectLocutorTrack = function(id) {
    locutorSelectedId = locutorSelectedId===id ? null : id;
    renderLocutorTracks();
    document.getElementById('locutorPlayBtn').disabled = !locutorSelectedId;
};
async function handleLocutorToggle() {
    if(locutorActive) {
        await supabase.from('locutor_state').update({ is_active:false, track_id:null, updated_at:new Date().toISOString() }).eq('id',1);
        locutorActive=false;
    } else {
        if(!locutorSelectedId){ alert('Selecione uma locução primeiro.'); return; }
        await supabase.from('locutor_state').update({
            is_active:true, track_id:locutorSelectedId,
            started_at:new Date().toISOString(), updated_at:new Date().toISOString()
        }).eq('id',1);
        locutorActive=true;
    }
    updateLocutorUI();
}
function updateLocutorUI() {
    const ind=document.getElementById('locutorIndicator'), txt=document.getElementById('locutorStatusText'), btn=document.getElementById('locutorPlayBtn');
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
window.editLocutorTrack = function(id) {
    const track = locutorTracks.find(t=>t.id===id);
    if (!track) return;
    editingLocutorId = id;
    document.getElementById('locutorTitle').value = track.title;
    document.getElementById('locutorDesc').value = track.description || '';
    document.getElementById('locutorUrl').value = track.audio_url;
    document.getElementById('locutorForm').querySelector('.submit-btn').textContent = '💾 Salvar Alteração';
    document.getElementById('locutorForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
};
window.deleteLocutorTrack = async function(id) {
    if(!confirm('Deletar esta locução?')) return;
    const track = locutorTracks.find(t=>t.id===id);
    await supabase.from('locutor_tracks').delete().eq('id',id);
    if(track?.audio_url) deleteFromCloudinary(track.audio_url);
    if(locutorSelectedId===id) locutorSelectedId=null;
    await loadLocutorTracks();
};
async function handleSaveLocutorTrack(e) {
    e.preventDefault();
    const title=document.getElementById('locutorTitle').value.trim();
    const desc =document.getElementById('locutorDesc').value.trim();
    const url  =document.getElementById('locutorUrl').value.trim();
    if(!title||!url){ alert('Preencha título e URL (ou envie um arquivo).'); return; }
    try {
        if (editingLocutorId) {
            const {error}=await supabase.from('locutor_tracks').update({title,description:desc||null,audio_url:url}).eq('id',editingLocutorId);
            if(error) throw error;
            alert('✅ Locução atualizada!');
            editingLocutorId = null;
            document.getElementById('locutorForm').querySelector('.submit-btn').textContent = '💾 Salvar';
        } else {
            const {error}=await supabase.from('locutor_tracks').insert([{title,description:desc||null,audio_url:url,enabled:true}]);
            if(error) throw error;
            alert('✅ Locução salva!');
        }
        document.getElementById('locutorTitle').value='';
        document.getElementById('locutorDesc').value='';
        document.getElementById('locutorUrl').value='';
        await loadLocutorTracks();
    } catch(err){ alert('❌ Erro: '+err.message); }
}

// Upload de arquivo (Locutor)
function uploadAudioFileToCloudinary(file, folder, onProgress) {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error('Nenhum arquivo selecionado')); return; }
        const okTypes = ['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/x-m4a'];
        if (file.type && !okTypes.includes(file.type) && !/\.(mp3|wav|ogg|m4a)$/i.test(file.name)) {
            reject(new Error('Formato não suportado. Use MP3, WAV, OGG ou M4A.')); return;
        }
        if (file.size > 50 * 1024 * 1024) { reject(new Error('Arquivo muito grande (máximo 50MB).')); return; }
        const safeName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        fd.append('folder', folder || 'radio_louro/uploads');
        fd.append('public_id', `${safeName}_${Date.now()}`);
        fd.append('resource_type', 'video');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`);
        xhr.upload.onprogress = e => { if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (data.secure_url) resolve(data.secure_url);
                else reject(new Error(data.error?.message || 'Upload falhou'));
            } catch { reject(new Error('Resposta inválida do Cloudinary')); }
        };
        xhr.onerror = () => reject(new Error('Erro de rede durante o upload'));
        xhr.send(fd);
    });
}
async function deleteFromCloudinary(audioUrl) {
    if (!audioUrl || !audioUrl.includes('cloudinary.com')) return;
    try {
        await fetch(DELETE_ASSET_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-function-secret': FUNCTION_SECRET },
            body: JSON.stringify({ audio_url: audioUrl }),
        });
    } catch (err) { console.warn('Não foi possível apagar do Cloudinary:', err); }
}

// Locutor Ao Vivo (microfone)
async function startLiveLocutor() {
    if(liveActive) { stopLiveLocutor(); return; }
    try {
        liveStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = liveAudioCtx.createMediaStreamSource(liveStream);
        liveProcessor = liveAudioCtx.createScriptProcessor(4096, 1, 1);
        liveBroadcastCh = supabase.channel('live_locutor_player', { config: { private: true } });
        await liveBroadcastCh.subscribe();
        await liveBroadcastCh.send({ type:'broadcast', event:'live_locutor_start', payload:{} });
        liveProcessor.onaudioprocess = async (e) => {
            if(!liveActive) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const chunk = Array.from(inputData);
            await liveBroadcastCh.send({ type:'broadcast', event:'live_audio_chunk', payload:{ chunk } });
        };
        source.connect(liveProcessor);
        liveProcessor.connect(liveAudioCtx.destination);
        liveActive = true;
        document.getElementById('liveLocutorIndicator').classList.add('active');
        document.getElementById('liveLocutorStatus').textContent = '🔴 No ar — falando ao vivo';
        document.getElementById('liveLocutorBtn').textContent = '⏹️ Encerrar ao vivo';
        document.getElementById('liveLocutorBtn').classList.add('active');
    } catch(err) {
        alert('❌ Não foi possível acessar o microfone: ' + err.message);
    }
}
async function stopLiveLocutor() {
    liveActive = false;
    if(liveBroadcastCh) { await liveBroadcastCh.send({ type:'broadcast', event:'live_locutor_stop', payload:{} }); liveBroadcastCh.unsubscribe(); liveBroadcastCh=null; }
    if(liveProcessor) { liveProcessor.disconnect(); liveProcessor=null; }
    if(liveAudioCtx) { liveAudioCtx.close(); liveAudioCtx=null; }
    if(liveStream) { liveStream.getTracks().forEach(t=>t.stop()); liveStream=null; }
    document.getElementById('liveLocutorIndicator').classList.remove('active');
    document.getElementById('liveLocutorStatus').textContent = 'Inativo';
    document.getElementById('liveLocutorBtn').textContent = '🎙️ Iniciar ao vivo';
    document.getElementById('liveLocutorBtn').classList.remove('active');
}

// Chamada de Funcionário
async function handleChamadaSubmit(e) {
    e.preventDefault();
    const nome = document.getElementById('chamadaNome').value.trim();
    const setor = document.getElementById('chamadaSetor').value.trim();
    const destino = document.getElementById('chamadaDestino').value.trim();
    if(!nome || !setor) { alert('Preencha nome e setor!'); return; }
    const msg = destino
        ? `Atenção! ${nome}, do setor de ${setor}, favor comparecer ${destino}.`
        : `Atenção! ${nome}, do setor de ${setor}, favor comparecer à gerência.`;
    dispatchTTS(msg, `Chamada: ${nome}`);
}
window.chamadaRapida = function(setorPreenchido, destino) {
    const nome = document.getElementById('chamadaNome').value.trim();
    if(!nome) { alert('Digite o nome do funcionário primeiro!'); return; }
    if(setorPreenchido) document.getElementById('chamadaSetor').value = setorPreenchido;
    const setor = document.getElementById('chamadaSetor').value.trim() || 'não informado';
    const msg = `Atenção! ${nome}, do setor de ${setor}, favor comparecer ${destino}.`;
    dispatchTTS(msg, `Chamada: ${nome}`);
};

// TTS
function populateEngineVoices(engine) {
    const sel = document.getElementById('ttsVoiceSelect');
    if(!sel) return;
    sel.innerHTML = (TTS_VOICES[engine]||[]).map(v => `<option value="${v.id}">${escapeHtml(v.label)}</option>`).join('');
}
async function loadTTSLibrary() {
    const {data} = await supabase.from('tts_library').select('*').order('created_at',{ascending:false});
    ttsLibrary = data || []; renderTTSLibrary();
}
function renderTTSLibrary() {
    const grid = document.getElementById('ttsLibraryGrid');
    if(!grid) return;
    const enabled = ttsLibrary.filter(t=>t.enabled);
    if(!enabled.length) { grid.innerHTML='<div style="color:#999;font-size:13px;padding:10px;">Nenhum texto salvo.</div>'; return; }
    const catIcons={promocao:'🏷️',aviso:'📣',saudacao:'👋',encerramento:'🌙',geral:'📝'};
    grid.innerHTML = enabled.map(t=>`
        <div class="tts-lib-card" onclick="loadTTSText(${t.id})">
            <div class="tts-lib-title">${escapeHtml(t.title)}</div>
            <div class="tts-lib-preview">${escapeHtml(t.text_content)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
                <span class="tts-lib-category">${catIcons[t.category]||'📝'} ${escapeHtml(t.category)}</span>
                <div style="display:flex;gap:4px;">
                    <button class="suggest-btn" style="font-size:10px;padding:4px 8px;" onclick="event.stopPropagation();playTTSFromLib(${t.id})">🔊 Falar</button>
                </div>
            </div>
        </div>`).join('');
}
window.loadTTSText = function(id) {
    const item = ttsLibrary.find(t=>t.id===id);
    if(!item) return;
    document.getElementById('ttsTextInput').value = item.text_content;
    document.getElementById('ttsTitleInput').value = item.title;
    document.getElementById('ttsCategoryInput').value = item.category||'geral';
    document.getElementById('ttsCharCount').textContent = item.text_content.length;
    if(item.voice_id) document.getElementById('ttsVoiceSelect').value = item.voice_id;
    document.getElementById('ttsTextInput').focus();
};
window.playTTSFromLib = async function(id) {
    const item = ttsLibrary.find(t=>t.id===id);
    if(!item || !item.audio_url) { alert('⚠️ Este item ainda não tem áudio gerado.'); return; }
    await dispatchTTSAudio(item.audio_url, item.title);
    await supabase.from('tts_library').update({ last_played_at:new Date().toISOString(), play_count:(item.play_count||0)+1 }).eq('id',id);
};

async function dispatchTTSAudio(audioUrl, title) {
    const ch = supabase.channel('tts_broadcast', { config: { private: true } });
    await new Promise(resolve => { ch.subscribe(status => { if(status === 'SUBSCRIBED') resolve(); }); });
    await ch.send({ type:'broadcast', event:'tts_play', payload:{ audio_url:audioUrl, title } });
    ch.unsubscribe();
    if(testAudio) { testAudio.src=audioUrl; testAudio.play().catch(e=>console.warn('Erro ao tocar localmente:',e)); }
}
async function dispatchTTS(text, title) {
    const audioUrl = await generateTTSAudio(text, selectedTTSEngine, null, title, null);
    if(!audioUrl) { alert('❌ Não foi possível gerar o áudio (provavelmente cota do TTS).'); return; }
    await dispatchTTSAudio(audioUrl, title);
}
async function generateTTSAudio(text, engine, voiceId, title, onProgress) {
    if(onProgress) onProgress(`🎙️ Gerando áudio (${engine})...`);
    if(engine === 'elevenlabs') {
        const remaining = await getElevenLabsRemaining();
        if(remaining !== null && remaining < text.length) {
            const msg = `❌ Cota ElevenLabs insuficiente.\nTexto: ${text.length} caracteres\nDisponível: ${remaining} caracteres`;
            if(onProgress) onProgress(msg);
            alert(msg);
            return null;
        }
    }
    try {
        const res = await fetch(TTS_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${SUPABASE_ANON_KEY}`, 'x-function-secret': FUNCTION_SECRET },
            body: JSON.stringify({ text, engine, voice_id: voiceId, title }),
        });
        const data = await res.json();
        if(!res.ok || !data.audio_url) {
            if(onProgress) onProgress(`❌ ${data.error || 'Erro desconhecido'}`);
            alert(`Erro ao gerar TTS: ${data.error || 'Erro desconhecido'}`);
            return null;
        }
        if(engine === 'elevenlabs' && data.chars_used) {
            await supabase.from('elevenlabs_usage').insert([{ chars_used: data.chars_used, month: new Date().toISOString().slice(0,7), engine:'elevenlabs', title }]);
        }
        if(onProgress) onProgress('✅ Áudio gerado!');
        return data.audio_url;
    } catch(err) {
        if(onProgress) onProgress(`❌ ${err.message}`);
        return null;
    }
}
async function getElevenLabsRemaining() {
    try {
        const month = new Date().toISOString().slice(0,7);
        const { data } = await supabase.from('elevenlabs_usage').select('chars_used').eq('month', month);
        const used = (data||[]).reduce((s,r)=>s+(r.chars_used||0),0);
        return Math.max(0, ELEVENLABS_MONTHLY_LIMIT - used);
    } catch { return null; }
}
async function loadElevenLabsUsage(containerId) {
    const el = document.getElementById(containerId);
    if(!el) return;
    try {
        const month = new Date().toISOString().slice(0,7);
        const { data } = await supabase.from('elevenlabs_usage').select('chars_used').eq('month', month);
        const used = (data||[]).reduce((s,r)=>s+(r.chars_used||0),0);
        const remaining = Math.max(0, ELEVENLABS_MONTHLY_LIMIT - used);
        const pct = Math.round((used/ELEVENLABS_MONTHLY_LIMIT)*100);
        const color = pct>=90?'#dc3545':pct>=70?'#f59e0b':'#006b3f';
        const icon = pct>=90?'🔴':pct>=70?'🟡':'🟢';
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px;">
                <span style="font-size:13px;font-weight:600;color:${color};">${icon} ElevenLabs este mês</span>
                <span style="font-size:12px;color:#666;">${used.toLocaleString('pt-BR')} / ${ELEVENLABS_MONTHLY_LIMIT.toLocaleString('pt-BR')} (${pct}%)</span>
            </div>
            <div style="background:#e9ecef;border-radius:50px;height:8px;overflow:hidden;">
                <div style="background:${color};width:${pct}%;height:100%;border-radius:50px;"></div>
            </div>
            <div style="font-size:11px;color:#666;margin-top:4px;">${remaining.toLocaleString('pt-BR')} caracteres restantes</div>`;
    } catch(err) { el.innerHTML = '<span style="color:#dc3545;font-size:12px;">❌ Não foi possível verificar o uso.</span>'; }
}
async function handleTTSPlayNow() {
    const text = document.getElementById('ttsTextInput').value.trim();
    const title = document.getElementById('ttsTitleInput').value.trim()||'Aviso';
    const voiceId = document.getElementById('ttsVoiceSelect')?.value;
    if(!text){ alert('Digite o texto antes de falar.'); return; }
    const btn = document.getElementById('ttsPlayNowBtn');
    btn.disabled=true;
    try {
        const audioUrl = await generateTTSAudio(text, selectedTTSEngine, voiceId, title, msg=>{ btn.textContent=msg; });
        if(audioUrl) { await dispatchTTSAudio(audioUrl, title); loadElevenLabsUsage('elevenLabsUsageBar'); }
    } catch(err){ alert('❌ Erro: '+err.message); }
    btn.textContent='🔊 Gerar e Tocar Agora'; btn.disabled=false;
}
async function handleTTSSave() {
    const text = document.getElementById('ttsTextInput').value.trim();
    const title = document.getElementById('ttsTitleInput').value.trim()||'Sem título';
    const category = document.getElementById('ttsCategoryInput').value;
    const voiceId = document.getElementById('ttsVoiceSelect')?.value;
    if(!text){ alert('Digite o texto antes de salvar.'); return; }
    const btn = document.getElementById('ttsSaveBtn');
    btn.disabled=true;
    try {
        const audioUrl = await generateTTSAudio(text, selectedTTSEngine, voiceId, title, msg=>{ btn.textContent=msg; });
        if(audioUrl) {
            await supabase.from('tts_library').insert([{
                title, text_content:text, category, engine:selectedTTSEngine, voice_id:voiceId, audio_url:audioUrl, enabled:true
            }]);
            alert('✅ Salvo na biblioteca!');
            await loadTTSLibrary();
            loadElevenLabsUsage('elevenLabsUsageBar');
        }
    } catch(err){ alert('❌ Erro: '+err.message); }
    btn.textContent='💾 Gerar e Salvar na Biblioteca'; btn.disabled=false;
}

function testAudioUrl(url) {
    if(!url){ alert('Insira uma URL!'); return; }
    testAudio.src=url;
    testAudio.play().then(()=>{ alert('▶️ Reproduzindo...\nClique OK para parar.'); testAudio.pause(); testAudio.currentTime=0; }).catch(()=>alert('❌ Erro ao reproduzir.'));
}

// ─────────────────────────────────────────────────────────────
// LISTENERS
// ─────────────────────────────────────────────────────────────
function setupLocutorTabs() {
    const tabs   = document.querySelectorAll('.locutor-tab');
    const panels = document.querySelectorAll('.locutor-tab-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = 'tabpanel-' + tab.dataset.tab;
            panels.forEach(p => { p.style.display = (p.id === target) ? '' : 'none'; });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function setupAllListeners() {
    // Abas
    setupLocutorTabs();

    // Emergência
    document.getElementById('emergencyBtn')?.addEventListener('click', toggleEmergency);
    supabase.channel('emergency_locutor')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'emergency_alert'},
            payload => { emergencyActive = payload.new.is_active; renderEmergencyUI(payload.new); })
        .subscribe();

    // Flash
    document.getElementById('flashForm')?.addEventListener('submit', handleFlashSubmit);
    document.getElementById('flashStopBtn')?.addEventListener('click', stopFlashPromotion);
    supabase.channel('flash_locutor')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'flash_state'}, payload => {
            flashActive = payload.new.is_active;
            renderFlashUI(payload.new);
            if(payload.new.is_active && payload.new.ends_at) startFlashCountdown(new Date(payload.new.ends_at));
            else if(flashCountdownTimer) { clearInterval(flashCountdownTimer); flashCountdownTimer = null; }
        }).subscribe();

    // Locutor
    document.getElementById('locutorPlayBtn')?.addEventListener('click', handleLocutorToggle);
    document.getElementById('locutorForm')?.addEventListener('submit', handleSaveLocutorTrack);
    document.getElementById('locutorTestBtn')?.addEventListener('click', ()=>testAudioUrl(document.getElementById('locutorUrl').value));
    document.getElementById('locutorClearBtn')?.addEventListener('click', ()=>{
        document.getElementById('locutorTitle').value='';
        document.getElementById('locutorDesc').value='';
        document.getElementById('locutorUrl').value='';
        editingLocutorId = null;
        document.getElementById('locutorForm').querySelector('.submit-btn').textContent = '💾 Salvar';
    });
    document.getElementById('locutorFile')?.addEventListener('change', async e => {
        const file = e.target.files[0];
        const status = document.getElementById('locutorFileStatus');
        if(!file) return;
        try {
            if(status) status.textContent = '⏳ Enviando...';
            const url = await uploadAudioFileToCloudinary(file, 'radio_louro/locutor', pct => { if(status) status.textContent = `⏳ Enviando... ${pct}%`; });
            document.getElementById('locutorUrl').value = url;
            if(status) status.textContent = '✅ Arquivo enviado! URL preenchida abaixo.';
        } catch(err) { if(status) status.textContent = `❌ ${err.message}`; }
    });
    document.getElementById('liveLocutorBtn')?.addEventListener('click', startLiveLocutor);

    // Chamada de funcionário
    document.getElementById('chamadaForm')?.addEventListener('submit', handleChamadaSubmit);

    // TTS
    const textarea = document.getElementById('ttsTextInput');
    if(textarea) textarea.addEventListener('input', ()=>{ document.getElementById('ttsCharCount').textContent = textarea.value.length; });
    document.getElementById('ttsPlayNowBtn')?.addEventListener('click', handleTTSPlayNow);
    document.getElementById('ttsSaveBtn')?.addEventListener('click', handleTTSSave);
    document.getElementById('ttsClearBtn')?.addEventListener('click', ()=>{
        document.getElementById('ttsTextInput').value='';
        document.getElementById('ttsTitleInput').value='';
        document.getElementById('ttsCharCount').textContent='0';
    });
}

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    if(!window.supabase) {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">⚠️ Erro ao carregar o sistema. Verifique sua conexão.</div>';
        return;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    testAudio = document.getElementById('testAudio');

    document.getElementById('loginForm')?.addEventListener('submit', e => { e.preventDefault(); handleLogin(); });
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    const { data: { session } } = await supabase.auth.getSession();
    if(session) showPanel(); else showLogin();
});
