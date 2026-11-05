/* Utilitários compartilhados por todas as páginas */
var chaveEstoque = "toca-acai-produtos";
var chaveSaidas = "toca-acai-saidas";
var chaveCadastros = "toca-acai-cadastros";
var filtroTodosMeses = "todos";
var mesesDoAno = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
var limiteEstoqueBaixo = 3;

function carregarLista(chave) {
  var dados = localStorage.getItem(chave);
  if (dados === null) {
    return [];
  }

  var lista = JSON.parse(dados);
  if (!Array.isArray(lista)) {
    throw new Error("Os dados armazenados em " + chave + " são inválidos.");
  }
  return lista;
}

function salvarLista(chave, lista) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista));
    return true;
  } catch (erro) {
    window.alert("Não foi possível salvar os dados. Verifique o espaço disponível no navegador.");
    return false;
  }
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
  if (!seletor) {
    return;
  }

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
  if (!data || mesSelecionado === filtroTodosMeses) {
    return true;
  }
  var partes = data.split("-");
  if (partes.length < 2) {
    return true;
  }
  return String(Number(partes[1]) - 1) === mesSelecionado;
}

function obterCategoriasCadastradas() {
  return carregarLista(chaveCadastros).filter(function (registro) {
    return registro.secao === "categoria" && registro.nome.trim();
  });
}

function encontrarCategoria(categorias, categoriaId, nomeCategoria) {
  if (categoriaId) {
    var porId = categorias.find(function (categoria) {
      return categoria.id === categoriaId;
    });
    if (porId) {
      return porId;
    }
  }

  return categorias.find(function (categoria) {
    return normalizarTexto(categoria.nome) === normalizarTexto(nomeCategoria);
  }) || null;
}

