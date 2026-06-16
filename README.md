# 📊 Monitor Financeiro Inteligente - Multi-Extratos
[Link do GitHub Pages](https://bering7.github.io/Monitor-Financeiro/)

Um centralizador financeiro inteligente e automatizado que unifica a leitura de extratos bancários de diferentes instituições, consolidando dados de forma visual e intuitiva em um único painel.

O projeto foi desenvolvido utilizando uma arquitetura moderna e desacoplada, dividida entre uma API de processamento de dados (Backend) e uma interface de usuário responsiva (Frontend).

---

## 🚀 Funcionalidades Principais

* **Leitura Multi-Extratos Simultânea:** Suporte para upload e processamento de um ou mais arquivos de extratos simultaneamente (combinando diferentes bancos na mesma análise).
* **Detecção Automática de Provedor:** O sistema analisa a estrutura dos arquivos importados e identifica automaticamente a origem (ex: Nubank, Banco Inter, PicPay), adaptando delimitadores e codificações (`UTF-8` / `Latin-1`) sem intervenção do usuário.
* **Motor de Categorização Inteligente:** Processamento de descrições textuais das transações para categorização automática (Alimentação, Transporte, Saúde, Lazer, Renda, Pix, etc.).
* **Dashboard Dinâmico:** Exibição gráfica em formato de rosca detalhando os gastos por categoria e cards informativos com o balanço total (Entradas, Saídas e Saldo Final líquido).
* **Origem Transparente:** Quando múltiplos extratos são consolidados, a tabela de transações injeta dinamicamente identificadores visuais indicando a qual instituição pertence cada movimentação.

---

## 🛠️ Tecnologias Utilizadas

### **Frontend**
* **HTML5 & CSS3:** Estrutura e estilização moderna com suporte a modo escuro nativo (*Dark Mode*).
* **JavaScript (ES6+):** Manipulação assíncrona do DOM e requisições via `Fetch API` para comunicação com o servidor.
* **Chart.js:** Biblioteca utilizada para a renderização e animação dos gráficos estatísticos de consumo.

### **Backend**
* **Python:** Linguagem base para engenharia de dados.
* **Flask:** Micro-framework utilizado para construir a API REST que recebe e processa os dados.
* **Pandas:** Biblioteca de análise de dados massiva utilizada para ler, limpar, filtrar e concatenar os DataFrames dos extratos.
* **Flask-CORS:** Mecanismo de segurança para permitir o tráfego de dados entre servidores distintos de Frontend e Backend.

---

## 🏗️ Arquitetura e Deploy

O projeto segue o modelo de **Desacoplamento de Aplicação**, permitindo escalabilidade e independência de hospedagem:

1.  **Interface de Usuário (Frontend):** Hospedada de forma estática no **GitHub Pages**, garantindo carregamento rápido e disponibilidade contínua.
2.  **Motor de Processamento (Backend):** Hospedado de forma autônoma na plataforma **Render**, processando as requisições em nuvem e devolvendo payloads padronizados em JSON.

---

## 👤 Autor

Desenvolvido com foco em engenharia de software e análise de dados. Sinta-se à vontade para explorar o código ou entrar em contato para sugestões de melhorias!