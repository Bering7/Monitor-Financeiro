// Substitua pelo nome real do seu web service no Render
const API_URL = 'https://monitor-financeiro-backend.onrender.com/api';
let todasTransacoes = []; // Guarda os dados na memória para usarmos na edição
let idEdicao = null; // Controla se estamos criando (null) ou editando (número)
let porcentagemInvestimento = parseFloat(localStorage.getItem('porcentagemInvestimento')) || 0;

function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ==========================================
// BUSCAR DADOS
// ==========================================
async function carregarTransacoes() {
    try {
        const resposta = await authFetch(`${API_URL}/transacoes`);
        if (!resposta.ok) return; // 401: o authFetch já voltou para a tela de login
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
    renderizarLista(todasTransacoes);
    if (typeof atualizarGrafico === 'function') {
        atualizarGrafico();
    }
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
    // O valor investido sai do saldo disponível (Receita - Despesas - Investimento)
    const saldo = totalReceitas - totalDespesas - valorInvestimento;

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

        const resposta = await authFetch(url, {
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
        const resposta = await authFetch(`${API_URL}/transacoes/${idEdicao}`, {
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
// CONTROLE DE FILTRO
// ==========================================
let filtroAtivo = { descricao: '', categoria: '' };

const btnFiltro = document.getElementById('btn-filtro');
if (btnFiltro) {
    btnFiltro.addEventListener('click', () => {
        const inputDesc = document.getElementById('filtro-descricao');
        const inputCat = document.getElementById('filtro-categoria');
        if (inputDesc) inputDesc.value = filtroAtivo.descricao;
        if (inputCat) inputCat.value = filtroAtivo.categoria;
        abrirModal('modal-filtro');
    });
}

const formFiltro = document.getElementById('form-filtro');
if (formFiltro) {
    formFiltro.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputDesc = document.getElementById('filtro-descricao');
        const inputCat = document.getElementById('filtro-categoria');
        filtroAtivo.descricao = inputDesc ? inputDesc.value.toLowerCase().trim() : '';
        filtroAtivo.categoria = inputCat ? inputCat.value.toLowerCase().trim() : '';
        fecharModal('modal-filtro');
        renderizarLista(todasTransacoes);
        if (typeof atualizarGrafico === 'function') {
            atualizarGrafico();
        }
    });
}

const btnLimparFiltro = document.getElementById('btn-limpar-filtro');
if (btnLimparFiltro) {
    btnLimparFiltro.addEventListener('click', () => {
        filtroAtivo.descricao = '';
        filtroAtivo.categoria = '';
        const formFiltroEl = document.getElementById('form-filtro');
        if (formFiltroEl) formFiltroEl.reset();
        fecharModal('modal-filtro');
        renderizarLista(todasTransacoes);
        if (typeof atualizarGrafico === 'function') {
            atualizarGrafico();
        }
    });
}

// Reset filter on tab change
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        filtroAtivo.descricao = '';
        filtroAtivo.categoria = '';
        const formFiltroEl = document.getElementById('form-filtro');
        if (formFiltroEl) formFiltroEl.reset();
        // Dados já estão em memória: só redesenha a lista (o gráfico se atualiza pelo grafico.js)
        renderizarLista(todasTransacoes);
    });
});

