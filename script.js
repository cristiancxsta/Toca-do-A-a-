/* A interface usa a API local; os dados persistentes ficam no SQLite. */
var filtroTodosMeses = "todos";
var mesesDoAno = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
var limiteEstoqueBaixo = 5;

async function requisitar(url, opcoes) {
  var resposta = await fetch(url, Object.assign({
    headers: { "Content-Type": "application/json" }
  }, opcoes || {}));
  if (resposta.status === 204) {
    return null;
  }
  var dados = await resposta.json();
  if (!resposta.ok) {
    if (resposta.status === 401 && url !== "/api/login" && url !== "/api/usuarios") {
      window.location.assign("/index.html");
    }
    throw new Error(dados.erro || "Falha ao comunicar com o banco de dados.");
  }
  return dados;
}

async function carregarDados() {
  return requisitar("/api/dados");
}

function mostrarErro(erro) {
  window.alert(erro.message || "Não foi possível concluir a operação.");
}

function hojeComoData() {
  var hoje = new Date();
  return [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0")
  ].join("-");
}

function preencherSeletorMeses(seletor) {
  if (!seletor) return;
  seletor.textContent = "";
  var opcaoTodos = document.createElement("option");
  opcaoTodos.value = filtroTodosMeses;
  opcaoTodos.textContent = "Todos os meses";
  seletor.appendChild(opcaoTodos);
  mesesDoAno.forEach(function (mes, indice) {
    var opcao = document.createElement("option");
    opcao.value = String(indice);
    opcao.textContent = mes;
    seletor.appendChild(opcao);
  });
  seletor.value = String(new Date().getMonth());
}

function registroNoMes(data, mesSelecionado) {
  if (!data || mesSelecionado === filtroTodosMeses) return true;
  var partes = data.split("-");
  return partes.length < 2 || String(Number(partes[1]) - 1) === mesSelecionado;
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function normalizarTexto(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function criarCelula(texto, classe) {
  var celula = document.createElement("td");
  celula.textContent = texto;
  if (classe) celula.className = classe;
  return celula;
}

function criarLinhaVazia(tabela, quantidadeColunas, texto) {
  var linha = document.createElement("tr");
  var celula = criarCelula(texto);
  celula.colSpan = quantidadeColunas;
  linha.appendChild(celula);
  tabela.appendChild(linha);
}

function configurarModais() {
  document.querySelectorAll("[data-abrir]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      var overlay = document.getElementById(botao.dataset.abrir);
      if (overlay) {
        overlay.classList.add("aberto");
        var primeiroCampo = overlay.querySelector("input, select");
        if (primeiroCampo) primeiroCampo.focus();
      }
    });
  });
  document.querySelectorAll("[data-fechar]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      botao.closest(".overlay").classList.remove("aberto");
    });
  });
  document.querySelectorAll(".overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (evento) {
      if (evento.target === overlay) overlay.classList.remove("aberto");
    });
  });
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape") {
      document.querySelectorAll(".overlay.aberto").forEach(function (overlay) {
        overlay.classList.remove("aberto");
      });
    }
  });
}

function nomeCategoria(produto, categorias) {
  var categoria = categorias.find(function (item) {
    return item.id === produto.categoriaId;
  });
  return categoria ? categoria.nome : produto.categoria || "";
}

