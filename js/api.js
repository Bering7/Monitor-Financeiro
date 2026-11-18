let todasTransacoes = []; // Guarda os dados na memória para usarmos na edição
let idEdicao = null; // Controla se estamos criando (null) ou editando (id do lançamento)
let porcentagemInvestimento = parseFloat(localStorage.getItem('porcentagemInvestimento')) || 0;

function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ==========================================
// BUSCAR DADOS
// ==========================================
// Sessão vencida ou token inválido: volta para o login
function tratarErroSupabase(erro) {
    console.error('Erro do Supabase:', erro);
    if (erro && (erro.status === 401 || /jwt/i.test(erro.message || ''))) {
        supabaseClient.auth.signOut();
        limparSessao();
        mostrarTelaAuth();
    }
}

async function carregarTransacoes() {
    try {
        // Receita de valor NÃO fixo é excluída automaticamente no mês seguinte ao mês escolhido
        const primeiroDiaDoMes = hojeISO().slice(0, 7) + '-01';
        const limpeza = await supabaseClient.from('transacoes').delete()
            .eq('tipo', 'receita')
            .eq('valor_fixo', false)
            .lt('data', primeiroDiaDoMes);
        if (limpeza.error) console.error('Erro na limpeza automática:', limpeza.error);

        // O RLS do Supabase já devolve só as linhas do usuário logado
        const { data, error } = await supabaseClient
            .from('transacoes')
            .select('*')
            .order('data', { ascending: false });
        if (error) { tratarErroSupabase(error); return; }

        // O banco chama a coluna de "futuro"; o restante do app usa "flag_futuro"
        todasTransacoes = (data || []).map(t => ({
            ...t,
            data: (t.data || '').slice(0, 10),
            flag_futuro: t.futuro
        }));
        
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

// Receita marcada como "Recebimento futuro" só conta quando o dia e o mês definidos chegam
function receitaPendente(t) {
    return t.tipo === 'receita' && !!t.flag_futuro && (t.data || '') > hojeISO();
}

// Selo "Futuro" exibido ao lado das receitas ainda não recebidas
function seloFuturo(t) {
    return receitaPendente(t)
        ? `<span class="badge-futuro" title="Entra no saldo em ${formatarDataBR(t.data)}">Futuro</span>`
        : '';
}

// Totais usados nos cards, no investimento e na porcentagem do gráfico
function calcularResumo(transacoes) {
    let receitas = 0;
    let despesas = 0;

    (transacoes || []).forEach(t => {
        const valor = Number(t.valor) || 0;
        if (t.tipo === 'receita') {
            if (!receitaPendente(t)) receitas += valor; // ignora recebimento futuro
        } else if (t.tipo === 'despesa-fixa' || t.tipo === 'despesa-variavel') {
            despesas += valor;
        }
    });

    const investimento = receitas * (porcentagemInvestimento / 100);
    // O valor investido sai do saldo disponível (Receita - Despesas - Investimento)
    return { receitas, despesas, investimento, saldo: receitas - despesas - investimento };
}

// Usado pelo grafico.js para calcular a porcentagem do tooltip
function obterResumo() {
    return calcularResumo(todasTransacoes);
}

function atualizarCardsResumo(transacoes) {
    const { receitas, despesas, investimento, saldo } = calcularResumo(transacoes);

    const elReceita = document.getElementById('card-receita');
    if (elReceita) elReceita.textContent = formatarMoeda(receitas);

    const elDespesas = document.getElementById('card-despesas');
    if (elDespesas) elDespesas.textContent = formatarMoeda(despesas);

    const elSaldo = document.getElementById('card-saldo');
    if (elSaldo) elSaldo.textContent = formatarMoeda(saldo);

    const cardInvestir = document.getElementById('card-investir');
    if (cardInvestir) cardInvestir.textContent = formatarMoeda(investimento);
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
        const { flag_futuro, ...resto } = dados;
        const registro = { ...resto, futuro: !!flag_futuro }; // coluna do banco: "futuro"

        let resposta;
        if (idEdicao) {
            resposta = await supabaseClient.from('transacoes').update(registro).eq('id', idEdicao);
        } else {
            const { data: { session } } = await supabaseClient.auth.getSession();
            resposta = await supabaseClient.from('transacoes').insert({ ...registro, user_id: session.user.id });
        }

        if (resposta.error) {
            tratarErroSupabase(resposta.error);
            alert('Não foi possível salvar. Tente novamente.');
            return;
        }

        idEdicao = null;
        carregarTransacoes();
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
        const { error } = await supabaseClient.from('transacoes').delete().eq('id', idEdicao);

        if (error) {
            tratarErroSupabase(error);
            return;
        }

        idEdicao = null;
        fecharModal('modal-receita');
        fecharModal('modal-despesa-fixa');
        fecharModal('modal-despesa-variavel');
        carregarTransacoes();
    } catch (erro) {
        console.error("Erro ao tentar excluir:", erro);
    }
}

// ==========================================
// LEITURA E ESCRITA DOS CAMPOS
// ==========================================
let anoMesEdicao = null; // mês original do lançamento em edição (o dia pode mudar, o mês não)

// 1000.5 -> "1000,50". Evita que o ponto decimal seja lido como separador de milhar ao salvar.
function valorParaCampo(valor) {
    return (Number(valor) || 0).toFixed(2).replace('.', ',');
}

// Aceita "1.234,56", "1234,56", "R$ 50" e "50.5"
function lerValorCampo(texto) {
    let s = String(texto ?? '').replace(/R\$/g, '').replace(/\s/g, '');
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');   // formato brasileiro
    } else if (!/^\d+\.\d{1,2}$/.test(s)) {
        s = s.replace(/\./g, '');                      // ponto como milhar (1.000)
    }
    return parseFloat(s);
}

