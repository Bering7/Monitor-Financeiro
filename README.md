# Monitor Financeiro
Acesse: [GitHub Pages](https://bering7.github.io/Monitor-Financeiro)

Aplicação web para acompanhar receitas, despesas e investimentos de forma simples e visual, com resumo em cards, tabela de lançamentos e gráfico.

## Funcionalidades

- **Cards de resumo:** receita, investimento, despesas e saldo, sempre atualizados.
- **Lançamentos por tipo:** abas de Receita, Despesa fixa e Despesa variável, com adição, edição e exclusão.
- **Visão Geral:** tabela com todos os lançamentos individuais, ordenados do mais recente para o mais antigo, com a linha de investimento calculada.
- **Investimento:** define a porcentagem da receita a investir (barra deslizante ou atalhos). O valor investido é descontado do saldo.
- **Gráfico de rosca:** distribuição por categoria, ajustada conforme a aba selecionada.
- **Filtro:** busca por descrição e categoria, aplicada à lista e ao gráfico.
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

<!-- TODO: documentar como instalar e iniciar o backend localmente -->

## 🔌 API

Base: `/api`

| Método   | Rota               | Descrição                    |
|----------|--------------------|------------------------------|
| `GET`    | `/transacoes`      | Lista todos os lançamentos   |
| `POST`   | `/transacoes`      | Cria um lançamento           |
| `PUT`    | `/transacoes/:id`  | Atualiza um lançamento       |
| `DELETE` | `/transacoes/:id`  | Remove um lançamento         |

Tipos de lançamento: `receita`, `despesa-fixa` e `despesa-variavel`.

## Dados salvos no navegador

| Chave                     | Uso                                  |
|---------------------------|--------------------------------------|
| `porcentagemInvestimento` | Porcentagem da receita a investir    |
| `tema`                    | Tema escolhido (`light` ou `dark`)   |

## Próximos passos

- [ ] Navegação por mês/ano
- [ ] Layout responsivo para celular
- [ ] Exportar lançamentos (CSV)
- [ ] Autenticação de usuários

## Autor

Feito por [Bering7](https://github.com/Bering7).