function nomeCategoriaDoProduto(produto, categorias) {
  var categoria = encontrarCategoria(categorias, produto.categoriaId, produto.categoria);
  return categoria ? categoria.nome : produto.categoria;
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
  if (classe) {
    celula.className = classe;
  }
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
        if (primeiroCampo) {
          primeiroCampo.focus();
        }
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
      if (evento.target === overlay) {
        overlay.classList.remove("aberto");
      }
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

/* Página Estoque: inclusão, edição, busca e resumo mensal */
function configurarEstoque() {
  var produtos = carregarLista(chaveEstoque);
  var categorias = obterCategoriasCadastradas();
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

  function dataDoProduto(produto) {
    return produto.atualizadoEm || produto.criadoEm || hojeComoData();
  }

  function atualizarCategorias(selecionada, incluirCategoriaLegada) {
    categorias = obterCategoriasCadastradas();
    campoCategoria.textContent = "";

    var opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = categorias.length
      ? "Selecione uma categoria"
      : "Cadastre uma categoria primeiro";
    campoCategoria.appendChild(opcaoInicial);

    categorias.forEach(function (categoria) {
      var opcao = document.createElement("option");
      opcao.value = categoria.id;
      opcao.textContent = categoria.nome;
      campoCategoria.appendChild(opcao);
    });

    if (incluirCategoriaLegada && selecionada &&
        !categorias.some(function (categoria) {
          return categoria.id === selecionada.categoriaId ||
            normalizarTexto(categoria.nome) === normalizarTexto(selecionada.categoria);
        })) {
      var categoriaLegada = document.createElement("option");
      categoriaLegada.value = selecionada.categoriaId || selecionada.categoria;
      categoriaLegada.textContent = selecionada.categoria + " (categoria antiga)";
      campoCategoria.appendChild(categoriaLegada);
    }

    if (selecionada) {
      var categoriaAtual = encontrarCategoria(
        categorias,
        selecionada.categoriaId,
        selecionada.categoria
      );
      campoCategoria.value = categoriaAtual
        ? categoriaAtual.id
        : (selecionada.categoriaId || selecionada.categoria);
    } else {
      campoCategoria.value = "";
    }
    campoCategoria.disabled = categorias.length === 0 && !incluirCategoriaLegada;
  }

  function desenharEstoque() {
    var termo = normalizarTexto(busca.value.trim());
    var filtrados = produtos.filter(function (produto) {
      var texto = [
        produto.id,
        produto.nome,
        nomeCategoriaDoProduto(produto, categorias),
        produto.quantidade,
        produto.preco
      ].join(" ");

      return registroNoMes(dataDoProduto(produto), seletorMes.value) &&
        normalizarTexto(texto).indexOf(termo) !== -1;
    });
    tabela.textContent = "";

    if (filtrados.length === 0) {
      criarLinhaVazia(
        tabela,
        6,
        termo ? "Nenhum produto encontrado" : "Nenhum produto cadastrado neste mês"
      );
    }

    filtrados.forEach(function (produto) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(produto.id));
      linha.appendChild(criarCelula(produto.nome));
      linha.appendChild(criarCelula(nomeCategoriaDoProduto(produto, categorias)));
      linha.appendChild(criarCelula(String(produto.quantidade), "num"));
      linha.appendChild(criarCelula(formatarMoeda(produto.preco)));

      var celulaAcao = document.createElement("td");
      var acoes = document.createElement("div");
      acoes.className = "cadastro-acoes";
      var botaoEditar = document.createElement("button");
      botaoEditar.type = "button";
      botaoEditar.className = "cadastro-acao";
      botaoEditar.textContent = "Editar";
      botaoEditar.setAttribute("aria-label", "Editar " + produto.nome);
      botaoEditar.addEventListener("click", function () {
        abrirEdicao(produto);
      });
      acoes.appendChild(botaoEditar);
      celulaAcao.appendChild(acoes);
      linha.appendChild(celulaAcao);
      tabela.appendChild(linha);
    });

    indicadores[0].textContent = String(filtrados.length);
    indicadores[1].textContent = formatarMoeda(filtrados.reduce(function (total, produto) {
      return total + produto.quantidade * produto.preco;
    }, 0));
    indicadores[2].textContent = String(filtrados.filter(function (produto) {
      return produto.quantidade <= limiteEstoqueBaixo;
    }).length);
  }

  function proximoId() {
    var maior = produtos.reduce(function (valor, produto) {
      return Math.max(valor, Number(produto.id) || 0);
    }, 0);
    return String(maior + 1).padStart(3, "0");
  }

  function abrirInclusao() {
    produtoEmEdicao = null;
    formulario.reset();
    atualizarCategorias(null, false);
    campoQuantidade.min = "1";
    campoQuantidade.value = "";
    tituloModal.textContent = "Adicionar Produto";
    botaoSalvar.textContent = "Adicionar";
  }

  function abrirEdicao(produto) {
    produtoEmEdicao = produto;
    formulario.reset();
    atualizarCategorias(produto, true);
    campoNome.value = produto.nome;
    campoQuantidade.min = "0";
    campoQuantidade.value = String(produto.quantidade);
    campoPreco.value = String(produto.preco);
    tituloModal.textContent = "Editar Produto";
    botaoSalvar.textContent = "Salvar alterações";
    modal.classList.add("aberto");
    campoNome.focus();
  }

  document.querySelector("[data-abrir='modal-cadastro']").addEventListener("click", abrirInclusao);
  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();
    var nome = campoNome.value.trim();
    var quantidade = Number(campoQuantidade.value);
    var categoriaSelecionada = categorias.find(function (categoria) {
      return categoria.id === campoCategoria.value;
    });
    var categoriaAnterior = produtoEmEdicao
      ? encontrarCategoria(categorias, produtoEmEdicao.categoriaId, produtoEmEdicao.categoria)
      : null;
    var mantendoCategoriaLegada = produtoEmEdicao && !categoriaAnterior &&
      campoCategoria.value === (produtoEmEdicao.categoriaId || produtoEmEdicao.categoria);
    var categoriaNome = categoriaSelecionada
      ? categoriaSelecionada.nome
      : (categoriaAnterior ? categoriaAnterior.nome :
        (mantendoCategoriaLegada ? produtoEmEdicao.categoria : ""));
    var categoriaId = categoriaSelecionada
      ? categoriaSelecionada.id
      : (produtoEmEdicao ? produtoEmEdicao.categoriaId : "");
    var preco = Number(campoPreco.value);
    var quantidadeMinima = produtoEmEdicao ? 0 : 1;

    if (!nome || !categoriaNome || !Number.isInteger(quantidade) || quantidade < quantidadeMinima ||
        !Number.isFinite(preco) || preco < 0) {
      window.alert("Informe o nome, selecione uma categoria cadastrada e preencha uma quantidade e preço válidos.");
      return;
    }

    var duplicado = produtos.some(function (produto) {
      return produto.id !== (produtoEmEdicao && produtoEmEdicao.id) &&
        normalizarTexto(produto.nome) === normalizarTexto(nome) &&
        normalizarTexto(nomeCategoriaDoProduto(produto, categorias)) === normalizarTexto(categoriaNome);
    });
    if (duplicado) {
      window.alert("Já existe um produto com esse nome e categoria.");
      return;
    }

    var atualizados;
    if (produtoEmEdicao) {
      atualizados = produtos.map(function (produto) {
        if (produto.id !== produtoEmEdicao.id) {
          return produto;
        }
        return {
          id: produto.id,
          nome: nome,
          categoria: categoriaNome,
          categoriaId: categoriaId,
          quantidade: quantidade,
          preco: preco,
          criadoEm: produto.criadoEm || dataDoProduto(produto),
          atualizadoEm: hojeComoData()
        };
      });
    } else {
      var existente = produtos.find(function (produto) {
        return normalizarTexto(produto.nome) === normalizarTexto(nome) &&
          normalizarTexto(nomeCategoriaDoProduto(produto, categorias)) === normalizarTexto(categoriaNome);
      });
      if (existente) {
        atualizados = produtos.map(function (produto) {
          if (produto.id !== existente.id) {
            return produto;
          }
          return {
            id: produto.id,
            nome: produto.nome,
            categoria: categoriaNomeDoProduto(produto, categorias),
            categoriaId: categoriaId || produto.categoriaId,
            quantidade: produto.quantidade + quantidade,
            preco: preco || produto.preco,
            criadoEm: produto.criadoEm || dataDoProduto(produto),
            atualizadoEm: hojeComoData()
          };
        });
      } else {
        atualizados = produtos.concat({
          id: proximoId(),
          nome: nome,
          categoria: categoriaNome,
          categoriaId: categoriaId,
          quantidade: quantidade,
          preco: preco,
          criadoEm: hojeComoData(),
          atualizadoEm: hojeComoData()
        });
      }
    }

    if (salvarLista(chaveEstoque, atualizados)) {
      produtos = atualizados;
      produtoEmEdicao = null;
      desenharEstoque();
      formulario.reset();
      modal.classList.remove("aberto");
    }
  });

  busca.addEventListener("input", desenharEstoque);
  seletorMes.addEventListener("change", desenharEstoque);
  window.addEventListener("storage", function (evento) {
    if (evento.key === chaveCadastros) {
      atualizarCategorias(produtoEmEdicao, Boolean(produtoEmEdicao));
      desenharEstoque();
    } else if (evento.key === chaveEstoque) {
      produtos = carregarLista(chaveEstoque);
      desenharEstoque();
    }
  });
  preencherSeletorMeses(seletorMes);
  atualizarCategorias(null, false);
  desenharEstoque();
}