function diaDaData(data) {
    return parseInt((data || '').slice(8, 10), 10) || 1;
}

// Novo lançamento usa o mês atual; edição mantém o mês que o lançamento já tinha
function mesDeReferencia() {
    return idEdicao && anoMesEdicao ? anoMesEdicao : anoMesAtual();
}

// ==========================================
// FUNÇÃO DE ABRIR EDIÇÃO
// ==========================================
function abrirEdicao(id) {
    const t = todasTransacoes.find(item => String(item.id) === String(id));
    if (!t) return;

    idEdicao = t.id;
    anoMesEdicao = (t.data || '').slice(0, 7) || anoMesAtual();

    // Mostra os botões de excluir pois estamos em modo de edição
    alternarBotoesExcluir(true);

    if (t.tipo === 'receita') {
        const naoFixo = t.valor_fixo === 0 || t.valor_fixo === false;
        document.getElementById('rec-valor').value = valorParaCampo(t.valor);
        document.getElementById('rec-descricao').value = t.descricao;
        document.getElementById('rec-tipo').value = t.categoria || '';
        document.getElementById('rec-dia').value = diaDaData(t.data);
        document.getElementById('rec-nao-fixo').checked = naoFixo;
        preencherOpcoesMes(anoMesEdicao);
        document.getElementById('rec-futuro').checked = !!t.flag_futuro;
        atualizarCamposReceita();
        abrirModal('modal-receita');
    } else if (t.tipo === 'despesa-fixa') {
        document.getElementById('df-valor').value = valorParaCampo(t.valor);
        document.getElementById('df-descricao').value = t.descricao;
        document.getElementById('df-dia').value = diaDaData(t.data);
        abrirModal('modal-despesa-fixa');
    } else if (t.tipo === 'despesa-variavel') {
        const semData = !!t.sem_data;
        document.getElementById('dv-valor').value = valorParaCampo(t.valor);
        document.getElementById('dv-descricao').value = t.descricao;
        document.getElementById('dv-dia').value = semData ? new Date().getDate() : diaDaData(t.data);
        document.querySelector(`input[name="dv-data-opcao"][value="${semData ? 'sem' : 'com'}"]`).checked = true;
        atualizarCamposDespesaVariavel();
        abrirModal('modal-despesa-variavel');
    }
}

