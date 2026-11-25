let meuGraficoInstancia = null;
let transacoesGlobais = []; // Guarda os dados para usarmos ao trocar de aba
let slideGraficoAtual = 0;  // 0: Gráfico (Tela 1), 1: Top 4 Gastos (Tela 2)

const TEXTO_SOBRE_GRAFICO = "Este gráfico mostra apenas os valores de despesas e investimentos e a porcentagem em relação à receita total, sendo possível ver os valores de receita apenas na tabela. Para ver os valores de receita no gráfico, abra a aba 'Receita'.";

// Escuta o evento criado no api.js que avisa: "Os dados chegaram!"
window.addEventListener('dadosCarregados', (event) => {
    transacoesGlobais = event.detail || [];
    atualizarGrafico();
    renderizarTopGastos();
});

// Redesenha o gráfico quando o tema (claro/escuro) muda, para ajustar as cores do texto
window.addEventListener('temaAlterado', () => {
    atualizarGrafico();
    renderizarTopGastos();
});

// Escuta o clique nas abas para re-desenhar o gráfico ao alternar entre elas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Aguarda a aba virar 'active' no DOM para atualizar
        setTimeout(() => {
            atualizarGrafico();
            renderizarTopGastos();
        }, 50);
    });
});

// Nomes exibidos de cada aba (usados no texto do botão "Sobre")
const NOMES_ABAS = {
    'receita': 'Receita',
    'despesa-fixa': 'Despesas Fixas',
    'despesa-variavel': 'Despesas Variáveis',
    'gastos': 'Gastos',
    'metas': 'Metas'
};

// ==========================================
// CONTROLE DE NAVEGAÇÃO POR SETAS NO GRÁFICO
// ==========================================
function mudarSlideGrafico(novoIndice) {
    const slides = document.querySelectorAll('.chart-slide');
    const dots = document.querySelectorAll('.slide-indicator');
    if (!slides.length) return;

    slideGraficoAtual = (novoIndice + slides.length) % slides.length;

    slides.forEach((slide, idx) => {
        slide.classList.toggle('active', idx === slideGraficoAtual);
    });

    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === slideGraficoAtual);
    });

    const btnSobre = document.getElementById('btn-sobre-grafico');
    if (btnSobre) {
        btnSobre.style.display = (slideGraficoAtual === 0) ? 'inline-flex' : 'none';
    }

    if (slideGraficoAtual === 0) {
        if (meuGraficoInstancia) {
            meuGraficoInstancia.resize();
        } else {
            atualizarGrafico();
        }
    } else if (slideGraficoAtual === 1) {
        renderizarTopGastos();
    }
}

const btnChartPrev = document.getElementById('btn-chart-prev');
if (btnChartPrev) {
    btnChartPrev.addEventListener('click', () => mudarSlideGrafico(slideGraficoAtual - 1));
}

const btnChartNext = document.getElementById('btn-chart-next');
if (btnChartNext) {
    btnChartNext.addEventListener('click', () => mudarSlideGrafico(slideGraficoAtual + 1));
}

document.querySelectorAll('.slide-indicator').forEach(dot => {
    dot.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-slide'), 10) || 0;
        mudarSlideGrafico(idx);
    });
});

