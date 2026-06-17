// --- CONFIGURAÇÃO DA API (BACKEND EM PRODUÇÃO) ---
const API_URL = 'https://monitor-financeiro-backend.onrender.com';

// --- ELEMENTOS DO DOM ---
// Usamos seletores dinâmicos ou verificações para evitar que o script quebre se a ordem falhar
const browseBtn = document.getElementById('browse-btn');
const statusMessage = document.getElementById('status-message');
const dashboardRow = document.getElementById('dashboard-row');
const txtEntradas = document.getElementById('total-entradas');
const txtSaidas = document.getElementById('total-saidas');
const txtSaldo = document.getElementById('saldo-final');
const tableContainer = document.getElementById('table-container');
const transactionsBody = document.getElementById('transactions-body');

// ARMAZENAMENTO GLOBAL DOS DADOS PARA O FILTRO FUNCIONAR EM TEMPO REAL
let todasAsTransacoes = []; 
let myChart = null; // Guarda o gráfico para poder limpá-lo a cada novo upload

const MyInvisibleInput = document.createElement('input');
MyInvisibleInput.type = 'file';
MyInvisibleInput.multiple = true; // Permite selecionar múltiplos arquivos no gerenciador do sistema

// --- VERIFICAÇÃO DE SESSÃO ATIVA AO RECARREGAR A PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none';
        if(document.getElementById('dashboard-container')) document.getElementById('dashboard-container').style.display = 'block';
        carregarHistoricoBanco();
    } else {
        if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'block';
        if(document.getElementById('dashboard-container')) document.getElementById('dashboard-container').style.display = 'none';
    }
});

if (browseBtn) {
    browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        MyInvisibleInput.click(); 
    });
}

MyInvisibleInput.addEventListener('change', (e) => {
    e.preventDefault();
    const files = e.target.files; 
    if (files && files.length > 0) {
        uploadFiles(files);
    }
});

function uploadFiles(files) {
    if (!statusMessage) return;
    statusMessage.classList.remove('hidden');
    statusMessage.textContent = 'Processando dados...';
    statusMessage.className = '';

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
    }

    const token = localStorage.getItem('token');

    fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token
        },
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
            statusMessage.textContent = 'Extratos processados e salvos no banco com sucesso!';
            statusMessage.className = 'success';
            processarEExibirDados(data);
        }
    })
    .catch(error => {
        statusMessage.textContent = 'Erro ao conectar com o servidor.';
        statusMessage.className = 'error';
        console.error(error);
    });
}

// Função para alternar visualmente entre as telas de Login e Cadastro
function alternarAbasAuth(mostrarLogin) {
    const loginBox = document.getElementById('login-box');
    const cadastroBox = document.getElementById('cadastro-box');
    
    if (loginBox && cadastroBox) {
        if (mostrarLogin) {
            loginBox.style.display = 'block';
            cadastroBox.style.display = 'none';
        } else {
            loginBox.style.display = 'none';
            cadastroBox.style.display = 'block';
        }
    }
}

