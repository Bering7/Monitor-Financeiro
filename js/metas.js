// ==========================================
// METAS FINANCEIRAS (CRUD + APORTES + RECOMENDAÇÃO + ALERTAS)
// ==========================================

let todasMetas = [];
let idEdicaoMeta = null;
let filtroMetaAtual = 'todas';
let ordemMetaAtual = 'prazo';

const MESES_NOMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Utilitários de moeda e dados
function formatarMoedaMetas(valor) {
    if (typeof formatarMoeda === 'function') return formatarMoeda(valor);
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function lerValorMetas(texto) {
    if (typeof lerValorCampo === 'function') return lerValorCampo(texto);
    let s = String(texto ?? '').replace(/R\$/g, '').replace(/\s/g, '');
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (!/^\d+\.\d{1,2}$/.test(s)) {
        s = s.replace(/\./g, '');
    }
    return parseFloat(s);
}

function valorParaCampoMetas(valor) {
    if (typeof valorParaCampo === 'function') return valorParaCampo(valor);
    return (Number(valor) || 0).toFixed(2).replace('.', ',');
}

function mesAtualISO() {
    if (typeof anoMesAtual === 'function') return anoMesAtual();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarMesBR(anoMes) {
    if (!anoMes || !anoMes.includes('-')) return anoMes || '';
    const [ano, mes] = anoMes.split('-').map(Number);
    if (!mes || !ano) return anoMes;
    return `${MESES_NOMES[mes - 1] || mes}/${ano}`;
}

function calcularMesesRestantes(anoMesAlvo) {
    if (!anoMesAlvo || !anoMesAlvo.includes('-')) return 1;
    const [anoAlvo, mesAlvo] = anoMesAlvo.split('-').map(Number);
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const diff = (anoAlvo - anoAtual) * 12 + (mesAlvo - mesAtual) + 1;
    return diff;
}

// Preenche os selects duplos de Mês e Ano
function preencherSelectsMesAno(prefixo, anoMesSelecionado, anosFuturos = 10) {
    const selMes = document.getElementById(`${prefixo}-mes-select`);
    const selAno = document.getElementById(`${prefixo}-ano-select`);
    if (!selMes || !selAno) return;

    const [anoPadrao, mesPadrao] = (anoMesSelecionado || mesAtualISO()).split('-').map(Number);

    selMes.innerHTML = '';
    MESES_NOMES.forEach((nome, i) => {
        const val = String(i + 1).padStart(2, '0');
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = `${nome} (${val})`;
        if (i + 1 === mesPadrao) opt.selected = true;
        selMes.appendChild(opt);
    });

    selAno.innerHTML = '';
    const anoAtual = new Date().getFullYear();
    const anoInicio = Math.min(anoAtual - 2, anoPadrao);
    const anoFim = Math.max(anoAtual + anosFuturos, anoPadrao + 2);

    for (let a = anoInicio; a <= anoFim; a++) {
        const opt = document.createElement('option');
        opt.value = String(a);
        opt.textContent = String(a);
        if (a === anoPadrao) opt.selected = true;
        selAno.appendChild(opt);
    }
}

function obterAnoMesDeSelects(prefixo) {
    const selMes = document.getElementById(`${prefixo}-mes-select`);
    const selAno = document.getElementById(`${prefixo}-ano-select`);
    if (!selMes || !selAno) return mesAtualISO();
    return `${selAno.value}-${selMes.value}`;
}

async function obterUsuarioId() {
    try {
        if (typeof supabaseClient !== 'undefined' && supabaseClient.auth) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) return session.user.id;
        }
    } catch (e) {
        console.warn('Erro ao obter sessão no metas.js:', e);
    }
    return null;
}

function salvarMetasLocal(userId, metas) {
    try {
        localStorage.setItem('metas_' + (userId || 'anonimo'), JSON.stringify(metas));
    } catch (e) {}
}

function carregarMetasLocal(userId) {
    try {
        const salvo = localStorage.getItem('metas_' + (userId || 'anonimo'));
        return salvo ? JSON.parse(salvo) : [];
    } catch (e) {
        return [];
    }
}

