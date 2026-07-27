// ==========================================
// CONTROLE DE ABAS (TABS)
// ==========================================
const tabBtns = document.querySelectorAll('.tab-btn');
const tituloAba = document.getElementById('titulo-aba');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 1. Remove a classe 'active' de todos os botões
        tabBtns.forEach(b => b.classList.remove('active'));
        
        // 2. Adiciona a classe 'active' apenas no botão clicado
        btn.classList.add('active');
        
        // 3. Muda o título da lista dinamicamente
        const aba = btn.getAttribute('data-tab');
        if (aba === 'receita') tituloAba.textContent = 'Receitas';
        if (aba === 'despesa-fixa') tituloAba.textContent = 'Despesas Fixas';
        if (aba === 'despesa-variavel') tituloAba.textContent = 'Despesas Variáveis';

        // (Futuramente, aqui chamaremos a API para carregar os dados reais da aba)
    });
});


// ==========================================
// CONTROLE DE MODAIS (ABRIR E FECHAR)
// ==========================================
function abrirModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Fecha a modal automaticamente se o usuário clicar fora dela (no fundo escuro)
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = 'none';
    }
});

// Faz o botão "Adicionar" ser inteligente: ele abre a modal da aba que estiver selecionada
document.getElementById('btn-adicionar').addEventListener('click', () => {
    const abaAtiva = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    abrirModal(`modal-${abaAtiva}`);
});


// ==========================================
// LÓGICA DO INVESTIMENTO (BARRA DESLIZANTE)
// ==========================================
const investRange = document.getElementById('invest-range');
const investPercentDisplay = document.getElementById('invest-percent-display');
const investValueDisplay = document.getElementById('invest-value-display');
const btnPercents = document.querySelectorAll('.btn-percent');

// Variável temporária simulando que você tem R$ 5.000 de receita (substituiremos pelo Banco de Dados depois)
let receitaTotalSimulada = 5000.00; 

function atualizarInvestimento(porcentagem) {
    // 1. Atualiza o texto gigante da porcentagem (ex: 20%)
    investPercentDisplay.textContent = `${porcentagem}%`;
    
    // 2. Calcula o valor em dinheiro
    const valorCalculado = (receitaTotalSimulada * (porcentagem / 100));
    
    // 3. Formata para o padrão brasileiro (R$ 1.000,00)
    investValueDisplay.textContent = valorCalculado.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    // 4. Sincroniza a bolinha da barra deslizante
    investRange.value = porcentagem;
}

// Evento: Quando o usuário arrastar a barra manualmente
investRange.addEventListener('input', (e) => {
    atualizarInvestimento(e.target.value);
});

// Evento: Quando o usuário clicar nos botões rápidos de atalho (20%, 30%, 40%, 50%)
btnPercents.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const valor = e.target.getAttribute('data-val');
        atualizarInvestimento(valor);
    });
});