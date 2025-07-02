// Configuração do Cloudinary para a Rádio Supermercado do Louro
// Versão corrigida com melhor tratamento de erros e validações

class CloudinaryManager {
    constructor() {
        this.config = {
            cloudName: 'dygbrcrr6',
            // IMPORTANTE: API Secret não deve estar no frontend por segurança
            uploadPreset: 'radio_louro' // Certifique-se que este preset existe no Cloudinary
        };
        
        this.baseUrl = `https://res.cloudinary.com/${this.config.cloudName}`;
        this.apiUrl = `https://api.cloudinary.com/v1_1/${this.config.cloudName}`;
        this.isInitialized = false;
    }
    
    /**
     * Inicializar e validar configuração
     */
    async initialize() {
        try {
            // Verificar se o cloud name existe
            const testUrl = `${this.baseUrl}/image/upload/v1/sample`;
            const response = await fetch(testUrl, { method: 'HEAD' });
            
            if (response.ok) {
                this.isInitialized = true;
                console.log('✅ Cloudinary inicializado com sucesso');
                return true;
            } else {
                throw new Error('Cloud name inválido ou inacessível');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar Cloudinary:', error);
            this.isInitialized = false;
            return false;
        }
    }
    
    /**
     * Verificar se está inicializado antes de usar
     */
    checkInitialization() {
        if (!this.isInitialized) {
            throw new Error('CloudinaryManager não foi inicializado. Chame initialize() primeiro.');
        }
    }
    
    /**
     * Upload de arquivo para o Cloudinary
     */
    async uploadFile(file, folder = 'radio-louro') {
        try {
            // Verificar inicialização
            this.checkInitialization();
            
            // Validar arquivo
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.config.uploadPreset);
            formData.append('folder', folder);
            formData.append('resource_type', 'auto');
            
            // Adicionar timeout para evitar carregamento infinito
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
            
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    errorData?.error?.message || 
                    `HTTP error! status: ${response.status}`
                );
            }
            
            const data = await response.json();
            return {
                success: true,
                url: data.secure_url,
                publicId: data.public_id,
                originalName: file.name,
                size: data.bytes,
                format: data.format,
                duration: data.duration || 0
            };
            
        } catch (error) {
            console.error('Erro no upload para Cloudinary:', error);
            
            let errorMessage = 'Erro desconhecido no upload';
            
            if (error.name === 'AbortError') {
                errorMessage = 'Upload cancelado por timeout (30s)';
            } else if (error.message.includes('upload_preset')) {
                errorMessage = 'Preset de upload não configurado corretamente';
            } else if (error.message.includes('network')) {
                errorMessage = 'Erro de conexão. Verifique sua internet.';
            } else {
                errorMessage = error.message;
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    /**
     * Upload múltiplos arquivos com melhor controle
     */
    async uploadMultipleFiles(files, folder = 'radio-louro', onProgress = null) {
        try {
            this.checkInitialization();
            
            const results = [];
            const totalFiles = files.length;
            
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                
                // Callback de progresso
                if (onProgress) {
                    onProgress({
                        currentFile: i + 1,
                        totalFiles,
                        fileName: file.name,
                        percentage: Math.round(((i) / totalFiles) * 100)
                    });
                }
                
                const result = await this.uploadFile(file, folder);
                results.push({
                    ...result,
                    fileName: file.name,
                    fileIndex: i
                });
                
                // Pequena pausa entre uploads para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            // Callback final
            if (onProgress) {
                onProgress({
                    currentFile: totalFiles,
                    totalFiles,
                    fileName: 'Concluído',
                    percentage: 100,
                    completed: true
                });
            }
            
            return {
                successful,
                failed,
                totalFiles,
                successCount: successful.length,
                failureCount: failed.length
            };
            
        } catch (error) {
            console.error('Erro no upload múltiplo:', error);
            throw error;
        }
    }
    
    /**
     * Validar arquivo com mais verificações
     */
    validateFile(file) {
        const validTypes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 
            'audio/ogg', 'audio/flac', 'audio/m4a'
        ];
        const maxSize = 50 * 1024 * 1024; // 50MB
        const minSize = 1024; // 1KB mínimo
        
        const errors = [];
        
        // Verificar se o arquivo existe
        if (!file) {
            errors.push('Nenhum arquivo selecionado');
            return { isValid: false, errors };
        }
        
        // Verificar tipo
        if (!validTypes.includes(file.type)) {
            errors.push(`Tipo não suportado: ${file.type}. Use MP3, WAV, OGG, FLAC ou M4A.`);
        }
        
        // Verificar tamanho
        if (file.size > maxSize) {
            errors.push(`Arquivo muito grande: ${this.formatFileSize(file.size)}. Máximo: 50MB.`);
        }
        
        if (file.size < minSize) {
            errors.push('Arquivo muito pequeno. Mínimo: 1KB.');
        }
        
        // Verificar nome
        if (file.name.length > 100) {
            errors.push('Nome muito longo. Máximo: 100 caracteres.');
        }
        
        // Verificar caracteres especiais no nome
        if (!/^[a-zA-Z0-9._\-\s]+$/.test(file.name)) {
            errors.push('Nome contém caracteres inválidos. Use apenas letras, números, pontos, hífens e espaços.');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            file: {
                name: file.name,
                size: file.size,
                type: file.type,
                sizeFormatted: this.formatFileSize(file.size)
            }
        };
    }
    
    /**
     * Gerar URL de áudio com validação
     */
    generateAudioUrl(publicId, options = {}) {
        if (!publicId) {
            console.error('Public ID é obrigatório para gerar URL');
            return null;
        }
        
        let transformations = [];
        
        if (options.quality) {
            transformations.push(`q_${options.quality}`);
        }
        
        if (options.format) {
            transformations.push(`f_${options.format}`);
        }
        
        if (options.bitrate) {
            transformations.push(`br_${options.bitrate}`);
        }
        
        const transformStr = transformations.length > 0 ? `/${transformations.join(',')}` : '';
        return `${this.baseUrl}/video/upload${transformStr}/${publicId}`;
    }
    
    /**
     * Formatar tamanho do arquivo
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Criar preview de áudio com tratamento de erro
     */
    async createAudioPreview(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('Arquivo não fornecido'));
                return;
            }
            
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            let resolved = false;
            
            // Timeout para evitar travamento
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    URL.revokeObjectURL(url);
                    reject(new Error('Timeout ao carregar áudio'));
                }
            }, 10000);
            
            audio.addEventListener('loadedmetadata', () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve({
                        duration: audio.duration,
                        url: url,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        durationFormatted: this.formatDuration(audio.duration)
                    });
                }
            });
            
            audio.addEventListener('error', (e) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    URL.revokeObjectURL(url);
                    reject(new Error(`Erro ao carregar áudio: ${e.message || 'Formato inválido'}`));
                }
            });
            
            audio.src = url;
        });
    }
    
    /**
     * Formatar duração em mm:ss
     */
    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Limpar recursos
     */
    cleanup() {
        this.isInitialized = false;
        console.log('🧹 Cloudinary Manager limpo');
    }
}

