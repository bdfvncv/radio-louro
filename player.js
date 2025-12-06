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
let backgroundPlaylist = [];
let advertisements = [];
let currentBackgroundIndex = 0;
let currentAdIndex = 0;
let tracksPlayedSinceLastAd = 0;
let isPlayingHourCerta = false;
let isPlayingAd = false;
let lastPlayedSlot = null;
let lastKnownDate = null;

// 🎄 NOVO: Estado das playlists temáticas
let seasonalPlaylist = [];
let seasonalAds = [];
let activeSeasonalCategory = null;
let isSeasonalActive = false;

// Inicializar
init();

async function init() {
    try {
        await ensureTableExists();
        await loadSchedule();
        
        lastKnownDate = new Date().toISOString().split('T')[0];
        console.log(`📅 Sistema iniciado em: ${lastKnownDate}`);
        
        await loadBackgroundPlaylist();
        await loadAdvertisements();
        
        // 🎄 NOVO: Carregar playlists temáticas
        await loadSeasonalData();
        
        setupEventListeners();
        setupRealtimeSubscription();
        
        updateClock();
        setInterval(updateClock, 1000);
        
        setInterval(checkHourChange, 30000);
        setInterval(checkAndShuffleIfNewDay, 10000);
        
        // 🎄 NOVO: Verificar playlists temáticas a cada 5 segundos
        setInterval(checkSeasonalStatus, 5000);
        
        await loadCurrentHourAudio();
        
        showMessage('Sistema carregado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar o sistema. Verifique o console.', 'error');
    }
}

async function ensureTableExists() {
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('hour')
            .limit(1);
        
        if (error && error.code === '42P01') {
            console.warn('Tabela radio_schedule não existe. Execute o SQL de criação no Supabase.');
            showMessage('Configure a tabela no Supabase primeiro. Veja o console.', 'info');
        }
    } catch (error) {
        console.error('Erro ao verificar tabela:', error);
    }
}

// ==========================================
// 🎄 PLAYLISTS TEMÁTICAS - NOVO!
// ==========================================

async function loadSeasonalData() {
    try {
        // Buscar playlists temáticas (músicas e propagandas)
        const { data: allSeasonalData, error } = await supabase
            .from('seasonal_playlists')
            .select('*')
            .eq('enabled', true)
            .order('play_order', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar dados temáticos:', error);
            return;
        }
        
        // Verificar qual categoria está ativa
        const { data: settings, error: settingsError } = await supabase
            .from('seasonal_settings')
            .select('*')
            .eq('is_active', true)
            .single();
        
        if (settingsError && settingsError.code !== 'PGRST116') {
            console.error('Erro ao verificar configurações temáticas:', error);
            return;
        }
        
        if (settings && settings.category) {
            // Há uma playlist temática ativa!
            activeSeasonalCategory = settings.category;
            isSeasonalActive = true;
            
            // Filtrar músicas e propagandas da categoria ativa
            seasonalPlaylist = allSeasonalData.filter(item => 
                item.category === activeSeasonalCategory && item.type === 'music'
            );
            
            seasonalAds = allSeasonalData.filter(item => 
                item.category === activeSeasonalCategory && item.type === 'ad'
            );
            
            const categoryLabels = {
                natal: '🎄 Natal',
                ano_novo: '🎆 Ano-Novo',
                pascoa: '🐰 Páscoa',
                sao_joao: '🔥 São João'
            };
            
            console.log(`🎭 Playlist temática ativa: ${categoryLabels[activeSeasonalCategory]}`);
            console.log(`🎵 Músicas temáticas: ${seasonalPlaylist.length}`);
            console.log(`📢 Propagandas temáticas: ${seasonalAds.length}`);
            
        } else {
            // Nenhuma playlist temática ativa
            isSeasonalActive = false;
            activeSeasonalCategory = null;
            seasonalPlaylist = [];
            seasonalAds = [];
            console.log('📻 Modo normal: Playlist padrão ativa');
        }
        
    } catch (error) {
        console.error('Erro ao carregar playlists temáticas:', error);
        isSeasonalActive = false;
    }
}

