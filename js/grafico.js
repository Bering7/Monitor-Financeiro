let meuGraficoInstancia = null;
let transacoesGlobais = []; // Guarda os dados para usarmos ao trocar de aba

const TEXTO_SOBRE_GRAFICO = "Este gráfico mostra apenas os valores de despesas e investimentos e a porcentagem em relação à receita total, sendo possível ver os valores de receita apenas na tabela. Para ver os valores de receita no gráfico, abra a aba 'Receita'.";

// Escuta o evento criado no api.js que avisa: "Os dados chegaram!"
window.addEventListener('dadosCarregados', (event) => {
    transacoesGlobais = event.detail || [];
    atualizarGrafico();
});

// Redesenha o gráfico quando o tema (claro/escuro) muda, para ajustar as cores do texto
window.addEventListener('temaAlterado', () => {
    atualizarGrafico();
});

// CORREÇÃO: Escuta o clique nas abas para re-desenhar o gráfico ao alternar entre elas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Aguarda a aba virar 'active' no DOM para atualizar
        setTimeout(() => {
            atualizarGrafico();
        }, 50);
    });
});

// Nomes exibidos de cada aba (usados no texto do botão "Sobre")
const NOMES_ABAS = {
    'receita': 'Receita',
    'despesa-fixa': 'Despesas Fixas',
    'despesa-variavel': 'Despesas Variáveis'
};

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