/* Página Saída: baixa de estoque e histórico mensal de movimentações */
function configurarSaidas() {
  var produtos = carregarLista(chaveEstoque);
  var saidas = carregarLista(chaveSaidas);
  var categorias = obterCategoriasCadastradas();
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

  function encontrarProdutoSelecionado() {
    return produtos.find(function (produto) {
      return produto.id === campoProduto.value;
    });
  }

  function atualizarProdutosDisponiveis() {
    campoProduto.textContent = "";
    var opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = "Selecione um produto do estoque";
    campoProduto.appendChild(opcaoInicial);
    produtos.filter(function (produto) {
      return produto.quantidade > 0;
    }).forEach(function (produto) {
      var opcao = document.createElement("option");
      opcao.value = produto.id;
      opcao.textContent = produto.nome + " - " +
        nomeCategoriaDoProduto(produto, categorias) +
        " (" + produto.quantidade + " disponíveis)";
      campoProduto.appendChild(opcao);
    });
  }

  function atualizarDadosDoProduto() {
    var produto = encontrarProdutoSelecionado();
    var nomeCategoria = produto ? nomeCategoriaDoProduto(produto, categorias) : "";
    campoCategoria.textContent = "";
    var opcaoInicial = document.createElement("option");
    opcaoInicial.value = nomeCategoria;
    opcaoInicial.textContent = nomeCategoria || "Selecione um produto";
    campoCategoria.appendChild(opcaoInicial);
    campoCategoria.value = nomeCategoria;

    var quantidade = Number(campoQuantidade.value);
    campoValor.value = produto && Number.isFinite(quantidade) && quantidade > 0
      ? (produto.preco * quantidade).toFixed(2)
      : "";
  }

  function desenharSaidas() {
    var termo = normalizarTexto(busca.value.trim());
    var filtradas = saidas.filter(function (saida) {
      var texto = [
        saida.id,
        saida.nome,
        nomeCategoriaDoProduto(saida, categorias),
        saida.quantidade,
        saida.motivo,
        saida.data
      ].join(" ");
      return registroNoMes(saida.data, seletorMes.value) &&
        normalizarTexto(texto).indexOf(termo) !== -1;
    });
    tabela.textContent = "";

    if (filtradas.length === 0) {
      criarLinhaVazia(
        tabela,
        5,
        termo ? "Nenhuma saída encontrada" : "Nenhuma saída registrada neste mês"
      );
    }

    filtradas.slice().reverse().forEach(function (saida) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(saida.id));
      linha.appendChild(criarCelula(saida.nome));
      linha.appendChild(criarCelula(nomeCategoriaDoProduto(saida, categorias)));
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
  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();
    var produto = encontrarProdutoSelecionado();
    var quantidade = Number(campoQuantidade.value);

    if (!produto) {
      window.alert("Selecione um produto existente no estoque.");
      return;
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      window.alert("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (quantidade > produto.quantidade) {
      window.alert("Quantidade indisponível. Estoque atual: " + produto.quantidade + ".");
      return;
    }

    var estoqueAtualizado = produtos.map(function (item) {
      if (item.id !== produto.id) {
        return item;
      }
      return {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        quantidade: item.quantidade - quantidade,
        preco: item.preco,
        criadoEm: item.criadoEm || item.atualizadoEm || hojeComoData(),
        atualizadoEm: hojeComoData()
      };
    });
    var proximoId = saidas.reduce(function (maior, saida) {
      return Math.max(maior, Number(saida.id) || 0);
    }, 0) + 1;
    var novaSaida = {
      id: String(proximoId).padStart(3, "0"),
      produtoId: produto.id,
      nome: produto.nome,
      categoria: nomeCategoriaDoProduto(produto, categorias),
      categoriaId: produto.categoriaId ||
        (encontrarCategoria(categorias, "", produto.categoria) || {}).id || "",
      quantidade: quantidade,
      motivo: campoMotivo.value,
      data: campoData.value || hojeComoData()
    };
    var saidasAtualizadas = saidas.concat(novaSaida);

    if (!salvarLista(chaveEstoque, estoqueAtualizado)) {
      return;
    }
    if (!salvarLista(chaveSaidas, saidasAtualizadas)) {
      if (!salvarLista(chaveEstoque, produtos)) {
        window.alert("Não foi possível restaurar o estoque após falha ao salvar a saída.");
      }
      return;
    }

    produtos = estoqueAtualizado;
    saidas = saidasAtualizadas;
    atualizarProdutosDisponiveis();
    desenharSaidas();
    formulario.reset();
    document.getElementById("modal-saida").classList.remove("aberto");
  });

  busca.addEventListener("input", desenharSaidas);
  seletorMes.addEventListener("change", desenharSaidas);
  window.addEventListener("storage", function (evento) {
    if (evento.key === chaveCadastros) {
      categorias = obterCategoriasCadastradas();
      atualizarProdutosDisponiveis();
      atualizarDadosDoProduto();
      desenharSaidas();
    } else if (evento.key === chaveEstoque) {
      produtos = carregarLista(chaveEstoque);
      atualizarProdutosDisponiveis();
      atualizarDadosDoProduto();
    } else if (evento.key === chaveSaidas) {
      saidas = carregarLista(chaveSaidas);
      desenharSaidas();
    }
  });
  preencherSeletorMeses(seletorMes);
  atualizarProdutosDisponiveis();
  desenharSaidas();
}

