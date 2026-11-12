"""Servidor local da aplicação Toca do Açaí, com API REST e SQLite."""
import json
import hashlib
import hmac
import posixpath
import re
import secrets
import sqlite3
import threading
import time
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


BASE = Path(__file__).resolve().parent
RAIZ = BASE.parent
DB = BASE / "toca.db"
SESSAO_COOKIE = "toca_sessao"
SESSAO_DURACAO = 12 * 60 * 60
sessoes = {}
sessoes_lock = threading.Lock()


def conectar():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def preparar_banco():
    db = conectar()
    try:
        db.executescript((BASE / "schema.sql").read_text(encoding="utf-8"))
        colunas = {linha["name"] for linha in db.execute("PRAGMA table_info(produtos)")}
        if "criado_em" not in colunas:
            db.execute("ALTER TABLE produtos ADD COLUMN criado_em TEXT")
            db.execute(
                "UPDATE produtos SET criado_em = date('now','localtime') "
                "WHERE criado_em IS NULL"
            )
        colunas_contas = {linha["name"] for linha in db.execute("PRAGMA table_info(contas)")}
        if "observacao" not in colunas_contas:
            db.execute("ALTER TABLE contas ADD COLUMN observacao TEXT")
        db.commit()
    finally:
        db.close()


def inteiro(valor, campo, minimo=None):
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise ValueError(f"{campo} deve ser um número inteiro.")
    if minimo is not None and valor < minimo:
        raise ValueError(f"{campo} deve ser pelo menos {minimo}.")
    return valor


def texto(valor, campo):
    if not isinstance(valor, str) or not valor.strip():
        raise ValueError(f"{campo} é obrigatório.")
    return valor.strip()


def numero(valor, campo, minimo=0):
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ValueError(f"{campo} deve ser numérico.")
    if valor < minimo:
        raise ValueError(f"{campo} deve ser pelo menos {minimo}.")
    return float(valor)


def hash_senha(senha):
    sal = secrets.token_bytes(16)
    derivada = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), sal, 200_000)
    return sal.hex() + ":" + derivada.hex()


def senha_confere(senha, guardada):
    try:
        sal_hex, hash_esperado = guardada.split(":", 1)
        sal = bytes.fromhex(sal_hex)
        esperado = bytes.fromhex(hash_esperado)
    except (ValueError, TypeError):
        return False
    derivada = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), sal, 200_000)
    return hmac.compare_digest(derivada, esperado)


