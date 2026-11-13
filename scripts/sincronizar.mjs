// Publica en Violet lo que hay en tu carpeta local (por defecto E:\violet).
//   node scripts/sincronizar.mjs "E:\violet"
//
// - Cada carpeta de E:\violet es una sección de la web. Los archivos sueltos en la raíz se ignoran.
// - Archivos de hasta 49 MB  -> se copian a files/<sección>/ del repositorio.
// - Archivos de más de 49 MB -> se suben a GitHub Releases (máx. 2 GB) y se anotan en releases.json.
// - Lo que borres en E:\violet también se borra de la web (espejo).
// - Al final hace commit y push; GitHub Actions publica la web en 1-2 minutos.
// Necesita git y GitHub CLI (gh) con sesión iniciada.

import {
  readdirSync, statSync, existsSync, mkdirSync, copyFileSync, utimesSync, rmSync,
  writeFileSync, readFileSync, mkdtempSync,
} from "node:fs";
import { join, relative, sep, dirname, resolve, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL("..", import.meta.url));
const filesDir = join(root, "files");
const origen = resolve(process.argv[2] || "E:/violet");
const LIMITE = 49 * 1024 * 1024;
const TAG = "archivos";
const IGNORAR = new Set(["Thumbs.db", "desktop.ini"]);
const MANTENER = new Set(["LEEME.md", ".gitkeep"]);

const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) ?? "").trim();
const tryRun = (cmd, args) => { try { return run(cmd, args); } catch { return null; } };
const mb = (b) => (b / 1048576).toFixed(1) + " MB";

// Si algo falla, explicarlo claramente y guardarlo en E:\violet\publicar-error.txt.
const errorLog = join(origen, "publicar-error.txt");
process.on("uncaughtException", (e) => {
  const detalle = [e.message, e.stderr && String(e.stderr).trim()].filter(Boolean).join("\n");
  console.error("\n*** ERROR: no se pudo publicar. Nada se ha perdido; vuelve a intentarlo. ***\n\n" + detalle);
  try { writeFileSync(errorLog, new Date().toLocaleString("es") + "\n\n" + detalle + "\n"); } catch {}
  process.exit(1);
});
if (existsSync(join(root, ".git", "index.lock"))) {
  console.error("Ya hay otra publicación en marcha. Espera a que termine y vuelve a intentarlo.\n" +
    "(Si no hay ninguna, borra el archivo " + join(root, ".git", "index.lock") + ")");
  process.exit(1);
}

if (!existsSync(origen) || !statSync(origen).isDirectory()) {
  console.error(`No existe la carpeta de origen: ${origen}`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name.startsWith(".") || IGNORAR.has(d.name)) return [];
    const full = join(dir, d.name);
    return d.isDirectory() ? walk(full) : d.isFile() ? [full] : [];
  });
}
const relDe = (base, full) => relative(base, full).split(sep).join("/");

// 1) Leer el origen
const secciones = readdirSync(origen, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("."))
  .map((d) => d.name);
const todos = secciones.flatMap((s) => walk(join(origen, s))).map((full) => {
  const st = statSync(full);
  return { full, rel: relDe(origen, full), bytes: st.size, mtime: st.mtime };
});
const pequenos = todos.filter((f) => f.bytes <= LIMITE);
const grandes = todos.filter((f) => f.bytes > LIMITE);
console.log(`Origen: ${origen}\n  ${secciones.length} sección(es), ${pequenos.length} archivo(s) normales, ${grandes.length} grande(s).`);

// 2) Espejo de archivos normales en files/
mkdirSync(filesDir, { recursive: true });
let copiados = 0, borrados = 0;
for (const f of pequenos) {
  const dest = join(filesDir, ...f.rel.split("/"));
  const st = existsSync(dest) ? statSync(dest) : null;
  if (st && st.size === f.bytes && Math.abs(st.mtimeMs - f.mtime.getTime()) < 2000) continue;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(f.full, dest);
  utimesSync(dest, f.mtime, f.mtime);
  copiados++;
  console.log(`  + ${f.rel} (${mb(f.bytes)})`);
}
const queridos = new Set(pequenos.map((f) => f.rel));
for (const full of walk(filesDir)) {
  const rel = relDe(filesDir, full);
  if (MANTENER.has(rel) || queridos.has(rel)) continue;
  rmSync(full);
  borrados++;
  console.log(`  - ${rel}`);
}
// Carpetas: una por sección (con .gitkeep para que existan aunque estén vacías); quitar las que sobran.
for (const d of readdirSync(filesDir, { withFileTypes: true })) {
  if (d.isDirectory() && !secciones.includes(d.name)) {
    rmSync(join(filesDir, d.name), { recursive: true, force: true });
    console.log(`  - sección ${d.name}/`);
  }
}
for (const s of secciones) {
  mkdirSync(join(filesDir, s), { recursive: true });
  const keep = join(filesDir, s, ".gitkeep");
  if (!existsSync(keep)) writeFileSync(keep, "");
}