// ==========================================
// RENDERIZAR ABA GERAL (todos os lançamentos, sem somar)
// ==========================================
function escaparHTML(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatarDataBR(data) {
    const partes = data ? data.split('-') : [];
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : (data || '');
}

function renderizarListaGeral(transacoes) {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;

    // Configuração visual de cada tipo (mesmas cores usadas no resto do app)
    const TIPOS = {
        'receita':          { rotulo: 'Receita',          cor: 'var(--color-green)', sinal: '+' },
        'despesa-fixa':     { rotulo: 'Despesa fixa',     cor: 'var(--color-red)',   sinal: '-' },
        'despesa-variavel': { rotulo: 'Despesa variável', cor: '#f97316',            sinal: '-' },
        'investimento':     { rotulo: 'Investimento',     cor: 'var(--color-blue)',  sinal: ''  }
    };

    // 1. Aplica o filtro e mantém cada lançamento individual
    const lancamentos = transacoes.filter(t => {
        if (!TIPOS[t.tipo]) return false;
        const matchDesc = filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
        const matchCat = filtroAtivo.categoria === '' || (t.categoria && t.categoria.toLowerCase().includes(filtroAtivo.categoria));
        return matchDesc && matchCat;
    });

    // 2. Mais recentes primeiro
    lancamentos.sort((a, b) => {
        const da = a.data || '';
        const db = b.data || '';
        if (da !== db) return da < db ? 1 : -1;
        return (b.id || 0) - (a.id || 0);
    });

    // 3. Linha de Investimento (calculada pela % escolhida sobre a receita filtrada)
    const totalReceitas = lancamentos
        .filter(t => t.tipo === 'receita')
        .reduce((soma, t) => soma + (Number(t.valor) || 0), 0);
    const valorInvestimento = totalReceitas * (porcentagemInvestimento / 100);
    const semFiltroAtivo = filtroAtivo.descricao === '' && filtroAtivo.categoria === '';
    const mostrarInvestimento = semFiltroAtivo && valorInvestimento > 0;

    if (lancamentos.length === 0 && !mostrarInvestimento) {
        listContainer.innerHTML = `<div class="empty-state"><p>Nenhum lançamento cadastrado.</p></div>`;
        return;
    }

    const colunas = "display: grid; grid-template-columns: 95px 1fr 130px 150px 28px; gap: 12px; align-items: center;";
    listContainer.innerHTML = '';

    const cabecalho = document.createElement('div');
    cabecalho.style = `${colunas} padding-bottom: 12px; margin-bottom: 4px; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 13px; font-weight: 600;`;
    cabecalho.innerHTML = `<span>Data</span><span>Descrição</span><span>Tipo</span><span style="text-align: right;">Valor</span><span></span>`;
    listContainer.appendChild(cabecalho);

    const criarLinha = ({ data, descricao, categoria, tipo, valor, id }) => {
        const cfg = TIPOS[tipo];
        const sinalStr = cfg.sinal ? `${cfg.sinal} ` : '';
        const botaoEditar = id !== undefined ? `
            <button onclick="abrirEdicao(${id})" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 4px;" title="Editar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>` : '';
        const subcategoria = categoria
            ? `<span style="display: block; font-size: 12px; font-weight: 500; color: var(--text-muted); margin-top: 2px;">${escaparHTML(categoria)}</span>`
            : '';

        const item = document.createElement('div');
        item.style = `${colunas} padding: 14px 0; border-bottom: 1px solid var(--border-color);`;
        item.innerHTML = `
            <span style="font-size: 14px; color: var(--text-muted); font-weight: 500;">${data ? formatarDataBR(data) : '—'}</span>
            <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">${escaparHTML(descricao)}${subcategoria}</span>
            <span><span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: ${cfg.cor}; background-color: color-mix(in srgb, ${cfg.cor} 12%, transparent);">${cfg.rotulo}</span></span>
            <span style="text-align: right; font-weight: 600; color: ${cfg.cor}; font-size: 15px;">${sinalStr}${formatarMoeda(valor)}</span>
            <span>${botaoEditar}</span>
        `;
        listContainer.appendChild(item);
    };

    lancamentos.forEach(t => criarLinha({
        data: t.data,
        descricao: t.descricao,
        categoria: t.tipo === 'despesa-fixa' ? '' : t.categoria,
        tipo: t.tipo,
        valor: t.valor,
        id: t.id
    }));

    if (mostrarInvestimento) {
        criarLinha({
            descricao: `Investimento (${porcentagemInvestimento}% da receita)`,
            tipo: 'investimento',
            valor: valorInvestimento
        });
    }
}

// ==========================================
// RENDERIZAR LISTA 
// ==========================================
function renderizarLista(transacoes) {
    const listContainer = document.getElementById('list-container');
    if (!listContainer) return;

    const abaAtivaObj = document.querySelector('.tab-btn.active');
    const abaAtiva = abaAtivaObj ? abaAtivaObj.getAttribute('data-tab') : 'geral';
    
    const btnAdicionar = document.getElementById('btn-adicionar');
    if (btnAdicionar) {
        btnAdicionar.style.display = (abaAtiva === 'geral') ? 'none' : 'flex';
    }

    if (abaAtiva === 'geral') {
        renderizarListaGeral(transacoes);
        return;
    }
    
    const transacoesAba = transacoes.filter(t => {
        if (t.tipo !== abaAtiva) return false;
        const matchDesc = filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
        const matchCat = filtroAtivo.categoria === '' || (t.categoria && t.categoria.toLowerCase().includes(filtroAtivo.categoria));
        return matchDesc && matchCat;
    });
    
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
                <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">${escaparHTML(t.descricao)}</span>
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

// Só carrega os dados depois de confirmar que há uma conta logada (definido no auth.js)
iniciarSessao();