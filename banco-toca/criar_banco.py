"""Cria o banco da Toca do Açaí (arquivo toca.db) com dados de exemplo.
Uso:  python criar_banco.py
Só precisa do Python instalado, sem mais nada.
"""
import hashlib, os, sqlite3, sys
from pathlib import Path

AQUI = Path(__file__).parent
DB = AQUI / "toca.db"

def hash_senha(senha):
    sal = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal, 200_000)
    return sal.hex() + ":" + h.hex()

def senha_confere(senha, guardada):
    sal, h = guardada.split(":")
    novo = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal), 200_000)
    return novo.hex() == h

if DB.exists():
    sys.exit("toca.db já existe. Apague ou renomeie o arquivo para criar um novo.")

db = sqlite3.connect(DB)
db.executescript((AQUI / "schema.sql").read_text(encoding="utf-8"))

db.execute("INSERT INTO usuarios (nome,email,senha,cargo) VALUES (?,?,?,?)",
           ("Marcos", "marcos@toca.com", hash_senha("trocar123"), "Gerente"))
db.executemany("INSERT INTO categorias (nome) VALUES (?)",
               [(c,) for c in ["SORVETE","AÇAÍ","EMBALAGEM","ACOMPANHAMENTOS","CONDIMENTO","FRUTA"]])
db.executemany("INSERT INTO produtos (descricao,categoria_id,quantidade,preco) VALUES (?,?,?,?)",
               [("Sorvete de Chocolate",1,20,10),("Sorvete de Creme",1,12,14),("Sorvete de Maracujá",1,17,9)])
db.executemany("INSERT INTO contas (tipo,descricao,cliente,valor) VALUES (?,?,?,?)",
               [("pagar","Fornecedor",None,550),("pagar","Energia",None,250),
                ("receber","Pedido - Sorvete",None,75),("receber","Encomenda - Picolé",None,329),
                ("receber","Encomenda - Açaí",None,750),("receber","Fornecimento - Açaí",None,2846)])
db.commit(); db.close()
print("Banco criado:", DB)
print("Login de exemplo: marcos@toca.com / trocar123  (troque a senha depois)")