async function checkSeasonalStatus() {
    try {
        const { data: settings, error } = await supabase
            .from('seasonal_settings')
            .select('*')
            .eq('is_active', true)
            .single();
        
        const wasActive = isSeasonalActive;
        const previousCategory = activeSeasonalCategory;
        
        if (settings && settings.category) {
            // Há uma categoria ativa
            const newCategory = settings.category;
            
            if (!wasActive || previousCategory !== newCategory) {
                // Mudou de estado ou de categoria
                console.log(`🎭 Mudança detectada! Ativando playlist temática: ${newCategory}`);
                await loadSeasonalData();
                
                // Resetar índices
                currentBackgroundIndex = 0;
                currentAdIndex = 0;
                tracksPlayedSinceLastAd = 0;
                
                // Se estava tocando música/propaganda, trocar para temática
                if (isPlaying && !isPlayingHourCerta) {
                    playBackgroundMusic();
                }
                
                const categoryLabels = {
                    natal: '🎄 Natal',
                    ano_novo: '🎆 Ano-Novo',
                    pascoa: '🐰 Páscoa',
                    sao_joao: '🔥 São João'
                };
                
                showMessage(`${categoryLabels[newCategory]} ativado!`, 'success');
            }
        } else {
            // Nenhuma categoria ativa
            if (wasActive) {
                // Estava ativo, agora desativou
                console.log('📻 Voltando para playlist normal...');
                isSeasonalActive = false;
                activeSeasonalCategory = null;
                seasonalPlaylist = [];
                seasonalAds = [];
                
                // Resetar índices
                currentBackgroundIndex = 0;
                currentAdIndex = 0;
                tracksPlayedSinceLastAd = 0;
                
                // Se estava tocando, trocar para playlist normal
                if (isPlaying && !isPlayingHourCerta) {
                    playBackgroundMusic();
                }
                
                showMessage('Voltando à programação normal', 'info');
            }
        }
        
    } catch (error) {
        console.error('Erro ao verificar status temático:', error);
    }
}

// ==========================================
// FIM - PLAYLISTS TEMÁTICAS
// ==========================================

// ==========================================
// 🎲 PROGRAMAÇÃO DINÂMICA DIÁRIA
// ==========================================

async function checkAndShuffleIfNewDay() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        if (lastKnownDate && lastKnownDate !== today) {
            console.log(`🌅 MUDANÇA DE DIA DETECTADA!`);
            console.log(`   Dia anterior: ${lastKnownDate}`);
            console.log(`   Dia atual: ${today}`);
            console.log(`🎲 Iniciando embaralhamento automático...`);
            
            await shufflePlaylistForToday();
            await loadBackgroundPlaylist();
            
            lastKnownDate = today;
            
            showMessage('🎲 Nova programação do dia carregada!', 'success');
            return;
        }
        
        const { data, error } = await supabase
            .from('background_playlist')
            .select('last_shuffle_date')
            .eq('enabled', true)
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao verificar data:', error);
            return;
        }
        
        const lastShuffleDate = data?.last_shuffle_date;
        
        if (!lastShuffleDate || lastShuffleDate !== today) {
            console.log(`🎲 Data do banco desatualizada. Embaralhando...`);
            console.log(`   Última data no banco: ${lastShuffleDate || 'nunca'}`);
            console.log(`   Data atual: ${today}`);
            
            await shufflePlaylistForToday();
            await loadBackgroundPlaylist();
            
            lastKnownDate = today;
            
            showMessage('🎲 Playlist embaralhada automaticamente!', 'success');
        } else {
            if (!lastKnownDate) {
                lastKnownDate = today;
            }
        }
    } catch (error) {
        console.error('Erro ao verificar dia:', error);
    }
}

