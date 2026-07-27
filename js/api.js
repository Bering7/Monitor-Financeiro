// Substitua "seu-app" pelo nome real do seu web service no Render
const API_URL = 'https://SEU-APP-NO-RENDER.onrender.com/api';
let todasTransacoes = []; // Guarda os dados na memória para usarmos na edição
let idEdicao = null; // Controla se estamos criando (null) ou editando (número)

function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ==========================================
// BUSCAR DADOS
// ==========================================
async function carregarTransacoes() {
    try {
        const resposta = await fetch(`${API_URL}/transacoes`);
        todasTransacoes = await resposta.json();
        
        atualizarCardsResumo(todasTransacoes);
        renderizarLista(todasTransacoes);
        
        window.dispatchEvent(new CustomEvent('dadosCarregados', { detail: todasTransacoes }));
    } catch (erro) {
        console.error("Erro ao buscar:", erro);
    }
}

function atualizarCardsResumo(transacoes) {
    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach(t => {
        if (t.tipo === 'receita') totalReceitas += t.valor;
        else if (t.tipo === 'despesa-fixa' || t.tipo === 'despesa-variavel') totalDespesas += t.valor;
    });

    const saldo = totalReceitas - totalDespesas;
    document.getElementById('card-receita').textContent = formatarMoeda(totalReceitas);
    document.getElementById('card-despesas').textContent = formatarMoeda(totalDespesas);
    document.getElementById('card-saldo').textContent = formatarMoeda(saldo);
}

// ==========================================
// SALVAR OU EDITAR DADOS
// ==========================================
async function salvarTransacao(dados) {
    try {
        // Se idEdicao estiver preenchido, ele ATUALIZA (PUT). Se for nulo, ele CRIA (POST).
        const url = idEdicao ? `${API_URL}/transacoes/${idEdicao}` : `${API_URL}/transacoes`;
        const metodo = idEdicao ? 'PUT' : 'POST';

        const resposta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (resposta.ok) {
            idEdicao = null; // Limpa o modo de edição
            carregarTransacoes(); 
        }
    } catch (erro) {
        console.error("Erro ao salvar:", erro);
    }
}

// ==========================================
// FUNÇÃO DE ABRIR EDIÇÃO
// ==========================================
function abrirEdicao(id) {
    idEdicao = id;
    const t = todasTransacoes.find(item => item.id === id);
    
    // Preenche a modal correspondente com os dados daquele item
    if (t.tipo === 'receita') {
        document.getElementById('rec-valor').value = t.valor;
        document.getElementById('rec-data').value = t.data;
        document.getElementById('rec-descricao').value = t.descricao;
        document.getElementById('rec-tipo').value = t.categoria;
        document.getElementById('rec-futuro').checked = t.flag_futuro;
        abrirModal('modal-receita');
    } else if (t.tipo === 'despesa-fixa') {
        document.getElementById('df-valor').value = t.valor;
        document.getElementById('df-vencimento').value = t.data;
        document.getElementById('df-descricao').value = t.descricao;
        abrirModal('modal-despesa-fixa');
    } else if (t.tipo === 'despesa-variavel') {
        document.getElementById('dv-valor').value = t.valor;
        document.getElementById('dv-data').value = t.data;
        document.getElementById('dv-descricao').value = t.descricao;
        document.getElementById('dv-categoria').value = t.categoria;
        document.getElementById('dv-parcelado').checked = t.flag_parcelado;
        abrirModal('modal-despesa-variavel');
    }
}

// Garante que o botão "+ Adicionar" resete tudo para não editar sem querer
document.getElementById('btn-adicionar').addEventListener('click', () => {
    idEdicao = null;
    document.getElementById('form-receita').reset();
    document.getElementById('form-despesa-fixa').reset();
    document.getElementById('form-despesa-variavel').reset();
});

// ==========================================
// EVENTOS DOS FORMULÁRIOS
// ==========================================
document.getElementById('form-receita').addEventListener('submit', (e) => {
    e.preventDefault();
    let valSujo = document.getElementById('rec-valor').value;
    let valorLimpo = parseFloat(valSujo.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

    salvarTransacao({
        tipo: 'receita', data: document.getElementById('rec-data').value,
        valor: valorLimpo, descricao: document.getElementById('rec-descricao').value,
        categoria: document.getElementById('rec-tipo').value, flag_futuro: document.getElementById('rec-futuro').checked
    });
    fecharModal('modal-receita'); e.target.reset();
});

document.getElementById('form-despesa-fixa').addEventListener('submit', (e) => {
    e.preventDefault();
    let valSujo = document.getElementById('df-valor').value;
    let valorLimpo = parseFloat(valSujo.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

    salvarTransacao({
        tipo: 'despesa-fixa', data: document.getElementById('df-vencimento').value,
        valor: valorLimpo, descricao: document.getElementById('df-descricao').value
    });
    fecharModal('modal-despesa-fixa'); e.target.reset();
});

document.getElementById('form-despesa-variavel').addEventListener('submit', (e) => {
    e.preventDefault();
    let valSujo = document.getElementById('dv-valor').value;
    let valorLimpo = parseFloat(valSujo.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

    salvarTransacao({
        tipo: 'despesa-variavel', data: document.getElementById('dv-data').value,
        valor: valorLimpo, descricao: document.getElementById('dv-descricao').value,
        categoria: document.getElementById('dv-categoria').value, flag_parcelado: document.getElementById('dv-parcelado').checked
    });
    fecharModal('modal-despesa-variavel'); e.target.reset();
});

// ==========================================
// RENDERIZAR LISTA 
// ==========================================
function renderizarLista(transacoes) {
    const listContainer = document.getElementById('list-container');
    const abaAtiva = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    const transacoesAba = transacoes.filter(t => t.tipo === abaAtiva);
    
    if (transacoesAba.length === 0) {
        listContainer.innerHTML = `<div class="empty-state"><p>Sem dados neste período.</p></div>`;
        return;
    }
    listContainer.innerHTML = ''; 
    
    const cabecalho = document.createElement('div');
    const textoData = abaAtiva === 'despesa-fixa' ? 'Vencimento' : 'Data';
    cabecalho.style = "display: flex; justify-content: space-between; padding-bottom: 12px; margin-bottom: 4px; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 13px; font-weight: 600;";
    cabecalho.innerHTML = `<div style="display: flex; gap: 24px;"><span style="min-width: 90px;">${textoData}</span><span>Nome</span></div><span>Valor</span>`;
    listContainer.appendChild(cabecalho);
    
    transacoesAba.forEach(t => {
        const partesData = t.data.split('-');
        const dataFormatada = partesData.length === 3 ? `${partesData[2]}/${partesData[1]}/${partesData[0]}` : t.data;
        const isReceita = t.tipo === 'receita';
        const corValor = isReceita ? 'var(--color-green)' : 'var(--text-main)';
        const sinal = isReceita ? '+' : '-';

        const item = document.createElement('div');
        item.style = "display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border-color); align-items: center;";
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 24px;">
                <span style="font-size: 14px; color: var(--text-muted); min-width: 90px; font-weight: 500;">${dataFormatada}</span>
                <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">${t.descricao}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: 600; color: ${corValor}; font-size: 15px;">
                    ${sinal} ${formatarMoeda(t.valor)}
                </span>
                <button onclick="abrirEdicao(${t.id})" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 4px;" title="Editar">
                    <!-- Ícone de Lápis definitivo -->
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => carregarTransacoes());
});

carregarTransacoes();