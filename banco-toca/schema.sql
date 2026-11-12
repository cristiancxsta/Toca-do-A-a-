-- Banco da Toca do Açaí (SQLite: um único arquivo, sem servidor)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT NOT NULL,
  email  TEXT NOT NULL UNIQUE,
  senha  TEXT NOT NULL,              -- guardada como hash, nunca em texto puro
  cargo  TEXT NOT NULL DEFAULT 'Gerente'
);

CREATE TABLE IF NOT EXISTS categorias (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS produtos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao     TEXT NOT NULL,
  categoria_id  INTEGER NOT NULL REFERENCES categorias(id),
  quantidade    INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  preco         REAL    NOT NULL DEFAULT 0 CHECK (preco >= 0),
  criado_em     TEXT    NOT NULL DEFAULT (date('now','localtime'))
);

-- Cada saída de estoque (venda, produto vencido, perda...)
CREATE TABLE IF NOT EXISTS saidas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id  INTEGER NOT NULL REFERENCES produtos(id),
  quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
  valor       REAL    NOT NULL DEFAULT 0,          -- valor total da saída (vendas)
  motivo      TEXT    NOT NULL DEFAULT 'Venda',    -- Venda, Produto vencido, Perda...
  data        TEXT    NOT NULL DEFAULT (date('now','localtime'))
);

-- Contas a pagar e a receber na mesma tabela
CREATE TABLE IF NOT EXISTS contas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo        TEXT NOT NULL CHECK (tipo IN ('pagar','receber')),
  descricao   TEXT NOT NULL,
  observacao  TEXT,
  cliente     TEXT,
  valor       REAL NOT NULL CHECK (valor >= 0),
  vencimento  TEXT,
  status      TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Pago'))
);

-- Consultas prontas para as telas
CREATE VIEW IF NOT EXISTS resumo_estoque AS
  SELECT COALESCE(SUM(quantidade*preco),0) AS valor_em_estoque,
         COUNT(*)                          AS itens_cadastrados,
         COALESCE(SUM(quantidade <= 5),0)  AS estoque_baixo
  FROM produtos;

CREATE VIEW IF NOT EXISTS resumo_financeiro AS
  SELECT (SELECT COUNT(*) FROM saidas WHERE motivo='Venda')                         AS n_vendas,
         (SELECT COALESCE(SUM(valor),0) FROM contas WHERE tipo='pagar'   AND status='Pendente') AS a_pagar,
         (SELECT COALESCE(SUM(valor),0) FROM contas WHERE tipo='receber' AND status='Pendente') AS a_receber;

CREATE VIEW IF NOT EXISTS receita_mensal AS
  SELECT strftime('%Y-%m', data) AS mes, SUM(valor) AS receita
  FROM saidas WHERE motivo='Venda' GROUP BY mes;
