// Abre e fecha modais: <button data-abrir="id"> e <button data-fechar>
document.querySelectorAll("[data-abrir]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.getElementById(btn.dataset.abrir).classList.add("aberto");
  });
});

document.querySelectorAll("[data-fechar]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    btn.closest(".overlay").classList.remove("aberto");
  });
});

document.querySelectorAll(".overlay").forEach(function (ov) {
  ov.addEventListener("click", function (e) {
    if (e.target === ov) ov.classList.remove("aberto");
  });
});

// Envio dos formulários dos modais (protótipo: apenas fecha e avisa)
document.querySelectorAll("form.proto").forEach(function (f) {
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    f.closest(".overlay").classList.remove("aberto");
    alert("Registro salvo (protótipo).");
  });
});