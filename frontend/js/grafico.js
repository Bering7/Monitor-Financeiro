let meuGraficoInstancia = null;
let transacoesGlobais = []; // Guarda os dados para usarmos ao trocar de aba

// Escuta o evento criado no api.js que avisa: "Os dados chegaram!"
window.addEventListener('dadosCarregados', (event) => {
    transacoesGlobais = event.detail;
    atualizarGrafico();
});

function atualizarGrafico() {
    // Se ainda não carregou os dados, não faz nada
    if (transacoesGlobais.length === 0) return;

    const canvas = document.getElementById('meuGrafico');
    const chartEmpty = document.getElementById('chart-empty');
    
    // Descobre qual aba está aberta no momento
    const abaAtiva = document.querySelector('.tab-btn.active').getAttribute('data-tab');

    // Pega apenas as transações da aba ativa
    const dadosAba = transacoesGlobais.filter(t => t.tipo === abaAtiva);

    if (dadosAba.length === 0) {
        // Se não tiver dados nesta aba, esconde o gráfico e mostra a mensagem
        canvas.style.display = 'none';
        chartEmpty.style.display = 'flex';
        return;
    }

    // Se tem dado, esconde a mensagem e mostra o canvas
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
        totais[chave_agrupamento] += t.valor;
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