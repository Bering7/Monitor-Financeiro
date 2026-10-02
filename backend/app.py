from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature
from functools import wraps
from datetime import datetime
import sqlite3
import os
import re
import math

app = Flask(__name__)
# O CORS permite que o frontend (HTML/JS) converse com este backend
CORS(app)

# Pega o caminho exato da pasta onde este arquivo (app.py) está
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Força o banco de dados a ser criado dentro dessa mesma pasta
DB_NAME = os.environ.get('DB_PATH', os.path.join(BASE_DIR, 'banco.db'))

# ==========================================
# CONFIGURAÇÃO DE SEGURANÇA
# ==========================================
# Em produção (Render), defina a variável de ambiente SECRET_KEY com um texto longo e aleatório.
# Ela assina os tokens de login: quem a conhece consegue forjar logins de qualquer usuário.
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    SECRET_KEY = 'chave-de-desenvolvimento-NAO-USAR-EM-PRODUCAO'
    print("AVISO: SECRET_KEY não definida. Usando chave de desenvolvimento (insegura).")

serializador = URLSafeTimedSerializer(SECRET_KEY, salt='monitor-financeiro-auth')
VALIDADE_TOKEN = 60 * 60 * 24 * 30  # 30 dias

TIPOS_VALIDOS = {'receita', 'despesa-fixa', 'despesa-variavel'}
EMAIL_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def obter_conexao():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row # Permite acessar colunas pelo nome
    return conn


