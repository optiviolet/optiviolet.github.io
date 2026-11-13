# Violet

Web de descargas gratuita: fondo negro, botones violetas, sin publicidad, sin rastreadores y sin registro.
Alojada gratis en **GitHub Pages**. Tú subes los archivos al repositorio y aparecen solos en la web.

```
index.html            Página principal
404.html              Página de "no encontrado"
assets/               Estilos, script y logotipo
files/                ← AQUÍ VAN TUS ARCHIVOS
catalogo.json         Nombres bonitos, descripciones y enlaces externos (opcional)
scripts/generar-catalogo.mjs   Crea archivos.json al publicar
.github/workflows/publicar.yml Publica la web automáticamente
```

## Cómo funciona

GitHub Pages solo sirve archivos estáticos (no hay servidor ni base de datos). Por eso:

1. Tus archivos viven en la carpeta `files/` del repositorio.
2. Cada vez que cambias algo, **GitHub Actions** (gratis) ejecuta `scripts/generar-catalogo.mjs`, que crea
   `archivos.json` con la lista de archivos, y publica la web.
3. La página lee `archivos.json` y dibuja una tarjeta con su botón **Descargar** por cada archivo.

**Seguridad:** solo quien tiene permiso de escritura en el repositorio (tú) puede subir, cambiar o borrar
archivos. Los visitantes solo pueden ver y descargar. No hay contraseñas ni tokens en el código.

---

## Publicarla gratis (una sola vez)

1. Crea una cuenta en <https://github.com> (gratis). Tu nombre de usuario será parte de la dirección.
2. Pulsa **+ → New repository** y ponle exactamente el nombre **`TUUSUARIO.github.io`**
   (cambia `TUUSUARIO` por tu usuario). Márcalo como **Public** y pulsa **Create repository**.
3. Sube el proyecto. Elige una opción:
   - **Desde la web:** en el repositorio vacío pulsa **uploading an existing file** y arrastra *todo el
     contenido* de la carpeta `violet` (incluida la carpeta `.github`; si tu explorador la oculta, actívalo
     en *Vista → Elementos ocultos*). Pulsa **Commit changes**.
   - **Con git (recomendado):** abre una terminal en la carpeta `violet` y ejecuta:
     ```bash
     git init -b main
     git add .
     git commit -m "Violet"
     git remote add origin https://github.com/TUUSUARIO/TUUSUARIO.github.io.git
     git push -u origin main
     ```
4. En el repositorio ve a **Settings → Pages** y en **Build and deployment → Source** elige **GitHub Actions**.
5. Ve a la pestaña **Actions**: verás "Publicar Violet" en marcha. Si no arrancó, ábrelo y pulsa
   **Run workflow**. Cuando salga el check verde (1–2 minutos), tu web estará en:

   **https://TUUSUARIO.github.io/**

---

## Administrar archivos

Todo se hace desde la web de GitHub (o con git). Cada cambio se publica solo en 1–2 minutos.

### Añadir un archivo
Repositorio → carpeta **files** → **Add file → Upload files** → arrastra el archivo → **Commit changes**.
Puedes crear subcarpetas (p. ej. `files/programas/`) para organizarte; en la web todo sale en la misma lista.

### Ponerle nombre y descripción (opcional)
Edita `catalogo.json` (icono del lápiz). La clave es la ruta del archivo dentro de `files/`:

```json
{
  "archivos": {
    "mi-programa.zip": {
      "nombre": "Mi Programa 2.0",
      "descripcion": "Versión portable para Windows.",
      "orden": 1
    },
    "programas/otro.exe": { "descripcion": "Instalador." }
  },
  "enlaces": []
}
```

- Sin entrada en `catalogo.json`, el nombre mostrado es el del archivo sin extensión.
- `orden` (opcional): los números más bajos salen primero. El resto, del más reciente al más antiguo.

### Borrar un archivo
Abre el archivo dentro de `files/` → menú **···** → **Delete file** → **Commit changes**.
(Si tenía entrada en `catalogo.json`, bórrala también; si no, el log de Actions te avisará.)

### Archivos grandes (más de 100 MB): GitHub Releases
GitHub no admite archivos de más de **25 MB subidos desde la web** ni de más de **100 MB con git**.
Para archivos grandes (hasta 2 GB cada uno) usa *Releases*, también gratis:

1. Repositorio → **Releases → Create a new release** → pon una etiqueta (p. ej. `v1`) → arrastra el archivo
   en *Attach binaries* → **Publish release**.
2. Copia el enlace del archivo (clic derecho → copiar enlace). Será así:
   `https://github.com/TUUSUARIO/TUUSUARIO.github.io/releases/download/v1/archivo.zip`
3. Añádelo a `enlaces` en `catalogo.json`:
   ```json
   "enlaces": [
     {
       "nombre": "Mi juego completo",
       "descripcion": "Versión 1.0",
       "url": "https://github.com/TUUSUARIO/TUUSUARIO.github.io/releases/download/v1/juego.zip",
       "tamano": "850 MB"
     }
   ]
   ```

---

## Probar en tu ordenador (opcional)

Necesitas [Node.js](https://nodejs.org) y Python (o cualquier servidor estático):

```bash
node scripts/generar-catalogo.mjs
python -m http.server 8080
```

Abre <http://localhost:8080>. (Abrir `index.html` con doble clic no funciona: el navegador bloquea la
lectura de `archivos.json` fuera de un servidor.)

## Límites de GitHub (gratis)

- Repositorio: se recomienda no pasar de **1 GB** en total. La web publicada: máx. **1 GB**.
- Tráfico orientativo: **100 GB al mes**. Si lo superas, GitHub puede avisarte.
- GitHub Pages no debe usarse para un negocio o venta. Publica solo archivos que tengas derecho a distribuir.
- Todo lo que subas al repositorio público es visible para cualquiera (es una web de descargas pública).
