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
        
        // 3. Muda o título da lista dinamicamente e controla botão Adicionar
        const aba = btn.getAttribute('data-tab');
        if (tituloAba) {
            if (aba === 'geral') tituloAba.textContent = 'Visão Geral';
            if (aba === 'receita') tituloAba.textContent = 'Receitas';
            if (aba === 'despesa-fixa') tituloAba.textContent = 'Despesas Fixas';
            if (aba === 'despesa-variavel') tituloAba.textContent = 'Despesas Variáveis';
        }

        const btnAdicionar = document.getElementById('btn-adicionar');
        if (btnAdicionar) {
            btnAdicionar.style.display = (aba === 'geral') ? 'none' : 'flex';
        }

        // 4. CORREÇÃO: Força a lista a redesenhar imediatamente ao mudar de aba
        if (typeof renderizarLista === 'function' && typeof todasTransacoes !== 'undefined') {
            renderizarLista(todasTransacoes);
        }
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
        const valorAtual = localStorage.getItem('porcentagemInvestimento') !== null 
            ? localStorage.getItem('porcentagemInvestimento') 
            : (investRange ? investRange.value : 0);
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
const btnAdicionar = document.getElementById('btn-adicionar');
if (btnAdicionar) {
    btnAdicionar.addEventListener('click', () => {
        const abaAtivaObj = document.querySelector('.tab-btn.active');
        if (abaAtivaObj) {
            const abaAtiva = abaAtivaObj.getAttribute('data-tab');
            abrirModal(`modal-${abaAtiva}`);
        }
    });
}


// ==========================================
// LÓGICA DO INVESTIMENTO (BARRA DESLIZANTE)
// ==========================================
const investRange = document.getElementById('invest-range');
const investPercentDisplay = document.getElementById('invest-percent-display');
const investValueDisplay = document.getElementById('invest-value-display');
const btnPercents = document.querySelectorAll('.btn-percent');

// Função auxiliar para somar as Receitas Reais vindas do api.js
// (receitas marcadas como "Recebimento futuro" só entram quando o dia e o mês chegam)
function obterReceitaTotalReal() {
    if (typeof todasTransacoes !== 'undefined' && Array.isArray(todasTransacoes)
        && typeof calcularResumo === 'function') {
        return calcularResumo(todasTransacoes).receitas;
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

// Evento: Botão Salvar na modal de investimento
const btnSalvarInvestimento = document.getElementById('btn-salvar-investimento');
if (btnSalvarInvestimento) {
    btnSalvarInvestimento.addEventListener('click', () => {
        const porcentagem = investRange ? investRange.value : 0;
        localStorage.setItem('porcentagemInvestimento', porcentagem);
        // Guarda também na conta, para valer em qualquer dispositivo (função do auth.js)
        if (typeof salvarPorcentagemNoServidor === 'function') salvarPorcentagemNoServidor(porcentagem);
        atualizarInvestimento(porcentagem);
        fecharModal('modal-investir');
    });
}

// Inicializa com o valor salvo no localStorage, se houver
const porcentagemSalvaInit = localStorage.getItem('porcentagemInvestimento');
if (porcentagemSalvaInit !== null) {
    atualizarInvestimento(porcentagemSalvaInit);
}


// ==========================================
// TEMA CLARO / ESCURO
// ==========================================
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('tema', tema); } catch (e) {}

    const btnTema = document.getElementById('btn-tema');
    if (btnTema) {
        btnTema.title = tema === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro';
    }

    // Avisa o gráfico para redesenhar com as cores do novo tema
    window.dispatchEvent(new CustomEvent('temaAlterado'));
}

const btnTema = document.getElementById('btn-tema');
if (btnTema) {
    btnTema.addEventListener('click', () => {
        const atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        aplicarTema(atual === 'dark' ? 'light' : 'dark');
    });
    btnTema.title = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'Mudar para modo claro'
        : 'Mudar para modo escuro';
}