const btnAddModal = document.getElementById('btn-adicionar');
if (btnAddModal) {
    btnAddModal.addEventListener('click', () => {
        idEdicao = null;
        anoMesEdicao = null;
        // Oculta os botões de excluir ao criar um novo registro
        alternarBotoesExcluir(false);
        if (document.getElementById('form-receita')) document.getElementById('form-receita').reset();
        if (document.getElementById('form-despesa-fixa')) document.getElementById('form-despesa-fixa').reset();
        if (document.getElementById('form-despesa-variavel')) document.getElementById('form-despesa-variavel').reset();
        // Dia de hoje, mês atual e campos no estado padrão (função do main.js)
        if (typeof prepararFormulariosNovos === 'function') prepararFormulariosNovos();
    });
}

// ==========================================
// EVENTOS DOS FORMULÁRIOS
// ==========================================
const formRec = document.getElementById('form-receita');
if (formRec) {
    formRec.addEventListener('submit', (e) => {
        e.preventDefault();
        const valor = lerValorCampo(document.getElementById('rec-valor').value);
        if (!(valor > 0)) { alert('Informe um valor válido, maior que zero.'); return; }

        // Valor não fixo: o usuário escolhe dia e mês. Fixo: só o dia (mês e ano são os atuais).
        const naoFixo = document.getElementById('rec-nao-fixo').checked;
        const anoMes = naoFixo ? document.getElementById('rec-mes').value : mesDeReferencia();

        salvarTransacao({
            tipo: 'receita',
            data: montarData(anoMes, document.getElementById('rec-dia').value),
            valor: valor,
            descricao: document.getElementById('rec-descricao').value,
            categoria: document.getElementById('rec-tipo').value,
            flag_futuro: document.getElementById('rec-futuro').checked,
            valor_fixo: !naoFixo
        });
        fecharModal('modal-receita'); e.target.reset();
    });
}

const formDF = document.getElementById('form-despesa-fixa');
if (formDF) {
    formDF.addEventListener('submit', (e) => {
        e.preventDefault();
        const valor = lerValorCampo(document.getElementById('df-valor').value);
        if (!(valor > 0)) { alert('Informe um valor válido, maior que zero.'); return; }

        salvarTransacao({
            tipo: 'despesa-fixa',
            data: montarData(mesDeReferencia(), document.getElementById('df-dia').value),
            valor: valor,
            descricao: document.getElementById('df-descricao').value
        });
        fecharModal('modal-despesa-fixa'); e.target.reset();
    });
}

const formDV = document.getElementById('form-despesa-variavel');
if (formDV) {
    formDV.addEventListener('submit', (e) => {
        e.preventDefault();
        const valor = lerValorCampo(document.getElementById('dv-valor').value);
        if (!(valor > 0)) { alert('Informe um valor válido, maior que zero.'); return; }

        // "Não possui data": vale para o mês, sem dia específico (guardado como dia 1 + sem_data)
        const possuiData = document.querySelector('input[name="dv-data-opcao"]:checked').value === 'com';
        const anoMes = mesDeReferencia();

        salvarTransacao({
            tipo: 'despesa-variavel',
            data: possuiData ? montarData(anoMes, document.getElementById('dv-dia').value) : `${anoMes}-01`,
            valor: valor,
            descricao: document.getElementById('dv-descricao').value,
            sem_data: !possuiData
        });
        fecharModal('modal-despesa-variavel'); e.target.reset();
    });
}

// ==========================================
// CONTROLE DE FILTRO (somente por descrição / nome)
// ==========================================
let filtroAtivo = { descricao: '' };

const btnFiltro = document.getElementById('btn-filtro');
if (btnFiltro) {
    btnFiltro.addEventListener('click', () => {
        const inputDesc = document.getElementById('filtro-descricao');
        if (inputDesc) inputDesc.value = filtroAtivo.descricao;
        abrirModal('modal-filtro');
    });
}