async function shufflePlaylistForToday() {
    try {
        const { data: allTracks, error: fetchError } = await supabase
            .from('background_playlist')
            .select('id, original_order, title')
            .eq('enabled', true)
            .order('original_order', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        if (!allTracks || allTracks.length === 0) {
            console.log('⚠️ Nenhuma música ativa para embaralhar');
            return;
        }
        
        console.log(`🎵 Embaralhando ${allTracks.length} músicas...`);
        
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
        
        console.log('✅ Playlist embaralhada com sucesso!');
        console.log(`📅 Data registrada: ${today}`);
        
    } catch (error) {
        console.error('❌ Erro ao embaralhar playlist:', error);
    }
}

// ==========================================
// FIM - PROGRAMAÇÃO DINÂMICA DIÁRIA
// ==========================================

async function loadBackgroundPlaylist() {
    try {
        await checkAndShuffleIfNewDay();
        
        const { data, error } = await supabase
            .from('background_playlist')
            .select('*')
            .eq('enabled', true)
            .order('daily_order', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar playlist de fundo:', error);
            backgroundPlaylist = [];
            return;
        }
        
        backgroundPlaylist = data || [];
        console.log('🎵 Playlist de fundo carregada:', backgroundPlaylist.length, 'músicas');
        console.log('🎲 Ordem do dia aplicada!');
        
        if (backgroundPlaylist.length > 0) {
            console.log('📋 Ordem de reprodução atual:');
            backgroundPlaylist.forEach((track, index) => {
                console.log(`  ${index + 1}. ${track.title} (Original: ${track.original_order}, Dia: ${track.daily_order})`);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar playlist:', error);
        backgroundPlaylist = [];
    }
}

async function loadAdvertisements() {
    try {
        const { data, error } = await supabase
            .from('advertisements')
            .select('*')
            .eq('enabled', true)
            .order('play_order', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar propagandas:', error);
            advertisements = [];
            return;
        }
        
        advertisements = data || [];
        console.log('📢 Propagandas carregadas:', advertisements.length, 'anúncios');
    } catch (error) {
        console.error('Erro ao carregar propagandas:', error);
        advertisements = [];
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
    
    supabase
        .channel('playlist_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'background_playlist' },
            () => {
                console.log('🔄 Playlist atualizada, recarregando...');
                loadBackgroundPlaylist();
            }
        )
        .subscribe();
    
    supabase
        .channel('ads_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'advertisements' },
            () => {
                console.log('🔄 Propagandas atualizadas, recarregando...');
                loadAdvertisements();
            }
        )
        .subscribe();
    
    // 🎄 NOVO: Subscription para playlists temáticas
    supabase
        .channel('seasonal_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_playlists' },
            () => {
                console.log('🎭 Playlists temáticas atualizadas');
                loadSeasonalData();
            }
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_settings' },
            () => {
                console.log('🎭 Configurações temáticas atualizadas');
                checkSeasonalStatus();
            }
        )
        .subscribe();
}

async function handleRealtimeUpdate(payload) {
    console.log('Atualização em tempo real:', payload);
    
    await loadSchedule();
    
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
    const currentMinute = now.getMinutes();
    
    let currentSlot, prevSlot, nextSlot;
    
    if (currentMinute < 30) {
        currentSlot = { hour: currentHourNum, half: false, label: `${String(currentHourNum).padStart(2, '0')}:00` };
        const prevHour = (currentHourNum - 1 + 24) % 24;
        prevSlot = { hour: prevHour, half: true, label: `${String(prevHour).padStart(2, '0')}:30` };
        nextSlot = { hour: currentHourNum, half: true, label: `${String(currentHourNum).padStart(2, '0')}:30` };
    } else {
        currentSlot = { hour: currentHourNum, half: true, label: `${String(currentHourNum).padStart(2, '0')}:30` };
        prevSlot = { hour: currentHourNum, half: false, label: `${String(currentHourNum).padStart(2, '0')}:00` };
        const nextHour = (currentHourNum + 1) % 24;
        nextSlot = { hour: nextHour, half: false, label: `${String(nextHour).padStart(2, '0')}:00` };
    }
    
    const prevData = allSchedules.find(s => s.hour === prevSlot.hour);
    const currData = allSchedules.find(s => s.hour === currentSlot.hour);
    const nextData = allSchedules.find(s => s.hour === nextSlot.hour);
    
    const prevHasAudio = prevSlot.half 
        ? (prevData && prevData.audio_url_half && prevData.enabled)
        : (prevData && prevData.audio_url && prevData.enabled);
    
    const currHasAudio = currentSlot.half
        ? (currData && currData.audio_url_half && currData.enabled)
        : (currData && currData.audio_url && currData.enabled);
    
    const nextHasAudio = nextSlot.half
        ? (nextData && nextData.audio_url_half && nextData.enabled)
        : (nextData && nextData.audio_url && nextData.enabled);
    
    previousProgram.textContent = prevHasAudio 
        ? `${prevSlot.label} - Programado`
        : `${prevSlot.label} - Sem programação`;
    
    currentHour.textContent = currHasAudio 
        ? `${currentSlot.label} - No Ar`
        : `${currentSlot.label} - Sem programação`;
    
    nextProgram.textContent = nextHasAudio 
        ? `${nextSlot.label} - Próximo`
        : `${nextSlot.label} - Sem programação`;
}

async function loadCurrentHourAudio() {
    const currentHourNum = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    
    await checkAndShuffleIfNewDay();
    
    try {
        const { data, error } = await supabase
            .from('radio_schedule')
            .select('*')
            .eq('hour', currentHourNum)
            .eq('enabled', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                playBackgroundMusic();
                return;
            }
            throw error;
        }
        
        currentHourData = data;
        
        const isHourExact = currentMinute <= 2;
        const isHalfHour = currentMinute >= 30 && currentMinute <= 32;
        
        const currentSlot = isHourExact ? `${currentHourNum}:00` : `${currentHourNum}:30`;
        
        if (lastPlayedSlot === currentSlot) {
            console.log(`⏭️ Slot ${currentSlot} já foi reproduzido, pulando para playlist`);
            playBackgroundMusic();
            return;
        }
        
        if (isHourExact && data && data.audio_url && data.audio_url.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:00`;
            lastPlayedSlot = currentSlot;
            console.log(`🎙️ Tocando Hora Certa (hora cheia): ${currentProgram.textContent}`);
            
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em Play para ouvir', 'info');
                });
            }
        } else if (isHalfHour && data && data.audio_url_half && data.audio_url_half.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url_half;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:30`;
            lastPlayedSlot = currentSlot;
            console.log(`🎙️ Tocando Hora Certa (meia hora): ${currentProgram.textContent}`);
            
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em Play para ouvir', 'info');
                });
            }
        } else {
            playBackgroundMusic();
        }
    } catch (error) {
        console.error('Erro ao carregar áudio:', error);
        playBackgroundMusic();
    }
}