function configurarAutenticacao() {
  var formularioLogin = document.getElementById("form-login");
  var formularioRegistro = document.getElementById("form-registro");
  var mensagem = document.getElementById("auth-feedback");

  function mostrarMensagem(texto) {
    if (mensagem) mensagem.textContent = texto;
  }

  if (formularioLogin) {
    if (new URLSearchParams(window.location.search).has("cadastro")) {
      mostrarMensagem("Conta criada. Entre com seu e-mail e senha.");
    }
    formularioLogin.addEventListener("submit", async function (evento) {
      evento.preventDefault();
      mostrarMensagem("");
      try {
        await requisitar("/api/login", {
          method: "POST",
          body: JSON.stringify({
            email: document.getElementById("email").value.trim(),
            senha: document.getElementById("senha").value
          })
        });
        window.location.assign("/Estoque.html");
      } catch (erro) {
        mostrarMensagem(erro.message);
      }
    });
  }

  if (formularioRegistro) {
    formularioRegistro.addEventListener("submit", async function (evento) {
      evento.preventDefault();
      mostrarMensagem("");
      var senha = document.getElementById("senha").value;
      if (senha !== document.getElementById("confirmar").value) {
        mostrarMensagem("As senhas não conferem.");
        return;
      }
      try {
        await requisitar("/api/usuarios", {
          method: "POST",
          body: JSON.stringify({
            nome: document.getElementById("usuario").value.trim(),
            email: document.getElementById("email").value.trim(),
            senha: senha
          })
        });
        window.location.assign("/index.html?cadastro=ok");
      } catch (erro) {
        mostrarMensagem(erro.message);
      }
    });
  }

  var usuario = document.querySelector(".usuario");
  if (usuario) {
    requisitar("/api/sessao").then(function (dados) {
      var avatar = usuario.querySelector(".avatar");
      var nome = usuario.querySelector("[data-usuario-nome]");
      var cargo = usuario.querySelector("[data-usuario-cargo]");
      if (avatar) avatar.textContent = dados.nome.charAt(0).toUpperCase();
      if (nome) nome.textContent = dados.nome;
      if (cargo) cargo.textContent = dados.cargo;
    }).catch(mostrarErro);
  }

  document.querySelectorAll("[data-sair]").forEach(function (botao) {
    botao.addEventListener("click", async function () {
      try {
        await requisitar("/api/logout", {
          method: "POST",
          body: JSON.stringify({})
        });
        window.location.assign("/index.html");
      } catch (erro) {
        mostrarErro(erro);
      }
    });
  });
}

