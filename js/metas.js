// ==========================================
// METAS FINANCEIRAS (CRUD + APORTES + SUPABASE)
// ==========================================

let todasMetas = [];
let metaParaAporteId = null;

// Funções utilitárias locais de apoio
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

function mesAtualISO() {
    if (typeof anoMesAtual === 'function') return anoMesAtual();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarMesBR(anoMes) {
    if (!anoMes || !anoMes.includes('-')) return anoMes || '';
    const [ano, mes] = anoMes.split('-');
    return `${mes}/${ano}`;
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

// Persistência local de fallback
function salvarMetasLocal(userId, metas) {
    try {
        const chave = 'metas_' + (userId || 'anonimo');
        localStorage.setItem(chave, JSON.stringify(metas));
    } catch (e) {}
}

function carregarMetasLocal(userId) {
    try {
        const chave = 'metas_' + (userId || 'anonimo');
        const salvo = localStorage.getItem(chave);
        return salvo ? JSON.parse(salvo) : [];
    } catch (e) {
        return [];
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
            console.warn('Supabase offline ou erro nas metas. Usando fallback local:', erro);
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
                    Clique no botão <strong>"+ Nova Meta"</strong> acima para criar seu primeiro objetivo!
                </span>
            </div>
        `;
        if (resumoEl) resumoEl.textContent = 'Defina objetivos e acompanhe seu ritmo mensal de economia.';
        return;
    }

    let somaAlvos = 0;
    let somaGuardado = 0;

    container.innerHTML = '';
    todasMetas.forEach(meta => {
        const valorAlvo = Number(meta.valor_alvo) || 0;
        const parametro = Number(meta.aporte_parametro) || 0;
        const aportes = meta.aportes_mensais || {};

        const totalAcumulado = Object.values(aportes).reduce((soma, v) => soma + (Number(v) || 0), 0);
        const progresso = valorAlvo > 0 ? Math.min(100, (totalAcumulado / valorAlvo) * 100) : 0;
        const restante = Math.max(0, valorAlvo - totalAcumulado);

        somaAlvos += valorAlvo;
        somaGuardado += totalAcumulado;

        // Ritmo médio dos meses com aportes registrados
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

        const card = document.createElement('div');
        card.className = 'meta-card';
        card.innerHTML = `
            <div class="meta-card-header">
                <div class="meta-card-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="6"></circle>
                        <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                    <span>${meta.titulo ? meta.titulo.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : 'Meta'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="meta-badge-prazo" title="Mês alvo">Prazo: ${formatarMesBR(meta.mes_alvo)}</span>
                    <button type="button" class="btn-meta-excluir" onclick="excluirMeta('${meta.id}')" title="Excluir meta">
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
                    <span class="meta-pct-badge">${progresso.toFixed(1)}%</span>
                </div>
                <div class="meta-progress-track">
                    <div class="meta-progress-fill" style="width: ${progresso}%;"></div>
                </div>
            </div>

            <div class="meta-stats-grid">
                <div class="meta-stat-item">
                    <span class="meta-stat-label">Falta guardar</span>
                    <span class="meta-stat-value">${formatarMoedaMetas(restante)}</span>
                </div>
                <div class="meta-stat-item">
                    <span class="meta-stat-label">Aporte Parâmetro</span>
                    <span class="meta-stat-value">${formatarMoedaMetas(parametro)}/mês</span>
                </div>
                <div class="meta-stat-item">
                    <span class="meta-stat-label">Ritmo Médio</span>
                    <span class="meta-stat-value ${ritmoClass}">${ritmoTexto}</span>
                </div>
            </div>

            <div class="meta-actions-row">
                <span style="font-size: 12px; color: var(--text-muted);">
                    ${qtdMeses > 0 ? `${qtdMeses} mês(es) com aporte` : 'Nenhum aporte registrado'}
                </span>
                <button type="button" class="btn-action-list" onclick="abrirModalAporte('${meta.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Registrar Aporte
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    if (resumoEl) {
        const pctGeral = somaAlvos > 0 ? ((somaGuardado / somaAlvos) * 100).toFixed(1) : 0;
        resumoEl.textContent = `${todasMetas.length} meta(s) ativa(s) • Total guardado: ${formatarMoedaMetas(somaGuardado)} de ${formatarMoedaMetas(somaAlvos)} (${pctGeral}%)`;
    }
}

// ==========================================
// CRIAR META
// ==========================================
async function criarMeta({ titulo, valor_alvo, mes_alvo, aporte_parametro, aporte_inicial }) {
    const userId = await obterUsuarioId();
    const aportes = {};
    if (aporte_inicial > 0) {
        aportes[mesAtualISO()] = aporte_inicial;
    }

    const nova = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'meta_' + Date.now(),
        user_id: userId,
        titulo: titulo.trim(),
        valor_alvo: Number(valor_alvo) || 0,
        mes_alvo: mes_alvo,
        aporte_parametro: Number(aporte_parametro) || 0,
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
            } else if (error) {
                console.warn('Erro ao salvar meta no Supabase:', error);
            }
        } catch (e) {
            console.warn('Erro na chamada Supabase:', e);
        }
    }

    todasMetas.unshift(nova);
    salvarMetasLocal(userId, todasMetas);
    renderizarMetas();
}

// ==========================================
// REGISTRAR / ATUALIZAR APORTE MENSAL
// ==========================================
function abrirModalAporte(metaId) {
    const meta = todasMetas.find(m => String(m.id) === String(metaId));
    if (!meta) return;

    metaParaAporteId = meta.id;
    const subtitulo = document.getElementById('aporte-meta-subtitulo');
    const inputMes = document.getElementById('aporte-mes');
    const inputValor = document.getElementById('aporte-valor');
    const inputId = document.getElementById('aporte-meta-id');

    if (subtitulo) subtitulo.textContent = `Meta: ${meta.titulo}`;
    if (inputId) inputId.value = meta.id;

    const mesAtual = mesAtualISO();
    if (inputMes) inputMes.value = mesAtual;

    const valorJaSalvo = (meta.aportes_mensais || {})[mesAtual];
    if (inputValor) inputValor.value = valorJaSalvo ? formatarMoedaMetas(valorJaSalvo) : '';

    if (typeof abrirModal === 'function') {
        abrirModal('modal-aporte-meta');
    }
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
            console.warn('Erro ao excluir no Supabase:', e);
        }
    }

    todasMetas = todasMetas.filter(m => String(m.id) !== String(metaId));
    salvarMetasLocal(userId, todasMetas);
    renderizarMetas();
}

