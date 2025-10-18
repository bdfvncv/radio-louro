// Configuração do Supabase
const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos DOM
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const syncBtn = document.getElementById('syncBtn');
const currentTime = document.getElementById('currentTime');
const countdownTimer = document.getElementById('countdownTimer');
const currentProgram = document.getElementById('currentProgram');
const statusMessage = document.getElementById('statusMessage');
const previousProgram = document.getElementById('previousProgram');
const currentHour = document.getElementById('currentHour');
const nextProgram = document.getElementById('nextProgram');

// Estado do player
let isPlaying = false;
let currentHourData = null;
let allSchedules = [];

// Inicializar
init();

async function init() {
    try {
        // Verificar se a tabela existe, se não, criar
        await ensureTableExists();
        
        // Carregar programação
        await loadSchedule();
        
        // Configurar listeners
        setupEventListeners();
        
        // Configurar tempo real
        setupRealtimeSubscription();
        
        // Atualizar relógio
        updateClock();
        setInterval(updateClock, 1000);
        
        // Verificar mudança de hora
        setInterval(checkHourChange, 30000); // A cada 30 segundos
        
        // Carregar áudio da hora atual
        await loadCurrentHourAudio();
        
        showMessage('Sistema carregado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar o sistema. Verifique o console.', 'error');
    }
}

async function ensureTableExists() {
    try {
        // Tentar fazer uma query simples para verificar se a tabela existe
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('hour')
            .limit(1);
        
        if (error && error.code === '42P01') {
            // Tabela não existe, mostrar mensagem para criar
            console.warn('Tabela radio_schedule não existe. Execute o SQL de criação no Supabase.');
            showMessage('Configure a tabela no Supabase primeiro. Veja o console.', 'info');
            console.log(`
-- Execute este SQL no Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS radio_schedule (
    id SERIAL PRIMARY KEY,
    hour INTEGER NOT NULL UNIQUE CHECK (hour >= 0 AND hour <= 23),
    audio_url TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_radio_schedule_hour ON radio_schedule(hour);
CREATE INDEX IF NOT EXISTS idx_radio_schedule_enabled ON radio_schedule(enabled);

-- Inserir dados padrão (opcional)
INSERT INTO radio_schedule (hour, audio_url, enabled) 
VALUES (0, '', false) ON CONFLICT (hour) DO NOTHING;
            `);
        }
    } catch (error) {
        console.error('Erro ao verificar tabela:', error);
    }
}

function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    volumeSlider.addEventListener('input', updateVolume);
    syncBtn.addEventListener('click', forceSync);
    
    audioPlayer.addEventListener('ended', handleAudioEnded);
    audioPlayer.addEventListener('error', handleAudioError);
    audioPlayer.addEventListener('canplay', handleCanPlay);
}

function setupRealtimeSubscription() {
    supabase
        .channel('radio_schedule_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            handleRealtimeUpdate
        )
        .subscribe();
}

async function handleRealtimeUpdate(payload) {
    console.log('Atualização em tempo real:', payload);
    
    // Recarregar programação
    await loadSchedule();
    
    // Se a atualização foi na hora atual, recarregar áudio
    const currentHourNum = new Date().getHours();
    if (payload.new && payload.new.hour === currentHourNum) {
        showMessage('Programação atualizada! Recarregando...', 'info');
        await loadCurrentHourAudio();
    }
}

async function loadSchedule() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .order('hour', { ascending: true });
        
        if (error) throw error;
        
        allSchedules = data || [];
        updateScheduleDisplay();
    } catch (error) {
        console.error('Erro ao carregar programação:', error);
        allSchedules = [];
    }
}