// 3) Archivos grandes -> GitHub Releases
// El nombre del repositorio sale del remoto de git (no necesita GitHub CLI).
const remoto = run("git", ["remote", "get-url", "origin"]);
const repo = (/github\.com[/:]([^/]+\/[^/]+?)(\.git)?$/.exec(remoto) || [])[1];
if (!repo) throw new Error(`El remoto de git no es un repositorio de GitHub: ${remoto}`);
const releasesPath = join(root, "releases.json");
const anteriores = existsSync(releasesPath) ? JSON.parse(readFileSync(releasesPath, "utf8")) : [];
const nuevos = [];

const limpiar = (n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
const usados = new Map();
for (const f of grandes) {
  const base = limpiar(basename(f.rel)) || "archivo";
  usados.set(base, (usados.get(base) || 0) + 1);
}

const nombreAssetDe = (f) => {
  const base = limpiar(basename(f.rel)) || "archivo";
  return usados.get(base) > 1 ? `${limpiar(f.rel.split("/")[0])}--${base}` : base;
};

// Solo se usa GitHub CLI si los archivos grandes han cambiado desde la última publicación.
const sinCambiosGrandes =
  grandes.length === anteriores.length &&
  grandes.every((f) => anteriores.some((a) => a.asset === nombreAssetDe(f) && a.bytes === f.bytes));

let assets;
if (sinCambiosGrandes) {
  assets = anteriores.map((a) => ({ name: a.asset, size: a.bytes }));
} else {
  if (!tryRun("gh", ["auth", "status"])) {
    throw new Error("Hay archivos grandes (más de 49 MB) que subir y GitHub CLI no tiene la sesión iniciada.\n" +
      "Ejecuta \"Publicar en Violet.bat\" otra vez: te pedirá iniciar sesión en GitHub una sola vez.");
  }
  if (!tryRun("gh", ["release", "view", TAG, "-R", repo])) {
    run("gh", ["release", "create", TAG, "-R", repo, "--title", "Archivos grandes de Violet",
      "--notes", "Archivos de más de 49 MB publicados en Violet. Se gestiona automáticamente con scripts/sincronizar.mjs."]);
  }
  assets = JSON.parse(run("gh", ["api", `repos/${repo}/releases/tags/${TAG}`, "--jq", "[.assets[] | {name, size}]"]));
}

let tmp = null;
for (const f of grandes) {
  const [seccion] = f.rel.split("/");
  const nombreAsset = nombreAssetDe(f);
  const existe = assets.find((a) => a.name === nombreAsset && a.size === f.bytes);
  if (!existe) {
    tmp ??= mkdtempSync(join(tmpdir(), "violet-"));
    const copia = join(tmp, nombreAsset);
    copyFileSync(f.full, copia);
    console.log(`  ↑ ${f.rel} (${mb(f.bytes)}) -> Releases`);
    run("gh", ["release", "upload", TAG, copia, "--clobber", "-R", repo], { stdio: ["ignore", "pipe", "inherit"] });
    rmSync(copia);
  }
  nuevos.push({
    nombre: basename(f.rel).replace(/\.[^.]+$/, ""),
    seccion,
    archivo: basename(f.rel),
    url: `https://github.com/${repo}/releases/download/${TAG}/${encodeURIComponent(nombreAsset)}`,
    bytes: f.bytes,
    fecha: f.mtime.toISOString(),
    asset: nombreAsset,
  });
}
if (tmp) rmSync(tmp, { recursive: true, force: true });
for (const a of assets) {
  if (!nuevos.some((n) => n.asset === a.name)) {
    run("gh", ["release", "delete-asset", TAG, a.name, "--yes", "-R", repo]);
    console.log(`  - Releases: ${a.name}`);
  }
}
writeFileSync(releasesPath, JSON.stringify(nuevos, null, 2) + "\n");

// 4) Comprobar y publicar
run("node", [join(root, "scripts", "generar-catalogo.mjs")]);
run("git", ["add", "-A", "files", "releases.json"]);
if (run("git", ["diff", "--cached", "--name-only"])) {
  run("git", ["commit", "-m", `Actualizar archivos (${copiados} nuevos/cambiados, ${borrados} borrados, ${nuevos.length} grandes)`]);
  console.log("Subiendo a GitHub...");
  run("git", ["push"], { stdio: ["ignore", "inherit", "inherit"] });
  console.log("\nListo. La web se actualizará en 1-2 minutos.");
} else {
  console.log("\nNo hay cambios que publicar.");
}
rmSync(errorLog, { force: true }); // todo fue bien: quitar el aviso de un error anterior
