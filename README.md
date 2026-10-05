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
- Backend em `backend/`, hospedado no [Render](https://render.com/) <!-- TODO: informar a stack do backend (ex.: Node.js + Express + banco de dados) -->

## Estrutura do projeto

```
Monitor-Financeiro/
├── backend/          # API que armazena os lançamentos
├── css/
│   └── style.css     # Estilos e temas (claro/escuro)
├── js/
│   ├── auth.js       # Login, cadastro, sessão e logout
│   ├── api.js        # Comunicação com a API, cards e lista de lançamentos
│   ├── grafico.js    # Gráfico de rosca (Chart.js)
│   └── main.js       # Abas, modais, investimento, tema e data
└── index.html        # Página principal
```

## Como rodar

### Frontend

1. Clone o repositório:
   ```bash
   git clone https://github.com/Bering7/Monitor-Financeiro.git
   cd Monitor-Financeiro
   ```
2. Abra o `index.html` com uma extensão de servidor local, como o **Live Server** ou o **Live Preview** do VS Code.

Por padrão, o frontend usa a API hospedada no Render. Para usar outra, altere a constante `API_URL` no início de `js/api.js`.

> O backend no plano gratuito do Render pode demorar alguns segundos para responder na primeira requisição, pois a instância "hiberna" quando fica sem uso.

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

O servidor sobe em `http://127.0.0.1:5000`. Para usá-lo, aponte a `API_URL` de `js/api.js` para `http://127.0.0.1:5000/api`.

**Variáveis de ambiente**

| Variável     | Uso                                                                                          |
|--------------|----------------------------------------------------------------------------------------------|
| `SECRET_KEY` | **Obrigatória em produção.** Texto longo e aleatório que assina os logins. Defina no Render. |
| `DB_PATH`    | Opcional. Caminho do arquivo do banco SQLite (padrão: `backend/banco.db`).                   |
| `CRIAR_CONTA_TESTE` | Opcional. `0` desliga a conta de testes (padrão: ligada).                             |

Para gerar uma chave: `python -c "import secrets; print(secrets.token_hex(32))"`.

**Conta de testes:** na primeira inicialização o backend cria `teste@teste.com` (senha `123`) com dados fictícios. Ela só é criada se não existir, então o que você apagar nela não volta a cada reinício. Qualquer outra conta criada pelo cadastro começa vazia.

> A senha da conta de testes é pública. Use-a só para testar e defina `CRIAR_CONTA_TESTE=0` quando for usar o app de verdade.

**Persistência:** o banco é um arquivo SQLite (nunca em memória). No plano gratuito do Render o disco é temporário e é apagado a cada deploy e reinício. Para manter os dados, use um disco persistente (aponte `DB_PATH` para ele, ex.: `/var/data/banco.db`) ou um banco externo.

> Não versione o `banco.db`: ele guarda contas e senhas (criptografadas). O `.gitignore` do projeto já o ignora.

## 🔌 API

Base: `/api`

| Método   | Rota               | Auth | Descrição                                   |
|----------|--------------------|------|---------------------------------------------|
| `POST`   | `/registro`        | não  | Cria uma conta e devolve o token de login   |
| `POST`   | `/login`           | não  | Entra na conta e devolve o token de login   |
| `GET`    | `/perfil`          | sim  | E-mail e porcentagem de investimento        |
| `PUT`    | `/perfil`          | sim  | Atualiza a porcentagem de investimento      |
| `GET`    | `/transacoes`      | sim  | Lista os lançamentos do usuário logado      |
| `POST`   | `/transacoes`      | sim  | Cria um lançamento                          |
| `PUT`    | `/transacoes/:id`  | sim  | Atualiza um lançamento                      |
| `DELETE` | `/transacoes/:id`  | sim  | Remove um lançamento                        |

Rotas com **Auth: sim** exigem o cabeçalho `Authorization: Bearer <token>`. Cada usuário só enxerga e altera os próprios lançamentos.

Tipos de lançamento: `receita`, `despesa-fixa` e `despesa-variavel`.

## Dados salvos no navegador

| Chave                     | Uso                                                                 |
|---------------------------|---------------------------------------------------------------------|
| `tokenAuth`               | Token de login (apagado ao clicar em **Sair**)                      |
| `emailUsuario`            | E-mail exibido no cabeçalho                                         |
| `porcentagemInvestimento` | Cópia local da porcentagem; a original fica salva na conta          |
| `tema`                    | Tema escolhido (`light` ou `dark`)                                  |

## Próximos passos

- [ ] Navegação por mês/ano
- [ ] Layout responsivo para celular
- [ ] Exportar lançamentos (CSV)
- [x] Autenticação de usuários
- [ ] Recuperação de senha
- [ ] Banco de dados persistente em produção (o disco do Render gratuito é temporário)

## Autor

Feito por [Bering7](https://github.com/Bering7).