const formFiltro = document.getElementById('form-filtro');
if (formFiltro) {
    formFiltro.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputDesc = document.getElementById('filtro-descricao');
        filtroAtivo.descricao = inputDesc ? inputDesc.value.toLowerCase().trim() : '';
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
        return matchDesc;
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
        .filter(t => t.tipo === 'receita' && !receitaPendente(t))
        .reduce((soma, t) => soma + (Number(t.valor) || 0), 0);
    const valorInvestimento = totalReceitas * (porcentagemInvestimento / 100);
    const semFiltroAtivo = filtroAtivo.descricao === '';
    const mostrarInvestimento = semFiltroAtivo && valorInvestimento > 0;

    if (lancamentos.length === 0 && !mostrarInvestimento) {
        listContainer.innerHTML = `<div class="empty-state"><p>Nenhum lançamento cadastrado.</p></div>`;
        return;
    }

    const colunas = "display: grid; grid-template-columns: 95px 1fr 130px 150px; gap: 12px; align-items: center;";
    listContainer.innerHTML = '';

    const cabecalho = document.createElement('div');
    cabecalho.className = 'linha-geral cab-geral';
    cabecalho.style = `${colunas} padding-bottom: 12px; margin-bottom: 4px; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 13px; font-weight: 600;`;
    cabecalho.innerHTML = `<span>Data</span><span>Descrição</span><span>Tipo</span><span style="text-align: right;">Valor</span>`;
    listContainer.appendChild(cabecalho);

    const criarLinha = ({ data, descricao, categoria, tipo, valor, selo = '' }) => {
        const cfg = TIPOS[tipo];
        const sinalStr = cfg.sinal ? `${cfg.sinal} ` : '';
        const subcategoria = categoria
            ? `<span style="display: block; font-size: 12px; font-weight: 500; color: var(--text-muted); margin-top: 2px;">${escaparHTML(categoria)}</span>`
            : '';

        const item = document.createElement('div');
        item.className = 'linha-geral';
        item.style = `${colunas} padding: 14px 0; border-bottom: 1px solid var(--border-color);`;
        item.innerHTML = `
            <span style="font-size: 14px; color: var(--text-muted); font-weight: 500;">${data ? formatarDataBR(data) : '—'}</span>
            <span class="nome-transacao" style="color: ${cfg.cor};">${escaparHTML(descricao)}${selo}${subcategoria}</span>
            <span><span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: ${cfg.cor}; background-color: color-mix(in srgb, ${cfg.cor} 12%, transparent);">${cfg.rotulo}</span></span>
            <span style="text-align: right; font-weight: 600; color: ${cfg.cor}; font-size: 15px;">${sinalStr}${formatarMoeda(valor)}</span>
        `;
        listContainer.appendChild(item);
    };

    lancamentos.forEach(t => criarLinha({
        data: t.sem_data ? '' : t.data, // despesa variável "não possui data" mostra —
        descricao: t.descricao,
        categoria: t.tipo === 'despesa-fixa' ? '' : t.categoria,
        tipo: t.tipo,
        valor: t.valor,
        selo: seloFuturo(t)
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
    const gastosView = document.getElementById('gastos-view');
    if (!listContainer) return;

    const abaAtivaObj = document.querySelector('.tab-btn.active');
    const abaAtiva = abaAtivaObj ? abaAtivaObj.getAttribute('data-tab') : 'geral';
    
    const btnAdicionar = document.getElementById('btn-adicionar');
    if (btnAdicionar) {
        btnAdicionar.style.display = (abaAtiva === 'geral' || abaAtiva === 'gastos') ? 'none' : 'flex';
    }

    const btnFiltro = document.getElementById('btn-filtro');
    if (btnFiltro) {
        btnFiltro.style.display = (abaAtiva === 'gastos') ? 'none' : 'flex';
    }

    if (abaAtiva === 'gastos') {
        listContainer.style.display = 'none';
        if (gastosView) gastosView.style.display = 'flex';
        return;
    } else {
        listContainer.style.display = 'block';
        if (gastosView) gastosView.style.display = 'none';
    }

    if (abaAtiva === 'geral') {
        renderizarListaGeral(transacoes);
        return;
    }
    
    const transacoesAba = transacoes.filter(t => {
        if (t.tipo !== abaAtiva) return false;
        const matchDesc = filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
        return matchDesc;
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
        const dataFormatada = t.sem_data ? '—' : (partesData.length === 3 ? `${partesData[2]}/${partesData[1]}/${partesData[0]}` : t.data);
        
        let corValor = 'var(--text-main)';
        let sinal = '-';

        if (t.tipo === 'receita') {
            corValor = 'var(--color-green)';
            sinal = '+';
        } else if (t.tipo === 'despesa-fixa') {
            corValor = 'var(--color-red)';
            sinal = '-';
        } else if (t.tipo === 'despesa-variavel') {
            corValor = '#f97316'; // Laranja usado para despesas variáveis
            sinal = '-';
        }

        const item = document.createElement('div');
        item.style = "display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border-color); align-items: center;";
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 24px;">
                <span style="font-size: 14px; color: var(--text-muted); min-width: 90px; font-weight: 500;">${dataFormatada}</span>
                <span class="nome-transacao">${escaparHTML(t.descricao)}${seloFuturo(t)}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: 600; color: ${corValor}; font-size: 15px;">
                    ${sinal} ${formatarMoeda(t.valor)}
                </span>
                <button onclick="abrirEdicao('${t.id}')" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 4px;" title="Editar">
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

// ==========================================
// INTEGRAÇÃO COM BACKEND FASTAPI (EXTRATO CSV)
// ==========================================
let transacoesExtratoPreview = [];

// URL base configurável para o backend FastAPI
let FASTAPI_URL = localStorage.getItem('fastapi_url') || 'http://127.0.0.1:8000';

async function enviarExtratoFastAPI(file) {
    if (!file) return;

    const statusEl = document.getElementById('upload-status');
    const previewSection = document.getElementById('preview-section');

    if (statusEl) {
        statusEl.style.display = 'flex';
        statusEl.className = 'upload-status status-loading';
        statusEl.innerHTML = `
            <div class="spinner"></div>
            <div>
                <strong>Enviando ${escaparHTML(file.name)}...</strong>
                <div>Aguarde enquanto o FastAPI processa e categoriza os lançamentos.</div>
            </div>
        `;
    }
    if (previewSection) previewSection.style.display = 'none';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const userId = session ? session.user.id : '';
        const token = session ? session.access_token : '';

        const formData = new FormData();
        formData.append('file', file);
        if (userId) formData.append('user_id', userId);

        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Endpoint FastAPI para processar extrato
        const url = `${FASTAPI_URL}/processar-extrato${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            let msgErro = `Servidor retornou erro ${response.status}`;
            try {
                const errJson = await response.json();
                msgErro = errJson.detail || errJson.message || msgErro;
            } catch (e) {}
            throw new Error(msgErro);
        }

        const dados = await response.json();
        let itens = [];
        if (Array.isArray(dados)) {
            itens = dados;
        } else if (dados && typeof dados === 'object') {
            itens = dados.transacoes || dados.dados || dados.itens || dados.extrato || dados.data || [];
        }

        if (!itens || itens.length === 0) {
            if (statusEl) {
                statusEl.className = 'upload-status status-alerta';
                statusEl.innerHTML = `<strong>Aviso:</strong> Nenhum lançamento encontrado no arquivo CSV enviado.`;
            }
            return;
        }

        // Normaliza itens retornados pelo FastAPI (Data, Descrição, Valor e Categoria sugerida)
        transacoesExtratoPreview = itens.map((item, index) => {
            let val = item.valor ?? item.amount ?? item.value ?? 0;
            if (typeof val === 'string') {
                val = lerValorCampo(val);
            }
            val = Math.abs(Number(val) || 0);

            let dt = String(item.data || item.date || item.dt || hojeISO());
            if (dt.includes('/')) {
                const partes = dt.split('/');
                if (partes.length === 3) {
                    dt = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                }
            } else if (dt.length > 10) {
                dt = dt.slice(0, 10);
            }

            return {
                id_temp: index,
                data: dt,
                descricao: item.descricao || item.description || item.historico || 'Gasto importado',
                valor: val,
                categoria: item.categoria || item.category || 'Outros',
                tipo: item.tipo || 'despesa-variavel',
                selecionado: true
            };
        });

        if (statusEl) {
            statusEl.className = 'upload-status status-sucesso';
            statusEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <div>
                    <strong>Extrato processado com sucesso!</strong>
                    <div>${transacoesExtratoPreview.length} lançamentos identificados. Revise na tabela abaixo e confirme para salvar.</div>
                </div>
            `;
        }

        renderizarPreviewExtrato();

    } catch (erro) {
        console.error('Erro na requisição ao FastAPI:', erro);
        if (statusEl) {
            statusEl.className = 'upload-status status-erro';
            statusEl.innerHTML = `
                <div>
                    <strong>Erro ao conectar com o backend FastAPI:</strong>
                    <div>${escaparHTML(erro.message || 'Falha na comunicação com o endpoint /processar-extrato.')}</div>
                    <small style="opacity: 0.8; margin-top: 4px; display: block;">Endpoint testado: <code>${escaparHTML(FASTAPI_URL)}/processar-extrato</code></small>
                </div>
            `;
        }
    }
}

function renderizarPreviewExtrato() {
    const previewSection = document.getElementById('preview-section');
    const tbody = document.getElementById('preview-tbody');
    const countEl = document.getElementById('preview-count');
    const checkTodos = document.getElementById('check-todos-preview');

    if (!previewSection || !tbody) return;

    if (transacoesExtratoPreview.length === 0) {
        previewSection.style.display = 'none';
        return;
    }

    previewSection.style.display = 'block';

    const selecionadas = transacoesExtratoPreview.filter(t => t.selecionado).length;
    if (countEl) {
        countEl.textContent = `${selecionadas} de ${transacoesExtratoPreview.length} selecionadas para salvar`;
    }

    if (checkTodos) {
        checkTodos.checked = selecionadas === transacoesExtratoPreview.length;
        checkTodos.indeterminate = selecionadas > 0 && selecionadas < transacoesExtratoPreview.length;
    }

    tbody.innerHTML = '';
    transacoesExtratoPreview.forEach(t => {
        const tr = document.createElement('tr');
        if (!t.selecionado) tr.classList.add('linha-desmarcada');

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="check-item-preview" data-id="${t.id_temp}" ${t.selecionado ? 'checked' : ''}>
            </td>
            <td>
                <input type="date" class="input-preview-data" data-id="${t.id_temp}" value="${t.data}">
            </td>
            <td>
                <input type="text" class="input-preview-desc" data-id="${t.id_temp}" value="${escaparHTML(t.descricao)}">
            </td>
            <td style="font-weight: 700; color: var(--color-red); font-size: 14px; white-space: nowrap;">
                - ${formatarMoeda(t.valor)}
            </td>
            <td>
                <input type="text" class="input-preview-cat" data-id="${t.id_temp}" value="${escaparHTML(t.categoria)}" placeholder="Categoria">
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-preview-delete" data-id="${t.id_temp}" title="Excluir da importação">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Eventos de alteração dos campos da tabela de prévia
    tbody.querySelectorAll('.check-item-preview').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id, 10);
            const item = transacoesExtratoPreview.find(t => t.id_temp === id);
            if (item) {
                item.selecionado = e.target.checked;
                renderizarPreviewExtrato();
            }
        });
    });

    tbody.querySelectorAll('.input-preview-data').forEach(inp => {
        inp.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id, 10);
            const item = transacoesExtratoPreview.find(t => t.id_temp === id);
            if (item) item.data = e.target.value;
        });
    });

    tbody.querySelectorAll('.input-preview-desc').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const id = parseInt(e.target.dataset.id, 10);
            const item = transacoesExtratoPreview.find(t => t.id_temp === id);
            if (item) item.descricao = e.target.value;
        });
    });

    tbody.querySelectorAll('.input-preview-cat').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const id = parseInt(e.target.dataset.id, 10);
            const item = transacoesExtratoPreview.find(t => t.id_temp === id);
            if (item) item.categoria = e.target.value;
        });
    });

    tbody.querySelectorAll('.btn-preview-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id, 10);
            transacoesExtratoPreview = transacoesExtratoPreview.filter(t => t.id_temp !== id);
            renderizarPreviewExtrato();
        });
    });
}

