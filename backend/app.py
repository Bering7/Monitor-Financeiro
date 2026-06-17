import os
import datetime
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import jwt

# Importação da biblioteca email-validator para checagem real via DNS
from email_validator import validate_email, EmailNotValidError

app = Flask(__name__)
CORS(app)

# --- CONFIGURAÇÕES DE PASTAS E BANCO DE DADOS ---
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Configuração do banco SQL relacional local via SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///banco.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'sua_chave_secreta_super_segura_aqui'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

db = SQLAlchemy(app)

# --- MODELOS RELACIONAIS (SQL ALCHEMY) ---
class Usuario(db.Model):
    __tablename__ = 'usuarios'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)
    
    # Cria o relacionamento: um usuário pode ter muitas transações
    transacoes = db.relationship('Transacao', backref='dono', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email
        }

class Transacao(db.Model):
    __tablename__ = 'transacoes'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    data = db.Column(db.String(20), nullable=False)
    banco = db.Column(db.String(50), nullable=False)
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    valor = db.Column(db.Float, nullable=False)
    
    # Chave Estrangeira ligando a transação ao ID do usuário logado
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "data": self.data,
            "banco": self.banco,
            "descricao": self.descricao,
            "categoria": self.categoria,
            "valor": self.valor
        }


# --- DECORATOR: PROTEÇÃO DE ROTAS VIA JWT ---
def token_requerido(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            else:
                token = auth_header

        if not token:
            return jsonify({"erro": "Token de autenticação ausente ou inválido!"}), 401

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            usuario_atual = Usuario.query.get(payload['usuario_id'])
            if not usuario_atual:
                return jsonify({"erro": "Usuário não encontrado."}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"erro": "Sua sessão expirou. Faça login novamente."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"erro": "Token inválido ou corrompido."}), 401

        return f(usuario_atual, *args, **kwargs)
        
    return decorated


# --- MOTOR DE CATEGORIZAÇÃO ---
def categorizar_descricao(descricao):
    desc = str(descricao).lower()
    if 'mercado' in desc or 'supermercado' in desc or 'ifood' in desc or 'restaurante' in desc or 'padaria' in desc or 'superbom' in desc or 'pannabread' in desc:
        return 'Alimentação'
    elif 'posto' in desc or 'combustivel' in desc or 'uber' in desc or '99app' in desc or 'estapar' in desc:
        return 'Transporte'
    elif 'netflix' in desc or 'spotify' in desc or 'disney' in desc or 'hbo' in desc or 'prime' in desc or 'cafedodg' in desc:
        return 'Assinaturas/Lazer'
    elif 'salario' in desc or 'remuneracao' in desc or 'pagamento recebido' in desc:
        return 'Renda'
    elif 'pix recebido' in desc or 'transferencia recebida' in desc:
        return 'Entradas Pix'
    elif 'pix enviado' in desc or 'transferencia enviada' in desc:
        return 'Saídas Pix'
    elif 'farmacia' in desc or 'drogaria' in desc or 'medico' in desc or 'hospital' in desc:
        return 'Saúde'
    return 'Outros'

# --- LIMPANDO NÚMEROS DE TODOS OS BANCOS ---
def limpa_moeda(valor_str):
    v = str(valor_str).upper()
    if v == 'NAN' or v == 'NONE' or v == '':
        return 0.0
    v = v.replace('R$', '').replace('+', '').replace(' ', '').strip()
    v = v.replace('−', '-').replace('\u2212', '-')
    if ',' in v and '.' in v:
        v = v.replace('.', '').replace(',', '.')
    elif ',' in v:
        v = v.replace(',', '.')
    try:
        return float(v)
    except:
        return 0.0

