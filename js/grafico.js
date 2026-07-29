let meuGraficoInstancia = null;
let transacoesGlobais = []; // Guarda os dados para usarmos ao trocar de aba

// Escuta o evento criado no api.js que avisa: "Os dados chegaram!"
window.addEventListener('dadosCarregados', (event) => {
    transacoesGlobais = event.detail || [];
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
    const abaAtiva = abaAtivaObj ? abaAtivaObj.getAttribute('data-tab') : 'receita';

    // Pega apenas as transações da aba ativa
    const dadosAba = transacoesGlobais.filter(t => t.tipo === abaAtiva);

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

    // Se tem dados, esconde a mensagem e mostra o canvas
    canvas.style.display = 'block';
    chartEmpty.style.display = 'none';

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

    const labels = Object.keys(totais);
    const dados = Object.values(totais);

    // Paleta de cores para o gráfico
    const cores = [
        '#3b82f6', '#10b981', '#ef4444', '#f59e0b', 
        '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1',
        '#64748b', '#06b6d4', '#f43f5e'
    ];

    // Se já existe um gráfico desenhado antes, nós o destruímos para desenhar o novo
    if (meuGraficoInstancia) {
        meuGraficoInstancia.destroy();
    }

    // Garante que a biblioteca do Chart.js está carregada
    if (typeof Chart === 'undefined') return;

    // Desenha o novo gráfico com os dados da aba atual
    meuGraficoInstancia = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dados,
                backgroundColor: cores.slice(0, labels.length),
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
                        font: { family: "'Inter', sans-serif", size: 12 }
                    }
                }
            }
        }
    });
}