class Aplicacao(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RAIZ), **kwargs)

    def translate_path(self, path):
        caminho = Path(super().translate_path(path)).resolve()
        try:
            caminho.relative_to(BASE)
        except ValueError:
            return str(caminho)
        return str(BASE / "__arquivo_interno_bloqueado__")

    def responder(self, status, dados=None):
        corpo = b"" if dados is None else json.dumps(
            dados, ensure_ascii=False
        ).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if corpo:
            self.wfile.write(corpo)

    def responder_json_com_cookie(self, status, dados, cookie):
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(corpo)

    def rota(self):
        caminho = unquote(urlsplit(self.path).path)
        return "/" + posixpath.normpath(caminho).lstrip("/")

    def usuario_sessao(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except CookieError:
            return None
        cookie = cookies.get(SESSAO_COOKIE)
        if cookie is None:
            return None
        token = cookie.value
        agora = time.monotonic()
        with sessoes_lock:
            sessao = sessoes.get(token)
            if sessao is None:
                return None
            expira_em, usuario = sessao
            if expira_em <= agora:
                del sessoes[token]
                return None
            return usuario

    def exigir_sessao(self):
        if self.usuario_sessao() is None:
            self.responder(401, {"erro": "Faça login para continuar."})
            return False
        return True

    def enviar_cookie_sessao(self, token, max_age):
        return (
            f"{SESSAO_COOKIE}={token}; Path=/; HttpOnly; "
            f"SameSite=Strict; Max-Age={max_age}"
        )

    def ler_json(self):
        tamanho = int(self.headers.get("Content-Length", "0"))
        if tamanho > 1_000_000:
            raise ValueError("Requisição muito grande.")
        try:
            dados = json.loads(self.rfile.read(tamanho))
        except (json.JSONDecodeError, UnicodeDecodeError) as erro:
            raise ValueError("O corpo da requisição deve ser JSON válido.") from erro
        if not isinstance(dados, dict):
            raise ValueError("O corpo da requisição deve ser um objeto JSON.")
        return dados

    def do_GET(self):
        rota = self.rota()
        if rota == "/api/sessao":
            usuario = self.usuario_sessao()
            if usuario is None:
                self.responder(401, {"erro": "Sessão não encontrada."})
            else:
                self.responder(200, usuario)
            return
        if rota == "/api/dados":
            if not self.exigir_sessao():
                return
            db = conectar()
            try:
                categorias = [dict(row) for row in db.execute(
                    "SELECT id, nome FROM categorias ORDER BY nome"
                )]
                produtos = [dict(row) for row in db.execute(
                    """SELECT p.id, p.descricao AS nome, p.categoria_id AS categoriaId,
                              c.nome AS categoria, p.quantidade, p.preco,
                              p.criado_em AS criadoEm
                       FROM produtos p JOIN categorias c ON c.id = p.categoria_id
                       ORDER BY p.id"""
                )]
                saidas = [dict(row) for row in db.execute(
                    """SELECT s.id, s.produto_id AS produtoId, p.descricao AS nome,
                              p.categoria_id AS categoriaId, c.nome AS categoria,
                              s.quantidade, s.valor, s.motivo, s.data
                       FROM saidas s JOIN produtos p ON p.id = s.produto_id
                       JOIN categorias c ON c.id = p.categoria_id
                       ORDER BY s.id"""
                )]
                contas = [dict(row) for row in db.execute(
                    """SELECT id, tipo AS secao, descricao AS nome,
                              observacao AS descricao, cliente, valor,
                              vencimento, status FROM contas ORDER BY id"""
                )]
                self.responder(200, {
                    "categorias": categorias,
                    "produtos": produtos,
                    "saidas": saidas,
                    "contas": contas,
                })
            finally:
                db.close()
            return
        if rota in ("/Estoque.html", "/cadastro.html", "/saida.html") and \
                self.usuario_sessao() is None:
            self.send_response(303)
            self.send_header("Location", "/index.html")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        try:
            rota = self.rota()
            dados = self.ler_json()
            if rota == "/api/login":
                email = texto(dados.get("email"), "E-mail").lower()
                senha = dados.get("senha")
                if not isinstance(senha, str):
                    raise ValueError("E-mail ou senha inválidos.")
                db = conectar()
                try:
                    usuario_db = db.execute(
                        """SELECT id, nome, email, senha, cargo FROM usuarios
                           WHERE lower(email) = ?""",
                        (email,),
                    ).fetchone()
                finally:
                    db.close()
                senha_valida = usuario_db is not None and senha_confere(
                    senha, usuario_db["senha"]
                )
                if usuario_db is None:
                    hashlib.pbkdf2_hmac(
                        "sha256", senha.encode("utf-8"), bytes(16), 200_000
                    )
                if not senha_valida:
                    self.responder(401, {"erro": "E-mail ou senha inválidos."})
                    return
                usuario = {
                    "id": usuario_db["id"],
                    "nome": usuario_db["nome"],
                    "email": usuario_db["email"],
                    "cargo": usuario_db["cargo"],
                }
                token = secrets.token_urlsafe(32)
                with sessoes_lock:
                    sessoes_expiradas = [
                        chave for chave, (expira_em, _) in sessoes.items()
                        if expira_em <= time.monotonic()
                    ]
                    for chave in sessoes_expiradas:
                        del sessoes[chave]
                    sessoes[token] = (time.monotonic() + SESSAO_DURACAO, usuario)
                self.responder_json_com_cookie(
                    200, usuario, self.enviar_cookie_sessao(token, SESSAO_DURACAO)
                )
                return
            if rota == "/api/usuarios":
                nome = texto(dados.get("nome"), "Nome")
                email = texto(dados.get("email"), "E-mail").lower()
                senha = dados.get("senha")
                if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                    raise ValueError("Informe um e-mail válido.")
                if not isinstance(senha, str) or len(senha) < 8:
                    raise ValueError("A senha deve ter pelo menos 8 caracteres.")
                db = conectar()
                try:
                    with db:
                        cursor = db.execute(
                            """INSERT INTO usuarios (nome, email, senha, cargo)
                               VALUES (?, ?, ?, 'Gerente')""",
                            (nome, email, hash_senha(senha)),
                        )
                        usuario = {
                            "id": cursor.lastrowid,
                            "nome": nome,
                            "email": email,
                            "cargo": "Gerente",
                        }
                finally:
                    db.close()
                self.responder(201, usuario)
                return
            if rota == "/api/logout":
                cookie = SimpleCookie()
                try:
                    cookie.load(self.headers.get("Cookie", ""))
                    token_cookie = cookie.get(SESSAO_COOKIE)
                except CookieError:
                    token_cookie = None
                if token_cookie is not None:
                    with sessoes_lock:
                        sessoes.pop(token_cookie.value, None)
                self.responder_json_com_cookie(
                    200, {"ok": True}, self.enviar_cookie_sessao("", 0)
                )
                return
            if not self.exigir_sessao():
                return
            db = conectar()
            try:
                with db:
                    if rota == "/api/categorias":
                        cursor = db.execute(
                            "INSERT INTO categorias (nome) VALUES (?)",
                            (texto(dados.get("nome"), "Nome"),),
                        )
                        resultado = {"id": cursor.lastrowid}
                    elif rota == "/api/produtos":
                        nome = texto(dados.get("nome"), "Nome do produto")
                        categoria_id = inteiro(dados.get("categoriaId"), "Categoria")
                        quantidade = inteiro(dados.get("quantidade"), "Quantidade", 0)
                        preco = numero(dados.get("preco"), "Preço")
                        cursor = db.execute(
                            """INSERT INTO produtos
                               (descricao, categoria_id, quantidade, preco, criado_em)
                               VALUES (?, ?, ?, ?, date('now','localtime'))""",
                            (nome, categoria_id, quantidade, preco),
                        )
                        resultado = {"id": cursor.lastrowid}
                    elif rota == "/api/contas":
                        secao = dados.get("secao")
                        if secao not in ("pagar", "receber"):
                            raise ValueError("Seção da conta inválida.")
                        valor = numero(dados.get("valor"), "Valor")
                        status = dados.get("status", "Pendente")
                        if status not in ("Pendente", "Pago"):
                            raise ValueError("Status da conta inválido.")
                        cursor = db.execute(
                            """INSERT INTO contas
                               (tipo, descricao, observacao, cliente, valor, vencimento, status)
                               VALUES (?, ?, ?, ?, ?, ?, ?)""",
                            (secao, texto(dados.get("nome"), "Nome"),
                             dados.get("descricao") or None, dados.get("cliente") or None, valor,
                             dados.get("vencimento") or None, status),
                        )
                        resultado = {"id": cursor.lastrowid}
                    elif rota == "/api/saidas":
                        produto_id = inteiro(dados.get("produtoId"), "Produto", 1)
                        quantidade = inteiro(dados.get("quantidade"), "Quantidade", 1)
                        motivo = texto(dados.get("motivo"), "Motivo")
                        data = texto(dados.get("data"), "Data")
                        produto = db.execute(
                            "SELECT quantidade, preco FROM produtos WHERE id = ?",
                            (produto_id,),
                        ).fetchone()
                        if produto is None:
                            raise ValueError("Produto não encontrado.")
                        cursor = db.execute(
                            """UPDATE produtos SET quantidade = quantidade - ?
                               WHERE id = ? AND quantidade >= ?""",
                            (quantidade, produto_id, quantidade),
                        )
                        if cursor.rowcount != 1:
                            raise ValueError("Quantidade indisponível no estoque.")
                        cursor = db.execute(
                            """INSERT INTO saidas
                               (produto_id, quantidade, valor, motivo, data)
                               VALUES (?, ?, ?, ?, ?)""",
                            (produto_id, quantidade, produto["preco"] * quantidade,
                             motivo, data),
                        )
                        resultado = {"id": cursor.lastrowid}
                    else:
                        self.responder(404, {"erro": "Endpoint não encontrado."})
                        return
                self.responder(201, resultado)
            finally:
                db.close()
        except ValueError as erro:
            self.responder(400, {"erro": str(erro)})
        except sqlite3.IntegrityError as erro:
            mensagem = "Não foi possível salvar: confira os vínculos e valores informados."
            if "UNIQUE constraint failed" in str(erro):
                mensagem = (
                    "Já existe uma conta com este e-mail."
                    if self.rota() == "/api/usuarios"
                    else "Já existe um cadastro com esse nome."
                )
            self.responder(409, {"erro": mensagem})

    def do_PUT(self):
        if not self.exigir_sessao():
            return
        try:
            dados = self.ler_json()
            correspondencia = re.fullmatch(
                r"/api/(categorias|produtos|contas)/(\d+)", self.rota()
            )
            if not correspondencia:
                self.responder(404, {"erro": "Endpoint não encontrado."})
                return
            recurso, id_texto = correspondencia.groups()
            registro_id = int(id_texto)
            db = conectar()
            try:
                with db:
                    if recurso == "categorias":
                        cursor = db.execute(
                            "UPDATE categorias SET nome = ? WHERE id = ?",
                            (texto(dados.get("nome"), "Nome"), registro_id),
                        )
                    elif recurso == "produtos":
                        cursor = db.execute(
                            """UPDATE produtos
                               SET descricao = ?, categoria_id = ?, quantidade = ?, preco = ?
                               WHERE id = ?""",
                            (texto(dados.get("nome"), "Nome do produto"),
                             inteiro(dados.get("categoriaId"), "Categoria"),
                             inteiro(dados.get("quantidade"), "Quantidade", 0),
                             numero(dados.get("preco"), "Preço"), registro_id),
                        )
                    else:
                        secao = dados.get("secao")
                        if secao not in ("pagar", "receber"):
                            raise ValueError("Seção da conta inválida.")
                        status = dados.get("status", "Pendente")
                        if status not in ("Pendente", "Pago"):
                            raise ValueError("Status da conta inválido.")
                        cursor = db.execute(
                            """UPDATE contas
                               SET tipo = ?, descricao = ?, observacao = ?, cliente = ?, valor = ?,
                                   vencimento = ?, status = ?
                               WHERE id = ?""",
                            (secao, texto(dados.get("nome"), "Nome"),
                             dados.get("descricao") or None,
                             dados.get("cliente") or None,
                             numero(dados.get("valor"), "Valor"),
                             dados.get("vencimento") or None, status, registro_id),
                        )
                    if cursor.rowcount == 0:
                        self.responder(404, {"erro": "Registro não encontrado."})
                        return
                self.responder(200, {"id": registro_id})
            finally:
                db.close()
        except ValueError as erro:
            self.responder(400, {"erro": str(erro)})
        except sqlite3.IntegrityError:
            self.responder(409, {"erro": "Não foi possível salvar: confira os vínculos e valores informados."})

    def do_DELETE(self):
        if not self.exigir_sessao():
            return
        correspondencia = re.fullmatch(
            r"/api/(categorias|contas)/(\d+)", self.rota()
        )
        if not correspondencia:
            self.responder(404, {"erro": "Endpoint não encontrado."})
            return
        recurso, id_texto = correspondencia.groups()
        tabela = "categorias" if recurso == "categorias" else "contas"
        db = conectar()
        try:
            with db:
                cursor = db.execute(f"DELETE FROM {tabela} WHERE id = ?", (int(id_texto),))
                if cursor.rowcount == 0:
                    self.responder(404, {"erro": "Registro não encontrado."})
                    return
            self.responder(204)
        except sqlite3.IntegrityError:
            self.responder(409, {"erro": "Esta categoria está vinculada a produtos e não pode ser excluída."})
        finally:
            db.close()

    def log_message(self, formato, *args):
        print("%s - %s" % (self.address_string(), formato % args))


if __name__ == "__main__":
    preparar_banco()
    servidor = ThreadingHTTPServer(("127.0.0.1", 8000), Aplicacao)
    print("Toca do Açaí disponível em http://127.0.0.1:8000")
    print(f"Banco SQLite: {DB}")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
