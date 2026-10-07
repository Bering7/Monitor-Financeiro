-- =====================================================================
-- BLOCO 1 (obrigatório): colunas novas + segurança (RLS)
-- Rode no Supabase: SQL Editor → New query → Run
-- =====================================================================

-- Colunas usadas pelo app (receita não fixa e despesa variável sem data)
alter table public.transacoes add column if not exists sem_data   boolean not null default false;
alter table public.transacoes add column if not exists valor_fixo boolean not null default true;
alter table public.transacoes alter column user_id set default auth.uid();

-- Validações no banco (valem só para linhas novas/editadas)
alter table public.transacoes drop constraint if exists transacoes_tipo_ck;
alter table public.transacoes add  constraint transacoes_tipo_ck
    check (tipo in ('receita', 'despesa-fixa', 'despesa-variavel')) not valid;
alter table public.transacoes drop constraint if exists transacoes_valor_ck;
alter table public.transacoes add  constraint transacoes_valor_ck check (valor > 0) not valid;

-- RLS: sem isso, QUALQUER pessoa com a chave pública lê e altera TODAS as linhas.
alter table public.transacoes enable row level security;

-- Remove políticas antigas (uma política permissiva esquecida anularia as novas)
do $$
declare p record;
begin
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'transacoes' loop
        execute format('drop policy %I on public.transacoes', p.policyname);
    end loop;
end $$;

create policy transacoes_select on public.transacoes for select to authenticated
    using (auth.uid() = user_id);
create policy transacoes_insert on public.transacoes for insert to authenticated
    with check (auth.uid() = user_id);
create policy transacoes_update on public.transacoes for update to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transacoes_delete on public.transacoes for delete to authenticated
    using (auth.uid() = user_id);


-- =====================================================================
-- BLOCO 2 (conta de testes): dados fictícios para teste@teste.com
-- ANTES: Authentication → Users → Add user → "Create new user"
--        e-mail teste@teste.com | senha 123456 | marque "Auto Confirm User"
--        (o Supabase exige no mínimo 6 caracteres, por isso não dá para usar "123")
-- Só insere se a conta ainda não tiver lançamentos.
-- =====================================================================
insert into public.transacoes (user_id, tipo, data, valor, descricao, categoria, futuro, sem_data, valor_fixo)
select u.id, v.tipo, v.data, v.valor, v.descricao, v.categoria, v.futuro, v.sem_data, v.valor_fixo
from auth.users u
cross join lateral (values
    ('receita',          (date_trunc('month', current_date))::date + 4,                      5000.00, 'Salário',           'Salário',   false, false, true),
    ('receita',          (date_trunc('month', current_date))::date + 14,                      800.00, 'Projeto freelance', 'Freelance', false, false, false),
    ('receita',          (date_trunc('month', current_date) + interval '1 month')::date + 9, 1200.00, 'Bônus',             'Outros',    true,  false, false),
    ('despesa-fixa',     (date_trunc('month', current_date))::date + 9,                      1200.00, 'Aluguel',           '',          false, false, true),
    ('despesa-fixa',     (date_trunc('month', current_date))::date + 14,                      110.00, 'Internet',          '',          false, false, true),
    ('despesa-fixa',     (date_trunc('month', current_date))::date + 19,                      180.00, 'Energia',           '',          false, false, true),
    ('despesa-fixa',     (date_trunc('month', current_date))::date + 4,                        90.00, 'Academia',          '',          false, false, true),
    ('despesa-variavel', (date_trunc('month', current_date))::date + 7,                       350.00, 'Mercado',           '',          false, false, true),
    ('despesa-variavel', (date_trunc('month', current_date))::date + 11,                       60.00, 'Delivery',          '',          false, false, true),
    ('despesa-variavel', (date_trunc('month', current_date))::date,                           120.00, 'Transporte',        '',          false, true,  true),
    ('despesa-variavel', (date_trunc('month', current_date))::date + 17,                      150.00, 'Lazer',             '',          false, false, true)
) as v(tipo, data, valor, descricao, categoria, futuro, sem_data, valor_fixo)
where u.email = 'teste@teste.com'
  and not exists (select 1 from public.transacoes t where t.user_id = u.id);

-- A porcentagem de investimento (10%) da conta de testes é opcional:
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"porcentagem_investimento": 10}'::jsonb
 where email = 'teste@teste.com';