// Inicialização segura
let cloudinaryManager = null;

// Função para inicializar com verificação
async function initializeCloudinaryManager(config = {}) {
    try {
        if (cloudinaryManager) {
            console.log('CloudinaryManager já inicializado');
            return cloudinaryManager;
        }
        
        cloudinaryManager = new CloudinaryManager();
        
        // Aplicar configurações customizadas
        if (config.cloudName) {
            cloudinaryManager.config.cloudName = config.cloudName;
            cloudinaryManager.baseUrl = `https://res.cloudinary.com/${config.cloudName}`;
            cloudinaryManager.apiUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}`;
        }
        
        if (config.uploadPreset) {
            cloudinaryManager.config.uploadPreset = config.uploadPreset;
        }
        
        // Inicializar e verificar conexão
        const success = await cloudinaryManager.initialize();
        
        if (success) {
            // Disponibilizar globalmente apenas se inicializado com sucesso
            window.cloudinaryManager = cloudinaryManager;
            console.log('🔧 Cloudinary configurado e inicializado:', cloudinaryManager.config.cloudName);
            return cloudinaryManager;
        } else {
            throw new Error('Falha na inicialização do Cloudinary');
        }
        
    } catch (error) {
        console.error('❌ Erro ao inicializar CloudinaryManager:', error);
        cloudinaryManager = null;
        throw error;
    }
}

// Função para obter instância (com lazy loading)
function getCloudinaryManager() {
    if (!cloudinaryManager) {
        throw new Error('CloudinaryManager não foi inicializado. Chame initializeCloudinaryManager() primeiro.');
    }
    return cloudinaryManager;
}

// Exportar funções principais
window.initializeCloudinaryManager = initializeCloudinaryManager;
window.getCloudinaryManager = getCloudinaryManager;

// Cleanup ao descarregar página
window.addEventListener('beforeunload', () => {
    if (cloudinaryManager) {
        cloudinaryManager.cleanup();
    }
});

console.log('📁 Cloudinary Manager carregado (versão corrigida)!');
