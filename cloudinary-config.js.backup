// Configuração do Cloudinary para a Rádio Supermercado do Louro
// Este arquivo deve ser incluído antes do script principal

class CloudinaryManager {
    constructor() {
        this.config = {
            cloudName: 'dygbrcrr6',
            apiKey: '853591251513134',
            apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
            uploadPreset: 'radio_louro' // Crie um upload preset no Cloudinary
        };
        
        this.baseUrl = `https://res.cloudinary.com/${this.config.cloudName}`;
        this.apiUrl = `https://api.cloudinary.com/v1_1/${this.config.cloudName}`;
    }
    
    /**
     * Upload de arquivo para o Cloudinary
     * @param {File} file - Arquivo para upload
     * @param {string} folder - Pasta de destino no Cloudinary
     * @returns {Promise} - Promise com dados do upload
     */
    async uploadFile(file, folder = 'radio-louro') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.config.uploadPreset);
        formData.append('folder', folder);
        formData.append('resource_type', 'auto'); // Para arquivos de áudio
        
        try {
            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Upload múltiplos arquivos
     * @param {FileList} files - Lista de arquivos
     * @param {string} folder - Pasta de destino
     * @returns {Promise} - Promise com resultados dos uploads
     */
    async uploadMultipleFiles(files, folder = 'radio-louro') {
        const uploadPromises = Array.from(files).map(file => 
            this.uploadFile(file, folder)
        );
        
        try {
            const results = await Promise.all(uploadPromises);
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            return {
                successful,
                failed,
                totalFiles: files.length,
                successCount: successful.length,
                failureCount: failed.length
            };
            
        } catch (error) {
            console.error('Erro no upload múltiplo:', error);
            throw error;
        }
    }
    
    /**
     * Deletar arquivo do Cloudinary
     * @param {string} publicId - ID público do arquivo
     * @returns {Promise} - Promise com resultado da deleção
     */
    async deleteFile(publicId) {
        try {
            // Para deletar, você precisará implementar uma função serverless
            // ou usar um backend, pois requer autenticação com API Secret
            console.warn('Deleção requer implementação backend por segurança');
            return { success: false, error: 'Deleção não implementada no frontend' };
            
        } catch (error) {
            console.error('Erro ao deletar arquivo:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Gerar URL de transformação para áudio
     * @param {string} publicId - ID público do arquivo
     * @param {Object} options - Opções de transformação
     * @returns {string} - URL transformada
     */
    generateAudioUrl(publicId, options = {}) {
        let transformations = [];
        
        // Qualidade do áudio
        if (options.quality) {
            transformations.push(`q_${options.quality}`);
        }
        
        // Formato do áudio
        if (options.format) {
            transformations.push(`f_${options.format}`);
        }
        
        // Bitrate
        if (options.bitrate) {
            transformations.push(`br_${options.bitrate}`);
        }
        
        const transformStr = transformations.length > 0 ? `/${transformations.join(',')}` : '';
        return `${this.baseUrl}/video/upload${transformStr}/${publicId}`;
    }
    
    /**
     * Listar arquivos de uma pasta
     * @param {string} folder - Nome da pasta
     * @returns {Promise} - Promise com lista de arquivos
     */
    async listFiles(folder = 'radio-louro') {
        try {
            // Esta função também requer backend por segurança
            // Aqui você pode implementar uma API própria que consulta o Cloudinary
            console.warn('Listagem requer implementação backend por segurança');
            return { success: false, error: 'Listagem não implementada no frontend' };
            
        } catch (error) {
            console.error('Erro ao listar arquivos:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Validar arquivo antes do upload
     * @param {File} file - Arquivo para validar
     * @returns {Object} - Resultado da validação
     */
    validateFile(file) {
        const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
        const maxSize = 50 * 1024 * 1024; // 50MB
        
        const errors = [];
        
        if (!validTypes.includes(file.type)) {
            errors.push('Tipo de arquivo não suportado. Use MP3, WAV ou OGG.');
        }
        
        if (file.size > maxSize) {
            errors.push('Arquivo muito grande. Máximo 50MB.');
        }
        
        if (file.name.length > 100) {
            errors.push('Nome do arquivo muito longo. Máximo 100 caracteres.');
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
     * Gerar thumbnail para arquivo de áudio (usando waveform)
     * @param {string} publicId - ID público do arquivo
     * @returns {string} - URL do thumbnail
     */
    generateAudioThumbnail(publicId) {
        return `${this.baseUrl}/video/upload/f_jpg,w_300,h_200,c_pad,b_auto,fl_waveform/${publicId}.jpg`;
    }
}

// Instância global do gerenciador Cloudinary
window.cloudinaryManager = new CloudinaryManager();

// Função para inicializar o Cloudinary
window.initializeCloudinary = function(config) {
    if (config.cloudName) {
        window.cloudinaryManager.config.cloudName = config.cloudName;
        window.cloudinaryManager.baseUrl = `https://res.cloudinary.com/${config.cloudName}`;
        window.cloudinaryManager.apiUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}`;
    }
    
    if (config.uploadPreset) {
        window.cloudinaryManager.config.uploadPreset = config.uploadPreset;
    }
    
    console.log('🔧 Cloudinary configurado:', window.cloudinaryManager.config.cloudName);
};

// Widget de upload do Cloudinary (opcional)
window.createUploadWidget = function(options, callback) {
    if (typeof cloudinary === 'undefined') {
        console.error('Cloudinary SDK não carregado');
        return null;
    }
    
    return cloudinary.createUploadWidget({
        cloudName: window.cloudinaryManager.config.cloudName,
        uploadPreset: window.cloudinaryManager.config.uploadPreset,
        folder: options.folder || 'radio-louro',
        resourceType: 'auto',
        multiple: options.multiple || false,
        maxFiles: options.maxFiles || 10,
        maxFileSize: 50000000, // 50MB
        sources: ['local', 'url', 'camera'],
        clientAllowedFormats: ['mp3', 'wav', 'ogg', 'flac'],
        maxImageWidth: 2000,
        maxImageHeight: 2000,
        cropping: false,
        theme: 'minimal',
        styles: {
            palette: {
                window: "#2c3e50",
                sourceBg: "#34495e",
                windowBorder: "#3498db",
                tabIcon: "#ffffff",
                inactiveTabIcon: "#bdc3c7",
                menuIcons: "#3498db",
                link: "#3498db",
                action: "#27ae60",
                inProgress: "#f39c12",
                complete: "#27ae60",
                error: "#e74c3c",
                textDark: "#2c3e50",
                textLight: "#ffffff"
            }
        }
    }, callback);
};

// Função para processar resultado do upload
window.processUploadResult = function(result) {
    if (result.event === 'success') {
        return {
            success: true,
            url: result.info.secure_url,
            publicId: result.info.public_id,
            originalName: result.info.original_filename,
            size: result.info.bytes,
            format: result.info.format,
            duration: result.info.duration || 0,
            resourceType: result.info.resource_type
        };
    }
    
    return {
        success: false,
        error: result.info || 'Upload failed'
    };
};

// Função para criar preview de áudio
window.createAudioPreview = function(file) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        
        audio.addEventListener('loadedmetadata', () => {
            resolve({
                duration: audio.duration,
                url: url,
                name: file.name,
                size: file.size,
                type: file.type
            });
        });
        
        audio.addEventListener('error', () => {
            reject(new Error('Não foi possível carregar o arquivo de áudio'));
        });
        
        audio.src = url;
    });
};

console.log('📁 Cloudinary Manager carregado!');