async function configurarEstoque() {
  var dados = await carregarDados();
  var produtos = dados.produtos;
  var categorias = dados.categorias;
  var formulario = document.getElementById("form-produto");
  var modal = document.getElementById("modal-cadastro");
  var tabela = document.querySelector("#tabela tbody");
  var busca = document.getElementById("busca");
  var seletorMes = document.getElementById("filtro-mes");
  var campoNome = document.getElementById("produto-nome");
  var campoQuantidade = document.getElementById("produto-quantidade");
  var campoCategoria = document.getElementById("produto-categoria");
  var campoPreco = document.getElementById("produto-preco");
  var tituloModal = document.getElementById("titulo-produto");
  var botaoSalvar = document.getElementById("botao-salvar-produto");
  var indicadores = document.querySelectorAll(".cards .valor");
  var produtoEmEdicao = null;

  function atualizarCategorias(selecionada) {
    campoCategoria.textContent = "";
    var inicial = document.createElement("option");
    inicial.value = "";
    inicial.textContent = categorias.length
      ? "Selecione uma categoria"
      : "Cadastre uma categoria primeiro";
    campoCategoria.appendChild(inicial);
    categorias.forEach(function (categoria) {
      var opcao = document.createElement("option");
      opcao.value = String(categoria.id);
      opcao.textContent = categoria.nome;
      campoCategoria.appendChild(opcao);
    });
    campoCategoria.value = selecionada ? String(selecionada.categoriaId) : "";
    campoCategoria.disabled = categorias.length === 0;
  }

  function desenharEstoque() {
    var termo = normalizarTexto(busca.value.trim());
    var filtrados = produtos.filter(function (produto) {
      var texto = [
        produto.id, produto.nome, nomeCategoria(produto, categorias),
        produto.quantidade, produto.preco
      ].join(" ");
      return registroNoMes(produto.criadoEm, seletorMes.value) &&
        normalizarTexto(texto).indexOf(termo) !== -1;
    });
    tabela.textContent = "";
    if (!filtrados.length) {
      criarLinhaVazia(tabela, 6, termo
        ? "Nenhum produto encontrado"
        : "Nenhum produto cadastrado neste mês");
    }
    filtrados.forEach(function (produto) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(produto.id));
      linha.appendChild(criarCelula(produto.nome));
      linha.appendChild(criarCelula(nomeCategoria(produto, categorias)));
      linha.appendChild(criarCelula(String(produto.quantidade), "num"));
      linha.appendChild(criarCelula(formatarMoeda(produto.preco)));
      var celulaAcao = document.createElement("td");
      var acoes = document.createElement("div");
      acoes.className = "cadastro-acoes";
      var editar = document.createElement("button");
      editar.type = "button";
      editar.className = "cadastro-acao";
      editar.textContent = "Editar";
      editar.setAttribute("aria-label", "Editar " + produto.nome);
      editar.addEventListener("click", function () {
        produtoEmEdicao = produto;
        formulario.reset();
        atualizarCategorias(produto);
        campoNome.value = produto.nome;
        campoQuantidade.min = "0";
        campoQuantidade.value = String(produto.quantidade);
        campoPreco.value = String(produto.preco);
        tituloModal.textContent = "Editar Produto";
        botaoSalvar.textContent = "Salvar alterações";
        modal.classList.add("aberto");
        campoNome.focus();
      });
      acoes.appendChild(editar);
      celulaAcao.appendChild(acoes);
      linha.appendChild(celulaAcao);
      tabela.appendChild(linha);
    });
    indicadores[0].textContent = String(filtrados.length);
    indicadores[1].textContent = formatarMoeda(filtrados.reduce(function (soma, produto) {
      return soma + produto.quantidade * produto.preco;
    }, 0));
    indicadores[2].textContent = String(filtrados.filter(function (produto) {
      return produto.quantidade <= limiteEstoqueBaixo;
    }).length);
  }

  document.querySelector("[data-abrir='modal-cadastro']").addEventListener("click", function () {
    produtoEmEdicao = null;
    formulario.reset();
    atualizarCategorias(null);
    campoQuantidade.min = "1";
    tituloModal.textContent = "Adicionar Produto";
    botaoSalvar.textContent = "Adicionar";
  });

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    var nome = campoNome.value.trim();
    var quantidade = Number(campoQuantidade.value);
    var categoriaId = Number(campoCategoria.value);
    var preco = Number(campoPreco.value || 0);
    if (!nome || !categoriaId || !Number.isInteger(quantidade) ||
        quantidade < (produtoEmEdicao ? 0 : 1) || !Number.isFinite(preco) || preco < 0) {
      window.alert("Informe nome, categoria, quantidade e preço válidos.");
      return;
    }
    var duplicado = produtos.find(function (produto) {
      return produto.id !== (produtoEmEdicao && produtoEmEdicao.id) &&
        normalizarTexto(produto.nome) === normalizarTexto(nome) &&
        produto.categoriaId === categoriaId;
    });
    try {
      if (produtoEmEdicao) {
        await requisitar("/api/produtos/" + produtoEmEdicao.id, {
          method: "PUT",
          body: JSON.stringify({ nome: nome, quantidade: quantidade, categoriaId: categoriaId, preco: preco })
        });
      } else if (duplicado) {
        await requisitar("/api/produtos/" + duplicado.id, {
          method: "PUT",
          body: JSON.stringify({
            nome: duplicado.nome, quantidade: duplicado.quantidade + quantidade,
            categoriaId: categoriaId, preco: preco || duplicado.preco
          })
        });
      } else {
        await requisitar("/api/produtos", {
          method: "POST",
          body: JSON.stringify({ nome: nome, quantidade: quantidade, categoriaId: categoriaId, preco: preco })
        });
      }
      produtos = (await carregarDados()).produtos;
      produtoEmEdicao = null;
      desenharEstoque();
      formulario.reset();
      modal.classList.remove("aberto");
    } catch (erro) {
      mostrarErro(erro);
    }
  });
  busca.addEventListener("input", desenharEstoque);
  seletorMes.addEventListener("change", desenharEstoque);
  preencherSeletorMeses(seletorMes);
  atualizarCategorias(null);
  desenharEstoque();
  window.addEventListener("focus", async function () {
    try {
      var atualizados = await carregarDados();
      produtos = atualizados.produtos;
      categorias = atualizados.categorias;
      atualizarCategorias(produtoEmEdicao);
      desenharEstoque();
    } catch (erro) {
      mostrarErro(erro);
    }
  });
}