function playBackgroundMusic() {
    isPlayingHourCerta = false;
    isPlayingAd = false;
    
    // 🎄 NOVO: Verificar se deve usar playlist temática ou normal
    const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
    const ads = isSeasonalActive ? seasonalAds : advertisements;
    
    if (playlist.length === 0) {
        handleNoAudio();
        return;
    }
    
    const adFrequency = ads.length > 0 && ads[currentAdIndex] 
        ? ads[currentAdIndex].frequency 
        : 3;
    
    if (ads.length > 0 && tracksPlayedSinceLastAd >= adFrequency) {
        playAdvertisement();
        return;
    }
    
    const currentTrack = playlist[currentBackgroundIndex];
    
    if (currentTrack && currentTrack.audio_url) {
        audioPlayer.src = currentTrack.audio_url;
        
        // 🎄 NOVO: Mostrar se é temática
        const prefix = isSeasonalActive ? '🎭 ' : '🎵 ';
        currentProgram.textContent = `${prefix}${currentTrack.title || 'Música ' + (currentBackgroundIndex + 1)}`;
        
        tracksPlayedSinceLastAd++;
        
        const playlistType = isSeasonalActive ? `temática (${activeSeasonalCategory})` : 'normal';
        console.log(`🎵 Tocando (${playlistType}): ${currentTrack.title} (${currentBackgroundIndex + 1}/${playlist.length})`);
        
        if (isPlaying) {
            audioPlayer.play().catch(err => {
                console.error('Erro ao reproduzir música de fundo:', err);
            });
        }
    } else {
        handleNoAudio();
    }
}