function carregarMetasDoCache() {
    try {
        if (typeof localStorage === 'undefined') return;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('metas_')) {
                const salvo = localStorage.getItem(k);
                if (salvo) {
                    const parsed = JSON.parse(salvo);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        todasMetas = parsed.map(m => ({
                            ...m,
                            aportes_mensais: typeof m.aportes_mensais === 'object' && m.aportes_mensais !== null ? m.aportes_mensais : {}
                        }));
                        break;
                    }
                }
            }
        }
    } catch (e) {}
}

// Obtém o valor total de aportes a ser descontado do saldo total
function obterTotalAportesMetas(mes) {
    if (!Array.isArray(todasMetas) || todasMetas.length === 0) {
        carregarMetasDoCache();
    }
    if (!Array.isArray(todasMetas) || todasMetas.length === 0) return 0;

    const mesRef = mes || mesAtualISO();
    let totalMes = 0;
    let totalGeral = 0;

    todasMetas.forEach(meta => {
        const aportes = meta.aportes_mensais || {};
        totalMes += Number(aportes[mesRef]) || 0;
        Object.values(aportes).forEach(v => {
            totalGeral += Number(v) || 0;
        });
    });

    // Desconta o total de aportes do mês atual (ou total geral se o usuário registrou aporte em outro mês)
    return totalMes > 0 ? totalMes : totalGeral;
}
window.obterTotalAportesMetas = obterTotalAportesMetas;

function sincronizarCardsResumo() {
    if (typeof atualizarCardsResumo === 'function' && typeof todasTransacoes !== 'undefined') {
        atualizarCardsResumo(todasTransacoes);
    }
}

// ==========================================
// BUSCAR DADOS
// ==========================================
async function carregarMetas() {
    const userId = await obterUsuarioId();
    let dados = null;

    if (userId && typeof supabaseClient !== 'undefined') {
        try {
            const { data, error } = await supabaseClient
                .from('metas')
                .select('*')
                .eq('user_id', userId)
                .order('criado_em', { ascending: false });

            if (!error && Array.isArray(data)) {
                dados = data;
                salvarMetasLocal(userId, dados);
            } else {
                dados = carregarMetasLocal(userId);
            }
        } catch (erro) {
            console.warn('Supabase offline. Usando fallback local:', erro);
            dados = carregarMetasLocal(userId);
        }
    } else {
        dados = carregarMetasLocal(userId || 'anonimo');
    }

    todasMetas = (dados || []).map(m => ({
        ...m,
        aportes_mensais: typeof m.aportes_mensais === 'object' && m.aportes_mensais !== null ? m.aportes_mensais : {}
    }));

    renderizarMetas();
    sincronizarCardsResumo();
}

