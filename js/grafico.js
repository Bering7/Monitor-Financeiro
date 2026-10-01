let meuGraficoInstancia = null;
let transacoesGlobais = []; // Guarda os dados para usarmos ao trocar de aba

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

function atualizarGrafico() {
    const canvas = document.getElementById('meuGrafico');
    const chartEmpty = document.getElementById('chart-empty');
    
    // Se os elementos não existirem na tela, evita erros no console
    if (!canvas || !chartEmpty) return;

    // Se ainda não carregou os dados
    if (!transacoesGlobais || transacoesGlobais.length === 0) {
        canvas.style.display = 'none';
        chartEmpty.style.display = 'flex';
        return;
    }

    // Descobre qual aba está aberta no momento
    const abaAtivaObj = document.querySelector('.tab-btn.active');
    const abaAtiva = abaAtivaObj ? abaAtivaObj.getAttribute('data-tab') : 'geral';

    let labels = [];
    let dados = [];
    let cores = [];

    if (abaAtiva === 'geral') {
        let totalReceitas = 0;
        let totalDespesasFixas = 0;
        let totalDespesasVariaveis = 0;

        transacoesGlobais.forEach(t => {
            const matchDesc = typeof filtroAtivo === 'undefined' || filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
            const matchCat = typeof filtroAtivo === 'undefined' || filtroAtivo.categoria === '' || (t.categoria && t.categoria.toLowerCase().includes(filtroAtivo.categoria));
            if (!matchDesc || !matchCat) return;

            if (t.tipo === 'receita') {
                totalReceitas += Number(t.valor) || 0;
            } else if (t.tipo === 'despesa-fixa') {
                totalDespesasFixas += Number(t.valor) || 0;
            } else if (t.tipo === 'despesa-variavel') {
                totalDespesasVariaveis += Number(t.valor) || 0;
            }
        });

        const percInvest = typeof porcentagemInvestimento !== 'undefined' 
            ? porcentagemInvestimento 
            : (parseFloat(localStorage.getItem('porcentagemInvestimento')) || 0);

        const valorInvestimento = totalReceitas * (percInvest / 100);

        const metricas = [
            { label: 'Receita', valor: totalReceitas, cor: '#10b981' },             // Verde
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
            const matchDesc = typeof filtroAtivo === 'undefined' || filtroAtivo.descricao === '' || (t.descricao && t.descricao.toLowerCase().includes(filtroAtivo.descricao));
            const matchCat = typeof filtroAtivo === 'undefined' || filtroAtivo.categoria === '' || (t.categoria && t.categoria.toLowerCase().includes(filtroAtivo.categoria));
            return matchDesc && matchCat;
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
            
            // Se for Despesa Fixa, agrupa pelo Nome (descrição). Senão, agrupa pela Categoria.
            if (abaAtiva === 'despesa-fixa') {
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
                        font: { family: "'Inter', sans-serif", size: 12 }
                    }
                }
            }
        }
    });
}