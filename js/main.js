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
    });
});


// ==========================================
// CONTROLE DE MODAIS (ABRIR E FECHAR)
// ==========================================
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
    
    // Ao abrir a modal de investimento, atualiza os valores calculando sobre a receita real
    if (id === 'modal-investimento' || id === 'modal-investir') {
        const valorAtual = investRange ? investRange.value : 0;
        atualizarInvestimento(valorAtual);
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
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

// Função auxiliar para somar as Receitas Reais vindas do api.js
function obterReceitaTotalReal() {
    if (typeof todasTransacoes !== 'undefined' && Array.isArray(todasTransacoes)) {
        return todasTransacoes
            .filter(t => t.tipo === 'receita')
            .reduce((total, t) => total + Number(t.valor), 0);
    }
    return 0;
}

function atualizarInvestimento(porcentagem) {
    const porcentagemNum = parseFloat(porcentagem) || 0;

    // 1. Pega a receita REAL cadastrada no sistema
    const receitaReal = obterReceitaTotalReal();
    
    // 2. Atualiza o texto de porcentagem (ex: 20%)
    if (investPercentDisplay) {
        investPercentDisplay.textContent = `${porcentagemNum}%`;
    }
    
    // 3. Calcula o valor em dinheiro com base na RECEITA REAL
    const valorCalculado = (receitaReal * (porcentagemNum / 100));
    
    // 4. Formata para o padrão brasileiro (R$ 0,00)
    if (investValueDisplay) {
        investValueDisplay.textContent = valorCalculado.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    // 5. Sincroniza a posição da barra deslizante
    if (investRange) {
        investRange.value = porcentagemNum;
    }

    // 6. Atualiza o Card da tela principal se a função existir no api.js
    if (typeof atualizarPorcentagemInvestimento === 'function') {
        atualizarPorcentagemInvestimento(porcentagemNum);
    }
}

// Evento: Quando o usuário arrastar a barra manualmente
if (investRange) {
    investRange.addEventListener('input', (e) => {
        atualizarInvestimento(e.target.value);
    });
}

// Evento: Quando o usuário clicar nos botões rápidos de atalho (20%, 30%, 40%, 50%)
btnPercents.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const valor = e.target.getAttribute('data-val');
        atualizarInvestimento(valor);
    });
});