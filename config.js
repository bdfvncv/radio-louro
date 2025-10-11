// Configurações do Supabase e Cloudinary
const CONFIG = {
    // Configurações Supabase
    SUPABASE_URL: 'https://dyzjsgfoaxyeyepoylvg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5empzZ2ZvYXh5ZXllcG95bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODUzNjUsImV4cCI6MjA3NTE2MTM2NX0.PwmaMI04EhcTqUQioTRInyVKUlw3t1ap0lM5hI29s2I',
    
    // Configurações Cloudinary
    CLOUDINARY_CLOUD_NAME: 'dygbrcrr6',
    CLOUDINARY_API_KEY: '888572786733292',
    // ATENÇÃO: Nunca exponha o API Secret no frontend!
    // Use apenas para operações backend/server-side
    // CLOUDINARY_API_SECRET: '5WbclVP4gNXypbix_op1ExPGZLg', // NÃO USE NO FRONTEND
    
    // Nome da tabela no Supabase
    TABLE_NAME: 'programacao_hourly',
    
    // URL base para uploads do Cloudinary (apenas leitura/public)
    CLOUDINARY_BASE_URL: 'https://res.cloudinary.com/dygbrcrr6'
};
