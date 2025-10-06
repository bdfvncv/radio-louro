// ==========================================
// CLOUDINARY SERVICE - UPLOAD E STREAMING
// ==========================================

import { CLOUDINARY_CONFIG, CLOUDINARY_FOLDERS } from './config.js';

class CloudinaryService {
  constructor() {
    this.config = CLOUDINARY_CONFIG;
  }

  async uploadAudio(file, categoria, subcategoria = 'geral') {
    try {
      console.log(`📤 Iniciando upload: ${file.name}`);
      
      this.validarArquivo(file);
      
      const folder = this.determinarPasta(categoria, subcategoria);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.config.uploadPreset);
      formData.append('folder', folder);
      formData.append('resource_type', 'auto');
      
      const response = await fetch(
        `${this.config.baseUrl}/auto/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erro no upload: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log(`✅ Upload concluído: ${data.secure_url}`);
      
      return {
        nome: file.name,
        cloudinaryUrl: data.secure_url,
        cloudinaryPublicId: data.public_id,
        duracao: data.duration || 0,
        formato: data.format,
        tamanho: data.bytes
      };
      
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      throw error;
    }
  }

  async uploadMultiplos(files, categoria, subcategoria = 'geral', onProgress) {
    const resultados = [];
    const total = files.length;
    
    for (let i = 0; i < total; i++) {
      try {
        const resultado = await this.uploadAudio(files[i], categoria, subcategoria);
        resultados.push({ sucesso: true, arquivo: resultado });
        
        if (onProgress) {
          onProgress(i + 1, total, files[i].name);
        }
      } catch (error) {
        resultados.push({ 
          sucesso: false, 
          erro: error.message,
          nomeArquivo: files[i].name 
        });
      }
    }
    
    return resultados;
  }

  async deleteAudio(publicId) {
    try {
      console.log(`🗑️ Deletando arquivo: ${publicId}`);
      
      const timestamp = Math.round(new Date().getTime() / 1000);
      const signature = await this.gerarAssinatura(publicId, timestamp);
      
      const formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('signature', signature);
      formData.append('api_key', this.config.apiKey);
      formData.append('timestamp', timestamp);
      
      const response = await fetch(
        `${this.config.baseUrl}/video/destroy`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erro ao deletar: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Arquivo deletado: ${data.result}`);
      
      return data.result === 'ok';
      
    } catch (error) {
      console.error('❌ Erro ao deletar:', error);
      throw error;
    }
  }

  getStreamUrl(publicId, options = {}) {
    const baseUrl = `https://res.cloudinary.com/${this.config.cloudName}/video/upload`;
    
    let transformations = [];
    
    if (options.quality) {
      transformations.push(`q_${options.quality}`);
    }
    
    if (options.format) {
      transformations.push(`f_${options.format}`);
    }
    
    const transformString = transformations.length > 0 
      ? transformations.join(',') + '/' 
      : '';
    
    return `${baseUrl}/${transformString}${publicId}`;
  }

  getCachedUrl(publicId) {
    return this.getStreamUrl(publicId, {
      quality: 'auto:good',
      format: 'mp3'
    });
  }

  validarArquivo(file) {
    const maxSize = 50 * 1024 * 1024;
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    
    if (file.size > maxSize) {
      throw new Error(`Arquivo muito grande. Tamanho máximo: 50MB`);
    }
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Formato não suportado. Use: MP3, WAV ou OGG`);
    }
    
    return true;
  }

  determinarPasta(categoria, subcategoria) {
    const pastaBase = CLOUDINARY_FOLDERS[categoria] || 'radio-louro/outros';
    
    if (subcategoria && subcategoria !== 'geral') {
      return `${pastaBase}/${subcategoria}`;
    }
    
    return pastaBase;
  }

  async gerarAssinatura(publicId, timestamp) {
    const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${this.config.apiSecret}`;
    
    const msgUint8 = new TextEncoder().encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }

  async extrairDuracaoAudio(file) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(objectUrl);
        resolve(Math.floor(audio.duration));
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar áudio'));
      });
      
      audio.src = objectUrl;
    });
  }

  formatarTamanho(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  isValidCloudinaryUrl(url) {
    if (!url) return false;
    return url.includes('cloudinary.com') && url.includes(this.config.cloudName);
  }
}

export const cloudinaryService = new CloudinaryService();

console.log('✅ Cloudinary Service carregado');