async function configurarSaidas() {
  var dados = await carregarDados();
  var produtos = dados.produtos;
  var saidas = dados.saidas;
  var categorias = dados.categorias;
  var formulario = document.getElementById("form-saida");
  var tabela = document.querySelector("#tabela tbody");
  var busca = document.getElementById("busca");
  var seletorMes = document.getElementById("filtro-mes");
  var campoProduto = document.getElementById("input-descricao");
  var campoCategoria = document.getElementById("select-categoria");
  var campoValor = document.getElementById("input-valor");
  var campoQuantidade = document.getElementById("input-qtd");
  var campoData = document.getElementById("input-data");
  var campoMotivo = document.getElementById("select-motivo");

  function atualizarProdutosDisponiveis() {
    campoProduto.textContent = "";
    var inicial = document.createElement("option");
    inicial.value = "";
    inicial.textContent = "Selecione um produto do estoque";
    campoProduto.appendChild(inicial);
    produtos.filter(function (produto) {
      return produto.quantidade > 0;
    }).forEach(function (produto) {
      var opcao = document.createElement("option");
      opcao.value = String(produto.id);
      opcao.textContent = produto.nome + " - " + nomeCategoria(produto, categorias) +
        " (" + produto.quantidade + " disponíveis)";
      campoProduto.appendChild(opcao);
    });
  }

  function atualizarDadosDoProduto() {
    var produto = produtos.find(function (item) {
      return String(item.id) === campoProduto.value;
    });
    var categoriaNome = produto ? nomeCategoria(produto, categorias) : "";
    campoCategoria.textContent = "";
    var opcao = document.createElement("option");
    opcao.value = categoriaNome;
    opcao.textContent = categoriaNome || "Selecione um produto";
    campoCategoria.appendChild(opcao);
    campoValor.value = produto && Number(campoQuantidade.value) > 0
      ? (produto.preco * Number(campoQuantidade.value)).toFixed(2)
      : "";
  }

  function desenharSaidas() {
    var termo = normalizarTexto(busca.value.trim());
    var filtradas = saidas.filter(function (saida) {
      var texto = [saida.id, saida.nome, nomeCategoria(saida, categorias),
        saida.quantidade, saida.motivo, saida.data].join(" ");
      return registroNoMes(saida.data, seletorMes.value) &&
        normalizarTexto(texto).indexOf(termo) !== -1;
    });
    tabela.textContent = "";
    if (!filtradas.length) {
      criarLinhaVazia(tabela, 5, termo
        ? "Nenhuma saída encontrada"
        : "Nenhuma saída registrada neste mês");
    }
    filtradas.slice().reverse().forEach(function (saida) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(saida.id));
      linha.appendChild(criarCelula(saida.nome));
      linha.appendChild(criarCelula(nomeCategoria(saida, categorias)));
      linha.appendChild(criarCelula(String(saida.quantidade), "num"));
      linha.appendChild(criarCelula(saida.motivo));
      tabela.appendChild(linha);
    });
  }

  document.querySelector("[data-abrir='modal-saida']").addEventListener("click", function () {
    formulario.reset();
    campoData.value = hojeComoData();
    atualizarProdutosDisponiveis();
    atualizarDadosDoProduto();
  });
  campoProduto.addEventListener("change", atualizarDadosDoProduto);
  campoQuantidade.addEventListener("input", atualizarDadosDoProduto);
  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    var produto = produtos.find(function (item) {
      return String(item.id) === campoProduto.value;
    });
    var quantidade = Number(campoQuantidade.value);
    if (!produto) {
      window.alert("Selecione um produto existente no estoque.");
      return;
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      window.alert("Informe uma quantidade inteira maior que zero.");
      return;
    }
    try {
      await requisitar("/api/saidas", {
        method: "POST",
        body: JSON.stringify({
          produtoId: produto.id,
          quantidade: quantidade,
          motivo: campoMotivo.value,
          data: campoData.value || hojeComoData()
        })
      });
      dados = await carregarDados();
      produtos = dados.produtos;
      saidas = dados.saidas;
      categorias = dados.categorias;
      atualizarProdutosDisponiveis();
      desenharSaidas();
      formulario.reset();
      document.getElementById("modal-saida").classList.remove("aberto");
    } catch (erro) {
      mostrarErro(erro);
    }
  });
  busca.addEventListener("input", desenharSaidas);
  seletorMes.addEventListener("change", desenharSaidas);
  preencherSeletorMeses(seletorMes);
  atualizarProdutosDisponiveis();
  desenharSaidas();
  window.addEventListener("focus", async function () {
    try {
      dados = await carregarDados();
      produtos = dados.produtos;
      saidas = dados.saidas;
      categorias = dados.categorias;
      atualizarProdutosDisponiveis();
      atualizarDadosDoProduto();
      desenharSaidas();
    } catch (erro) {
      mostrarErro(erro);
    }
  });
}

