// Violet — lista los archivos publicados (archivos.json) y genera sus tarjetas de descarga.
(function () {
  "use strict";

  var list = document.getElementById("list");
  var count = document.getElementById("count");
  var status = document.getElementById("status");
  var tpl = document.getElementById("card-tpl");

  function formatSize(bytes) {
    if (typeof bytes !== "number" || !isFinite(bytes)) return "";
    var units = ["B", "KB", "MB", "GB"];
    var i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return (i === 0 ? bytes : bytes.toFixed(bytes < 10 ? 1 : 0)) + " " + units[i];
  }

  function formatDate(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "";
    return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  }

  function extOf(name) {
    var m = /\.([a-z0-9]{1,5})$/i.exec(name || "");
    return m ? m[1] : "file";
  }

  function select(card) {
    var prev = list.querySelector(".card.selected");
    if (prev && prev !== card) prev.classList.remove("selected");
    card.classList.add("selected");
  }

  function render(items) {
    var frag = document.createDocumentFragment();

    items.forEach(function (f) {
      var card = tpl.content.firstElementChild.cloneNode(true);
      var btn = card.querySelector(".btn");

      card.querySelector(".ext").textContent = extOf(f.archivo || f.url);
      card.querySelector(".name").textContent = f.nombre;
      card.querySelector(".desc").textContent = f.descripcion || "";
      card.querySelector(".meta").textContent =
        [f.tamano || formatSize(f.bytes), formatDate(f.fecha)].filter(Boolean).join(" · ");

      btn.href = f.url;
      btn.setAttribute("aria-label", "Descargar " + f.nombre);
      if (f.local) btn.setAttribute("download", f.archivo.split("/").pop());

      card.addEventListener("click", function (e) {
        select(card);
        if (e.target.closest(".btn")) return;
        btn.focus({ preventScroll: true });
      });
      card.addEventListener("keydown", function (e) {
        if (e.target === card && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          select(card);
          btn.focus();
        }
      });

      frag.appendChild(card);
    });

    list.appendChild(frag);
  }

  function showStatus(msg) {
    status.textContent = msg;
    status.hidden = false;
  }

  fetch("archivos.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var items = Array.isArray(data.archivos) ? data.archivos : [];
      count.textContent = items.length === 1 ? "1 archivo disponible" : items.length + " archivos disponibles";
      if (!items.length) showStatus("Todavía no hay archivos publicados.");
      render(items);
    })
    .catch(function () {
      count.textContent = "";
      showStatus("No se pudo cargar la lista de archivos. Inténtalo de nuevo en unos minutos.");
    });
})();
