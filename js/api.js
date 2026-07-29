// Substitua pelo nome real do seu web service no Render
const API_URL = 'https://monitor-financeiro-backend.onrender.com/api';
let todasTransacoes = []; // Guarda os dados na memória para usarmos na edição
let idEdicao = null; // Controla se estamos criando (null) ou editando (número)
let porcentagemInvestimento = 0;

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

// Permite ao main.js atualizar a porcentagem e recalcular os cards
function atualizarPorcentagemInvestimento(porcentagem) {
    porcentagemInvestimento = parseFloat(porcentagem) || 0;
    atualizarCardsResumo(todasTransacoes);
}

function atualizarCardsResumo(transacoes) {
    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoes.forEach(t => {
        if (t.tipo === 'receita') {
            totalReceitas += t.valor;
        } else if (t.tipo === 'despesa-fixa' || t.tipo === 'despesa-variavel') {
            totalDespesas += t.valor;
        }
    });

    const valorInvestimento = totalReceitas * (porcentagemInvestimento / 100);
    const saldo = totalReceitas - totalDespesas;

    const elReceita = document.getElementById('card-receita');
    if (elReceita) elReceita.textContent = formatarMoeda(totalReceitas);

    const elDespesas = document.getElementById('card-despesas');
    if (elDespesas) elDespesas.textContent = formatarMoeda(totalDespesas);

    const elSaldo = document.getElementById('card-saldo');
    if (elSaldo) elSaldo.textContent = formatarMoeda(saldo);

    const cardInvestir = document.getElementById('card-investir');
    if (cardInvestir) {
        cardInvestir.textContent = formatarMoeda(valorInvestimento);
    }
}

// ==========================================
// CONTROLAR EXIBIÇÃO DOS BOTÕES DE EXCLUSÃO
// ==========================================
function alternarBotoesExcluir(exibir) {
    const botoesExcluir = document.querySelectorAll('.btn-excluir');
    botoesExcluir.forEach(btn => {
        btn.style.display = exibir ? 'inline-block' : 'none';
    });
}

// ==========================================
// SALVAR OU EDITAR DADOS
// ==========================================
async function salvarTransacao(dados) {
    try {
        const url = idEdicao ? `${API_URL}/transacoes/${idEdicao}` : `${API_URL}/transacoes`;
        const metodo = idEdicao ? 'PUT' : 'POST';

        const resposta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (resposta.ok) {
            idEdicao = null;
            carregarTransacoes(); 
        }
    } catch (erro) {
        console.error("Erro ao salvar:", erro);
    }
}

// ==========================================
// EXCLUIR DADOS
// ==========================================
async function excluirTransacaoAtual() {
    if (!idEdicao) return;

    const confirmar = confirm("Tem certeza de que deseja excluir este item?");
    if (!confirmar) return;

    try {
        const resposta = await fetch(`${API_URL}/transacoes/${idEdicao}`, {
            method: 'DELETE'
        });

        if (resposta.ok) {
            idEdicao = null;
            fecharModal('modal-receita');
            fecharModal('modal-despesa-fixa');
            fecharModal('modal-despesa-variavel');
            carregarTransacoes();
        } else {
            console.error("Erro ao excluir no servidor.");
        }
    } catch (erro) {
        console.error("Erro ao tentar excluir:", erro);
    }
}

// ==========================================
// FUNÇÃO DE ABRIR EDIÇÃO
// ==========================================
function abrirEdicao(id) {
    idEdicao = id;
    const t = todasTransacoes.find(item => item.id === id);
    if (!t) return;
    
    // Mostra os botões de excluir pois estamos em modo de edição
    alternarBotoesExcluir(true);

    if (t.tipo === 'receita') {
        if (document.getElementById('rec-valor')) document.getElementById('rec-valor').value = t.valor;
        if (document.getElementById('rec-data')) document.getElementById('rec-data').value = t.data;
        if (document.getElementById('rec-descricao')) document.getElementById('rec-descricao').value = t.descricao;
        if (document.getElementById('rec-tipo')) document.getElementById('rec-tipo').value = t.categoria;
        if (document.getElementById('rec-futuro')) document.getElementById('rec-futuro').checked = t.flag_futuro;
        abrirModal('modal-receita');
    } else if (t.tipo === 'despesa-fixa') {
        if (document.getElementById('df-valor')) document.getElementById('df-valor').value = t.valor;
        if (document.getElementById('df-vencimento')) document.getElementById('df-vencimento').value = t.data;
        if (document.getElementById('df-descricao')) document.getElementById('df-descricao').value = t.descricao;
        abrirModal('modal-despesa-fixa');
    } else if (t.tipo === 'despesa-variavel') {
        if (document.getElementById('dv-valor')) document.getElementById('dv-valor').value = t.valor;
        if (document.getElementById('dv-data')) document.getElementById('dv-data').value = t.data;
        if (document.getElementById('dv-descricao')) document.getElementById('dv-descricao').value = t.descricao;
        if (document.getElementById('dv-categoria')) document.getElementById('dv-categoria').value = t.categoria;
        if (document.getElementById('dv-parcelado')) document.getElementById('dv-parcelado').checked = t.flag_parcelado;
        abrirModal('modal-despesa-variavel');
    }
}

const btnAddModal = document.getElementById('btn-adicionar');
if (btnAddModal) {
    btnAddModal.addEventListener('click', () => {
        idEdicao = null;
        // Oculta os botões de excluir ao criar um novo registro
        alternarBotoesExcluir(false);
        if (document.getElementById('form-receita')) document.getElementById('form-receita').reset();
        if (document.getElementById('form-despesa-fixa')) document.getElementById('form-despesa-fixa').reset();
        if (document.getElementById('form-despesa-variavel')) document.getElementById('form-despesa-variavel').reset();
    });
}

// ==========================================
// EVENTOS DOS FORMULÁRIOS
// ==========================================
const formRec = document.getElementById('form-receita');
if (formRec) {
    formRec.addEventListener('submit', (e) => {
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
}

const formDF = document.getElementById('form-despesa-fixa');
if (formDF) {
    formDF.addEventListener('submit', (e) => {
        e.preventDefault();
        let valSujo = document.getElementById('df-valor').value;
        let valorLimpo = parseFloat(valSujo.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

        salvarTransacao({
            tipo: 'despesa-fixa', data: document.getElementById('df-vencimento').value,
            valor: valorLimpo, descricao: document.getElementById('df-descricao').value
        });
        fecharModal('modal-despesa-fixa'); e.target.reset();
    });
}

const formDV = document.getElementById('form-despesa-variavel');
if (formDV) {
    formDV.addEventListener('submit', (e) => {
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
}

// ==========================================
// RENDERIZAR LISTA 
// ==========================================
function renderizarLista(transacoes) {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;

    const abaAtivaObj = document.querySelector('.tab-btn.active');
    const abaAtiva = abaAtivaObj ? abaAtivaObj.getAttribute('data-tab') : 'receita';
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
        const partesData = t.data ? t.data.split('-') : [];
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

carregarTransacoes();