async function configurarCadastro() {
  var dados = await carregarDados();
  var registros = dados.categorias.map(function (item) {
    return { id: item.id, secao: "categoria", nome: item.nome };
  }).concat(dados.contas);
  var formulario = document.getElementById("form-cadastro");
  var modal = document.getElementById("modal-cadastro");
  var campoSecao = document.getElementById("secao");
  var campoNome = document.getElementById("nome");
  var campoValor = document.getElementById("valor");
  var campoId = document.getElementById("id-cadastro");
  var campoDescricao = document.getElementById("descricao");
  var campoCliente = document.getElementById("cliente");
  var campoVencimento = document.getElementById("vencimento");
  var campoStatus = document.getElementById("status");
  var campoMes = document.getElementById("filtro-mes");
  var campoBusca = document.getElementById("busca");
  var tituloModal = document.getElementById("titulo-modal");
  var botaoSalvar = document.getElementById("botao-salvar");
  var registroEmEdicao = null;

  function obterRegistros(secao) {
    return registros.filter(function (item) {
      return item.secao === secao && corresponde(item);
    });
  }

  function corresponde(registro) {
    var termo = normalizarTexto(campoBusca.value.trim());
    var texto = [registro.id, registro.nome, registro.descricao, registro.cliente,
      registro.status].join(" ");
    return (!termo || normalizarTexto(texto).indexOf(termo) !== -1) &&
      (registro.secao === "categoria" || registroNoMes(registro.vencimento, campoMes.value));
  }

  function atualizarCamposDoFormulario() {
    var ehCategoria = campoSecao.value === "categoria";
    document.querySelectorAll("#campo-valor, #campo-cliente, #campo-vencimento, #campo-status")
      .forEach(function (campo) {
        campo.style.display = ehCategoria ? "none" : "";
      });
    campoValor.required = campoSecao.value === "pagar" || campoSecao.value === "receber";
    campoId.value = campoSecao.value ? "Gerado ao salvar" : "";
  }

  function formatarData(data) {
    if (!data) return "—";
    var partes = data.split("-");
    return partes.length === 3 ? partes[2] + "/" + partes[1] + "/" + partes[0] : data;
  }

  function desenharCategorias() {
    var tabela = document.getElementById("lista-categorias");
    var categorias = obterRegistros("categoria");
    tabela.textContent = "";
    if (!categorias.length) criarLinhaVazia(tabela, 3, "Nenhum cadastro encontrado");
    categorias.forEach(function (categoria) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(categoria.id));
      linha.appendChild(criarCelula(categoria.nome));
      var acoes = document.createElement("td");
      acoes.appendChild(criarAcoes(categoria));
      linha.appendChild(acoes);
      tabela.appendChild(linha);
    });
    document.getElementById("quantidade-categorias").textContent = categorias.length;
    document.getElementById("total-categorias").textContent = "Total: " + categorias.length;
  }

  function desenharContas(secao) {
    var tabela = document.getElementById("lista-" + secao);
    var contas = obterRegistros(secao);
    var total = 0;
    tabela.textContent = "";
    if (!contas.length) criarLinhaVazia(tabela, 6, "Nenhum cadastro encontrado");
    contas.forEach(function (conta) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(conta.id));
      var nome = criarCelula(conta.nome);
      var detalhes = [conta.descricao, conta.cliente].filter(Boolean);
      if (detalhes.length) {
        nome.appendChild(document.createElement("br"));
        var pequeno = document.createElement("small");
        pequeno.textContent = detalhes.join(" - ");
        nome.appendChild(pequeno);
      }
      linha.appendChild(nome);
      linha.appendChild(criarCelula(formatarMoeda(conta.valor), "num"));
      linha.appendChild(criarCelula(formatarData(conta.vencimento)));
      linha.appendChild(criarCelula(conta.status));
      var celulaAcoes = document.createElement("td");
      celulaAcoes.appendChild(criarAcoes(conta));
      linha.appendChild(celulaAcoes);
      tabela.appendChild(linha);
      total += Number(conta.valor);
    });
    document.getElementById("quantidade-" + secao).textContent = "Quantidade: " + contas.length;
    document.getElementById("total-" + secao).textContent = formatarMoeda(total);
  }

  function desenharPagina() {
    desenharCategorias();
    desenharContas("pagar");
    desenharContas("receber");
  }

  function abrirEdicao(registro) {
    registroEmEdicao = registro;
    formulario.reset();
    campoSecao.value = registro.secao;
    campoSecao.disabled = true;
    campoNome.value = registro.nome;
    campoValor.value = registro.valor || "";
    campoId.value = registro.id;
    campoDescricao.value = registro.descricao || "";
    campoCliente.value = registro.cliente || "";
    campoVencimento.value = registro.vencimento || "";
    campoStatus.value = registro.status || "Pendente";
    tituloModal.textContent = "Editar Cadastro";
    botaoSalvar.textContent = "Salvar alterações";
    atualizarCamposDoFormulario();
    campoId.value = registro.id;
    modal.classList.add("aberto");
    campoNome.focus();
  }

  function criarAcoes(registro) {
    var acoes = document.createElement("div");
    acoes.className = "cadastro-acoes";
    var editar = document.createElement("button");
    editar.type = "button";
    editar.className = "cadastro-acao";
    editar.textContent = "Editar";
    editar.setAttribute("aria-label", "Editar " + registro.nome);
    editar.addEventListener("click", function () {
      abrirEdicao(registro);
    });
    acoes.appendChild(editar);
    var excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "cadastro-acao cadastro-acao-excluir";
    excluir.textContent = "Excluir";
    excluir.setAttribute("aria-label", "Excluir " + registro.nome);
    excluir.addEventListener("click", async function () {
      if (!window.confirm("Deseja excluir este cadastro?")) return;
      try {
        await requisitar("/api/" + (registro.secao === "categoria" ? "categorias" : "contas") +
          "/" + registro.id, { method: "DELETE" });
        dados = await carregarDados();
        sincronizarRegistros();
        desenharPagina();
        atualizarCamposDoFormulario();
      } catch (erro) {
        mostrarErro(erro);
      }
    });
    acoes.appendChild(excluir);
    return acoes;
  }

  function sincronizarRegistros() {
    registros = dados.categorias.map(function (item) {
      return { id: item.id, secao: "categoria", nome: item.nome };
    }).concat(dados.contas);
  }

  document.querySelector("[data-abrir='modal-cadastro']").addEventListener("click", function () {
    registroEmEdicao = null;
    formulario.reset();
    campoSecao.disabled = false;
    tituloModal.textContent = "Novo Cadastro";
    botaoSalvar.textContent = "Adicionar";
    atualizarCamposDoFormulario();
    modal.classList.add("aberto");
    campoSecao.focus();
  });
  modal.querySelector("[data-fechar]").addEventListener("click", function () {
    modal.classList.remove("aberto");
    registroEmEdicao = null;
    formulario.reset();
    campoSecao.disabled = false;
    tituloModal.textContent = "Novo Cadastro";
    botaoSalvar.textContent = "Adicionar";
    atualizarCamposDoFormulario();
  });
  modal.addEventListener("click", function (evento) {
    if (evento.target === modal) modal.classList.remove("aberto");
  });
  campoSecao.addEventListener("change", atualizarCamposDoFormulario);
  campoBusca.addEventListener("input", desenharPagina);
  campoMes.addEventListener("change", desenharPagina);
  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    var secao = campoSecao.value;
    var registro = {
      secao: secao,
      nome: campoNome.value.trim(),
      descricao: secao === "categoria" ? "" : campoDescricao.value.trim(),
      cliente: secao === "categoria" ? "" : campoCliente.value.trim(),
      vencimento: secao === "categoria" ? "" : campoVencimento.value,
      status: secao === "categoria" ? "" : campoStatus.value,
      valor: secao === "categoria" ? 0 : Number(campoValor.value)
    };
    if (!registro.nome || (secao !== "categoria" &&
        (!Number.isFinite(registro.valor) || registro.valor < 0))) {
      window.alert("Preencha os campos obrigatórios com valores válidos.");
      return;
    }
    try {
      var recurso = secao === "categoria" ? "categorias" : "contas";
      await requisitar("/api/" + recurso + (registroEmEdicao ? "/" + registroEmEdicao.id : ""), {
        method: registroEmEdicao ? "PUT" : "POST",
        body: JSON.stringify(registro)
      });
      dados = await carregarDados();
      sincronizarRegistros();
      desenharPagina();
      modal.classList.remove("aberto");
      registroEmEdicao = null;
      formulario.reset();
      campoSecao.disabled = false;
      atualizarCamposDoFormulario();
    } catch (erro) {
      mostrarErro(erro);
    }
  });
  preencherSeletorMeses(campoMes);
  atualizarCamposDoFormulario();
  desenharPagina();
}

async function iniciarAplicacao() {
  configurarModais();
  configurarAutenticacao();
  try {
    if (document.getElementById("form-produto")) {
      await configurarEstoque();
    } else if (document.getElementById("form-saida")) {
      await configurarSaidas();
    } else if (document.getElementById("form-cadastro")) {
      await configurarCadastro();
    }
  } catch (erro) {
    window.alert("Não foi possível carregar os dados do banco. " +
      "Inicie o servidor local e tente novamente.\n\n" + (erro.message || ""));
  }
}

iniciarAplicacao();
