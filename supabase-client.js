// Inicialização do cliente Supabase
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Funções auxiliares para interação com o Supabase
const SupabaseService = {
    // Buscar programação de uma hora específica
    async getHourProgram(hour) {
        try {
            const { data, error } = await supabase
                .from(CONFIG.TABLE_NAME)
                .select('*')
                .eq('hour', hour)
                .eq('enabled', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('Erro ao buscar programação:', error);
            return null;
        }
    },

    // Buscar toda a programação
    async getAllPrograms() {
        try {
            const { data, error } = await supabase
                .from(CONFIG.TABLE_NAME)
                .select('*')
                .order('hour', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Erro ao buscar todas as programações:', error);
            return [];
        }
    },

    // Atualizar programação de uma hora
    async updateHourProgram(hour, updates) {
        try {
            // Primeiro, verifica se já existe um registro para esta hora
            const { data: existing } = await supabase
                .from(CONFIG.TABLE_NAME)
                .select('id')
                .eq('hour', hour)
                .single();

            let result;
            if (existing) {
                // Atualiza o registro existente
                result = await supabase
                    .from(CONFIG.TABLE_NAME)
                    .update(updates)
                    .eq('hour', hour);
            } else {
                // Cria um novo registro
                result = await supabase
                    .from(CONFIG.TABLE_NAME)
                    .insert([{ hour, ...updates }]);
            }

            if (result.error) throw result.error;
            return { success: true };
        } catch (error) {
            console.error('Erro ao atualizar programação:', error);
            return { success: false, error };
        }
    },

    // Salvar múltiplas programações
    async saveAllPrograms(programs) {
        try {
            // Upsert (insert ou update) de todos os programas
            const { data, error } = await supabase
                .from(CONFIG.TABLE_NAME)
                .upsert(programs, { onConflict: 'hour' });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erro ao salvar programações:', error);
            return { success: false, error };
        }
    },

    // Subscrever a mudanças em tempo real
    subscribeToChanges(callback) {
        return supabase
            .channel('programacao_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: CONFIG.TABLE_NAME
                }, 
                callback
            )
            .subscribe();
    },

    // Cancelar subscrição
    unsubscribe(subscription) {
        if (subscription) {
            supabase.removeChannel(subscription);
        }
    }
};