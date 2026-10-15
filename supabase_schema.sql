-- ============================================================
-- SCHEMA PARA O NOVO PROJETO SUPABASE: icjaadpiwzhyoccgdejl
-- Cole este script no SQL Editor do seu painel Supabase e clique em RUN
-- ============================================================

-- 1. TABELA DE USUÁRIOS (Gera IDs sequenciais automáticos: #1, #2, #3...)
CREATE TABLE IF NOT EXISTS public.analytics_users (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE EVENTOS DE ANALYTICS (Visitas, cliques de botões, planos)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    event_type TEXT,     -- 'visit', 'click', 'lead'
    page TEXT,           -- 'bridge', 'profile'
    item TEXT,           -- 'weekly', 'monthly', 'annual', 'vip_basic', 'test', etc.
    country TEXT,        -- 'BR', 'MX', 'US', etc.
    lang TEXT,           -- 'pt', 'es', 'en'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE LEADS / CONTATOS (Captura de Nome e WhatsApp antes do checkout)
CREATE TABLE IF NOT EXISTS public.leads (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    plan TEXT,
    country TEXT,
    lang TEXT,
    user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. HABILITAR PERMISSÕES PÚBLICAS (Row Level Security - RLS)
-- ============================================================

ALTER TABLE public.analytics_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Políticas para analytics_users
CREATE POLICY "Permitir insert anon analytics_users" ON public.analytics_users FOR INSERT TO anon, service_role WITH CHECK (true);
CREATE POLICY "Permitir select anon analytics_users" ON public.analytics_users FOR SELECT TO anon, service_role USING (true);

-- Políticas para analytics_events
CREATE POLICY "Permitir insert anon analytics_events" ON public.analytics_events FOR INSERT TO anon, service_role WITH CHECK (true);
CREATE POLICY "Permitir select anon analytics_events" ON public.analytics_events FOR SELECT TO anon, service_role USING (true);
CREATE POLICY "Permitir delete anon analytics_events" ON public.analytics_events FOR DELETE TO anon, service_role USING (true);

-- Políticas para leads
CREATE POLICY "Permitir insert anon leads" ON public.leads FOR INSERT TO anon, service_role WITH CHECK (true);
CREATE POLICY "Permitir select anon leads" ON public.leads FOR SELECT TO anon, service_role USING (true);
CREATE POLICY "Permitir delete anon leads" ON public.leads FOR DELETE TO anon, service_role USING (true);

-- ============================================================
-- 5. FUNÇÃO RPC PARA RESETAR OPERAÇÃO (Usada pelo botão no adminsupremo)
-- ============================================================

CREATE OR REPLACE FUNCTION reset_id_counters()
RETURNS void AS $$
BEGIN
    TRUNCATE TABLE public.analytics_events RESTART IDENTITY CASCADE;
    TRUNCATE TABLE public.analytics_users RESTART IDENTITY CASCADE;
    TRUNCATE TABLE public.leads RESTART IDENTITY CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
