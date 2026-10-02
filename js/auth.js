// ==========================================
// AUTENTICAÇÃO (conta do usuário)
// ==========================================
// Este arquivo precisa ser carregado ANTES do api.js (usa a constante API_URL em tempo de execução).
const CHAVE_TOKEN = 'tokenAuth';
const CHAVE_EMAIL = 'emailUsuario';

function getToken() {
    try { return localStorage.getItem(CHAVE_TOKEN); } catch (e) { return null; }
}

// Apaga tudo que é da conta (mantém só a preferência de tema)
function limparSessao() {
    try {
        localStorage.removeItem(CHAVE_TOKEN);
        localStorage.removeItem(CHAVE_EMAIL);
        localStorage.removeItem('porcentagemInvestimento');
    } catch (e) {}
}

// fetch que já envia o token. Se o servidor disser que a sessão não vale mais, volta para o login.
async function authFetch(url, opcoes = {}) {
    const headers = { ...(opcoes.headers || {}) };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resposta = await fetch(url, { ...opcoes, headers });
    if (resposta.status === 401) {
        limparSessao();
        mostrarTelaAuth();
    }
    return resposta;
}

// ------------------------------------------
// Tela de login / cadastro
// ------------------------------------------
let modoAuth = 'login'; // 'login' ou 'registro'

function mostrarTelaAuth() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function esconderTelaAuth() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
}

function definirModoAuth(modo) {
    modoAuth = modo;
    const registro = modo === 'registro';

    document.getElementById('auth-subtitulo').textContent = registro
        ? 'Crie sua conta para guardar seus dados e acessá-los em qualquer dispositivo.'
        : 'Entre na sua conta para ver seus dados em qualquer dispositivo.';
    document.getElementById('auth-grupo-senha2').style.display = registro ? 'flex' : 'none';
    document.getElementById('auth-senha').setAttribute('autocomplete', registro ? 'new-password' : 'current-password');
    document.getElementById('btn-auth-enviar').textContent = registro ? 'Criar conta' : 'Entrar';
    document.getElementById('btn-auth-alternar').textContent = registro
        ? 'Já tenho conta. Entrar'
        : 'Não tenho conta. Criar agora';
    document.getElementById('auth-erro').textContent = '';
}

async function enviarAuth(evento) {
    evento.preventDefault();

    const email = document.getElementById('auth-email').value.trim();
    const senha = document.getElementById('auth-senha').value;
    const senha2 = document.getElementById('auth-senha2').value;
    const elErro = document.getElementById('auth-erro');
    const botao = document.getElementById('btn-auth-enviar');
    const textoOriginal = botao.textContent;

    elErro.textContent = '';

    if (modoAuth === 'registro' && senha !== senha2) {
        elErro.textContent = 'As senhas não são iguais.';
        return;
    }

    botao.disabled = true;
    botao.textContent = 'Aguarde...';

    try {
        const rota = modoAuth === 'registro' ? 'registro' : 'login';
        const resposta = await fetch(`${API_URL}/${rota}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            elErro.textContent = dados.erro || 'Não foi possível entrar. Tente novamente.';
            return;
        }

        limparSessao(); // descarta qualquer resto de outra conta usada neste aparelho
        localStorage.setItem(CHAVE_TOKEN, dados.token);
        localStorage.setItem(CHAVE_EMAIL, dados.email);
        location.reload(); // recarrega já logado, com o estado limpo
    } catch (erro) {
        elErro.textContent = 'Sem conexão com o servidor. No primeiro acesso ele pode levar até 1 minuto para acordar; tente de novo.';
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

function fazerLogout() {
    limparSessao();
    location.reload();
}

const formAuth = document.getElementById('form-auth');
if (formAuth) formAuth.addEventListener('submit', enviarAuth);

const btnAlternarAuth = document.getElementById('btn-auth-alternar');
if (btnAlternarAuth) {
    btnAlternarAuth.addEventListener('click', () => {
        definirModoAuth(modoAuth === 'login' ? 'registro' : 'login');
    });
}

const btnSair = document.getElementById('btn-sair');
if (btnSair) btnSair.addEventListener('click', fazerLogout);

// ------------------------------------------
// Dados da conta (% de investimento fica salva na conta, não no aparelho)
// ------------------------------------------
async function salvarPorcentagemNoServidor(porcentagem) {
    try {
        await authFetch(`${API_URL}/perfil`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ porcentagem_investimento: Number(porcentagem) || 0 })
        });
    } catch (erro) {
        console.error('Erro ao salvar porcentagem:', erro);
    }
}

// Ponto de partida do app: só carrega os dados se houver uma conta logada
async function iniciarSessao() {
    if (!getToken()) {
        mostrarTelaAuth();
        return;
    }

    esconderTelaAuth();

    const areaUsuario = document.getElementById('user-area');
    const elEmail = document.getElementById('usuario-email');
    let emailSalvo = null;
    try { emailSalvo = localStorage.getItem(CHAVE_EMAIL); } catch (e) {}
    if (areaUsuario) areaUsuario.style.display = 'flex';
    if (elEmail && emailSalvo) elEmail.textContent = emailSalvo;

    try {
        const resposta = await authFetch(`${API_URL}/perfil`);
        if (!resposta.ok) return; // 401 já voltou para o login

        const perfil = await resposta.json();
        if (elEmail) elEmail.textContent = perfil.email;
        porcentagemInvestimento = parseFloat(perfil.porcentagem_investimento) || 0;
        try { localStorage.setItem('porcentagemInvestimento', porcentagemInvestimento); } catch (e) {}
    } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
    }

    carregarTransacoes();
}