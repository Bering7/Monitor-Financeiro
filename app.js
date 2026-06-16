const browseBtn = document.getElementById('browse-btn');
const statusMessage = document.getElementById('status-message');

// CONTAINER DA LINHA DO DASHBOARD (CARDS + GRÁFICO)
const dashboardRow = document.getElementById('dashboard-row');
const txtEntradas = document.getElementById('total-entradas');
const txtSaidas = document.getElementById('total-saidas');
const txtSaldo = document.getElementById('saldo-final');

// ELEMENTOS DA TABELA
const tableContainer = document.getElementById('table-container');
const transactionsBody = document.getElementById('transactions-body');

let myChart = null; // Guarda o gráfico para poder limpá-lo a cada novo upload

const MyInvisibleInput = document.createElement('input');
MyInvisibleInput.type = 'file';
MyInvisibleInput.multiple = true; // NOVO: Permite selecionar múltiplos arquivos no gerenciador do sistema

browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    MyInvisibleInput.click(); 
});

MyInvisibleInput.addEventListener('change', (e) => {
    e.preventDefault();
    const files = e.target.files; // Captura a lista de arquivos selecionados
    if (files && files.length > 0) {
        uploadFiles(files);
    }
});

function uploadFiles(files) {
    statusMessage.classList.remove('hidden');
    statusMessage.textContent = 'Processando dados...';
    statusMessage.className = '';

    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
    }

    fetch('https://monitor-financeiro-backend.onrender.com/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro na resposta do servidor');
        return response.json();
    })
    .then(data => {
        if (data.erro) {
            statusMessage.textContent = 'Erro: ' + data.erro;
            statusMessage.className = 'error';
        } else {
            statusMessage.textContent = 'Extratos processados com sucesso!';
            statusMessage.className = 'success';

            document.getElementById('banco-badge').textContent = data.mensagem || "Extrato Combinado";

            // 1. Mostra o Dashboard Superior (Cards + Gráfico lado a lado)
            dashboardRow.classList.remove('hidden');
            dashboardRow.style.display = 'flex';

            txtEntradas.textContent = data.resumo.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            txtSaidas.textContent = data.resumo.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            txtSaldo.textContent = data.resumo.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            if (data.resumo.saldo >= 0) {
                txtSaldo.style.color = '#04d361';
            } else {
                txtSaldo.style.color = '#f75a68';
            }

            // --- NOVO: Controle Dinâmico do Cabeçalho da Tabela ---
            const exibeBanco = data.qtd_bancos > 1;
            const tableThead = document.querySelector('#table-container table thead');
            
            if (exibeBanco) {
                tableThead.innerHTML = `
                    <tr>
                        <th>Data</th>
                        <th>Banco</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th style="text-align: right;">Valor</th>
                    </tr>
                `;
            } else {
                tableThead.innerHTML = `
                    <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th style="text-align: right;">Valor</th>
                    </tr>
                `;
            }

            // 2. Preenche a tabela detalhada unificada
            transactionsBody.innerHTML = '';
            tableContainer.classList.remove('hidden');

            const gastosPorCategoria = {};

            data.transacoes.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #323238';
                
                const corValor = item.valor >= 0 ? '#04d361' : '#f75a68';
                const valorFormatado = item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                // Define estilos de cor discretos para as tags dos bancos
                let corBadgeBanco = '#820ad1'; // Nubank Roxo
                if (item.banco === 'Inter') corBadgeBanco = '#ff7a00'; // Inter Laranja
                if (item.banco === 'PicPay') corBadgeBanco = '#11c76f'; // PicPay Verde

                // Monta a célula do banco condicionalmente
                const tdBancoHtml = exibeBanco ? `<td style="padding: 10px;"><span style="background: ${corBadgeBanco}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${item.banco}</span></td>` : '';

                tr.innerHTML = `
                    <td style="padding: 10px; color: #e1e1e6;">${item.data}</td>
                    ${tdBancoHtml}
                    <td style="padding: 10px; color: #a8a8b3;">${item.descricao}</td>
                    <td style="padding: 10px; color: #a8a8b3;"><span style="background: #202024; padding: 4px 8px; border-radius: 4px;">${item.categoria || 'Geral'}</span></td>
                    <td class="no-break" style="padding: 10px; text-align: right; color: ${corValor};">${valorFormatado}</td>
                `;
                transactionsBody.appendChild(tr);

                if (item.valor < 0) {
                    const cat = item.categoria || 'Outros';
                    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Math.abs(item.valor);
                }
            });

            // 3. Renderiza o Gráfico de Rosca Acumulado
            if (myChart) {
                myChart.destroy();
            }

            const categorias = Object.keys(gastosPorCategoria);
            const valores = Object.values(gastosPorCategoria);

            const ctx = document.getElementById('categoryChart').getContext('2d');
            myChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categorias,
                    datasets: [{
                        data: valores,
                        backgroundColor: [
                            '#f75a68',
                            '#33b5e5',
                            '#ffbb33',
                            '#aa66cc',
                            '#04d361',
                            '#99cc00'
                        ],
                        borderWidth: 2,
                        borderColor: '#29292e'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#c4c4cc',
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }
    })
    .catch(error => {
        statusMessage.textContent = 'Erro ao conectar com o servidor.';
        statusMessage.className = 'error';
        console.error(error);
    });
}