function updateScheduleDisplay() {
    const now = new Date();
    const currentHourNum = now.getHours();
    const prevHourNum = (currentHourNum - 1 + 24) % 24;
    const nextHourNum = (currentHourNum + 1) % 24;
    
    // Buscar dados das horas
    const prevData = allSchedules.find(s => s.hour === prevHourNum);
    const currData = allSchedules.find(s => s.hour === currentHourNum);
    const nextData = allSchedules.find(s => s.hour === nextHourNum);
    
    // Atualizar display
    previousProgram.textContent = prevData && prevData.enabled 
        ? `${String(prevHourNum).padStart(2, '0')}:00 - Programado`
        : `${String(prevHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    currentHour.textContent = currData && currData.enabled 
        ? `${String(currentHourNum).padStart(2, '0')}:00 - No Ar`
        : `${String(currentHourNum).padStart(2, '0')}:00 - Sem programação`;
    
    nextProgram.textContent = nextData && nextData.enabled 
        ? `${String(nextHourNum).padStart(2, '0')}:00 - Próximo`
        : `${String(nextHourNum).padStart(2, '0')}:00 - Sem programação`;
}

async function loadCurrentHourAudio() {
    const currentHourNum = new Date().getHours();
    
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .eq('hour', currentHourNum)
            .eq('enabled', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // Nenhum registro encontrado
                handleNoAudio();
                return;
            }
            throw error;
        }
        
        currentHourData = data;
        
        if (data && data.audio_url && data.audio_url.trim() !== '') {
            audioPlayer.src = data.audio_url;
            currentProgram.textContent = `Programa das ${String(currentHourNum).padStart(2, '0')}:00`;
            
            // Auto-play se estava tocando
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em Play para ouvir', 'info');
                });
            }
        } else {
            handleNoAudio();
        }
    } catch (error) {
        console.error('Erro ao carregar áudio:', error);
        handleNoAudio();
    }
}

function handleNoAudio() {
    audioPlayer.src = '';
    currentProgram.textContent = 'Programação temporariamente indisponível';
    showMessage('Nenhum áudio programado para esta hora', 'info');
    if (isPlaying) {
        togglePlay();
    }
}

function togglePlay() {
    if (!audioPlayer.src) {
        showMessage('Nenhum áudio disponível', 'error');
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        playBtn.innerHTML = '<span class="icon">▶️</span><span class="text">Play</span>';
        playBtn.classList.remove('playing');
    } else {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                playBtn.innerHTML = '<span class="icon">⏸️</span><span class="text">Pause</span>';
                playBtn.classList.add('playing');
            })
            .catch(error => {
                console.error('Erro ao reproduzir:', error);
                showMessage('Erro ao reproduzir áudio. Verifique a URL.', 'error');
            });
    }
}

function updateVolume() {
    const volume = volumeSlider.value / 100;
    audioPlayer.volume = volume;
    volumeValue.textContent = `${volumeSlider.value}%`;
}

async function forceSync() {
    showMessage('Sincronizando...', 'info');
    syncBtn.disabled = true;
    
    try {
        await loadSchedule();
        await loadCurrentHourAudio();
        showMessage('Sincronização concluída!', 'success');
    } catch (error) {
        showMessage('Erro na sincronização', 'error');
    } finally {
        setTimeout(() => {
            syncBtn.disabled = false;
        }, 2000);
    }
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    currentTime.textContent = `${hours}:${minutes}:${seconds}`;
    
    // Countdown para próxima hora
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const diff = nextHour - now;
    
    const minutesLeft = Math.floor(diff / 60000);
    const secondsLeft = Math.floor((diff % 60000) / 1000);
    
    countdownTimer.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
}

async function checkHourChange() {
    const now = new Date();
    const currentHourNum = now.getHours();
    
    // Se mudou de hora e estamos no minuto 00
    if (now.getMinutes() === 0 && (!currentHourData || currentHourData.hour !== currentHourNum)) {
        console.log('Mudança de hora detectada, recarregando...');
        await loadCurrentHourAudio();
        updateScheduleDisplay();
    }
}

function handleAudioEnded() {
    console.log('Áudio finalizado');
    // Pode repetir ou tocar próximo
    if (currentHourData && currentHourData.audio_url) {
        audioPlayer.play().catch(err => {
            console.error('Erro ao repetir:', err);
        });
    }
}

function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    showMessage('Erro ao carregar áudio. Verifique a URL.', 'error');
    if (isPlaying) {
        togglePlay();
    }
}

function handleCanPlay() {
    console.log('Áudio pronto para reprodução');
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 5000);
}

// Configurar volume inicial
audioPlayer.volume = 0.7;