// ==========================================
// RENDERIZAÇÃO NA TELA
// ==========================================
function renderizarMetas() {
    const container = document.getElementById('metas-lista');
    const resumoEl = document.getElementById('metas-resumo-texto');
    if (!container) return;

    if (todasMetas.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 16px; text-align: center;">
                <p>Nenhuma meta cadastrada ainda.</p>
                <span style="font-size: 13px; color: var(--text-muted); margin-top: 6px; display: block;">
                    Clique em <strong>"+ Nova Meta"</strong> para planejar seu primeiro objetivo!
                </span>
            </div>
        `;
        if (resumoEl) resumoEl.textContent = 'Defina objetivos e acompanhe seu ritmo mensal de economia.';
        return;
    }

    // Filtros
    let metasFiltradas = todasMetas.filter(m => {
        const valorAlvo = Number(m.valor_alvo) || 0;
        const total = Object.values(m.aportes_mensais || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const concluida = valorAlvo > 0 && total >= valorAlvo;

        if (filtroMetaAtual === 'ativas') return !concluida;
        if (filtroMetaAtual === 'concluidas') return concluida;
        return true;
    });

    // Ordenação
    metasFiltradas.sort((a, b) => {
        const totalA = Object.values(a.aportes_mensais || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const totalB = Object.values(b.aportes_mensais || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const pctA = (Number(a.valor_alvo) || 1) > 0 ? (totalA / Number(a.valor_alvo)) : 0;
        const pctB = (Number(b.valor_alvo) || 1) > 0 ? (totalB / Number(b.valor_alvo)) : 0;

        if (ordemMetaAtual === 'prazo') return (a.mes_alvo || '').localeCompare(b.mes_alvo || '');
        if (ordemMetaAtual === 'progresso_desc') return pctB - pctA;
        if (ordemMetaAtual === 'progresso_asc') return pctA - pctB;
        if (ordemMetaAtual === 'valor_alvo') return (Number(b.valor_alvo) || 0) - (Number(a.valor_alvo) || 0);
        return 0;
    });

    let somaAlvos = 0;
    let somaGuardado = 0;

    container.innerHTML = '';
    metasFiltradas.forEach(meta => {
        const valorAlvo = Number(meta.valor_alvo) || 0;
        const parametro = Number(meta.aporte_parametro) || 0;
        const aportes = meta.aportes_mensais || {};

        const totalAcumulado = Object.values(aportes).reduce((soma, v) => soma + (Number(v) || 0), 0);
        const progresso = valorAlvo > 0 ? Math.min(100, (totalAcumulado / valorAlvo) * 100) : 0;
        const restante = Math.max(0, valorAlvo - totalAcumulado);
        const concluida = progresso >= 100;

        somaAlvos += valorAlvo;
        somaGuardado += totalAcumulado;

        // Ritmo médio mensal
        const mesesComAporte = Object.keys(aportes).filter(mes => Number(aportes[mes]) > 0);
        const qtdMeses = mesesComAporte.length;
        const ritmoMedio = qtdMeses > 0 ? (totalAcumulado / qtdMeses) : 0;

        let ritmoClass = 'meta-stat-ritmo-neutro';
        let ritmoTexto = 'Sem aportes';

        if (ritmoMedio > 0) {
            if (ritmoMedio >= parametro) {
                ritmoClass = 'meta-stat-ritmo-ok';
                ritmoTexto = `${formatarMoedaMetas(ritmoMedio)}/mês (No ritmo)`;
            } else {
                ritmoClass = 'meta-stat-ritmo-baixo';
                ritmoTexto = `${formatarMoedaMetas(ritmoMedio)}/mês (Abaixo)`;
            }
        }

        // Diagnóstico de Prazo e Ritmo
        const mesesRestantes = calcularMesesRestantes(meta.mes_alvo);
        const mesAtual = mesAtualISO();
        const prazoVencido = meta.mes_alvo < mesAtual && !concluida;

        let alertaHtml = '';
        if (concluida) {
            alertaHtml = `
                <div class="meta-alerta-box alerta-sucesso">
                    <span>🎉 <strong>Parabéns!</strong> Meta concluída com sucesso!</span>
                </div>
            `;
        } else if (prazoVencido) {
            alertaHtml = `
                <div class="meta-alerta-box alerta-perigo">
                    <div class="alerta-texto">
                        <strong>⚠️ Prazo expirado (${formatarMesBR(meta.mes_alvo)})</strong>
                        <span>Faltam ${formatarMoedaMetas(restante)} para atingir o objetivo. Recomendamos estender a data.</span>
                    </div>
                    <button type="button" class="btn-alerta-acao" onclick="abrirEdicaoMeta('${meta.id}')">Estender prazo</button>
                </div>
            `;
        } else if (mesesRestantes > 0 && restante > 0) {
            // Verifica projeção pelo ritmo médio ou aporte parâmetro
            const ritmoReferencia = ritmoMedio > 0 ? ritmoMedio : parametro;
            const projecao = totalAcumulado + (ritmoReferencia * mesesRestantes);

            if (projecao < valorAlvo) {
                const deficit = valorAlvo - projecao;
                const aporteNecessario = restante / mesesRestantes;
                alertaHtml = `
                    <div class="meta-alerta-box alerta-aviso">
                        <div class="alerta-texto">
                            <strong>⚠️ Ritmo insuficiente para o prazo</strong>
                            <span>Faltarão aprox. ${formatarMoedaMetas(deficit)}. Sugestão: aportar ${formatarMoedaMetas(aporteNecessario)}/mês ou estender o término.</span>
                        </div>
                        <button type="button" class="btn-alerta-acao" onclick="abrirEdicaoMeta('${meta.id}')">Ajustar meta</button>
                    </div>
                `;
            }
        }

        const card = document.createElement('div');
        card.className = `meta-card ${concluida ? 'meta-card-concluida' : ''}`;
        card.innerHTML = `
            <div class="meta-card-header">
                <div class="meta-card-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${concluida ? 'text-green' : 'text-blue'}">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>${meta.titulo ? meta.titulo.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : 'Meta'}</span>
                </div>
                <div class="meta-header-acoes">
                    <span class="meta-badge-prazo ${prazoVencido ? 'prazo-vencido' : ''}">
                        ${prazoVencido ? 'Expirou em:' : 'Alvo:'} ${formatarMesBR(meta.mes_alvo)}
                    </span>
                    <button type="button" class="btn-meta-icon" onclick="abrirEdicaoMeta('${meta.id}')" title="Editar meta">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button type="button" class="btn-meta-icon btn-meta-del" onclick="excluirMeta('${meta.id}')" title="Excluir meta">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="meta-progress-wrapper">
                <div class="meta-values-row">
                    <div>
                        <span class="meta-val-acumulado">${formatarMoedaMetas(totalAcumulado)}</span>
                        <span class="meta-val-alvo">de ${formatarMoedaMetas(valorAlvo)}</span>
                    </div>
                    <span class="meta-pct-badge ${concluida ? 'text-green' : ''}">${progresso.toFixed(1)}%</span>
                </div>
                <div class="meta-progress-track">
                    <div class="meta-progress-fill ${concluida ? 'fill-sucesso' : ''}" style="width: ${progresso}%;"></div>
                </div>
            </div>

            <div class="meta-stats-grid">
                <div class="meta-stat-item">
                    <span class="meta-stat-label">Falta guardar</span>
                    <span class="meta-stat-value">${formatarMoedaMetas(restante)}</span>
                </div>
                <div class="meta-stat-item">
                    <span class="meta-stat-label">Parâmetro mensal</span>
                    <span class="meta-stat-value">${formatarMoedaMetas(parametro)}/mês</span>
                </div>
                <div class="meta-stat-item">
                    <span class="meta-stat-label">Ritmo médio</span>
                    <span class="meta-stat-value ${ritmoClass}">${ritmoTexto}</span>
                </div>
            </div>

            ${alertaHtml}

            <div class="meta-actions-row">
                <span style="font-size: 12px; color: var(--text-muted);">
                    ${mesesRestantes > 0 && !prazoVencido ? `${mesesRestantes} mês(es) restante(s)` : (prazoVencido ? 'Prazo encerrado' : 'Concluído')}
                </span>
                <button type="button" class="btn-action-list btn-aporte-rapido" onclick="abrirModalAporte('${meta.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    + Registrar Aporte
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    if (resumoEl) {
        const pctGeral = somaAlvos > 0 ? ((somaGuardado / somaAlvos) * 100).toFixed(1) : 0;
        resumoEl.textContent = `${todasMetas.length} meta(s) cadastrada(s) • Guardado: ${formatarMoedaMetas(somaGuardado)} de ${formatarMoedaMetas(somaAlvos)} (${pctGeral}%)`;
    }
}

// ==========================================
// CÁLCULO AO VIVO DA RECOMENDAÇÃO
// ==========================================
function atualizarRecomendacaoAoVivo() {
    const valAlvo = lerValorMetas(document.getElementById('meta-valor-alvo').value) || 0;
    const anoMesAlvo = obterAnoMesDeSelects('meta');
    const meses = Math.max(1, calcularMesesRestantes(anoMesAlvo));

    const sugestaoBox = document.getElementById('meta-sugestao-box');
    const sugestaoValorEl = document.getElementById('meta-sugestao-valor');
    const sugestaoMesesEl = document.getElementById('meta-sugestao-meses');

    if (!sugestaoBox) return;

    if (valAlvo > 0) {
        const sugerido = valAlvo / meses;
        sugestaoValorEl.textContent = formatarMoedaMetas(sugerido) + '/mês';
        sugestaoMesesEl.textContent = `(em ${meses} mês${meses > 1 ? 'es' : ''})`;
        sugestaoBox.dataset.valorSugerido = sugerido.toFixed(2);
        sugestaoBox.style.display = 'flex';
    } else {
        sugestaoBox.style.display = 'none';
    }
}

// ==========================================
// ABERTURA DE MODAL: CRIAÇÃO OU EDIÇÃO
// ==========================================
function abrirModalNovaMeta() {
    idEdicaoMeta = null;
    const form = document.getElementById('form-nova-meta');
    if (form) form.reset();

    const tituloModal = document.getElementById('modal-meta-titulo');
    const btnSubmit = document.getElementById('btn-submit-meta');
    const grupoInicial = document.getElementById('grupo-aporte-inicial');

    if (tituloModal) tituloModal.textContent = 'Nova Meta';
    if (btnSubmit) btnSubmit.textContent = 'Criar Meta';
    if (grupoInicial) grupoInicial.style.display = 'flex';

    // Sugere 6 meses no futuro
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    const mesSugerido = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    preencherSelectsMesAno('meta', mesSugerido);

    atualizarRecomendacaoAoVivo();
    if (typeof abrirModal === 'function') abrirModal('modal-nova-meta');
}

function abrirEdicaoMeta(metaId) {
    const meta = todasMetas.find(m => String(m.id) === String(metaId));
    if (!meta) return;

    idEdicaoMeta = meta.id;
    const tituloModal = document.getElementById('modal-meta-titulo');
    const btnSubmit = document.getElementById('btn-submit-meta');
    const grupoInicial = document.getElementById('grupo-aporte-inicial');

    if (tituloModal) tituloModal.textContent = 'Editar Meta';
    if (btnSubmit) btnSubmit.textContent = 'Salvar Alterações';
    if (grupoInicial) grupoInicial.style.display = 'none'; // Não re-solicita aporte inicial na edição

    document.getElementById('meta-titulo').value = meta.titulo || '';
    document.getElementById('meta-valor-alvo').value = valorParaCampoMetas(meta.valor_alvo);
    document.getElementById('meta-aporte-parametro').value = valorParaCampoMetas(meta.aporte_parametro);

    preencherSelectsMesAno('meta', meta.mes_alvo);
    atualizarRecomendacaoAoVivo();

    if (typeof abrirModal === 'function') abrirModal('modal-nova-meta');
}

// ==========================================
// SALVAR OU ATUALIZAR META
// ==========================================
async function salvarMetaFormulario(dados) {
    const userId = await obterUsuarioId();

    if (idEdicaoMeta) {
        // MODO EDIÇÃO
        const meta = todasMetas.find(m => String(m.id) === String(idEdicaoMeta));
        if (!meta) return;

        meta.titulo = dados.titulo;
        meta.valor_alvo = dados.valor_alvo;
        meta.mes_alvo = dados.mes_alvo;
        meta.aporte_parametro = dados.aporte_parametro;

        if (userId && typeof supabaseClient !== 'undefined') {
            try {
                await supabaseClient.from('metas').update({
                    titulo: meta.titulo,
                    valor_alvo: meta.valor_alvo,
                    mes_alvo: meta.mes_alvo,
                    aporte_parametro: meta.aporte_parametro
                }).eq('id', meta.id);
            } catch (e) {
                console.warn('Erro ao atualizar meta no Supabase:', e);
            }
        }

        salvarMetasLocal(userId, todasMetas);
        renderizarMetas();
        sincronizarCardsResumo();
        idEdicaoMeta = null;
    } else {
        // MODO CRIAÇÃO
        const aportes = {};
        if (dados.aporte_inicial > 0) {
            aportes[mesAtualISO()] = dados.aporte_inicial;
        }

        const nova = {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'meta_' + Date.now(),
            user_id: userId,
            titulo: dados.titulo,
            valor_alvo: dados.valor_alvo,
            mes_alvo: dados.mes_alvo,
            aporte_parametro: dados.aporte_parametro,
            aportes_mensais: aportes,
            criado_em: new Date().toISOString()
        };

        if (userId && typeof supabaseClient !== 'undefined') {
            try {
                const { data, error } = await supabaseClient.from('metas').insert({
                    user_id: userId,
                    titulo: nova.titulo,
                    valor_alvo: nova.valor_alvo,
                    mes_alvo: nova.mes_alvo,
                    aporte_parametro: nova.aporte_parametro,
                    aportes_mensais: nova.aportes_mensais
                }).select();

                if (!error && data && data[0]) {
                    nova.id = data[0].id;
                }
            } catch (e) {
                console.warn('Erro ao criar meta no Supabase:', e);
            }
        }

        todasMetas.unshift(nova);
        salvarMetasLocal(userId, todasMetas);
        renderizarMetas();
        sincronizarCardsResumo();
    }
}

// ==========================================
// REGISTRAR / ATUALIZAR APORTE MENSAL
// ==========================================
function abrirModalAporte(metaId) {
    const meta = todasMetas.find(m => String(m.id) === String(metaId));
    if (!meta) return;

    document.getElementById('aporte-meta-id').value = meta.id;
    const subtitulo = document.getElementById('aporte-meta-subtitulo');
    if (subtitulo) subtitulo.textContent = `Meta: ${meta.titulo}`;

    const mesAtual = mesAtualISO();
    preencherSelectsMesAno('aporte', mesAtual, 2);

    const valorJaSalvo = (meta.aportes_mensais || {})[mesAtual];
    const inputValor = document.getElementById('aporte-valor');
    if (inputValor) {
        inputValor.value = valorJaSalvo ? valorParaCampoMetas(valorJaSalvo) : '';
    }

    if (typeof abrirModal === 'function') abrirModal('modal-aporte-meta');
}

async function salvarAporteMensal(metaId, mes, valor) {
    const meta = todasMetas.find(m => String(m.id) === String(metaId));
    if (!meta) return;

    const aportes = { ...(meta.aportes_mensais || {}) };
    if (valor > 0) {
        aportes[mes] = valor;
    } else {
        delete aportes[mes];
    }
    meta.aportes_mensais = aportes;

    const userId = await obterUsuarioId();
    if (userId && typeof supabaseClient !== 'undefined') {
        try {
            await supabaseClient.from('metas').update({
                aportes_mensais: aportes
            }).eq('id', meta.id);
        } catch (e) {
            console.warn('Erro ao atualizar aporte no Supabase:', e);
        }
    }

    salvarMetasLocal(userId, todasMetas);
    renderizarMetas();
    sincronizarCardsResumo();
}

// ==========================================
// EXCLUIR META
// ==========================================
async function excluirMeta(metaId) {
    const meta = todasMetas.find(m => String(m.id) === String(metaId));
    if (!meta) return;

    if (!confirm(`Deseja realmente excluir a meta "${meta.titulo}"?`)) return;

    const userId = await obterUsuarioId();
    if (userId && typeof supabaseClient !== 'undefined') {
        try {
            await supabaseClient.from('metas').delete().eq('id', meta.id);
        } catch (e) {
            console.warn('Erro ao excluir meta no Supabase:', e);
        }
    }

    todasMetas = todasMetas.filter(m => String(m.id) !== String(metaId));
    salvarMetasLocal(userId, todasMetas);
    renderizarMetas();
    sincronizarCardsResumo();
}

// ==========================================
// INICIALIZAÇÃO E EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Botão de Nova Meta
    const btnNovaMeta = document.getElementById('btn-nova-meta');
    if (btnNovaMeta) {
        btnNovaMeta.addEventListener('click', abrirModalNovaMeta);
    }

    // Ouvintes para cálculo ao vivo da sugestão de aporte
    const inputValAlvo = document.getElementById('meta-valor-alvo');
    if (inputValAlvo) {
        inputValAlvo.addEventListener('input', atualizarRecomendacaoAoVivo);
    }
    const selMetaMes = document.getElementById('meta-mes-select');
    if (selMetaMes) {
        selMetaMes.addEventListener('change', atualizarRecomendacaoAoVivo);
    }
    const selMetaAno = document.getElementById('meta-ano-select');
    if (selMetaAno) {
        selMetaAno.addEventListener('change', atualizarRecomendacaoAoVivo);
    }

    // Botão de aplicar sugestão
    const btnAplicarSugestao = document.getElementById('btn-aplicar-sugestao');
    if (btnAplicarSugestao) {
        btnAplicarSugestao.addEventListener('click', () => {
            const box = document.getElementById('meta-sugestao-box');
            const val = box ? box.dataset.valorSugerido : null;
            if (val) {
                const inputParam = document.getElementById('meta-aporte-parametro');
                if (inputParam) inputParam.value = valorParaCampoMetas(val);
            }
        });
    }

    // Submissão do formulário Nova / Editar Meta
    const formMeta = document.getElementById('form-nova-meta');
    if (formMeta) {
        formMeta.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titulo = document.getElementById('meta-titulo').value.trim();
            const valorAlvo = lerValorMetas(document.getElementById('meta-valor-alvo').value);
            const mesAlvo = obterAnoMesDeSelects('meta');
            const parametro = lerValorMetas(document.getElementById('meta-aporte-parametro').value);
            const aporteInicial = lerValorMetas(document.getElementById('meta-aporte-inicial').value) || 0;

            if (!titulo) {
                alert('Informe um título para a meta.');
                return;
            }
            if (!(valorAlvo > 0)) {
                alert('Informe um valor alvo válido.');
                return;
            }
            if (!(parametro > 0)) {
                alert('Informe um valor de aporte parâmetro válido.');
                return;
            }

            await salvarMetaFormulario({
                titulo,
                valor_alvo: valorAlvo,
                mes_alvo: mesAlvo,
                aporte_parametro: parametro,
                aporte_inicial: aporteInicial
            });

            if (typeof fecharModal === 'function') fecharModal('modal-nova-meta');
            formMeta.reset();
        });
    }

    // Submissão do formulário de aporte
    const formAporte = document.getElementById('form-aporte-meta');
    if (formAporte) {
        formAporte.addEventListener('submit', async (e) => {
            e.preventDefault();
            const metaId = document.getElementById('aporte-meta-id').value;
            const mes = obterAnoMesDeSelects('aporte');
            const valor = lerValorMetas(document.getElementById('aporte-valor').value);

            if (isNaN(valor) || valor < 0) {
                alert('Informe um valor válido.');
                return;
            }

            await salvarAporteMensal(metaId, mes, valor);
            if (typeof fecharModal === 'function') fecharModal('modal-aporte-meta');
            formAporte.reset();
        });
    }

    // Atualiza campo de valor ao trocar mês/ano no modal de aporte
    function atualizarValorAporteModal() {
        const metaId = document.getElementById('aporte-meta-id').value;
        const meta = todasMetas.find(m => String(m.id) === String(metaId));
        const mes = obterAnoMesDeSelects('aporte');
        const inputValor = document.getElementById('aporte-valor');
        if (meta && inputValor) {
            const val = (meta.aportes_mensais || {})[mes];
            inputValor.value = val ? valorParaCampoMetas(val) : '';
        }
    }

    const selAporteMes = document.getElementById('aporte-mes-select');
    if (selAporteMes) selAporteMes.addEventListener('change', atualizarValorAporteModal);
    const selAporteAno = document.getElementById('aporte-ano-select');
    if (selAporteAno) selAporteAno.addEventListener('change', atualizarValorAporteModal);

    // Filtros de chips
    document.querySelectorAll('.metas-filtros .btn-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.metas-filtros .btn-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroMetaAtual = btn.dataset.filtro;
            renderizarMetas();
        });
    });

    // Seletor de ordenação
    const selOrdem = document.getElementById('metas-ordem');
    if (selOrdem) {
        selOrdem.addEventListener('change', (e) => {
            ordemMetaAtual = e.target.value;
            renderizarMetas();
        });
    }

    // Atualização de abas e dados externos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-tab') === 'metas') carregarMetas();
        });
    });

    window.addEventListener('dadosCarregados', () => carregarMetas());
    carregarMetas();
});

// Inicialização imediata a partir do cache local para que os cards já reflitam os aportes
carregarMetasDoCache();
sincronizarCardsResumo();
