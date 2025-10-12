// Inicialização do cliente Supabase
let supabaseClient = null;

function initSupabase() {
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.anonKey
    );
  }
  return supabaseClient;
}

// Função para buscar programação por hora
async function getProgramacaoPorHora(hora) {
  const client = initSupabase();
  const { data, error } = await client
    .from('programacao_hourly')
    .select('*')
    .eq('hour', hora)
    .eq('enabled', true)
    .single();
  
  if (error) {
    console.error('Erro ao buscar programação:', error);
    return null;
  }
  
  return data;
}

// Função para buscar toda a programação
async function getAllProgramacao() {
  const client = initSupabase();
  const { data, error } = await client
    .from('programacao_hourly')
    .select('*')
    .order('hour', { ascending: true });
  
  if (error) {
    console.error('Erro ao buscar programação:', error);
    return [];
  }
  
  return data || [];
}

// Função para atualizar programação
async function updateProgramacao(id, dados) {
  const client = initSupabase();
  const { data, error } = await client
    .from('programacao_hourly')
    .update(dados)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Erro ao atualizar programação:', error);
    throw error;
  }
  
  return data;
}

// Função para inserir programação
async function insertProgramacao(dados) {
  const client = initSupabase();
  const { data, error } = await client
    .from('programacao_hourly')
    .insert(dados)
    .select();
  
  if (error) {
    console.error('Erro ao inserir programação:', error);
    throw error;
  }
  
  return data;
}

// Função para upsert (insert ou update)
async function upsertProgramacao(dados) {
  const client = initSupabase();
  const { data, error } = await client
    .from('programacao_hourly')
    .upsert(dados, { onConflict: 'hour' })
    .select();
  
  if (error) {
    console.error('Erro ao salvar programação:', error);
    throw error;
  }
  
  return data;
}

// Função para escutar mudanças em tempo real
function subscribeToChanges(callback) {
  const client = initSupabase();
  
  const subscription = client
    .channel('programacao_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'programacao_hourly'
      },
      (payload) => {
        console.log('Mudança detectada:', payload);
        callback(payload);
      }
    )
    .subscribe();
  
  return subscription;
}
