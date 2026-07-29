from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
# O CORS permite que o frontend (HTML/JS) converse com este backend
CORS(app)

# Pega o caminho exato da pasta onde este arquivo (app.py) está
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# Força o banco de dados a ser criado dentro dessa mesma pasta
DB_NAME = os.path.join(BASE_DIR, 'banco.db')

def obter_conexao():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row # Permite acessar colunas pelo nome
    return conn

def inicializar_banco():
    conn = obter_conexao()
    cursor = conn.cursor()
    
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
    conn.commit()
    conn.close()

# Rota 1: Testar se o servidor está vivo
@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({"mensagem": "Servidor rodando 100%!"})

# Rota 2: Salvar uma nova transação no banco
@app.route('/api/transacoes', methods=['POST'])
def criar_transacao():
    dados = request.get_json()
    
    tipo = dados.get('tipo')
    data = dados.get('data')
    valor = dados.get('valor')
    descricao = dados.get('descricao')
    categoria = dados.get('categoria', '')
    flag_parcelado = dados.get('flag_parcelado', False)
    flag_futuro = dados.get('flag_futuro', False)
    
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO transacoes (tipo, data, valor, descricao, categoria, flag_parcelado, flag_futuro)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (tipo, data, valor, descricao, categoria, flag_parcelado, flag_futuro))
    
    conn.commit()
    novo_id = cursor.lastrowid
    conn.close()
    
    return jsonify({"mensagem": "Salvo com sucesso!", "id": novo_id}), 201

# Rota 3: Buscar todas as transações
@app.route('/api/transacoes', methods=['GET'])
def listar_transacoes():
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM transacoes ORDER BY data DESC')
    linhas = cursor.fetchall()
    conn.close()
    
    # Converte as linhas do banco para uma lista de dicionários (JSON)
    transacoes = [dict(linha) for linha in linhas]
    return jsonify(transacoes)

# Rota 4: Deletar uma transação pelo ID
@app.route('/api/transacoes/<int:id>', methods=['DELETE'])
def deletar_transacao(id):
    try:
        conn = sqlite3.connect('banco.db')
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transacoes WHERE id = ?", (id,))
        conn.commit()
        conn.close()
        return jsonify({"mensagem": "Transação excluída com sucesso"}), 200
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# Rota 5: Atualizar uma transação existente (Editar)
@app.route('/api/transacoes/<int:id_transacao>', methods=['PUT'])
def atualizar_transacao(id_transacao):
    dados = request.get_json()
    
    tipo = dados.get('tipo')
    data = dados.get('data')
    valor = dados.get('valor')
    descricao = dados.get('descricao')
    categoria = dados.get('categoria', '')
    flag_parcelado = dados.get('flag_parcelado', False)
    flag_futuro = dados.get('flag_futuro', False)
    
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE transacoes 
        SET tipo = ?, data = ?, valor = ?, descricao = ?, categoria = ?, flag_parcelado = ?, flag_futuro = ?
        WHERE id = ?
    ''', (tipo, data, valor, descricao, categoria, flag_parcelado, flag_futuro, id_transacao))
    
    conn.commit()
    conn.close()
    
    return jsonify({"mensagem": "Atualizado com sucesso!"}), 200

if __name__ == '__main__':
    # Quando o script rodar, ele primeiro garante que o banco existe
    inicializar_banco()
    print("Iniciando o servidor Flask na porta 5000...")
    app.run(debug=True, port=5000)