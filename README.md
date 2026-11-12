# Toca do Açaí

Sistema simples para controle de estoque e dados de uma loja de açaí, com login, cadastro de usuários, gestão de produtos, saídas e contas.

## Funcionalidades

- Login e criação de conta
- Cadastro de categorias e produtos
- Controle de estoque
- Registro de saídas e movimentações
- Gestão de contas e pagamentos
- Interface web em HTML/CSS/JavaScript
- Banco local em SQLite

## Tecnologias

- Front-end: HTML, CSS e JavaScript
- Back-end: Python
- Banco de dados: SQLite

## Estrutura do projeto

- `index.html` — tela de login
- `register.html` — cadastro de usuário
- `Estoque.html` — gestão do estoque
- `cadastro.html` — cadastro de produtos
- `saida.html` — registro de saídas
- `script.js` — lógica da interface
- `style.css` — estilos da aplicação
- `banco-toca/servidor.py` — servidor local da API
- `banco-toca/schema.sql` — estrutura do banco
- `banco-toca/criar_banco.py` — cria banco com dados de exemplo
- `banco-toca/toca.db` — banco SQLite utilizado pela aplicação

## Como executar

1. Verifique se o Python 3 está instalado.
2. (Opcional) Crie o banco com dados de exemplo:

   ```bash
   python banco-toca/criar_banco.py
   ```

3. Inicie o servidor:

   ```bash
   python banco-toca/servidor.py
   ```

4. Abra no navegador:

   ```text
   http://127.0.0.1:8000
   ```

5. Para encerrar o servidor, pressione `Ctrl+C` no terminal.

## Login de demonstração

Se você criou o banco de exemplo, pode usar:

- E-mail: `marcos@toca.com`
- Senha: `trocar123`

Recomendado trocar a senha após o primeiro acesso.

## Observações

- O sistema é local: os dados ficam no computador que executa o servidor.
- Faça backup do arquivo `banco-toca/toca.db` periodicamente.
- Não é necessário instalar dependências extras para rodar o projeto.