# --- ROTAS DE AUTENTICAÇÃO ---
@app.route('/cadastro', methods=['POST'])
def cadastro():
    dados = request.get_json()
    if not dados or not dados.get('nome') or not dados.get('email') or not dados.get('senha'):
        return jsonify({"erro": "Preencha todos os campos obrigatórios"}), 400
        
    email_bruto = dados['email'].strip()

    # --- VALIDAÇÃO DE DNS ROBUSTA (BARRA E-MAILS INVENTADOS) ---
    try:
        # check_deliverability=True faz consultas DNS diretas, sem conexões SMTP instáveis
        informacoes_email = validate_email(email_bruto, check_deliverability=True)
        email_alvo = informacoes_email.normalized
    except EmailNotValidError as e:
        # Quando o e-mail for inválido/falso, retorna o status 400 e interrompe o cadastro
        return jsonify({"erro": f"E-mail inválido ou inexistente: {str(e)}"}), 400
        
    usuario_existente = Usuario.query.filter_by(email=email_alvo).first()
    if usuario_existente:
        return jsonify({"erro": "Este e-mail já está cadastrado"}), 400
        
    senha_criptografada = generate_password_hash(dados['senha'])
    novo_usuario = Usuario(nome=dados['nome'], email=email_alvo, senha_hash=senha_criptografada)
    
    db.session.add(novo_usuario)
    db.session.commit()
    return jsonify({"mensagem": "Usuário cadastrado com sucesso!"}), 201

