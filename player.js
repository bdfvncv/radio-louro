const SUPABASE_URL = 'https://dyzjsgfoaxyeyepoylvg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const syncBtn = document.getElementById('syncBtn');
const currentTime = document.getElementById('currentTime');
const countdownTimer = document.getElementById('countdownTimer');
const statusText = document.getElementById('statusText');
const trackName = document.getElementById('trackName');

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
        console.log('⚡ Iniciando rádio...');
        
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
        
        console.log('✅ Rádio pronta');
        
    } catch (error) {
        console.error('Erro ao inicializar:', error);
    }
}

async function loadAllDataParallel() {
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
            
            console.log(`🎭 Playlist temática: ${activeSeasonalCategory}`);
        } else {
            isSeasonalActive = false;
            seasonalPlaylist = [];
            seasonalAds = [];
        }
        
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
            }
        } else {
            if (wasActive) {
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
            }
        }
        
    } catch (error) {
        console.error('Erro ao verificar status temático:', error);
    }
}

async function checkAndShuffleIfNewDay() {
    if (isShuffling) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        if (lastKnownDate && lastKnownDate !== today) {
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
            isShuffling = false;
            return;
        }
        
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
        
    } catch (error) {
        console.error('Erro ao embaralhar:', error);
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
}

function setupRealtimeSubscription() {
    supabase
        .channel('radio_schedule_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'radio_schedule' },
            async () => {
                const { data } = await supabase.from('radio_schedule').select('*').order('hour', { ascending: true });
                allSchedules = data || [];
                await loadCurrentHourAudio();
            }
        )
        .subscribe();
    
    supabase
        .channel('playlist_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'background_playlist' },
            async () => {
                const { data } = await supabase.from('background_playlist').select('*').eq('enabled', true).order('daily_order', { ascending: true });
                backgroundPlaylist = data || [];
            }
        )
        .subscribe();
    
    supabase
        .channel('ads_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'advertisements' },
            async () => {
                const { data } = await supabase.from('advertisements').select('*').eq('enabled', true).order('play_order', { ascending: true });
                advertisements = data || [];
            }
        )
        .subscribe();
    
    supabase
        .channel('seasonal_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_playlists' },
            () => checkSeasonalStatus()
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'seasonal_settings' },
            () => checkSeasonalStatus()
        )
        .subscribe();
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
            playBackgroundMusic();
            return;
        }
        
        if (isHourExact && data.audio_url && data.audio_url.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url;
            updateDisplay('Hora Certa', `${String(currentHourNum).padStart(2, '0')}:00`);
            lastPlayedSlot = currentSlot;
            
            if (isPlaying) {
                audioPlayer.play().catch(err => console.error('Erro:', err));
            }
        } else if (isHalfHour && data.audio_url_half && data.audio_url_half.trim() !== '') {
            isPlayingHourCerta = true;
            audioPlayer.src = data.audio_url_half;
            updateDisplay('Hora Certa', `${String(currentHourNum).padStart(2, '0')}:30`);
            lastPlayedSlot = currentSlot;
            
            if (isPlaying) {
                audioPlayer.play().catch(err => console.error('Erro:', err));
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
        updateDisplay(isSeasonalActive ? '🎭 Música Temática' : 'Tocando agora', currentTrack.title || 'Música');
        
        tracksPlayedSinceLastAd++;
        
        if (isPlaying) {
            audioPlayer.play().catch(err => console.error('Erro:', err));
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
        updateDisplay('📢 Propaganda', currentAd.title);
        
        if (isPlaying) {
            audioPlayer.play().catch(err => console.error('Erro:', err));
        }
        
        currentAdIndex = (currentAdIndex + 1) % ads.length;
    } else {
        playBackgroundMusic();
    }
}

function handleNoAudio() {
    audioPlayer.src = '';
    updateDisplay('Sem programação', 'Aguardando áudio...');
}

// ========================================
// FUNÇÕES DE INTERFACE MINIMALISTA
// ========================================

function togglePlay() {
    if (!audioPlayer.src) {
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayButtonState(false);
    } else {
        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                updatePlayButtonState(true);
            })
            .catch(error => {
                console.error('Erro ao reproduzir:', error);
            });
    }
}

function updatePlayButtonState(playing) {
    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');
    
    if (playing) {
        // ESTADO: TOCANDO (Verde)
        playBtn.classList.remove('paused');
        playBtn.classList.add('playing');
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        // ESTADO: PARADO (Cinza)
        playBtn.classList.remove('playing');
        playBtn.classList.add('paused');
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function updateDisplay(status, track) {
    statusText.textContent = status;
    trackName.textContent = track;
}

function updateVolume() {
    const volume = volumeSlider.value / 100;
    audioPlayer.volume = volume;
}

async function forceSync() {
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Sincronizando...';
    
    try {
        await loadAllDataParallel();
        await loadCurrentHourAudio();
        syncBtn.textContent = '✅ Sincronizado!';
    } catch (error) {
        syncBtn.textContent = '❌ Erro';
    } finally {
        setTimeout(() => {
            syncBtn.textContent = '🔄 Sincronizar';
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
            lastPlayedSlot = null;
            await loadCurrentHourAudio();
        }
    }
}

function handleAudioEnded() {
    if (isPlayingHourCerta) {
        const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
        
        if (playlist.length > 0) {
            currentBackgroundIndex = (currentBackgroundIndex + 1) % playlist.length;
        }
        
        const ads = isSeasonalActive ? seasonalAds : advertisements;
        
        if (ads.length > 0) {
            playAdvertisement();
        } else {
            playBackgroundMusic();
        }
    } else if (isPlayingAd) {
        playBackgroundMusic();
    } else {
        const playlist = isSeasonalActive ? seasonalPlaylist : backgroundPlaylist;
        
        if (playlist.length > 0) {
            currentBackgroundIndex = (currentBackgroundIndex + 1) % playlist.length;
            playBackgroundMusic();
        } else {
            if (audioPlayer.src) {
                audioPlayer.play().catch(err => console.error('Erro:', err));
            }
        }
    }
}

function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    updateDisplay('Erro', 'Falha ao carregar áudio');
}

audioPlayer.volume = 0.7;

// Inicializa botão no estado parado
updatePlayButtonState(false);