def inicializar_banco():
    conn = obter_conexao()
    cursor = conn.cursor()

    # Tabela de usuários (contas)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL,
            porcentagem_investimento REAL NOT NULL DEFAULT 0,
            criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Cria a tabela de transações se ela não existir
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL, 
            data TEXT NOT NULL,
            valor REAL NOT NULL,
            descricao TEXT NOT NULL,
            categoria TEXT,
            flag_parcelado BOOLEAN DEFAULT 0,
            flag_futuro BOOLEAN DEFAULT 0
        )
    ''')

    # Migração: bancos antigos não têm o dono do lançamento
    colunas = [c['name'] for c in cursor.execute('PRAGMA table_info(transacoes)')]
    if 'usuario_id' not in colunas:
        cursor.execute('ALTER TABLE transacoes ADD COLUMN usuario_id INTEGER')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transacoes_usuario ON transacoes(usuario_id)')

    conn.commit()
    conn.close()


# Roda ao importar o arquivo, assim também funciona com o gunicorn (Render),
# que não executa o bloco "if __name__ == '__main__'".
inicializar_banco()


# ==========================================
# AUTENTICAÇÃO
# ==========================================
def gerar_token(usuario_id):
    return serializador.dumps({'uid': usuario_id})


def login_obrigatorio(funcao):
    """Exige 'Authorization: Bearer <token>' e disponibiliza g.usuario_id."""
    @wraps(funcao)
    def wrapper(*args, **kwargs):
        cabecalho = request.headers.get('Authorization', '')
        if not cabecalho.startswith('Bearer '):
            return jsonify({"erro": "Não autenticado"}), 401
        try:
            dados = serializador.loads(cabecalho[7:], max_age=VALIDADE_TOKEN)
            usuario_id = int(dados['uid'])
        except (BadSignature, KeyError, TypeError, ValueError):
            return jsonify({"erro": "Sessão inválida ou expirada"}), 401

        conn = obter_conexao()
        existe = conn.execute('SELECT 1 FROM usuarios WHERE id = ?', (usuario_id,)).fetchone()
        conn.close()
        if not existe:
            return jsonify({"erro": "Sessão inválida ou expirada"}), 401

        g.usuario_id = usuario_id
        return funcao(*args, **kwargs)
    return wrapper


def ler_credenciais():
    dados = request.get_json(silent=True) or {}
    email = str(dados.get('email') or '').strip().lower()
    senha = str(dados.get('senha') or '')
    return email, senha


# Rota 0a: Criar conta
@app.route('/api/registro', methods=['POST'])
def registro():
    email, senha = ler_credenciais()

    if not EMAIL_REGEX.match(email) or len(email) > 254:
        return jsonify({"erro": "Informe um e-mail válido."}), 400
    if len(senha) < 8:
        return jsonify({"erro": "A senha precisa ter pelo menos 8 caracteres."}), 400
    if len(senha) > 128:
        return jsonify({"erro": "A senha é muito longa (máximo de 128 caracteres)."}), 400

    conn = obter_conexao()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute(
                'INSERT INTO usuarios (email, senha_hash) VALUES (?, ?)',
                (email, generate_password_hash(senha))
            )
        except sqlite3.IntegrityError:
            return jsonify({"erro": "Este e-mail já está cadastrado."}), 409

        usuario_id = cursor.lastrowid

        # A primeira conta criada herda os lançamentos antigos (de antes das contas existirem)
        total_usuarios = cursor.execute('SELECT COUNT(*) FROM usuarios').fetchone()[0]
        if total_usuarios == 1:
            cursor.execute('UPDATE transacoes SET usuario_id = ? WHERE usuario_id IS NULL', (usuario_id,))

        conn.commit()
    finally:
        conn.close()

    return jsonify({"token": gerar_token(usuario_id), "email": email}), 201


# Rota 0b: Entrar
@app.route('/api/login', methods=['POST'])
def login():
    email, senha = ler_credenciais()

    conn = obter_conexao()
    usuario = conn.execute('SELECT id, senha_hash FROM usuarios WHERE email = ?', (email,)).fetchone()
    conn.close()

    # Mensagem única para e-mail inexistente e senha errada (não revela quais e-mails existem)
    if not usuario or not check_password_hash(usuario['senha_hash'], senha):
        return jsonify({"erro": "E-mail ou senha incorretos."}), 401

    return jsonify({"token": gerar_token(usuario['id']), "email": email})


# Rota 0c: Dados da conta (e-mail + % de investimento, que agora fica salva na conta)
@app.route('/api/perfil', methods=['GET'])
@login_obrigatorio
def obter_perfil():
    conn = obter_conexao()
    usuario = conn.execute(
        'SELECT email, porcentagem_investimento FROM usuarios WHERE id = ?', (g.usuario_id,)
    ).fetchone()
    conn.close()
    return jsonify({
        "email": usuario['email'],
        "porcentagem_investimento": usuario['porcentagem_investimento']
    })


@app.route('/api/perfil', methods=['PUT'])
@login_obrigatorio
def atualizar_perfil():
    dados = request.get_json(silent=True) or {}
    try:
        porcentagem = float(dados.get('porcentagem_investimento'))
    except (TypeError, ValueError):
        return jsonify({"erro": "Porcentagem inválida."}), 400
    if not math.isfinite(porcentagem) or porcentagem < 0 or porcentagem > 100:
        return jsonify({"erro": "A porcentagem deve estar entre 0 e 100."}), 400

    conn = obter_conexao()
    conn.execute('UPDATE usuarios SET porcentagem_investimento = ? WHERE id = ?', (porcentagem, g.usuario_id))
    conn.commit()
    conn.close()
    return jsonify({"mensagem": "Atualizado com sucesso!"})


# ==========================================
# TRANSAÇÕES (sempre restritas ao usuário logado)
# ==========================================
def validar_transacao(dados):
    """Retorna (campos, None) se válido ou (None, mensagem_de_erro)."""
    dados = dados or {}

    tipo = dados.get('tipo')
    if tipo not in TIPOS_VALIDOS:
        return None, "Tipo de lançamento inválido."

    data = str(dados.get('data') or '')
    try:
        datetime.strptime(data, '%Y-%m-%d')
    except ValueError:
        return None, "Data inválida."

    try:
        valor = float(dados.get('valor'))
    except (TypeError, ValueError):
        return None, "Valor inválido."
    if not math.isfinite(valor) or valor <= 0:
        return None, "O valor deve ser maior que zero."

    descricao = str(dados.get('descricao') or '').strip()
    if not descricao or len(descricao) > 200:
        return None, "Informe uma descrição (até 200 caracteres)."

    categoria = str(dados.get('categoria') or '').strip()[:100]

    return {
        'tipo': tipo,
        'data': data,
        'valor': valor,
        'descricao': descricao,
        'categoria': categoria,
        'flag_parcelado': 1 if dados.get('flag_parcelado') else 0,
        'flag_futuro': 1 if dados.get('flag_futuro') else 0,
    }, None


# Rota 1: Testar se o servidor está vivo
@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({"mensagem": "Servidor rodando 100%!"})

# Rota 2: Salvar uma nova transação no banco
@app.route('/api/transacoes', methods=['POST'])
@login_obrigatorio
def criar_transacao():
    campos, erro = validar_transacao(request.get_json(silent=True))
    if erro:
        return jsonify({"erro": erro}), 400

    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO transacoes (tipo, data, valor, descricao, categoria, flag_parcelado, flag_futuro, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (campos['tipo'], campos['data'], campos['valor'], campos['descricao'], campos['categoria'],
          campos['flag_parcelado'], campos['flag_futuro'], g.usuario_id))
    
    conn.commit()
    novo_id = cursor.lastrowid
    conn.close()
    
    return jsonify({"mensagem": "Salvo com sucesso!", "id": novo_id}), 201

# Rota 3: Buscar as transações do usuário logado
@app.route('/api/transacoes', methods=['GET'])
@login_obrigatorio
def listar_transacoes():
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM transacoes WHERE usuario_id = ? ORDER BY data DESC', (g.usuario_id,))
    linhas = cursor.fetchall()
    conn.close()
    
    # Converte as linhas do banco para uma lista de dicionários (JSON)
    transacoes = []
    for linha in linhas:
        item = dict(linha)
        item.pop('usuario_id', None) # o dono não precisa ir para o navegador
        transacoes.append(item)
    return jsonify(transacoes)

# Rota 4: Deletar uma transação pelo ID (somente se for do usuário logado)
@app.route('/api/transacoes/<int:id>', methods=['DELETE'])
@login_obrigatorio
def deletar_transacao(id):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transacoes WHERE id = ? AND usuario_id = ?", (id, g.usuario_id))
    conn.commit()
    apagou = cursor.rowcount > 0
    conn.close()

    if not apagou:
        return jsonify({"erro": "Lançamento não encontrado"}), 404
    return jsonify({"mensagem": "Transação excluída com sucesso"}), 200

# Rota 5: Atualizar uma transação existente (somente se for do usuário logado)
@app.route('/api/transacoes/<int:id_transacao>', methods=['PUT'])
@login_obrigatorio
def atualizar_transacao(id_transacao):
    campos, erro = validar_transacao(request.get_json(silent=True))
    if erro:
        return jsonify({"erro": erro}), 400
    
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE transacoes 
        SET tipo = ?, data = ?, valor = ?, descricao = ?, categoria = ?, flag_parcelado = ?, flag_futuro = ?
        WHERE id = ? AND usuario_id = ?
    ''', (campos['tipo'], campos['data'], campos['valor'], campos['descricao'], campos['categoria'],
          campos['flag_parcelado'], campos['flag_futuro'], id_transacao, g.usuario_id))
    
    conn.commit()
    atualizou = cursor.rowcount > 0
    conn.close()

    if not atualizou:
        return jsonify({"erro": "Lançamento não encontrado"}), 404
    return jsonify({"mensagem": "Atualizado com sucesso!"}), 200

if __name__ == '__main__':
    print("Iniciando o servidor Flask na porta 5000...")
    app.run(debug=True, port=5000)