/* Página Cadastro: categorias, contas e filtro por mês de vencimento */
function configurarCadastro() {
  var chaveArmazenamento = "toca-acai-cadastros";
  var registros = carregarLista(chaveArmazenamento);
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

  function gerarId(secao) {
    var maiorId = 0;
    registros.forEach(function (registro) {
      if (registro.secao === secao) {
        maiorId = Math.max(maiorId, parseInt(registro.id, 10) || 0);
      }
    });
    return String(maiorId + 1).padStart(3, "0");
  }

  function atualizarCamposDoFormulario() {
    var secao = campoSecao.value;
    var ehCategoria = secao === "categoria";
    document.querySelectorAll(
      "#campo-valor, #campo-cliente, #campo-vencimento, #campo-status"
    ).forEach(function (campo) {
      campo.style.display = ehCategoria ? "none" : "";
    });
    campoValor.required = secao === "pagar" || secao === "receber";
    campoId.value = secao ? gerarId(secao) : "";
  }

  function formatarData(data) {
    if (!data) {
      return "—";
    }
    var partes = data.split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }

  function registroCorrespondeAoFiltro(registro) {
    var termo = normalizarTexto(campoBusca.value.trim());
    var texto = [
      registro.id,
      registro.nome,
      registro.descricao,
      registro.cliente,
      registro.status
    ].join(" ");

    if (termo && normalizarTexto(texto).indexOf(termo) === -1) {
      return false;
    }
    if (registro.secao !== "categoria" &&
        !registroNoMes(registro.vencimento, campoMes.value)) {
      return false;
    }
    return true;
  }

  function obterRegistros(secao) {
    return registros.filter(function (registro) {
      return registro.secao === secao && registroCorrespondeAoFiltro(registro);
    });
  }

  function criarAcoes(registro) {
    var acoes = document.createElement("div");
    acoes.className = "cadastro-acoes";

    var botaoEditar = document.createElement("button");
    botaoEditar.type = "button";
    botaoEditar.className = "cadastro-acao";
    botaoEditar.textContent = "Editar";
    botaoEditar.setAttribute("aria-label", "Editar " + registro.nome);
    botaoEditar.addEventListener("click", function () {
      abrirEdicao(registro);
    });
    acoes.appendChild(botaoEditar);

    var botaoExcluir = document.createElement("button");
    botaoExcluir.type = "button";
    botaoExcluir.className = "cadastro-acao cadastro-acao-excluir";
    botaoExcluir.textContent = "Excluir";
    botaoExcluir.setAttribute("aria-label", "Excluir " + registro.nome);
    botaoExcluir.addEventListener("click", function () {
      if (window.confirm("Deseja excluir este cadastro?")) {
        var atualizados = registros.filter(function (item) {
          return item.secao !== registro.secao || item.id !== registro.id;
        });
        if (salvarLista(chaveArmazenamento, atualizados)) {
          registros = atualizados;
          desenharPagina();
          atualizarCamposDoFormulario();
        }
      }
    });
    acoes.appendChild(botaoExcluir);
    return acoes;
  }

  function desenharCategorias() {
    var tabela = document.getElementById("lista-categorias");
    var categorias = obterRegistros("categoria");
    tabela.textContent = "";

    if (categorias.length === 0) {
      criarLinhaVazia(tabela, 3, "Nenhum cadastro encontrado");
    }
    categorias.forEach(function (categoria) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(categoria.id));
      var celulaNome = criarCelula(categoria.nome);
      if (categoria.descricao) {
        celulaNome.textContent += " — " + categoria.descricao;
      }
      linha.appendChild(celulaNome);
      var celulaAcoes = document.createElement("td");
      celulaAcoes.appendChild(criarAcoes(categoria));
      linha.appendChild(celulaAcoes);
      tabela.appendChild(linha);
    });

    document.getElementById("quantidade-categorias").textContent = categorias.length;
    document.getElementById("total-categorias").textContent = "Total: " + categorias.length;
  }

  function desenharContas(secao) {
    var tabela = document.getElementById("lista-" + secao);
    var totalElemento = document.getElementById("total-" + secao);
    var quantidadeElemento = document.getElementById("quantidade-" + secao);
    var contas = obterRegistros(secao);
    var total = 0;
    tabela.textContent = "";

    if (contas.length === 0) {
      criarLinhaVazia(tabela, 6, "Nenhum cadastro encontrado");
    }
    contas.forEach(function (conta) {
      var linha = document.createElement("tr");
      linha.appendChild(criarCelula(conta.id));

      var celulaNome = criarCelula(conta.nome);
      var detalhes = [];
      if (conta.descricao) {
        detalhes.push(conta.descricao);
      }
      if (conta.cliente) {
        detalhes.push(conta.cliente);
      }
      if (detalhes.length > 0) {
        var textoDetalhes = document.createElement("small");
        textoDetalhes.textContent = detalhes.join(" - ");
        celulaNome.appendChild(document.createElement("br"));
        celulaNome.appendChild(textoDetalhes);
      }
      linha.appendChild(celulaNome);
      linha.appendChild(criarCelula(formatarMoeda(conta.valor), "num"));
      linha.appendChild(criarCelula(formatarData(conta.vencimento)));
      linha.appendChild(criarCelula(conta.status));
      var celulaAcoes = document.createElement("td");
      celulaAcoes.appendChild(criarAcoes(conta));
      linha.appendChild(celulaAcoes);
      tabela.appendChild(linha);
      total += Number(conta.valor);
    });

    quantidadeElemento.textContent = "Quantidade: " + contas.length;
    totalElemento.textContent = formatarMoeda(total);
  }

  function desenharPagina() {
    desenharCategorias();
    desenharContas("pagar");
    desenharContas("receber");
  }

  function abrirInclusao() {
    registroEmEdicao = null;
    formulario.reset();
    campoSecao.disabled = false;
    tituloModal.textContent = "Novo Cadastro";
    botaoSalvar.textContent = "Adicionar";
    atualizarCamposDoFormulario();
    modal.classList.add("aberto");
    campoSecao.focus();
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

  function fecharModal() {
    modal.classList.remove("aberto");
    registroEmEdicao = null;
    formulario.reset();
    campoSecao.disabled = false;
    tituloModal.textContent = "Novo Cadastro";
    botaoSalvar.textContent = "Adicionar";
    atualizarCamposDoFormulario();
  }

  document.querySelector("[data-abrir='modal-cadastro']").addEventListener("click", abrirInclusao);
  modal.querySelector("[data-fechar]").addEventListener("click", fecharModal);
  modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
      fecharModal();
    }
  });
  campoSecao.addEventListener("change", atualizarCamposDoFormulario);
  campoBusca.addEventListener("input", desenharPagina);
  campoMes.addEventListener("change", desenharPagina);
  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();
    var secao = campoSecao.value;
    var registro = {
      id: registroEmEdicao ? registroEmEdicao.id : gerarId(secao),
      secao: secao,
      nome: campoNome.value.trim(),
      descricao: campoDescricao.value.trim(),
      cliente: secao === "categoria" ? "" : campoCliente.value.trim(),
      vencimento: secao === "categoria" ? "" : campoVencimento.value,
      status: secao === "categoria" ? "" : campoStatus.value,
      valor: secao === "categoria" ? 0 : Number(campoValor.value)
    };
    var atualizados = registros.slice();
    if (registroEmEdicao) {
      atualizados = registros.map(function (item) {
        return item.secao === registroEmEdicao.secao && item.id === registroEmEdicao.id
          ? registro
          : item;
      });
    } else {
      atualizados.push(registro);
    }

    if (salvarLista(chaveArmazenamento, atualizados)) {
      registros = atualizados;
      desenharPagina();
      fecharModal();
    }
  });

  preencherSeletorMeses(campoMes);
  atualizarCamposDoFormulario();
  desenharPagina();
}

/* Validação do formulário de criação de conta */
function configurarRegistroDeConta() {
  var formulario = document.getElementById("form-registro");
  if (!formulario) {
    return;
  }
  formulario.addEventListener("submit", function (evento) {
    if (document.getElementById("senha").value !==
        document.getElementById("confirmar").value) {
      evento.preventDefault();
      window.alert("As senhas não conferem.");
    }
  });
}

configurarModais();
configurarRegistroDeConta();
if (document.getElementById("form-produto")) {
  configurarEstoque();
} else if (document.getElementById("form-saida")) {
  configurarSaidas();
} else if (document.getElementById("form-cadastro")) {
  configurarCadastro();
}
