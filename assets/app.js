// Violet — lee archivos.json, dibuja la lista de secciones y las tarjetas de descarga.
(function () {
  "use strict";

  var list = document.getElementById("list");
  var nav = document.getElementById("sections");
  var title = document.getElementById("title");
  var count = document.getElementById("count");
  var status = document.getElementById("status");
  var tpl = document.getElementById("card-tpl");

  var TODO = "todo";
  var data = { secciones: [], archivos: [] };

  // Iconos (trazos de 24x24) según el nombre de la sección; si no coincide, carpeta.
  var ICONOS = {
    todo: "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z",
    apps: "M5 4h5v5H5zM14 4h5v5h-5zM5 15h5v5H5zM14 15h5v5h-5z",
    juegos: "M7 9v4M5 11h4M15 10h.01M18 12h.01M6 6h12a4 4 0 0 1 4 4v3a4 4 0 0 1-7 2.6L13.6 14h-3.2L9 15.6A4 4 0 0 1 2 13v-3a4 4 0 0 1 4-4z",
    navegadores: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
    ports: "M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4",
    programas: "M3 5h18v14H3zM3 9h18M7 13l2 2-2 2M12 17h4",
    "sistemas operativos": "M3 4h18v12H3zM8 20h8M12 16v4",
    carpeta: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
  };

  function icon(id) {
    var d = ICONOS[(id || "").toLowerCase()] || ICONOS.carpeta;
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

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

  function plural(n) { return n === 1 ? "1 archivo" : n + " archivos"; }

  function select(card) {
    var prev = list.querySelector(".card.selected");
    if (prev && prev !== card) prev.classList.remove("selected");
    card.classList.add("selected");
  }

  function buildCard(f) {
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
      if (!e.target.closest(".btn")) btn.focus({ preventScroll: true });
    });
    card.addEventListener("keydown", function (e) {
      if (e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        select(card);
        btn.focus();
      }
    });
    return card;
  }

  function buildNav() {
    var items = [{ id: TODO, nombre: "Todo", total: data.archivos.length }].concat(data.secciones);
    nav.textContent = "";
    items.forEach(function (s) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sec";
      b.dataset.id = s.id;
      b.innerHTML = icon(s.id) + '<span class="lbl"></span><span class="num"></span>';
      b.querySelector(".lbl").textContent = s.nombre;
      b.querySelector(".num").textContent = s.total;
      b.addEventListener("click", function () {
        if (location.hash.slice(1) !== encodeURIComponent(s.id)) {
          history.pushState(null, "", s.id === TODO ? location.pathname : "#" + encodeURIComponent(s.id));
        }
        show(s.id);
      });
      li.appendChild(b);
      nav.appendChild(li);
    });
  }

  function currentId() {
    var id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
    return data.secciones.some(function (s) { return s.id === id; }) ? id : TODO;
  }

  function show(id) {
    var sec = data.secciones.filter(function (s) { return s.id === id; })[0];
    var items = id === TODO ? data.archivos : data.archivos.filter(function (f) { return f.seccion === id; });

    Array.prototype.forEach.call(nav.querySelectorAll(".sec"), function (b) {
      var on = b.dataset.id === id;
      b.setAttribute("aria-current", on ? "true" : "false");
      if (on && b.scrollIntoView && window.matchMedia("(max-width: 760px)").matches) {
        b.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });

    title.textContent = sec ? sec.nombre : "Descargas";
    document.title = sec ? sec.nombre + " — Violet" : "Violet — Descargas";
    count.textContent = plural(items.length) + (items.length === 1 ? " disponible" : " disponibles");

    list.textContent = "";
    var frag = document.createDocumentFragment();
    items.forEach(function (f) { frag.appendChild(buildCard(f)); });
    list.appendChild(frag);

    status.hidden = items.length > 0;
    status.textContent = id === TODO ? "Todavía no hay archivos publicados." : "Esta sección todavía no tiene archivos.";
  }

  window.addEventListener("popstate", function () { show(currentId()); });
  window.addEventListener("hashchange", function () { show(currentId()); });

  fetch("archivos.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      data.archivos = Array.isArray(json.archivos) ? json.archivos : [];
      data.secciones = Array.isArray(json.secciones) ? json.secciones : [];
      buildNav();
      show(currentId());
    })
    .catch(function () {
      count.textContent = "";
      status.textContent = "No se pudo cargar la lista de archivos. Inténtalo de nuevo en unos minutos.";
      status.hidden = false;
    });
})();
