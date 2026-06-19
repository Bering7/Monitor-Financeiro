// --- CONFIGURAÇÃO DA API (BACKEND EM PRODUÇÃO) ---
const API_URL = 'https://monitor-financeiro-backend.onrender.com';

// --- ELEMENTOS DO DOM ---
const browseBtn = document.getElementById('browse-btn');
const statusMessage = document.getElementById('status-message');
const dashboardRow = document.getElementById('dashboard-row');
const txtEntradas = document.getElementById('total-entradas');
const txtSaidas = document.getElementById('total-saidas');
const txtSaldo = document.getElementById('saldo-final');
const tableContainer = document.getElementById('table-container');
const transactionsBody = document.getElementById('transactions-body');
const emptyState = document.getElementById('empty-state'); // NOVO: Referência para a tela vazia

// ARMAZENAMENTO GLOBAL DOS DADOS PARA O FILTRO FUNCIONAR EM TEMPO REAL
let todasAsTransacoes = []; 
let myChart = null; 

const MyInvisibleInput = document.createElement('input');
MyInvisibleInput.type = 'file';
MyInvisibleInput.multiple = true; 

// --- AUXILIAR: EXIBIR MENSAGEM DE ERRO ESTILO INSTAGRAM ---
function exibirAvisoFormulario(containerId, mensagem, tipo = 'erro') {
    removerAvisosFormulario(containerId);

    const container = document.getElementById(containerId);
    if (!container) return;

    const divAviso = document.createElement('div');
    divAviso.className = `form-alert-box ${tipo}`;
    
    divAviso.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>${mensagem}</span>
    `;

    const subtitulo = container.querySelector('.auth-subtitle') || container.querySelector('h2');
    if (subtitulo) {
        subtitulo.insertAdjacentElement('afterend', divAviso);
    }
}

function removerAvisosFormulario(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const avisoAntigo = container.querySelector('.form-alert-box');
    if (avisoAntigo) avisoAntigo.remove();
}

// --- ATRIBUIR EVENTOS ASSIM QUE A PÁGINA CARREGAR ---
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

    const btnEntrar = document.querySelector('.btn-login');
    if (btnEntrar) {
        btnEntrar.removeAttribute('onclick'); 
        btnEntrar.addEventListener('click', (e) => {
            e.preventDefault();
            executarLogin();
        });
    }

    const btnRegistrar = document.querySelector('.btn-cadastro');
    if (btnRegistrar) {
        btnRegistrar.removeAttribute('onclick');
        btnRegistrar.addEventListener('click', (e) => {
            e.preventDefault();
            executarCadastro();
        });
    }

    // Atalho de teclado: Enter no campo de senha do Cadastro
    const campoSenhaCad = document.getElementById('cad-senha');
    if (campoSenhaCad) {
        campoSenhaCad.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executarCadastro();
        });
    }

    // Limpar erros da tela de login ao começar a digitar novamente
    const camposLogin = document.querySelectorAll('#login-box input');
    camposLogin.forEach(input => {
        input.addEventListener('input', () => removerAvisosFormulario('login-box'));
    });

    const camposCad = document.querySelectorAll('#cadastro-box input');
    camposCad.forEach(input => {
        input.addEventListener('input', () => removerAvisosFormulario('cadastro-box'));
    });

    // Atalho de teclado: Enter no campo de senha do Login
    const campoSenhaLogin = document.getElementById('login-senha');
    if (campoSenhaLogin) {
        campoSenhaLogin.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executarLogin();
        });
    }
});

// --- EVENTOS DE UPLOAD ---
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
        headers: { 'Authorization': 'Bearer ' + token },
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

// --- FUNÇÕES DE AUTENTICAÇÃO ---
function alternarAbasAuth(mostrarLogin) {
    removerAvisosFormulario('login-box');
    removerAvisosFormulario('cadastro-box');
    
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

function executarCadastro() {
    const nome = document.getElementById('cad-nome').value;
    const email = document.getElementById('cad-email').value;
    const senha = document.getElementById('cad-senha').value;
    const btn = document.querySelector('.btn-cadastro');

    if (!nome || !email || !senha) {
        exibirAvisoFormulario('cadastro-box', 'Por favor, preencha todos os campos do formulário.');
        return;
    }

    if(btn) { btn.disabled = true; btn.textContent = 'Cadastrando...'; }

    fetch(`${API_URL}/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
    })
    .then(response => response.json().then(data => ({ status: response.status, body: data })))
    .then(res => {
        if (res.status === 201) {
            alternarAbasAuth(true);
            exibirAvisoFormulario('login-box', 'Conta criada com sucesso! Faça login abaixo.', 'sucesso');
        } else {
            exibirAvisoFormulario('cadastro-box', res.body.erro || 'Erro ao efetuar cadastro.');
        }
    })
    .catch(err => {
        exibirAvisoFormulario('cadastro-box', 'Sem conexão com o servidor do Monitor Financeiro.');
        console.error("Erro ao cadastrar:", err);
    })
    .finally(() => {
        if(btn) { btn.disabled = false; btn.textContent = 'Registrar'; }
    });
}

function executarLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const btn = document.querySelector('.btn-login');

    if (!email || !senha) {
        exibirAvisoFormulario('login-box', 'As credenciais de e-mail e senha são obrigatórias.');
        return;
    }

    if(btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

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
            
            if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none';
            if(document.getElementById('dashboard-container')) document.getElementById('dashboard-container').style.display = 'block';
            
            carregarHistoricoBanco();
        } else {
            exibirAvisoFormulario('login-box', res.body.erro || 'A senha inserida ou usuário estão incorretos.');
        }
    })
    .catch(err => {
        exibirAvisoFormulario('login-box', 'O servidor remoto está acordando. Tente novamente em alguns segundos.');
        console.error("Erro ao fazer login:", err);
    })
    .finally(() => {
        if(btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
    });
}

function carregarHistoricoBanco() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    fetch(`${API_URL}/transacoes`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
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
    if(emptyState) emptyState.classList.add('hidden'); // Esconde o aviso de lista vazia
    
    const filterCont = document.getElementById('filter-container');
    if(filterCont) filterCont.classList.add('hidden');

    if(document.getElementById('filter-nubank')) document.getElementById('filter-nubank').checked = true;
    if(document.getElementById('filter-inter')) document.getElementById('filter-inter').checked = true;
    if(document.getElementById('filter-picpay')) document.getElementById('filter-picpay').checked = true;
    if(document.getElementById('filter-period')) document.getElementById('filter-period').value = '30'; // Reseta para 30 dias

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

// --- NOVO: FUNÇÃO PARA CONVERTER DATA DD/MM/YYYY PARA FORMATO DE CÁLCULO ---
function converterDataBrasileira(dataStr) {
    const partes = dataStr.split('/');
    // No JavaScript, o mês começa no 0 (Janeiro = 0, Dezembro = 11), por isso o "- 1"
    return new Date(partes[2], partes[1] - 1, partes[0]);
}

// --- PROCESSAMENTO E EXIBIÇÃO EM TELA ---
function processarEExibirDados(data) {
    todasAsTransacoes = data.transacoes || [];
    const badge = document.getElementById('banco-badge');
    if (badge) badge.textContent = data.mensagem || "Extrato Combinado";
    const filterCont = document.getElementById('filter-container');
    if (filterCont) filterCont.classList.remove('hidden');
    
    filtrarPorBanco(); // Essa função agora cuida de Bancos + Datas
}

// --- ATUALIZADO: AGORA FILTRA POR BANCO E TAMBÉM POR DATA ---
function filtrarPorBanco() {
    // 1. Descobre quais bancos estão marcados
    const bancosSelecionados = [];
    if (document.getElementById('filter-nubank') && document.getElementById('filter-nubank').checked) bancosSelecionados.push('Nubank');
    if (document.getElementById('filter-inter') && document.getElementById('filter-inter').checked) bancosSelecionados.push('Inter');
    if (document.getElementById('filter-picpay') && document.getElementById('filter-picpay').checked) bancosSelecionados.push('PicPay');

    // 2. Descobre qual período de tempo foi selecionado
    const selectPeriodo = document.getElementById('filter-period');
    const periodoEscolhido = selectPeriodo ? selectPeriodo.value : '30';

    // 3. Calcula a Data Limite (Hoje menos a quantidade de dias selecionada)
    const dataAtual = new Date();
    let dataLimite = new Date();
    if (periodoEscolhido !== 'all') {
        dataLimite.setDate(dataAtual.getDate() - parseInt(periodoEscolhido));
    }

    // 4. Faz a filtragem combinada
    const transacoesFiltradas = todasAsTransacoes.filter(item => {
        // Checa o banco
        const passaNoBanco = bancosSelecionados.includes(item.banco);
        
        // Checa a data
        let passaNaData = true;
        if (periodoEscolhido !== 'all') {
            const dataDaTransacao = converterDataBrasileira(item.data);
            passaNaData = dataDaTransacao >= dataLimite;
        }

        return passaNoBanco && passaNaData;
    });

    // 5. Manda para a tela
    exibirDadosNaTela(transacoesFiltradas);
}

// --- ATUALIZADO: GERENCIA A TELA DE ESTADO VAZIO ---
function exibirDadosNaTela(transacoes) {
    
    // Se não houver nada para mostrar, exibe a tela de Empty State
    if (transacoes.length === 0) {
        if(dashboardRow) dashboardRow.classList.add('hidden');
        if(tableContainer) tableContainer.classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
        return; 
    }

    // Se houver transações, esconde o Empty State e mostra os painéis
    if(emptyState) emptyState.classList.add('hidden');
    if(dashboardRow) {
        dashboardRow.classList.remove('hidden');
        dashboardRow.style.display = 'flex';
    }
    if(tableContainer) tableContainer.classList.remove('hidden');

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