// ==========================================
// TELA 2: RENDERIZAR TOP 4 MAIORES GASTOS
// ==========================================
function renderizarTopGastos() {
    const container = document.getElementById('top-gastos-cards');
    const badgeMes = document.getElementById('top-gastos-mes-badge');
    if (!container) return;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtualIndex = hoje.getMonth();
    const mesAtualFormatado = `${anoAtual}-${String(mesAtualIndex + 1).padStart(2, '0')}`;

    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    if (badgeMes) {
        badgeMes.textContent = `${mesesNomes[mesAtualIndex]}/${anoAtual}`;
    }

    // Filtra apenas despesas (fixas ou variáveis) do mês atual
    let despesasMes = (transacoesGlobais || []).filter(t => {
        const isDespesa = t.tipo === 'despesa-fixa' || t.tipo === 'despesa-variavel';
        if (!isDespesa) return false;
        return !t.data || t.data.startsWith(mesAtualFormatado);
    });

    // Fallback: se não tiver lançamentos com data do mês atual, usa todas as despesas cadastradas
    if (despesasMes.length === 0) {
        despesasMes = (transacoesGlobais || []).filter(t => t.tipo === 'despesa-fixa' || t.tipo === 'despesa-variavel');
    }

    if (despesasMes.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 24px 0;">
                <p>Nenhum gasto registrado neste mês.</p>
            </div>
        `;
        return;
    }

    // Ordena pelo maior valor (decrescente)
    despesasMes.sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));

    // Seleciona os Top 4 maiores gastos
    const top4 = despesasMes.slice(0, 4);
    const maiorValor = Number(top4[0].valor) || 1;
    const totalGastoMes = despesasMes.reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

    container.innerHTML = '';
    top4.forEach((t, i) => {
        const valor = Number(t.valor) || 0;
        const pctMes = totalGastoMes > 0 ? ((valor / totalGastoMes) * 100).toFixed(1) : '0';
        const barWidth = Math.min(100, Math.max(12, (valor / maiorValor) * 100));

        const partesData = t.data ? t.data.split('-') : [];
        const dataFmt = t.sem_data ? 'Sem data' : (partesData.length === 3 ? `${partesData[2]}/${partesData[1]}` : (t.data || ''));

        const tipoRotulo = t.tipo === 'despesa-fixa' ? 'Fixa' : 'Variável';
        const categoriaTexto = t.categoria ? ` • ${t.categoria}` : '';

        const card = document.createElement('div');
        card.className = 'top-gasto-card';
        card.innerHTML = `
            <div class="top-gasto-top-row">
                <div class="top-gasto-info">
                    <span class="top-gasto-rank rank-${i + 1}">${i + 1}º</span>
                    <div class="top-gasto-texts">
                        <span class="top-gasto-desc" title="${escaparHTML(t.descricao)}">${escaparHTML(t.descricao)}</span>
                        <span class="top-gasto-meta">${dataFmt} • ${tipoRotulo}${escaparHTML(categoriaTexto)}</span>
                    </div>
                </div>
                <div class="top-gasto-val-area">
                    <span class="top-gasto-valor">${typeof formatarMoeda === 'function' ? formatarMoeda(valor) : 'R$ ' + valor.toFixed(2)}</span>
                    <span class="top-gasto-pct">${pctMes}% dos gastos</span>
                </div>
            </div>
            <div class="top-gasto-progress-track">
                <div class="top-gasto-progress-fill" style="width: ${barWidth}%;"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Botão "Sobre" do gráfico: Delegação de Eventos (um único listener no document)
document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-sobre-grafico')) return;

    const abaObj = document.querySelector('.tab-btn.active');
    const aba = abaObj ? abaObj.getAttribute('data-tab') : 'geral';

    if (aba === 'geral') {
        alert(TEXTO_SOBRE_GRAFICO);
        return;
    }

    const nomeAba = NOMES_ABAS[aba] || (abaObj ? abaObj.textContent.trim() : aba);
    alert(`A porcentagem apresentada na legenda deste gráfico representa a porcentagem daquele valor em relação ao valor total de Receita. Já a porcentagem no gráfico representa a porcentagem daquele valor em relação ao valor total de ${nomeAba}.`);
});

// Receita total (mesma regra do card "Receita"): soma todas as receitas, ignorando recebimentos futuros
function calcularReceitaTotal() {
    return (transacoesGlobais || []).reduce((soma, t) => {
        if (t.tipo !== 'receita') return soma;
        if (typeof receitaPendente === 'function' && receitaPendente(t)) return soma;
        return soma + (Number(t.valor) || 0);
    }, 0);
}

// Porcentagem da fatia em relação à RECEITA TOTAL: (valor_da_fatia / total_de_receitas) * 100
function calcularPorcentagemFatia(valorFatia, totalReceitas) {
    if (!(totalReceitas > 0)) return null; // sem receita não há porcentagem que faça sentido
    return ((Number(valorFatia) || 0) / totalReceitas) * 100;
}

