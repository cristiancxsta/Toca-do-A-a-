var chaveArmazenamento = "toca-acai-cadastros";
var registros = JSON.parse(localStorage.getItem(chaveArmazenamento) || "[]");

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

var meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function carregarMeses() {
  for (var i = 0; i < meses.length; i++) {
    var opcao = document.createElement("option");
    opcao.value = String(i);
    opcao.textContent = meses[i];
    campoMes.appendChild(opcao);
  }

  campoMes.value = String(new Date().getMonth());
}

function gerarId(secao) {
  var maiorId = 0;

  for (var i = 0; i < registros.length; i++) {
    if (registros[i].secao === secao) {
      var numeroId = parseInt(registros[i].id, 10);
      if (numeroId > maiorId) {
        maiorId = numeroId;
      }
    }
  }

  var proximoId = String(maiorId + 1);
  while (proximoId.length < 3) {
    proximoId = "0" + proximoId;
  }
  return proximoId;
}

function atualizarCamposDoFormulario() {
  var secao = campoSecao.value;
  var ehCategoria = secao === "categoria";
  var camposFinanceiros = document.querySelectorAll(
    "#campo-valor, #campo-cliente, #campo-vencimento, #campo-status"
  );

  for (var i = 0; i < camposFinanceiros.length; i++) {
    camposFinanceiros[i].style.display = ehCategoria ? "none" : "";
  }

  campoValor.required = secao === "pagar" || secao === "receber";
  campoId.value = secao ? gerarId(secao) : "";
}

function criarCelula(texto) {
  var celula = document.createElement("td");
  celula.textContent = texto;
  return celula;
}

function formatarValor(valor) {
  return "R$ " + Number(valor).toFixed(2).replace(".", ",");
}

function formatarData(data) {
  if (!data) {
    return "—";
  }

  var partes = data.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function registroCorrespondeAoFiltro(registro) {
  var termo = campoBusca.value.trim().toLowerCase();
  var textoRegistro = [
    registro.id,
    registro.nome,
    registro.descricao,
    registro.cliente,
    registro.status
  ].join(" ").toLowerCase();

  if (termo && textoRegistro.indexOf(termo) === -1) {
    return false;
  }

  if (registro.secao !== "categoria" && campoMes.value && registro.vencimento) {
    var mesDoVencimento = String(parseInt(registro.vencimento.split("-")[1], 10) - 1);
    if (mesDoVencimento !== campoMes.value) {
      return false;
    }
  }

  return true;
}

function obterRegistros(secao) {
  var resultado = [];

  for (var i = 0; i < registros.length; i++) {
    if (registros[i].secao === secao && registroCorrespondeAoFiltro(registros[i])) {
      resultado.push(registros[i]);
    }
  }

  return resultado;
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
      registros = registros.filter(function (item) {
        return item.secao !== registro.secao || item.id !== registro.id;
      });
      salvarRegistros();
      desenharPagina();
      atualizarCamposDoFormulario();
    }
  });

  acoes.appendChild(botaoExcluir);
  return acoes;
}

function adicionarLinhaVazia(tabela, colunas) {
  var linha = document.createElement("tr");
  var celula = criarCelula("Nenhum cadastro encontrado");
  celula.colSpan = colunas;
  linha.appendChild(celula);
  tabela.appendChild(linha);
}

function desenharCategorias() {
  var tabela = document.getElementById("lista-categorias");
  var categorias = obterRegistros("categoria");
  tabela.textContent = "";

  if (categorias.length === 0) {
    adicionarLinhaVazia(tabela, 3);
  }

  for (var i = 0; i < categorias.length; i++) {
    var linha = document.createElement("tr");
    linha.appendChild(criarCelula(categorias[i].id));

    var celulaNome = criarCelula(categorias[i].nome);
    if (categorias[i].descricao) {
      celulaNome.textContent += " — " + categorias[i].descricao;
    }
    linha.appendChild(celulaNome);

    var celulaAcoes = document.createElement("td");
    celulaAcoes.appendChild(criarAcoes(categorias[i]));
    linha.appendChild(celulaAcoes);
    tabela.appendChild(linha);
  }

  document.getElementById("quantidade-categorias").textContent = categorias.length;
  document.getElementById("total-categorias").textContent =
    "Total: " + categorias.length;
}

function desenharContas(secao) {
  var tabela = document.getElementById("lista-" + secao);
  var totalElemento = document.getElementById("total-" + secao);
  var quantidadeElemento = document.getElementById("quantidade-" + secao);
  var contas = obterRegistros(secao);
  var total = 0;
  tabela.textContent = "";

  if (contas.length === 0) {
    adicionarLinhaVazia(tabela, 6);
  }

  for (var i = 0; i < contas.length; i++) {
    var linha = document.createElement("tr");
    linha.appendChild(criarCelula(contas[i].id));

    var celulaNome = criarCelula(contas[i].nome);
    var detalhes = [];
    if (contas[i].descricao) {
      detalhes.push(contas[i].descricao);
    }
    if (contas[i].cliente) {
      detalhes.push(contas[i].cliente);
    }
    if (detalhes.length > 0) {
      var textoDetalhes = document.createElement("small");
      textoDetalhes.textContent = detalhes.join(" - ");
      celulaNome.appendChild(document.createElement("br"));
      celulaNome.appendChild(textoDetalhes);
    }
    linha.appendChild(celulaNome);

    var celulaValor = criarCelula(formatarValor(contas[i].valor));
    celulaValor.className = "num";
    linha.appendChild(celulaValor);
    linha.appendChild(criarCelula(formatarData(contas[i].vencimento)));
    linha.appendChild(criarCelula(contas[i].status));

    var celulaAcoes = document.createElement("td");
    celulaAcoes.appendChild(criarAcoes(contas[i]));
    linha.appendChild(celulaAcoes);
    tabela.appendChild(linha);
    total += Number(contas[i].valor);
  }

  quantidadeElemento.textContent = "Quantidade: " + contas.length;
  totalElemento.textContent = formatarValor(total);
}

function desenharPagina() {
  desenharCategorias();
  desenharContas("pagar");
  desenharContas("receber");
}

function salvarRegistros() {
  localStorage.setItem(chaveArmazenamento, JSON.stringify(registros));
}

function abrirModal() {
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

document.querySelector("[data-abrir='modal-cadastro']").addEventListener("click", abrirModal);
document.querySelector("[data-fechar]").addEventListener("click", fecharModal);

modal.addEventListener("click", function (evento) {
  if (evento.target === modal) {
    fecharModal();
  }
});

document.addEventListener("keydown", function (evento) {
  if (evento.key === "Escape" && modal.classList.contains("aberto")) {
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

  if (registroEmEdicao) {
    for (var i = 0; i < registros.length; i++) {
      if (registros[i].secao === registroEmEdicao.secao &&
          registros[i].id === registroEmEdicao.id) {
        registros[i] = registro;
        break;
      }
    }
  } else {
    registros.push(registro);
  }
  salvarRegistros();
  desenharPagina();
  fecharModal();
});

carregarMeses();
atualizarCamposDoFormulario();
desenharPagina();