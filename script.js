let elements = {};
let radioState = {
    content: {},
    schedule: {},
    automation: {},
    playHistory: [],
    lastSync: null
};

/* ==========================
   Classe principal da Rádio
   ========================== */
class RadioLive24 {
    constructor() {
        this.syncManager = new RadioSyncManager();
        this.isPlaying = false;
        this.currentTrack = null;
        this.volume = 1.0;
    }

    /* ==========================
       Inicialização
       ========================== */
    async initialize() {
        try {
            this.initElements();
            this.setupEventListeners();
            this.loadStoredData();

            // Inicializar player
            if (elements.audioPlayer) {
                elements.audioPlayer.volume = this.volume;
                elements.audioPlayer.onended = () => this.playNext();
            }

            console.log("Rádio inicializada com sucesso!");
        } catch (error) {
            console.error("Erro na inicialização da rádio:", error);
        }
    }

    initElements() {
        const elementIds = [
            "audioPlayer",
            "playBtn",
            "pauseBtn",
            "volumeControl",
            "programacaoBtn",
            "pedidosBtn",
            "tocadasBtn",
            "estatisticasBtn",
            "logsBtn",
            "adminBtn",
            "backToPlayerBtn",
            "programacaoContent",
            "pedidosContent",
            "tocadasContent",
            "estatisticasContent",
            "logsContent",
            "adminContent",
            "forcePlayBtn"
        ];

        elements = {};
        elementIds.forEach(id => {
            elements[id] = document.getElementById(id) || null;
        });

        // Se não encontrar o player, usa fallback
        if (!elements.audioPlayer) {
            const fallbackAudio = document.querySelector("audio");
            if (fallbackAudio) {
                elements.audioPlayer = fallbackAudio;
                console.warn("audioPlayer não encontrado por id, usando primeiro <audio> da página.");
            } else {
                console.warn("Player de áudio não encontrado — algumas funções podem não funcionar.");
            }
        }
    }

    setupEventListeners() {
        if (elements.playBtn) {
            elements.playBtn.onclick = () => this.play();
        }
        if (elements.pauseBtn) {
            elements.pauseBtn.onclick = () => this.pause();
        }
        if (elements.volumeControl) {
            elements.volumeControl.oninput = (e) => this.setVolume(e.target.value);
        }

        // Botão extra para corrigir autoplay bloqueado
        if (elements.forcePlayBtn) {
            elements.forcePlayBtn.onclick = () => {
                if (elements.audioPlayer) {
                    elements.audioPlayer.play().catch(() => {});
                }
                elements.forcePlayBtn.style.display = "none";
            };
        }

        // Navegação
        const screens = {
            programacaoBtn: "programacaoScreen",
            pedidosBtn: "pedidosScreen",
            tocadasBtn: "tocadasScreen",
            estatisticasBtn: "estatisticasScreen",
            logsBtn: "logsScreen",
            adminBtn: "adminScreen"
        };

        for (const [btnId, screenId] of Object.entries(screens)) {
            if (elements[btnId]) {
                elements[btnId].onclick = () => this.showScreen(screenId);
            }
        }

        // Botão voltar ao player
        const backBtns = [
            "backToMain1",
            "backToMain2",
            "backToMain3",
            "backToMain4",
            "backToMain5",
            "backToPlayerBtn"
        ];

        backBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = () => this.showScreen("mainScreen");
            }
        });

        // Ativar/desativar modo admin
        if (elements.adminBtn) {
            elements.adminBtn.onclick = () => {
                if (this.syncManager) this.syncManager.setAdminMode(true);
                this.showScreen("adminScreen");
            };
        }
        if (elements.backToPlayerBtn) {
            elements.backToPlayerBtn.onclick = () => {
                if (this.syncManager) this.syncManager.setAdminMode(false);
                this.showScreen("mainScreen");
            };
        }
    }

    /* ==========================
       Player
       ========================== */
    play() {
        if (elements.audioPlayer && this.currentTrack) {
            elements.audioPlayer.play()
                .then(() => {
                    this.isPlaying = true;
                    console.log("Reprodução iniciada:", this.currentTrack);
                })
                .catch(err => console.warn("Erro ao reproduzir:", err));
        } else {
            console.warn("Nenhuma faixa carregada.");
        }
    }

    pause() {
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
            this.isPlaying = false;
        }
    }

    setVolume(value) {
        this.volume = parseFloat(value);
        if (elements.audioPlayer) {
            elements.audioPlayer.volume = this.volume;
        }
    }

    playNext() {
        // Lógica simples para avançar
        this.scheduleNextTrack();
    }

    scheduleNextTrack() {
        console.log("Escolher próxima música...");
        // TODO: implementar lógica de fila/hora certa/avisos
    }

    /* ==========================
       Navegação
       ========================== */
    showScreen(screenId) {
        const screens = document.querySelectorAll(".screen");
        screens.forEach(s => s.classList.remove("active"));
        const target = document.getElementById(screenId);
        if (target) target.classList.add("active");
    }

    /* ==========================
       Dados locais
       ========================== */
    loadStoredData() {
        try {
            const stored = localStorage.getItem("radioLive24State");
            if (stored) {
                const data = JSON.parse(stored);
                radioState = { ...radioState, ...data };
                console.log("Dados carregados do localStorage.");
            }
        } catch (error) {
            console.warn("Erro ao carregar dados:", error);
        }
    }

    saveData() {
        try {
            const dataToSave = {
                ...radioState,
                playHistory: radioState.playHistory ? radioState.playHistory.slice(-100) : []
            };
            localStorage.setItem("radioLive24State", JSON.stringify(dataToSave));

            if (this.syncManager && this.syncManager.isAdmin) {
                this.syncManager.publishUpdate();
            }
        } catch (error) {
            console.warn("Erro ao salvar dados:", error);
        }
    }
}

/* ==========================
   Classe Sync Manager
   ========================== */
class RadioSyncManager {
    constructor() {
        this.isAdmin = false;
        this.cloudName = "radio-louro"; // ajuste para o seu Cloudinary
        this.folder = "radio-louro/sync";
    }

    setAdminMode(value) {
        this.isAdmin = value;
        console.log("Admin mode:", value);
    }

    async publishUpdate() {
        if (!this.isAdmin) return;

        try {
            const payload = JSON.stringify(radioState);
            // ⚠ Importante: não exponha apiSecret no frontend!
            console.log("Simulação de upload do estado para Cloudinary...");
            console.log(payload);
        } catch (error) {
            console.error("Erro ao publicar atualização:", error);
        }
    }

    async syncData(centralData) {
        if (centralData.content) {
            radioState.content = { ...radioState.content, ...centralData.content };
        }
        if (centralData.schedule) {
            radioState.schedule = { ...radioState.schedule, ...centralData.schedule };
        }
        if (centralData.automation) {
            radioState.automation = { ...radioState.automation, ...centralData.automation };
        }

        radioState.lastSync = centralData.lastSync || new Date().toISOString();

        try {
            localStorage.setItem("radioLive24State", JSON.stringify(radioState));
        } catch (err) {
            console.warn("Erro ao salvar sync local:", err);
        }

        if (typeof radioSystem !== "undefined" && radioSystem) {
            radioSystem.updateContentLibrary && radioSystem.updateContentLibrary();
            radioSystem.updateReports && radioSystem.updateReports();
        }
    }
}

/* ==========================
   Inicialização global
   ========================== */
let radioSystem = null;

window.addEventListener("DOMContentLoaded", () => {
    radioSystem = new RadioLive24();
    radioSystem.initialize();
});