function formatarPorcentagem(pct) {
    return pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function atualizarGrafico() {
    const canvas = document.getElementById('meuGrafico');
    const chartEmpty = document.getElementById('chart-empty');
    
    // Se os elementos não existirem na tela, evita erros no console
    if (!canvas || !chartEmpty) return;

    // Descobre qual aba está aberta no momento
    const abaAtivaObj = document.querySelector('.tab-btn.active');
    const abaAtiva = abaAtivaObj ? abaAtivaObj.getAttribute('data-tab') : 'geral';

    // Botão "Sobre" visível em todas as abas
    const btnSobre = document.getElementById('btn-sobre-grafico');
    if (btnSobre) btnSobre.style.display = 'inline-flex';

    // Se ainda não carregou os dados
    if (!transacoesGlobais || transacoesGlobais.length === 0) {
        canvas.style.display = 'none';
        chartEmpty.style.display = 'flex';
        return;
    }

    // Base de cálculo das porcentagens exibidas na legenda
    const totalReceitas = calcularReceitaTotal();

    let labels = [];
    let dados = [];
    let cores = [];

    if (abaAtiva === 'geral') {
        let receitasFiltradas = 0;
        let totalDespesasFixas = 0;
        let totalDespesasVariaveis = 0;

        transacoesGlobais.forEach(t => {
            const matchDesc = typeof filtroAtivo === 'undefined' || filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
            if (!matchDesc) return;

            if (t.tipo === 'receita') {
                // "Recebimento futuro" só conta quando o dia e o mês chegam
                if (typeof receitaPendente === 'function' && receitaPendente(t)) return;
                receitasFiltradas += Number(t.valor) || 0;
            } else if (t.tipo === 'despesa-fixa') {
                totalDespesasFixas += Number(t.valor) || 0;
            } else if (t.tipo === 'despesa-variavel') {
                totalDespesasVariaveis += Number(t.valor) || 0;
            }
        });

        const percInvest = typeof porcentagemInvestimento !== 'undefined' 
            ? porcentagemInvestimento 
            : (parseFloat(localStorage.getItem('porcentagemInvestimento')) || 0);

        // O investimento continua sendo calculado a partir da receita, mas a receita não aparece no gráfico
        const valorInvestimento = receitasFiltradas * (percInvest / 100);

        const metricas = [
            { label: 'Investimentos', valor: valorInvestimento, cor: '#3b82f6' },     // Azul
            { label: 'Despesas Fixas', valor: totalDespesasFixas, cor: '#ef4444' },   // Vermelho
            { label: 'Despesas Variáveis', valor: totalDespesasVariaveis, cor: '#f97316' } // Laranja
        ];

        // Filtra métricas com valor > 0 para exibição limpa no gráfico
        const metricasValidas = metricas.filter(m => m.valor > 0);

        if (metricasValidas.length === 0) {
            canvas.style.display = 'none';
            chartEmpty.style.display = 'flex';
            if (meuGraficoInstancia) {
                meuGraficoInstancia.destroy();
                meuGraficoInstancia = null;
            }
            return;
        }

        labels = metricasValidas.map(m => m.label);
        dados = metricasValidas.map(m => m.valor);
        cores = metricasValidas.map(m => m.cor);
    } else if (abaAtiva === 'gastos') {
        // Aba Gastos: Exibe todos os gastos (fixos + variáveis) agrupados por categoria
        const dadosGastos = transacoesGlobais.filter(t => t.tipo === 'despesa-fixa' || t.tipo === 'despesa-variavel');
        if (dadosGastos.length === 0) {
            canvas.style.display = 'none';
            chartEmpty.style.display = 'flex';
            if (meuGraficoInstancia) {
                meuGraficoInstancia.destroy();
                meuGraficoInstancia = null;
            }
            return;
        }

        const totais = {};
        dadosGastos.forEach(t => {
            const chave = t.categoria || (t.tipo === 'despesa-fixa' ? 'Despesa Fixa' : 'Despesa Variável');
            totais[chave] = (totais[chave] || 0) + (Number(t.valor) || 0);
        });

        labels = Object.keys(totais);
        dados = Object.values(totais);
        const paletaCores = [
            '#ef4444', '#f97316', '#f59e0b', '#8b5cf6',
            '#3b82f6', '#ec4899', '#10b981', '#6366f1',
            '#64748b', '#06b6d4', '#f43f5e'
        ];
        cores = paletaCores.slice(0, labels.length);
    } else {
        // Pega apenas as transações da aba ativa
        const dadosAba = transacoesGlobais.filter(t => {
            if (t.tipo !== abaAtiva) return false;
            if (typeof receitaPendente === 'function' && receitaPendente(t)) return false;
            const matchDesc = typeof filtroAtivo === 'undefined' || filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
            return matchDesc;
        });

        if (dadosAba.length === 0) {
            // Se não tiver dados nesta aba, esconde o gráfico e mostra a mensagem
            canvas.style.display = 'none';
            chartEmpty.style.display = 'flex';
            
            // Destrói gráfico antigo se existir
            if (meuGraficoInstancia) {
                meuGraficoInstancia.destroy();
                meuGraficoInstancia = null;
            }
            return;
        }

        // Agrupa os valores para formar as fatias da rosca
        const totais = {};
        dadosAba.forEach(t => {
            let chave_agrupamento;
            
            // Despesas (fixa e variável) agrupam pelo Nome (descrição). Receita agrupa pelo tipo de renda.
            if (abaAtiva === 'despesa-fixa' || abaAtiva === 'despesa-variavel') {
                chave_agrupamento = t.descricao || 'Outros';
            } else {
                chave_agrupamento = t.categoria || 'Outros';
            }

            if (!totais[chave_agrupamento]) {
                totais[chave_agrupamento] = 0;
            }
            totais[chave_agrupamento] += Number(t.valor) || 0;
        });

        labels = Object.keys(totais);
        dados = Object.values(totais);

        // Paleta de cores para o gráfico
        const paletaCores = [
            '#3b82f6', '#10b981', '#ef4444', '#f59e0b', 
            '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1',
            '#64748b', '#06b6d4', '#f43f5e'
        ];
        cores = paletaCores.slice(0, labels.length);
    }

    // Se tem dados, esconde a mensagem e mostra o canvas
    canvas.style.display = 'block';
    chartEmpty.style.display = 'none';

    // Se já existe um gráfico desenhado antes, nós o destruímos para desenhar o novo
    if (meuGraficoInstancia) {
        meuGraficoInstancia.destroy();
    }

    // Garante que a biblioteca do Chart.js está carregada
    if (typeof Chart === 'undefined') return;

    // Cor do texto da legenda acompanha o tema atual
    const corTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6b7280';

    // Desenha o novo gráfico com os dados da aba atual
    meuGraficoInstancia = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
                backgroundColor: cores,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', 
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: corTexto,
                        font: { family: "'Inter', sans-serif", size: 12 },
                        // Legenda: "Despesas Fixas (35,0%)" — % em relação à receita total
                        generateLabels: (chart) => {
                            const padrao = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
                            const valores = chart.data.datasets[0].data;
                            return padrao.map((item) => {
                                const pct = calcularPorcentagemFatia(valores[item.index], totalReceitas);
                                if (pct === null) return item; // sem receita: mostra só o nome
                                return { ...item, text: `${item.text} (${formatarPorcentagem(pct)})` };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        // Tooltip: valor (R$) + % em relação ao TOTAL DA ABA ATUAL (soma das fatias exibidas)
                        title: () => '',
                        label: (item) => {
                            const valor = Number(item.parsed) || 0;
                            const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            const totalAba = item.dataset.data.reduce((soma, v, i) => {
                                return item.chart.getDataVisibility(i) ? soma + (Number(v) || 0) : soma;
                            }, 0);
                            if (!(totalAba > 0)) return valorFmt;
                            return `${valorFmt} (${formatarPorcentagem((valor / totalAba) * 100)})`;
                        }
                    }
                }
            }
        }
    });
}