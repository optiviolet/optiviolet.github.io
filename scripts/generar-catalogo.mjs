// Genera archivos.json a partir de la carpeta files/ y de catalogo.json.
// Lo ejecuta GitHub Actions en cada publicación (también puedes ejecutarlo en local):
//   node scripts/generar-catalogo.mjs
// Sin dependencias: solo Node.js.

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const filesDir = join(root, "files");
const IGNORAR = new Set([".gitkeep", ".DS_Store", "Thumbs.db", "desktop.ini", "LEEME.md"]);

// catalogo.json es opcional: nombres bonitos, descripciones y enlaces externos.
let catalogo = { archivos: {}, enlaces: [] };
const catalogoPath = join(root, "catalogo.json");
if (existsSync(catalogoPath)) {
  try {
    catalogo = { ...catalogo, ...JSON.parse(readFileSync(catalogoPath, "utf8")) };
  } catch (e) {
    console.error("ERROR: catalogo.json no es un JSON válido:\n  " + e.message);
    process.exit(1);
  }
}

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

const locales = walk(filesDir).map((full) => {
  const rel = relative(filesDir, full).split(sep).join("/"); // p. ej. "juegos/mi archivo.zip"
  const meta = catalogo.archivos?.[rel] || {};
  return {
    nombre: meta.nombre || quitarExtension(rel.split("/").pop()),
    descripcion: meta.descripcion || "",
    archivo: rel,
    url: "files/" + rel.split("/").map(encodeURIComponent).join("/"),
    bytes: statSync(full).size,
    fecha: fechaDe(full),
    local: true,
    orden: meta.orden,
  };
});

// Enlaces externos (p. ej. archivos grandes subidos a GitHub Releases).
const externos = (catalogo.enlaces || []).flatMap((e, i) => {
  if (!e || !e.url || !/^https:\/\//i.test(e.url)) {
    console.warn(`AVISO: el enlace #${i + 1} de catalogo.json no tiene una URL https válida; se ignora.`);
    return [];
  }
  return [{
    nombre: e.nombre || decodeURIComponent(e.url.split("/").pop()),
    descripcion: e.descripcion || "",
    archivo: e.url.split("?")[0].split("/").pop(),
    url: e.url,
    tamano: e.tamano || "",
    fecha: e.fecha || "",
    local: false,
    orden: e.orden,
  }];
});

// Orden: primero los que tengan "orden" (menor = antes); después, los más recientes.
const archivos = [...locales, ...externos].sort((a, b) => {
  const oa = a.orden ?? Infinity, ob = b.orden ?? Infinity;
  if (oa !== ob) return oa - ob;
  return String(b.fecha).localeCompare(String(a.fecha));
}).map(({ orden, ...f }) => f);

// Avisos útiles para el administrador.
for (const clave of Object.keys(catalogo.archivos || {})) {
  if (!locales.some((f) => f.archivo === clave)) {
    console.warn(`AVISO: catalogo.json describe "${clave}", pero no existe en files/.`);
  }
}

writeFileSync(join(root, "archivos.json"), JSON.stringify({ generado: new Date().toISOString(), archivos }, null, 2) + "\n");
console.log(`archivos.json generado: ${locales.length} archivo(s) en files/ y ${externos.length} enlace(s) externo(s).`);