// Checkbox "Selecionar todos" na tabela de prévia
const checkTodosPreview = document.getElementById('check-todos-preview');
if (checkTodosPreview) {
    checkTodosPreview.addEventListener('change', (e) => {
        const marcar = e.target.checked;
        transacoesExtratoPreview.forEach(t => t.selecionado = marcar);
        renderizarPreviewExtrato();
    });
}

// Botão "Descartar" prévia
const btnDescartarPreview = document.getElementById('btn-descartar-preview');
if (btnDescartarPreview) {
    btnDescartarPreview.addEventListener('click', () => {
        if (!confirm('Deseja descartar estes lançamentos importados?')) return;
        transacoesExtratoPreview = [];
        renderizarPreviewExtrato();
        const statusEl = document.getElementById('upload-status');
        const inputCSV = document.getElementById('input-extrato-csv');
        if (statusEl) statusEl.style.display = 'none';
        if (inputCSV) inputCSV.value = '';
    });
}

// Botão "Salvar no Supabase"
const btnSalvarPreview = document.getElementById('btn-salvar-preview');
if (btnSalvarPreview) {
    btnSalvarPreview.addEventListener('click', async () => {
        const selecionadas = transacoesExtratoPreview.filter(t => t.selecionado);
        if (selecionadas.length === 0) {
            alert('Selecione pelo menos uma transação para salvar.');
            return;
        }

        const textoOriginal = btnSalvarPreview.innerHTML;
        btnSalvarPreview.disabled = true;
        btnSalvarPreview.innerHTML = 'Salvando no banco...';

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                alert('Você precisa estar logado para salvar.');
                return;
            }

            const registros = selecionadas.map(t => ({
                user_id: session.user.id,
                tipo: 'despesa-variavel', // Gastos importados entram como despesas variáveis
                data: t.data || hojeISO(),
                valor: Math.abs(Number(t.valor)) || 0,
                descricao: (t.descricao || 'Gasto importado').trim(),
                categoria: (t.categoria || 'Outros').trim(),
                futuro: false,
                sem_data: !t.data,
                valor_fixo: false
            }));

            const { error } = await supabaseClient.from('transacoes').insert(registros);
            if (error) {
                tratarErroSupabase(error);
                alert('Erro ao salvar as transações no Supabase: ' + (error.message || ''));
                return;
            }

            alert(`${registros.length} transações salvas com sucesso no Supabase!`);
            transacoesExtratoPreview = [];
            renderizarPreviewExtrato();

            const statusEl = document.getElementById('upload-status');
            const inputCSV = document.getElementById('input-extrato-csv');
            if (statusEl) statusEl.style.display = 'none';
            if (inputCSV) inputCSV.value = '';

            // Recarrega lançamentos atualizados do Supabase
            await carregarTransacoes();

        } catch (erro) {
            console.error('Erro ao salvar lançamentos:', erro);
            alert('Não foi possível salvar os lançamentos.');
        } finally {
            btnSalvarPreview.disabled = false;
            btnSalvarPreview.innerHTML = textoOriginal;
        }
    });
}

// Evento de seleção de arquivo via <input type="file">
const inputExtratoCSV = document.getElementById('input-extrato-csv');
if (inputExtratoCSV) {
    inputExtratoCSV.addEventListener('change', (e) => {
        const arquivo = e.target.files && e.target.files[0];
        if (arquivo) {
            enviarExtratoFastAPI(arquivo);
        }
    });
}

// Suporte a Arrastar e Soltar (Drag & Drop) na área de upload
const uploadDropzone = document.getElementById('upload-dropzone');
if (uploadDropzone) {
    ['dragenter', 'dragover'].forEach(evt => {
        uploadDropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        uploadDropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadDropzone.classList.remove('dragover');
        });
    });

    uploadDropzone.addEventListener('drop', (e) => {
        const arquivos = e.dataTransfer && e.dataTransfer.files;
        if (arquivos && arquivos.length > 0) {
            const arquivo = arquivos[0];
            if (arquivo.name.toLowerCase().endsWith('.csv')) {
                enviarExtratoFastAPI(arquivo);
            } else {
                alert('Por favor, selecione um arquivo no formato .CSV.');
            }
        }
    });
}

// Só carrega os dados depois de confirmar que há uma conta logada (definido no auth.js)
iniciarSessao();