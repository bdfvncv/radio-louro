const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// NOVOS elementos para melhor feedback visual
const playerSection = document.getElementById('playerSection');
const playerStatusBadge = document.getElementById('playerStatusBadge');

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

let seasonalPlaylist = [];
let seasonalAds = [];
let activeSeasonalCategory = null;
let isSeasonalActive = false;

let isShuffling = false;

init();

async function init() {
    try {
        console.log('⚡ Iniciando sistema otimizado...');
        const startTime = performance.now();
        
        lastKnownDate = new Date().toISOString().split('T')[0];
        
        await loadAllDataParallel();
        
        setupEventListeners();
        setupRealtimeSubscription();
        
        updateClock();
        setInterval(updateClock, 1000);
        
        setInterval(checkHourChange, 30000);
        setInterval(checkSeasonalStatus, 5000);
        
        await loadCurrentHourAudio();
        
        setTimeout(() => {
            checkAndShuffleIfNewDay();
        }, 2000);
        
        setInterval(checkAndShuffleIfNewDay, 300000);
        
        const endTime = performance.now();
        console.log(`✅ Sistema carregado em ${(endTime - startTime).toFixed(0)}ms`);
        showMessage('Sistema carregado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showMessage('Erro ao carregar o sistema. Verifique o console.', 'error');
    }
}

async function loadAllDataParallel() {
    console.log('🚀 Carregando dados em paralelo...');
    
    try {
        const [
            scheduleData,
            playlistData,
            adsData,
            seasonalMusicData,
            seasonalAdsData,
            seasonalSettingsData
        ] = await Promise.all([
            supabase.from('radio_schedule').select('*').order('hour', { ascending: true }),
            supabase.from('background_playlist').select('*').eq('enabled', true).order('daily_order', { ascending: true }),
            supabase.from('advertisements').select('*').eq('enabled', true).order('play_order', { ascending: true }),
            supabase.from('seasonal_playlists').select('*').eq('type', 'music').eq('enabled', true).order('daily_order', { ascending: true }),
            supabase.from('seasonal_playlists').select('*').eq('type', 'ad').eq('enabled', true).order('play_order', { ascending: true }),
            supabase.from('seasonal_settings').select('*').eq('is_active', true).maybeSingle()
        ]);
        
        allSchedules = scheduleData.data || [];
        backgroundPlaylist = playlistData.data || [];
        advertisements = adsData.data || [];
        
        if (seasonalSettingsData.data && seasonalSettingsData.data.category) {
            activeSeasonalCategory = seasonalSettingsData.data.category;
            isSeasonalActive = true;
            
            seasonalPlaylist = (seasonalMusicData.data || []).filter(item => 
                item.category === activeSeasonalCategory
            );
            
            seasonalAds = (seasonalAdsData.data || []).filter(item => 
                item.category === activeSeasonalCategory
            );
            
            console.log(`🎭 Playlist temática ativa: ${activeSeasonalCategory}`);
        } else {
            isSeasonalActive = false;
            seasonalPlaylist = [];
            seasonalAds = [];
        }
        
        updateScheduleDisplay();
        
        console.log(`✅ Dados carregados: ${backgroundPlaylist.length} músicas, ${advertisements.length} ads`);
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

async function checkSeasonalStatus() {
    try {
        const { data: settings } = await supabase
            .from('seasonal_settings')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();
        
        const wasActive = isSeasonalActive;
        const previousCategory = activeSeasonalCategory;
        
        if (settings && settings.category) {
            const newCategory = settings.category;
            
            if (!wasActive || previousCategory !== newCategory) {
                console.log(`🎭 Mudança detectada! Ativando: ${newCategory}`);
                
                const [musicData, adData] = await Promise.all([
                    supabase.from('seasonal_playlists').select('*').eq('type', 'music').eq('enabled', true).eq('category', newCategory).order('daily_order', { ascending: true }),
                    supabase.from('seasonal_playlists').select('*').eq('type', 'ad').eq('enabled', true).eq('category', newCategory).order('play_order', { ascending: true })
                ]);
                
                activeSeasonalCategory = newCategory;
                isSeasonalActive = true;
                seasonalPlaylist = musicData.data || [];
                seasonalAds = adData.data || [];
                
                currentBackgroundIndex = 0;
                currentAdIndex = 0;
                tracksPlayedSinceLastAd = 0;
                
                if (isPlaying && !isPlayingHourCerta) {
                    playBackgroundMusic();
                }
                
                showMessage(`Playlist temática ativada!`, 'success');
            }
        } else {
            if (wasActive) {
                console.log('📻 Voltando para playlist normal...');
                isSeasonalActive = false;
                activeSeasonalCategory = null;
                seasonalPlaylist = [];
                seasonalAds = [];
                
                currentBackgroundIndex = 0;
                currentAdIndex = 0;
                tracksPlayedSinceLastAd = 0;
                
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

async function checkAndShuffleIfNewDay() {
    if (isShuffling) {
        console.log('⏳ Embaralhamento já em andamento, pulando...');
        return;
    }
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        if (lastKnownDate && lastKnownDate !== today) {
            console.log(`🌅 NOVO DIA: ${today}`);
            await shufflePlaylistOptimized();
            lastKnownDate = today;
            return;
        }
        
        const { data } = await supabase
            .from('background_playlist')
            .select('last_shuffle_date')
            .eq('enabled', true)
            .limit(1)
            .maybeSingle();
        
        const lastShuffleDate = data?.last_shuffle_date;
        
        if (!lastShuffleDate || lastShuffleDate !== today) {
            console.log(`🎲 Embaralhando playlist...`);
            await shufflePlaylistOptimized();
            lastKnownDate = today;
        } else {
            if (!lastKnownDate) {
                lastKnownDate = today;
            }
        }
    } catch (error) {
        console.error('Erro ao verificar dia:', error);
    }
}

async function shufflePlaylistOptimized() {
    if (isShuffling) return;
    
    isShuffling = true;
    
    try {
        const { data: allTracks } = await supabase
            .from('background_playlist')
            .select('id')
            .eq('enabled', true)
            .order('original_order', { ascending: true });
        
        if (!allTracks || allTracks.length === 0) {
            console.log('⚠️ Nenhuma música para embaralhar');
            isShuffling = false;
            return;
        }
        
        console.log(`🎲 Embaralhando ${allTracks.length} músicas (otimizado)...`);
        
        const shuffledIndices = [...Array(allTracks.length).keys()];
        for (let i = shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const updates = allTracks.map((track, index) => ({
            id: track.id,
            daily_order: shuffledIndices[index],
            last_shuffle_date: today
        }));
        
        const batchSize = 50;
        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            
            await Promise.all(
                batch.map(update =>
                    supabase
                        .from('background_playlist')
                        .update({
                            daily_order: update.daily_order,
                            last_shuffle_date: update.last_shuffle_date
                        })
                        .eq('id', update.id)
                )
            );
        }
        
        const { data: refreshedData } = await supabase
            .from('background_playlist')
            .select('*')
            .eq('enabled', true)
            .order('daily_order', { ascending: true });
        
        backgroundPlaylist = refreshedData || [];
        
        console.log('✅ Embaralhamento concluído!');
        
    } catch (error) {
        console.error('❌ Erro ao embaralhar:', error);
    } finally {
        isShuffling = false;
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
            async () => {
                console.log('🔄 Playlist atualizada');
                const { data } = await supabase
                    .from('background_playlist')
                    .select('*')
                    .eq('enabled', true)
                    .order('daily_order', { ascending: true });
                backgroundPlaylist = data || [];
            }
        )
        .subscribe();
    
    supabase
        .channel('ads_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'advertisements' },
            async () => {
                console.log('🔄 Propagandas atualizadas');
                const { data } = await supabase
                    .from('advertisements')
                    .select('*')
                    .eq('enabled', true)
                    .order('play_order', { ascending: true });
                advertisements = data || [];
            }
        )
        .subscribe();
    
    supabase
        .channel('seasonal_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_playlists' },
            () => {
                console.log('🎭 Playlists temáticas atualizadas');
                checkSeasonalStatus();
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
    
    const { data } = await supabase
        .from('radio_schedule')
        .select('*')
        .order('hour', { ascending: true });
    
    allSchedules = data || [];
    
    const currentHourNum = new Date().getHours();
    if (payload.new && payload.new.hour === currentHourNum) {
        showMessage('Programação atualizada! Recarregando...', 'info');
        await loadCurrentHourAudio();
    }
    
    updateScheduleDisplay();
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
    
    try {
        const data = allSchedules.find(s => s.hour === currentHourNum && s.enabled);
        
        if (!data) {
            playBackgroundMusic();
            return;
        }
        
        currentHourData = data;
        
        const isHourExact = currentMinute <= 2;
        const isHalfHour = currentMinute >= 30 && currentMinute <= 32;
        
        const currentSlot = isHourExact ? `${currentHourNum}:00` : `${currentHourNum}:30`;
        
        if (lastPlayedSlot === currentSlot) {
            console.log(`⏭️ Slot ${currentSlot} já reproduzido`);
            playBackgroundMusic();
            return;
        }
        
        if (isHourExact && data.audio_url && data.audio_url.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:00`;
            lastPlayedSlot = currentSlot;
            
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em INICIAR RÁDIO para ouvir', 'info');
                });
            }
        } else if (isHalfHour && data.audio_url_half && data.audio_url_half.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url_half;
            currentProgram.textContent = `🎙️ Hora Certa - ${String(currentHourNum).padStart(2, '0')}:30`;
            lastPlayedSlot = currentSlot;
            
            if (isPlaying) {
                audioPlayer.play().catch(err => {
                    console.error('Erro ao reproduzir:', err);
                    showMessage('Clique em INICIAR RÁDIO para ouvir', 'info');
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
        
        const prefix = isSeasonalActive ? '🎭 ' : '🎵 ';
        currentProgram.textContent = `${prefix}${currentTrack.title || 'Música ' + (currentBackgroundIndex + 1)}`;
        
        tracksPlayedSinceLastAd++;
        
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
        
        const prefix = isSeasonalActive ? '🎭 ' : '📢 ';
        currentProgram.textContent = `${prefix}${currentAd.title}${currentAd.advertiser ? ' - ' + currentAd.advertiser : ''}`;
        
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

// ========================================
// FUNÇÃO MELHORADA: Toggle Play com Feedback Visual
// ========================================

function togglePlay() {
    if (!audioPlayer.src) {
        showMessage('Nenhum áudio disponível', 'error');
        return;
    }
    
    if (isPlaying) {
        // PAUSAR
        audioPlayer.pause();
        isPlaying = false;
        updatePlayerVisualState(false);
        showMessage('Rádio pausada', 'info');
    } else {
        // TOCAR
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                updatePlayerVisualState(true);
                showMessage('Rádio iniciada!', 'success');
            })
            .catch(error => {
                console.error('Erro ao reproduzir:', error);
                showMessage('Erro ao reproduzir áudio. Verifique a URL.', 'error');
            });
    }
}

// ========================================
// NOVA FUNÇÃO: Atualizar Estado Visual do Player
// ========================================

function updatePlayerVisualState(playing) {
    if (playing) {
        // ESTADO: TOCANDO
        
        // Atualizar botão principal
        playBtn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">PAUSAR RÁDIO</span>';
        playBtn.classList.add('playing');
        
        // Atualizar badge de status
        playerStatusBadge.innerHTML = '<span class="status-icon">▶️</span><span class="status-text">TOCANDO</span>';
        playerStatusBadge.classList.remove('paused');
        playerStatusBadge.classList.add('playing');
        
        // Atualizar card do player
        playerSection.classList.add('playing');
        
    } else {
        // ESTADO: PAUSADO
        
        // Atualizar botão principal
        playBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">INICIAR RÁDIO</span>';
        playBtn.classList.remove('playing');
        
        // Atualizar badge de status
        playerStatusBadge.innerHTML = '<span class="status-icon">⏸️</span><span class="status-text">PAUSADO</span>';
        playerStatusBadge.classList.remove('playing');
        playerStatusBadge.classList.add('paused');
        
        // Atualizar card do player
        playerSection.classList.remove('playing');
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
        await loadAllDataParallel();
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
        console.log('✅ Hora certa finalizada, avançando para próxima música...');
        
        const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
        
        if (playlist.length > 0) {
            currentBackgroundIndex = (currentBackgroundIndex + 1) % playlist.length;
            console.log(`➡️ Avançando índice após hora certa: ${currentBackgroundIndex + 1}/${playlist.length}`);
        }
        
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