// ==========================================
// DATA ATUAL NO CABEÇALHO ("1 de Outubro de 2026")
// ==========================================
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function atualizarDataAtual() {
    const el = document.getElementById('data-atual');
    if (!el) return;
    const hoje = new Date();
    el.textContent = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

atualizarDataAtual();
// Se a aba ficar aberta durante a virada do dia, a data se corrige sozinha
setInterval(atualizarDataAtual, 60 * 1000);


// ==========================================
// DATAS E CAMPOS DOS FORMULÁRIOS (MODAIS)
// ==========================================
function dois(n) {
    return String(n).padStart(2, '0');
}

// Data local de hoje no formato AAAA-MM-DD
function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// Mês atual no formato AAAA-MM
function anoMesAtual() {
    return hojeISO().slice(0, 7);
}

// Junta 'AAAA-MM' + dia. Se o dia não existe no mês (31 em abril), usa o último dia.
function montarData(anoMes, dia) {
    const [ano, mes] = anoMes.split('-').map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const d = Math.min(Math.max(parseInt(dia, 10) || 1, 1), ultimoDia);
    return `${anoMes}-${dois(d)}`;
}

// Preenche o seletor de mês da receita: mês atual + próximos 11
function preencherOpcoesMes(anoMesSelecionado) {
    const select = document.getElementById('rec-mes');
    if (!select) return;

    const hoje = new Date();
    const valores = [];
    let html = '';
    for (let i = 0; i < 12; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const valor = `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
        valores.push(valor);
        html += `<option value="${valor}">${MESES_PT[d.getMonth()]}/${d.getFullYear()}</option>`;
    }
    // Ao editar um lançamento de um mês que já não está na lista, mantém esse mês disponível
    if (anoMesSelecionado && !valores.includes(anoMesSelecionado)) {
        const [a, mm] = anoMesSelecionado.split('-').map(Number);
        html = `<option value="${anoMesSelecionado}">${MESES_PT[mm - 1]}/${a}</option>` + html;
    }
    select.innerHTML = html;
    select.value = anoMesSelecionado || anoMesAtual();
}

// Receita: "Valor não fixo" mostra o seletor de mês
function atualizarCamposReceita() {
    const naoFixo = document.getElementById('rec-nao-fixo');
    const grupoMes = document.getElementById('rec-grupo-mes');
    if (naoFixo && grupoMes) grupoMes.style.display = naoFixo.checked ? 'flex' : 'none';
}

// Receita não fixa em outro mês: marca "Recebimento futuro" automaticamente
function sincronizarFuturoReceita() {
    const naoFixo = document.getElementById('rec-nao-fixo');
    const mes = document.getElementById('rec-mes');
    const futuro = document.getElementById('rec-futuro');
    if (!naoFixo || !mes || !futuro) return;
    futuro.checked = naoFixo.checked && mes.value !== anoMesAtual();
}

// Despesa variável: "Não possui data" esconde o campo Dia
function atualizarCamposDespesaVariavel() {
    const grupo = document.getElementById('dv-grupo-dia');
    const dia = document.getElementById('dv-dia');
    const semData = document.querySelector('input[name="dv-data-opcao"][value="sem"]');
    if (!grupo || !dia || !semData) return;
    grupo.style.display = semData.checked ? 'none' : 'flex';
    dia.required = !semData.checked; // campo escondido não pode bloquear o envio
}

// Estado inicial de um formulário NOVO: dia de hoje, mês atual, opções padrão
function prepararFormulariosNovos() {
    const hoje = new Date().getDate();
    ['rec-dia', 'df-dia', 'dv-dia'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = hoje;
    });
    preencherOpcoesMes(anoMesAtual());
    atualizarCamposReceita();
    atualizarCamposDespesaVariavel();
}

const recNaoFixo = document.getElementById('rec-nao-fixo');
if (recNaoFixo) recNaoFixo.addEventListener('change', () => { atualizarCamposReceita(); sincronizarFuturoReceita(); });

const recMes = document.getElementById('rec-mes');
if (recMes) recMes.addEventListener('change', sincronizarFuturoReceita);

document.querySelectorAll('input[name="dv-data-opcao"]').forEach(radio => {
    radio.addEventListener('change', atualizarCamposDespesaVariavel);
});

prepararFormulariosNovos();