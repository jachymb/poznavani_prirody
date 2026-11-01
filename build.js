// Složí hru do jediného souboru dist/poznavani_prirody.html, který jde poslat a otevřít bez instalace.
// Skripty a data vloží do stránky, kód i styly zhustí esbuild. Spouští ho pre-commit hook (.githooks/pre-commit).
const fs = require("fs");
const path = require("path");
const { transformSync } = require("esbuild");

const GAME = path.join(__dirname, "game");
const OUT = path.join(__dirname, "dist", "poznavani_prirody.html");

const minify = (code, loader) => transformSync(code, { loader, minify: true, charset: "utf8" }).code.trim();

function script(code, name) {
  // Lomítko nic nemění v řetězci ani ve výrazu, ale text „</script“ by jinak předčasně ukončil značku.
  const js = minify(code, "js").replace(/<\/script/gi, "<\\/script");
  if (js.includes("<!--")) throw new Error(`${name}: „<!--“ by v HTML začalo komentář`);
  return js;
}

const html = fs.readFileSync(path.join(GAME, "index.html"), "utf8");
const scripts = [];
const out = html
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${minify(css, "css")}</style>`)
  .replace(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g, (_, file, inline) => {
    scripts.push(file ? script(fs.readFileSync(path.join(GAME, file), "utf8"), file) : script(inline, "index.html"));
    return `<script>\u0000${scripts.length - 1}\u0000</script>`;
  })
  .replace(/>\s+</g, "><")
  .trim()
  .replace(/\u0000(\d+)\u0000/g, (_, n) => scripts[n]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out + "\n");
console.log(`${path.relative(__dirname, OUT)}: ${(Buffer.byteLength(out) / 1e6).toFixed(1)} MB`);
