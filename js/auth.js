// ==========================================
// SUPABASE: cliente + autenticação
// ==========================================
// O CDN do Supabase precisa ser carregado ANTES deste arquivo e deste arquivo antes do api.js.
// "supabase" já é o nome global criado pelo CDN, por isso o cliente se chama "supabaseClient".
const SUPABASE_URL = 'https://izcjyiwbpcdlyjwcsodh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_26cSIpbZxYd5wZP_K_UXLA_-egFZOM-'; // chave pública: a proteção real são as políticas RLS
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Apaga o que é da conta neste aparelho (a sessão em si é apagada pelo signOut)
function limparSessao() {
    try { localStorage.removeItem('porcentagemInvestimento'); } catch (e) {}
}

// Se o login expirar, o Supabase avisa por aqui
supabaseClient.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') {
        limparSessao();
        mostrarTelaAuth();
    }
});

function traduzirErroAuth(erro) {
    const msg = ((erro && erro.message) || '').toLowerCase();
    if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('already registered')) return 'Este e-mail já está cadastrado.';
    if (msg.includes('not confirmed')) return 'Confirme seu e-mail (veja a caixa de entrada) antes de entrar.';
    if (msg.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    if (msg.includes('email') && msg.includes('invalid')) return 'Informe um e-mail válido.';
    return 'Não foi possível concluir. Tente novamente.';
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
    const campoSenha = document.getElementById('auth-senha');
    campoSenha.setAttribute('autocomplete', registro ? 'new-password' : 'current-password');
    campoSenha.setAttribute('placeholder', registro ? 'Mínimo de 8 caracteres' : 'Sua senha');
    // O mínimo de 8 caracteres vale só para criar conta (contas antigas e a de testes podem ter senha menor)
    if (registro) campoSenha.setAttribute('minlength', '8'); else campoSenha.removeAttribute('minlength');
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
    elErro.style.color = '';

    if (modoAuth === 'registro' && senha !== senha2) {
        elErro.textContent = 'As senhas não são iguais.';
        return;
    }

    botao.disabled = true;
    botao.textContent = 'Aguarde...';

    try {
        const credenciais = { email, password: senha };
        const { data, error } = modoAuth === 'registro'
            ? await supabaseClient.auth.signUp(credenciais)
            : await supabaseClient.auth.signInWithPassword(credenciais);

        if (error) {
            elErro.textContent = traduzirErroAuth(error);
            return;
        }

        // Cadastro com "Confirm email" ligado no Supabase: ainda não há sessão até confirmar
        if (!data.session) {
            definirModoAuth('login');
            elErro.style.color = 'var(--color-green)';
            elErro.textContent = 'Conta criada! Confirme o e-mail que enviamos e depois entre.';
            return;
        }

        limparSessao(); // descarta qualquer resto de outra conta usada neste aparelho
        location.reload(); // recarrega já logado, com o estado limpo
    } catch (erro) {
        elErro.textContent = 'Sem conexão. Verifique sua internet e tente novamente.';
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

async function fazerLogout() {
    await supabaseClient.auth.signOut();
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
// Dados da conta (a % de investimento fica nos metadados do usuário no Supabase)
// ------------------------------------------
async function salvarPorcentagemNoServidor(porcentagem) {
    const { error } = await supabaseClient.auth.updateUser({
        data: { porcentagem_investimento: Number(porcentagem) || 0 }
    });
    if (error) console.error('Erro ao salvar porcentagem:', error);
}

// Ponto de partida do app: só carrega os dados se houver uma conta logada
async function iniciarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        mostrarTelaAuth();
        return;
    }

    esconderTelaAuth();

    // getUser consulta o servidor: traz a % de investimento mais recente (inclusive de outro aparelho)
    const { data: { user } } = await supabaseClient.auth.getUser();
    const usuario = user || session.user;

    const areaUsuario = document.getElementById('user-area');
    const elEmail = document.getElementById('usuario-email');
    if (areaUsuario) areaUsuario.style.display = 'flex';
    if (elEmail) elEmail.textContent = usuario.email;

    porcentagemInvestimento = parseFloat((usuario.user_metadata || {}).porcentagem_investimento) || 0;
    try { localStorage.setItem('porcentagemInvestimento', porcentagemInvestimento); } catch (e) {}

    carregarTransacoes();
}