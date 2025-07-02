// Configuração do Cloudinary para a Rádio Supermercado do Louro
// Este arquivo deve ser incluído antes do script principal

class CloudinaryManager {
    constructor() {
        this.config = {
            cloudName: 'dygbrcrr6',
            apiKey: '853591251513134',
            // Nota: apiSecret não deve ser exposto no frontend
            uploadPreset: 'radio_louro' // Você precisa criar este preset no Cloudinary
        };
        
        this.baseUrl = `https://res.cloudinary.com/${this.config.cloudName}`;
        this.apiUrl = `https://api.cloudinary.com/v1_1/${this.config.cloudName}`;
        
        console.log('🔧 Cloudinary Manager inicializado');
    }
    
    /**
     * Upload de arquivo para o Cloudinary
     * @param {File} file - Arquivo para upload
     * @param {string} folder - Pasta de destino no Cloudinary
     * @returns {Promise} - Promise com dados do upload
     */
    async uploadFile(file, folder = 'radio-louro') {
        // Validar arquivo antes do upload
        const validation = this.validateFile(file);
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.config.uploadPreset);
        formData.append('folder', folder);
        formData.append('resource_type', 'auto');
        
        try {
            console.log('📤 Enviando arquivo:', file.name);
            
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Upload failed: ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
            }
            
            const data = await response.json();
            
            console.log('✅ Upload concluído:', data.public_id);
            
            return {
                success: true,
                url: data.secure_url,
                publicId: data.public_id,
                originalName: file.name,
                size: data.bytes,
                format: data.format,
                duration: data.duration || 0,
                resourceType: data.resource_type
            };
            
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Upload múltiplos arquivos
     * @param {FileList|Array} files - Lista de arquivos
     * @param {string} folder - Pasta de destino
     * @returns {Promise} - Promise com resultados dos uploads
     */
    async uploadMultipleFiles(files, folder = 'radio-louro') {
        const fileArray = Array.from(files);
        const results = [];
        
        console.log(`📤 Iniciando upload de ${fileArray.length} arquivo(s)`);
        
        // Upload sequencial para evitar sobrecarga
        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            console.log(`📤 Uploading ${i + 1}/${fileArray.length}: ${file.name}`);
            
            try {
                const result = await this.uploadFile(file, folder);
                results.push(result);
                
                // Pequena pausa entre uploads
                if (i < fileArray.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    fileName: file.name
                });
            }
        }
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ Upload concluído: ${successful.length} sucessos, ${failed.length} falhas`);
        
        return {
            results,
            successful,
            failed,
            totalFiles: fileArray.length,
            successCount: successful.length,
            failureCount: failed.length
        };
    }
    
    /**
     * Validar arquivo antes do upload
     * @param {File} file - Arquivo para validar
     * @returns {Object} - Resultado da validação
     */
    validateFile(file) {
        const validTypes = [
            'audio/mpeg', 
            'audio/mp3', 
            'audio/wav', 
            'audio/ogg',
            'audio/webm',
            'audio/aac',
            'audio/flac'
        ];
        const maxSize = 50 * 1024 * 1024; // 50MB
        const errors = [];
        
        // Verificar tipo
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|aac|flac)$/i)) {
            errors.push('Tipo de arquivo não suportado. Use MP3, WAV, OGG, WebM, AAC ou FLAC.');
        }
        
        // Verificar tamanho
        if (file.size > maxSize) {
            errors.push(`Arquivo muito grande (${this.formatFileSize(file.size)}). Máximo: 50MB.`);
        }
        
        // Verificar se arquivo está vazio
        if (file.size === 0) {
            errors.push('Arquivo está vazio.');
        }
        
        // Verificar nome do arquivo
        if (file.name.length > 100) {
            errors.push('Nome do arquivo muito longo. Máximo: 100 caracteres.');
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
     * Formatar tamanho do arquivo
     * @param {number} bytes - Tamanho em bytes
     * @returns {string} - Tamanho formatado
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Gerar URL otimizada para áudio
     * @param {string} publicId - ID público do arquivo
     * @param {Object} options - Opções de otimização
     * @returns {string} - URL otimizada
     */
    generateOptimizedUrl(publicId, options = {}) {
        let transformations = [];
        
        // Qualidade do áudio
        if (options.quality) {
            transformations.push(`q_${options.quality}`);
        }
        
        // Formato do áudio (conversão automática)
        if (options.format) {
            transformations.push(`f_${options.format}`);
        } else {
            transformations.push('f_auto'); // Formato automático baseado no navegador
        }
        
        // Bitrate
        if (options.bitrate) {
            transformations.push(`br_${options.bitrate}`);
        }
        
        const transformStr = transformations.length > 0 ? `/${transformations.join(',')}` : '';
        return `${this.baseUrl}/video/upload${transformStr}/${publicId}`;
    }
    
    /**
     * Testar conexão com Cloudinary
     * @returns {Promise<boolean>} - True se conexão OK
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/image/upload/ping`);
            return response.ok;
        } catch (error) {
            console.error('Erro ao testar conexão Cloudinary:', error);
            return false;
        }
    }
}

// Instância global do gerenciador Cloudinary
if (typeof window !== 'undefined') {
    window.cloudinaryManager = new CloudinaryManager();
    
    // Função para inicializar com configuração customizada
    window.initializeCloudinary = function(config) {
        if (config.cloudName) {
            window.cloudinaryManager.config.cloudName = config.cloudName;
            window.cloudinaryManager.baseUrl = `https://res.cloudinary.com/${config.cloudName}`;
            window.cloudinaryManager.apiUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}`;
        }
        
        if (config.uploadPreset) {
            window.cloudinaryManager.config.uploadPreset = config.uploadPreset;
        }
        
        console.log('🔧 Cloudinary reconfigurado:', window.cloudinaryManager.config.cloudName);
    };
    
    // Testar conexão na inicialização
    window.cloudinaryManager.testConnection().then(connected => {
        if (connected) {
            console.log('✅ Conexão com Cloudinary estabelecida');
        } else {
            console.warn('⚠️ Problemas na conexão com Cloudinary');
        }
    });
}

// Para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudinaryManager;
}

console.log('📁 Cloudinary Manager carregado!');
