import os
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- MOTOR DE CATEGORIZAÇÃO ---
def categorizar_descricao(descricao):
    desc = str(descricao).lower()
    
    # Categorias calibradas para os 3 bancos
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
    
    # Se vier um valor nulo ou vazio do CSV, neutraliza como 0.0
    if v == 'NAN' or v == 'NONE' or v == '':
        return 0.0
        
    # Limpa as sujeiras do PicPay (R$, sinal de mais, espaços)
    v = v.replace('R$', '').replace('+', '').replace(' ', '').strip()
    # Troca o sinal de menos estranho do PicPay (Unicode) pelo hífen padrão do teclado
    v = v.replace('−', '-').replace('\u2212', '-')
    
    # Padroniza casas decimais (Nubank usa '.' e Inter/Picpay usam ',')
    if ',' in v and '.' in v:
        # Se tiver os dois (ex: 1.500,00 do Inter), tira o ponto e troca vírgula por ponto
        v = v.replace('.', '').replace(',', '.')
    elif ',' in v:
        # Se tiver só vírgula (ex: 150,00 do Inter/Picpay), troca vírgula por ponto
        v = v.replace(',', '.')
    # Se só tiver ponto (ex: 40.00 do Nubank), o Python já vai entender perfeito.
    
    try:
        return float(v)
    except:
        return 0.0

@app.route('/upload', methods=['POST'])
def upload_file():
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
            
            # 1. Detector de Encoding
            try:
                with open(caminho_arquivo, 'r', encoding='utf-8') as f:
                    f.read(100)
            except UnicodeDecodeError:
                encoding_correto = 'latin-1'
            
            # 2. Detector de Banco, Separador e Cabeçalhos
            with open(caminho_arquivo, 'r', encoding=encoding_correto, errors='ignore') as f:
                for i, linha in enumerate(f):
                    linha_limpa = linha.lower().replace('ç', 'c').replace('ã', 'a').replace('ó', 'o').replace('é', 'e').replace('í', 'i')
                    
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
            
            # 3. Pandas Lê o Arquivo individual
            df = pd.read_csv(caminho_arquivo, sep=separador, engine='python', skiprows=linhas_pular, encoding=encoding_correto)
            
            # 4. Limpeza de Acentos das Colunas
            novas_colunas = []
            for col in df.columns:
                c = str(col).lower().strip()
                c = c.replace('ç', 'c').replace('ã', 'a').replace('ó', 'o').replace('é', 'e').replace('í', 'i')
                c = c.replace('\ufeff', '').replace('"', '')
                novas_colunas.append(c)
            df.columns = novas_colunas
            
            df_padrao = pd.DataFrame()
            
            # 5. Mapeamento por Banco
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

            # 6. Filtro de Segurança Individual
            df_padrao = df_padrao.dropna(subset=['data', 'descricao'])
            df_padrao = df_padrao[df_padrao['descricao'].str.lower() != 'nan']
            df_padrao = df_padrao[df_padrao['data'].str.lower() != 'nan']
            
            # Executa a limpeza financeira intermediária antes de anexar
            df_padrao['valor'] = df_padrao['valor_sujo'].apply(limpa_moeda)
            df_padrao = df_padrao.drop(columns=['valor_sujo'])
            
            # --- NOVO: Vincula o banco de origem diretamente em cada linha ---
            df_padrao['banco'] = banco_identificado
            
            lista_df_bancos.append(df_padrao)
            
        if not lista_df_bancos:
            return jsonify({"erro": "Nenhum dado válido de arquivo CSV extraído."}), 400
            
        # 7. Unifica todos os extratos em um único DataFrame global
        df_consolidado = pd.concat(lista_df_bancos, ignore_index=True)
        
        # 8. Categorização Global
        df_consolidado['categoria'] = df_consolidado['descricao'].apply(categorizar_descricao)
        
        # Totais unificados calculados e arredondados
        total_entradas = round(float(df_consolidado[df_consolidado['valor'] > 0]['valor'].sum()), 2)
        total_saidas = round(float(df_consolidado[df_consolidado['valor'] < 0]['valor'].sum()), 2)
        saldo_final = round(total_entradas + total_saidas, 2)
        
        transacoes = df_consolidado.to_dict(orient='records')
        
        # Cria o texto contendo a lista de bancos
        lista_bancos_unicos = sorted(list(bancos_processados))
        string_bancos = ", ".join(lista_bancos_unicos)
        
        return jsonify({
            "mensagem": f"Bancos: {string_bancos}",
            "resumo": {
                "entradas": total_entradas,
                "saidas": total_saidas,
                "saldo": saldo_final
            },
            "transacoes": transacoes,
            "qtd_bancos": len(lista_bancos_unicos) # NOVO: Envia a quantidade exata de bancos analisados
        })
            
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500

if __name__ == '__main__':
    import os
    # O servidor na internet vai definir a porta automaticamente usando a variável PORT
    porta = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=porta)