# Monitor Financeiro
Acesse: [GitHub Pages](https://bering7.github.io/Monitor-Financeiro)

Aplicação web para acompanhar receitas, despesas e investimentos de forma simples e visual, com resumo em cards, tabela de lançamentos e gráfico.

## Funcionalidades

- **Contas de usuário:** cada pessoa cria uma conta (e-mail e senha) e vê apenas os próprios dados, em qualquer dispositivo.
- **Cards de resumo:** receita, investimento, despesas e saldo, sempre atualizados.
- **Lançamentos por tipo:** abas de Receita, Despesa fixa e Despesa variável, com adição, edição e exclusão.
  - **Receita fixa:** escolhe só o dia; fica até ser removida manualmente.
  - **Receita de valor não fixo:** escolhe dia e mês; é excluída automaticamente no mês seguinte ao escolhido. Se o mês for diferente do atual, "Recebimento futuro" é marcado sozinho.
  - **Recebimento futuro:** não entra na receita, no investimento nem no saldo até o dia e o mês chegarem.
  - **Despesa fixa:** escolhe só o dia do vencimento.
  - **Despesa variável:** "Possui data" (só o dia) ou "Não possui data" (vale para o mês, sem dia).
- **Visão Geral:** tabela com todos os lançamentos individuais, ordenados do mais recente para o mais antigo, com a linha de investimento calculada.
- **Investimento:** define a porcentagem da receita a investir (barra deslizante ou atalhos). O valor investido é descontado do saldo.
- **Gráfico de rosca:** distribuição por categoria/descrição, ajustada conforme a aba. Ao passar o mouse mostra o nome, o valor e a porcentagem em relação ao saldo total.
- **Filtro:** busca pela descrição/nome, aplicada à lista e ao gráfico.
- **Modo claro e escuro:** botão sol/lua no cabeçalho, com a preferência salva no navegador.
- **Data atual** exibida no cabeçalho.

## Tecnologias

- HTML, CSS e JavaScript puro (sem frameworks)
- [Chart.js](https://www.chartjs.org/) para o gráfico
- [Supabase](https://supabase.com/) (Auth + PostgreSQL) acessado direto do navegador pelo `supabase-js`. Não há servidor próprio.
- Hospedagem: GitHub Pages

## Estrutura do projeto

```
Monitor-Financeiro/
├── css/
│   └── style.css     # Estilos, temas (claro/escuro) e layout mobile
├── js/
│   ├── auth.js       # Cliente Supabase, login, cadastro, sessão e logout
│   ├── api.js        # CRUD da tabela transacoes, cards e lista de lançamentos
│   ├── grafico.js    # Gráfico de rosca (Chart.js)
│   └── main.js       # Abas, modais, investimento, tema, data e navegação mobile
├── supabase.sql      # Colunas, políticas de segurança (RLS) e conta de testes
└── index.html        # Página principal
```

## Como rodar

1. Clone o repositório e abra o `index.html` com o **Live Server** (ou publique no GitHub Pages).
2. No painel do Supabase, abra **SQL Editor** e rode o **Bloco 1** de `supabase.sql` (colunas e RLS). Sem o RLS os dados ficam abertos para qualquer pessoa.
3. (Opcional) Conta de testes: crie o usuário em **Authentication → Users → Add user** (`teste@teste.com`, senha `123456`, marque *Auto Confirm User*) e rode o **Bloco 2** de `supabase.sql`.
4. Em **Authentication → URL Configuration**, coloque o endereço do site (ex.: `https://bering7.github.io/Monitor-Financeiro/`) em *Site URL*.
5. Se quiser que o cadastro entre direto, sem e-mail de confirmação, desligue *Confirm email* em **Authentication → Sign In / Providers → Email**.

A URL e a chave pública (`sb_publishable_...`) ficam no topo de `js/auth.js`. A chave pública pode ficar no código; quem protege os dados são as políticas RLS.

## Banco de dados (Supabase)

Tabela `transacoes`: `id`, `user_id`, `descricao`, `valor`, `tipo`, `data`, `categoria`, `futuro`, `sem_data`, `valor_fixo`.

Tipos de lançamento: `receita`, `despesa-fixa` e `despesa-variavel`. Cada usuário só enxerga e altera as próprias linhas (`auth.uid() = user_id`). Receitas de valor não fixo são excluídas pelo app no mês seguinte ao escolhido.

## Dados salvos no navegador

| Chave                     | Uso                                                                  |
|---------------------------|----------------------------------------------------------------------|
| `sb-...-auth-token`       | Sessão de login (gerenciada pelo Supabase; apagada ao clicar em Sair) |
| `porcentagemInvestimento` | Cópia local da porcentagem; a original fica nos metadados da conta   |
| `tema`                    | Tema escolhido (`light` ou `dark`)                                   |

## Próximos passos

- [ ] Navegação por mês/ano
- [ ] Layout responsivo para celular
- [ ] Exportar lançamentos (CSV)
- [x] Autenticação de usuários
- [ ] Recuperação de senha
- [x] Banco de dados persistente (Supabase)

## Autor

Feito por [Bering7](https://github.com/Bering7).