function playAdvertisement() {
    // 🎄 NOVO: Usar propagandas temáticas ou normais
    const ads = isSeasonalActive ? seasonalAds : advertisements;
    
    if (ads.length === 0) {
        playBackgroundMusic();
        return;
    }
    
    isPlayingAd = true;
    isPlayingHourCerta = false;
    tracksPlayedSinceLastAd = 0;
    
    const currentAd = ads[currentAdIndex];
    
    if (currentAd && currentAd.audio_url) {
        audioPlayer.src = currentAd.audio_url;
        
        // 🎄 NOVO: Mostrar se é temática
        const prefix = isSeasonalActive ? '🎭 ' : '📢 ';
        currentProgram.textContent = `${prefix}${currentAd.title}${currentAd.advertiser ? ' - ' + currentAd.advertiser : ''}`;
        
        const adType = isSeasonalActive ? `temática (${activeSeasonalCategory})` : 'normal';
        console.log(`📢 Tocando propaganda (${adType}): ${currentAd.title}`);
        
        if (isPlaying) {
            audioPlayer.play().catch(err => {
                console.error('Erro ao reproduzir propaganda:', err);
            });
        }
        
        currentAdIndex = (currentAdIndex + 1) % ads.length;
    } else {
        playBackgroundMusic();
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
        await loadBackgroundPlaylist();
        await loadAdvertisements();
        await loadSeasonalData();
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
    
    const currentMinute = now.getMinutes();
    let nextSlotTime;
    
    if (currentMinute < 30) {
        nextSlotTime = new Date(now);
        nextSlotTime.setMinutes(30, 0, 0);
    } else {
        nextSlotTime = new Date(now);
        nextSlotTime.setHours(now.getHours() + 1, 0, 0, 0);
    }
    
    const diff = nextSlotTime - now;
    const minutesLeft = Math.floor(diff / 60000);
    const secondsLeft = Math.floor((diff % 60000) / 1000);
    
    countdownTimer.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
}

async function checkHourChange() {
    const now = new Date();
    const currentHourNum = now.getHours();
    const currentMinute = now.getMinutes();
    
    const isHourChange = currentMinute === 0;
    const isHalfHourChange = currentMinute === 30;
    
    if (isHourChange || isHalfHourChange) {
        const newSlot = isHourChange ? `${currentHourNum}:00` : `${currentHourNum}:30`;
        if (lastPlayedSlot !== newSlot) {
            console.log(`🕐 Mudança para novo slot: ${newSlot}`);
            lastPlayedSlot = null;
            await loadCurrentHourAudio();
            updateScheduleDisplay();
        }
    }
}

function handleAudioEnded() {
    console.log('🎵 Áudio finalizado');
    
    if (isPlayingHourCerta) {
        console.log('✅ Hora certa finalizada, verificando propagandas...');
        
        // 🎄 Usar propagandas temáticas ou normais
        const ads = isSeasonalActive ? seasonalAds : advertisements;
        
        if (ads.length > 0) {
            playAdvertisement();
        } else {
            playBackgroundMusic();
        }
    } else if (isPlayingAd) {
        console.log('✅ Propaganda finalizada, voltando para playlist');
        playBackgroundMusic();
    } else {
        // 🎄 Usar playlist temática ou normal
        const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
        
        if (playlist.length > 0) {
            currentBackgroundIndex = (currentBackgroundIndex + 1) % playlist.length;
            console.log(`➡️ Avançando para próxima música: ${currentBackgroundIndex + 1}/${playlist.length}`);
            playBackgroundMusic();
        } else {
            if (audioPlayer.src) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao repetir:', err);
                });
            }
        }
    }
}

function handleAudioError(event) {
    console.error('❌ Erro no áudio:', event);
    showMessage('Erro ao carregar áudio. Verifique a URL.', 'error');
    if (isPlaying) {
        togglePlay();
    }
}

function handleCanPlay() {
    console.log('✅ Áudio pronto para reprodução');
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 5000);
}

audioPlayer.volume = 0.7;