// ==========================================
// INICIALIZAÇÃO E EVENTOS DE FORMULÁRIO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Botão abrir modal nova meta
    const btnNovaMeta = document.getElementById('btn-nova-meta');
    if (btnNovaMeta) {
        btnNovaMeta.addEventListener('click', () => {
            const form = document.getElementById('form-nova-meta');
            if (form) form.reset();
            const inputMes = document.getElementById('meta-mes-alvo');
            if (inputMes) {
                // Sugere 6 meses no futuro como padrão
                const d = new Date();
                d.setMonth(d.getMonth() + 6);
                inputMes.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            if (typeof abrirModal === 'function') abrirModal('modal-nova-meta');
        });
    }

    // Formulário Nova Meta
    const formNovaMeta = document.getElementById('form-nova-meta');
    if (formNovaMeta) {
        formNovaMeta.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titulo = document.getElementById('meta-titulo').value;
            const valorAlvo = lerValorMetas(document.getElementById('meta-valor-alvo').value);
            const mesAlvo = document.getElementById('meta-mes-alvo').value;
            const parametro = lerValorMetas(document.getElementById('meta-aporte-parametro').value);
            const aporteInicial = lerValorMetas(document.getElementById('meta-aporte-inicial').value) || 0;

            if (!(valorAlvo > 0)) {
                alert('Informe um valor alvo válido.');
                return;
            }
            if (!mesAlvo) {
                alert('Selecione o mês alvo.');
                return;
            }
            if (!(parametro > 0)) {
                alert('Informe um valor de aporte parâmetro válido.');
                return;
            }

            await criarMeta({
                titulo,
                valor_alvo: valorAlvo,
                mes_alvo: mesAlvo,
                aporte_parametro: parametro,
                aporte_inicial: aporteInicial
            });

            if (typeof fecharModal === 'function') fecharModal('modal-nova-meta');
            formNovaMeta.reset();
        });
    }

    // Formulário Registrar Aporte
    const formAporte = document.getElementById('form-aporte-meta');
    if (formAporte) {
        formAporte.addEventListener('submit', async (e) => {
            e.preventDefault();
            const metaId = document.getElementById('aporte-meta-id').value;
            const mes = document.getElementById('aporte-mes').value;
            const valor = lerValorMetas(document.getElementById('aporte-valor').value);

            if (!mes) {
                alert('Selecione o mês de referência.');
                return;
            }
            if (isNaN(valor) || valor < 0) {
                alert('Informe um valor válido.');
                return;
            }

            await salvarAporteMensal(metaId, mes, valor);
            if (typeof fecharModal === 'function') fecharModal('modal-aporte-meta');
            formAporte.reset();
        });
    }

    // Atualiza o input de valor guardado ao mudar o mês no modal de aporte
    const inputAporteMes = document.getElementById('aporte-mes');
    if (inputAporteMes) {
        inputAporteMes.addEventListener('change', () => {
            const metaId = document.getElementById('aporte-meta-id').value;
            const meta = todasMetas.find(m => String(m.id) === String(metaId));
            const inputValor = document.getElementById('aporte-valor');
            if (meta && inputValor) {
                const val = (meta.aportes_mensais || {})[inputAporteMes.value];
                inputValor.value = val ? formatarMoedaMetas(val) : '';
            }
        });
    }

    // Listener para carregar metas ao alternar abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-tab') === 'metas') {
                carregarMetas();
            }
        });
    });

    // Carrega quando os dados iniciais do app terminarem de carregar
    window.addEventListener('dadosCarregados', () => {
        carregarMetas();
    });

    // Primeira carga inicial
    carregarMetas();
});