// Consome a rota do backend em Python para cadastrar o usuário no SQLite
function executarCadastro() {
    const nome = document.getElementById('cad-nome').value;
    const email = document.getElementById('cad-email').value;
    const senha = document.getElementById('cad-senha').value;

    if (!nome || !email || !senha) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    fetch(`${API_URL}/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(res => {
        if (res.status === 201) {
            alert(res.body.mensagem);
            alternarAbasAuth(true); 
        } else {
            alert("Erro: " + res.body.erro);
        }
    })
    .catch(err => console.error("Erro ao cadastrar:", err));
}

// Valida o usuário e guarda o JWT no localStorage do navegador
function executarLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    if (!email || !senha) {
        alert("Preencha o e-mail e a senha.");
        return;
    }

    fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(res => {
        if (res.status === 200) {
            localStorage.setItem('token', res.body.token);
            localStorage.setItem('usuario', JSON.stringify(res.body.usuario));
            
            alert(`Bem-vindo, ${res.body.usuario.nome}!`);
            
            if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none';
            if(document.getElementById('dashboard-container')) document.getElementById('dashboard-container').style.display = 'block';
            
            carregarHistoricoBanco();
        } else {
            alert("Erro: " + res.body.erro);
        }
    })
    .catch(err => {
        alert("Erro ao conectar com o backend hospedado. Se for o primeiro acesso, o servidor pode levar até 1 minuto para acordar.");
        console.error("Erro ao fazer login:", err);
    });
}

function carregarHistoricoBanco() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    fetch(`${API_URL}/transacoes`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao buscar dados históricos');
        return response.json();
    })
    .then(data => {
        if (data.transacoes && data.transacoes.length > 0) {
            if (statusMessage) {
                statusMessage.textContent = 'Dados históricos carregados do banco de dados!';
                statusMessage.className = 'success';
            }
            processarEExibirDados(data);
        } else {
            if (statusMessage) {
                statusMessage.textContent = 'Nenhum extrato guardado. Faça o upload para começar!';
                statusMessage.className = '';
            }
        }
    })
    .catch(err => console.error("Erro ao carregar histórico:", err));
}

function executarLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    todasAsTransacoes = [];

    if (myChart) {
        myChart.destroy();
        myChart = null;
    }
    if(transactionsBody) transactionsBody.innerHTML = '';
    if(txtEntradas) txtEntradas.textContent = 'R$ 0,00';
    if(txtSaidas) txtSaidas.textContent = 'R$ 0,00';
    if(txtSaldo) {
        txtSaldo.textContent = 'R$ 0,00';
        txtSaldo.style.color = '#e1e1e6';
    }
    if(statusMessage) {
        statusMessage.textContent = '';
        statusMessage.className = 'hidden';
    }
    if(dashboardRow) dashboardRow.style.display = 'none';
    if(tableContainer) tableContainer.classList.add('hidden');
    
    const filterCont = document.getElementById('filter-container');
    if(filterCont) filterCont.classList.add('hidden');

    if(document.getElementById('filter-nubank')) document.getElementById('filter-nubank').checked = true;
    if(document.getElementById('filter-inter')) document.getElementById('filter-inter').checked = true;
    if(document.getElementById('filter-picpay')) document.getElementById('filter-picpay').checked = true;

    if(document.getElementById('dashboard-container')) document.getElementById('dashboard-container').style.display = 'none';
    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'block';
    alternarAbasAuth(true); 
}

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        executarLogout();
    });
}

function processarEExibirDados(data) {
    todasAsTransacoes = data.transacoes || [];
    
    const badge = document.getElementById('banco-badge');
    if (badge) badge.textContent = data.mensagem || "Extrato Combinado";
    
    const filterCont = document.getElementById('filter-container');
    if (filterCont) filterCont.classList.remove('hidden');
    
    filtrarPorBanco();
}

function filtrarPorBanco() {
    const bancosSelecionados = [];
    if (document.getElementById('filter-nubank') && document.getElementById('filter-nubank').checked) bancosSelecionados.push('Nubank');
    if (document.getElementById('filter-inter') && document.getElementById('filter-inter').checked) bancosSelecionados.push('Inter');
    if (document.getElementById('filter-picpay') && document.getElementById('filter-picpay').checked) bancosSelecionados.push('PicPay');

    const transacoesFiltradas = todasAsTransacoes.filter(item => bancosSelecionados.includes(item.banco));
    exibirDadosNaTela(transacoesFiltradas);
}

function exibirDadosNaTela(transacoes) {
    if(dashboardRow) {
        dashboardRow.classList.remove('hidden');
        dashboardRow.style.display = 'flex';
    }

    let entradas = 0;
    let saidas = 0;
    
    transacoes.forEach(item => {
        if (item.valor >= 0) {
            entradas += item.valor;
        } else {
            saidas += item.valor;
        }
    });
    
    let saldo = entradas + saidas;

    if(txtEntradas) txtEntradas.textContent = entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if(txtSaidas) txtSaidas.textContent = saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if(txtSaldo) {
        txtSaldo.textContent = saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        txtSaldo.style.color = saldo >= 0 ? '#04d361' : '#f75a68';
    }

    const tableThead = document.querySelector('#table-container table thead');
    if (tableThead) {
        tableThead.innerHTML = `
            <tr>
                <th>Data</th>
                <th>Banco</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th style="text-align: right;">Valor</th>
            </tr>
        `;
    }

    if(transactionsBody) {
        transactionsBody.innerHTML = '';
        if(tableContainer) tableContainer.classList.remove('hidden');
        const gastosPorCategoria = {};

        transacoes.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #323238';
            const corValor = item.valor >= 0 ? '#04d361' : '#f75a68';
            const valorFormatado = item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            let corBadgeBanco = '#820ad1'; 
            if (item.banco === 'Inter') corBadgeBanco = '#ff7a00';
            if (item.banco === 'PicPay') corBadgeBanco = '#11c76f';

            const tdBancoHtml = `<td style="padding: 10px;"><span style="background: ${corBadgeBanco}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${item.banco}</span></td>`;

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

        if (myChart) myChart.destroy();
        const categorias = Object.keys(gastosPorCategoria);
        const valores = Object.values(gastosPorCategoria);
        const chartElem = document.getElementById('categoryChart');
        
        if (chartElem) {
            const ctx = chartElem.getContext('2d');
            myChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categorias,
                    datasets: [{
                        data: valores,
                        backgroundColor: ['#f75a68', '#33b5e5', '#ffbb33', '#aa66cc', '#04d361', '#99cc00'],
                        borderWidth: 2,
                        borderColor: '#29292e'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom', labels: { color: '#c4c4cc', font: { size: 11 } } } }
                }
            });
        }
    }
}