@app.route('/login', methods=['POST'])
def login():
    dados = request.get_json()
    if not dados or not dados.get('email') or not dados.get('senha'):
        return jsonify({"erro": "E-mail e senha são obrigatórios"}), 400
        
    usuario = Usuario.query.filter_by(email=dados['email'].strip().lower()).first()
    if not usuario or not check_password_hash(usuario.senha_hash, dados['senha']):
        return jsonify({"erro": "E-mail ou senha incorretos"}), 401
        
    token = jwt.encode({
        'usuario_id': usuario.id,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')
    
    return jsonify({
        "mensagem": "Login efetuado com sucesso!",
        "token": token,
        "usuario": usuario.to_dict()
    }), 200


# --- BUSCAR TRANSAÇÕES HISTÓRICAS DO BANCO ---
@app.route('/transacoes', methods=['GET'])
@token_requerido
def obter_transacoes(usuario_atual):
    lista_transacoes = Transacao.query.filter_by(usuario_id=usuario_atual.id).all()
    transacoes_dit = [t.to_dict() for t in lista_transacoes]
    
    total_entradas = sum(t['valor'] for t in transacoes_dit if t['valor'] > 0)
    total_saidas = sum(t['valor'] for t in transacoes_dit if t['valor'] < 0)
    bancos_unicos = list(set(t['banco'] for t in transacoes_dit))
    
    return jsonify({
        "transacoes": transacoes_dit,
        "resumo": {
            "entradas": round(total_entradas, 2),
            "saidas": round(total_saidas, 2),
            "saldo": round(total_entradas + total_saidas, 2)
        },
        "qtd_bancos": len(bancos_unicos),
        "mensagem": ", ".join(sorted(bancos_unicos)) if bancos_unicos else "Nenhum banco"
    })


# --- ROTA DE EXTRATOS (PROCESSA E SALVA PERMANENTEMENTE NO BANCO) ---
@app.route('/upload', methods=['POST'])
@token_requerido  
def upload_file(usuario_atual):
    if 'file' not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    
    arquivos = request.files.getlist('file')
    if not arquivos or arquivos[0].filename == '':
        return jsonify({"erro": "Nenhum arquivo selecionado"}), 400
    
    lista_df_bancos = []
    bancos_processados = set()
    
    try:
        for file in arquivos:
            if not file.filename.endswith('.csv'):
                continue
                
            caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
            file.save(caminho_arquivo)
            
            linhas_pular = 0
            encoding_correto = 'utf-8'
            separador = ','
            banco_identificado = "Genérico"
            
            try:
                with open(caminho_arquivo, 'r', encoding='utf-8') as f:
                    f.read(100)
            except UnicodeDecodeError:
                encoding_correto = 'latin-1'
            
            with open(caminho_arquivo, 'r', encoding=encoding_correto, errors='ignore') as f:
                for i, linha in enumerate(f):
                    linha_limpa = Server_Line = linha.lower().replace('ç', 'c').replace('ã', 'a').replace('ó', 'o').replace('é', 'e').replace('í', 'i')
                    
                    if 'data lancamento' in linha_limpa and 'historico' in linha_limpa:
                        linhas_pular = i
                        separador = ';'
                        banco_identificado = "Inter"
                        break
                    elif 'identificador' in linha_limpa and 'descri' in linha_limpa:
                        linhas_pular = i
                        separador = ','
                        banco_identificado = "Nubank"
                        break
                    elif 'origem / destino' in linha_limpa and 'forma de pagamento' in linha_limpa:
                        linhas_pular = i
                        separador = ','
                        banco_identificado = "PicPay"
                        break
            
            bancos_processados.add(banco_identificado)
            
            df = pd.read_csv(caminho_arquivo, sep=separador, engine='python', skiprows=linhas_pular, encoding=encoding_correto)
            
            novas_colunas = []
            for col in df.columns:
                c = str(col).lower().strip()
                c = c.replace('ç', 'c').replace('ã', 'a').replace('ó', 'o').replace('é', 'e').replace('í', 'i')
                c = c.replace('\ufeff', '').replace('"', '')
                novas_colunas.append(c)
            df.columns = novas_colunas
            
            df_padrao = pd.DataFrame()
            
            if banco_identificado == "PicPay":
                df_padrao['data'] = df['data'].astype(str)
                df_padrao['descricao'] = df['tipo'].astype(str) + " - " + df['origem / destino'].astype(str)
                df_padrao['valor_sujo'] = df['valor']
            elif banco_identificado == "Nubank":
                df_padrao['data'] = df['data'].astype(str)
                df_padrao['descricao'] = df['descricao'].astype(str)
                df_padrao['valor_sujo'] = df['valor']
            elif banco_identificado == "Inter":
                df_padrao['data'] = df['data lancamento'].astype(str)
                if 'descricao' in df.columns:
                    df_padrao['descricao'] = df['descricao'].astype(str)
                else:
                    df_padrao['descricao'] = df['historico'].astype(str)
                df_padrao['valor_sujo'] = df['valor']

            df_padrao = df_padrao.dropna(subset=['data', 'descricao'])
            df_padrao = df_padrao[df_padrao['descricao'].str.lower() != 'nan']
            df_padrao = df_padrao[df_padrao['data'].str.lower() != 'nan']
            
            df_padrao['valor'] = df_padrao['valor_sujo'].apply(limpa_moeda)
            df_padrao = df_padrao.drop(columns=['valor_sujo'])
            df_padrao['banco'] = banco_identificado
            
            lista_df_bancos.append(df_padrao)
            
        if not lista_df_bancos:
            return jsonify({"erro": "Nenhum dado válido de arquivo CSV extraído."}), 400
            
        df_consolidado = pd.concat(lista_df_bancos, ignore_index=True)
        df_consolidado['categoria'] = df_consolidado['descricao'].apply(categorizar_descricao)
        
        for _, Server_Row in df_consolidado.iterrows():
            nova_transacao = Transacao(
                data=str(Server_Row['data']),
                banco=str(Server_Row['banco']),
                descricao=str(Server_Row['descricao']),
                categoria=str(Server_Row['categoria']),
                valor=float(Server_Row['valor']),
                usuario_id=usuario_atual.id
            )
            db.session.add(nova_transacao)
        
        db.session.commit()
        
        lista_completa = Transacao.query.filter_by(usuario_id=usuario_atual.id).all()
        transacoes_dit = [t.to_dict() for t in lista_completa]
        
        total_entradas = round(sum(t['valor'] for t in transacoes_dit if t['valor'] > 0), 2)
        total_saidas = round(sum(t['valor'] for t in transacoes_dit if t['valor'] < 0), 2)
        
        lista_bancos_unicos = sorted(list(set(t['banco'] for t in transacoes_dit)))
        string_bancos = ", ".join(lista_bancos_unicos)
        
        print(f"--- {len(df_consolidado)} novas transações salvas para o usuário: {usuario_atual.nome} ---")
        
        return jsonify({
            "mensagem": f"Bancos: {string_bancos}",
            "resumo": {
                "entradas": total_entradas,
                "saidas": total_saidas,
                "saldo": round(total_entradas + total_saidas, 2)
            },
            "transacoes": transacoes_dit,
            "qtd_bancos": len(lista_bancos_unicos)
        })
            
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    porta = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=porta)