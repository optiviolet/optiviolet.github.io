// Genera archivos.json a partir de la carpeta files/, releases.json y catalogo.json.
// Cada subcarpeta de files/ es una sección de la web (apps, juegos, ...).
// Lo ejecuta GitHub Actions en cada publicación (también puedes ejecutarlo en local):
//   node scripts/generar-catalogo.mjs
// Sin dependencias: solo Node.js.

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const filesDir = join(root, "files");
const IGNORAR = new Set(["LEEME.md", "Thumbs.db", "desktop.ini"]);
const SIN_SECCION = "otros";

function leerJSON(nombre, porDefecto) {
  const p = join(root, nombre);
  if (!existsSync(p)) return porDefecto;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`ERROR: ${nombre} no es un JSON válido:\n  ${e.message}`);
    process.exit(1);
  }
}

// catalogo.json (opcional): nombres bonitos, descripciones, orden y enlaces externos.
const catalogo = { archivos: {}, secciones: {}, enlaces: [], ...leerJSON("catalogo.json", {}) };
// releases.json: archivos grandes subidos a GitHub Releases por scripts/sincronizar.mjs.
const releases = leerJSON("releases.json", []);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name.startsWith(".") || IGNORAR.has(d.name)) return [];
    const full = join(dir, d.name);
    return d.isDirectory() ? walk(full) : d.isFile() ? [full] : [];
  });
}

// Fecha del último commit que tocó el archivo (en Actions); si no hay git, la fecha del disco.
function fechaDe(full) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", full], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {}
  return statSync(full).mtime.toISOString();
}

const quitarExtension = (n) => n.replace(/\.[^.]+$/, "");
const capitalizar = (s) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

// Secciones = carpetas de primer nivel dentro de files/ (aunque estén vacías).
const carpetas = existsSync(filesDir)
  ? readdirSync(filesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
  : [];

const locales = walk(filesDir).map((full) => {
  const rel = relative(filesDir, full).split(sep).join("/"); // p. ej. "juegos/mi archivo.zip"
  const meta = catalogo.archivos?.[rel] || {};
  return {
    nombre: meta.nombre || quitarExtension(rel.split("/").pop()),
    descripcion: meta.descripcion || "",
    seccion: rel.includes("/") ? rel.split("/")[0] : SIN_SECCION,
    archivo: rel,
    url: "files/" + rel.split("/").map(encodeURIComponent).join("/"),
    bytes: statSync(full).size,
    fecha: fechaDe(full),
    local: true,
    orden: meta.orden,
  };
});

// Enlaces externos: los de releases.json (automáticos) y los escritos a mano en catalogo.json.
const externos = [...releases, ...(catalogo.enlaces || [])].flatMap((e, i) => {
  if (!e || !e.url || !/^https:\/\//i.test(e.url)) {
    console.warn(`AVISO: un enlace externo (#${i + 1}) no tiene una URL https válida; se ignora.`);
    return [];
  }
  const clave = e.seccion && e.archivo ? `${e.seccion}/${e.archivo}` : "";
  const meta = catalogo.archivos?.[clave] || {};
  return [{
    nombre: meta.nombre || e.nombre || quitarExtension(decodeURIComponent(e.url.split("/").pop())),
    descripcion: meta.descripcion || e.descripcion || "",
    seccion: e.seccion || SIN_SECCION,
    archivo: e.archivo || e.url.split("?")[0].split("/").pop(),
    url: e.url,
    bytes: e.bytes,
    tamano: e.tamano || "",
    fecha: e.fecha || "",
    local: false,
    orden: meta.orden ?? e.orden,
  }];
});

// Orden: primero los que tengan "orden" (menor = antes); después, los más recientes.
const archivos = [...locales, ...externos].sort((a, b) => {
  const oa = a.orden ?? Infinity, ob = b.orden ?? Infinity;
  if (oa !== ob) return oa - ob;
  return String(b.fecha).localeCompare(String(a.fecha));
}).map(({ orden, ...f }) => f);

const ids = new Set([...carpetas, ...archivos.map((f) => f.seccion)]);
const secciones = [...ids].map((id) => {
  const meta = catalogo.secciones?.[id] || {};
  return {
    id,
    nombre: meta.nombre || capitalizar(id),
    total: archivos.filter((f) => f.seccion === id).length,
    orden: meta.orden,
  };
}).sort((a, b) => {
  const oa = a.orden ?? Infinity, ob = b.orden ?? Infinity;
  if (oa !== ob) return oa - ob;
  if (a.id === SIN_SECCION) return 1;
  if (b.id === SIN_SECCION) return -1;
  return a.nombre.localeCompare(b.nombre, "es");
}).map(({ orden, ...s }) => s);

writeFileSync(join(root, "archivos.json"),
  JSON.stringify({ generado: new Date().toISOString(), secciones, archivos }, null, 2) + "\n");
console.log(`archivos.json generado: ${secciones.length} sección(es), ${locales.length} archivo(s) en files/ y ${externos.length} enlace(s) externo(s).`);
