import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), "public");

function darkSibling(src) {
  const dark = src?.replace(/(-light)?\.png$/, "-dark.png");
  return dark && dark !== src && fs.existsSync(path.join(publicDir, dark))
    ? dark
    : null;
}

function pngSize(src) {
  const header = Buffer.alloc(24);
  const file = fs.openSync(path.join(publicDir, src), "r");
  fs.readSync(file, header, 0, 24, 0);
  fs.closeSync(file);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

// A public PNG with a "-dark" sibling renders as both images, each linked to
// its full size. The stylesheet shows the one that matches the site's theme,
// and lazy loading keeps the browser from fetching the hidden one.
export function themedImagesPlugin(md) {
  const renderImage = md.renderer.rules.image;

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src");
    const dark = darkSibling(src);
    if (!dark) return renderImage(tokens, idx, options, env, self);

    const render = (file, theme) => {
      const copy = Object.assign(Object.create(Object.getPrototypeOf(token)), token, {
        attrs: token.attrs.map((attr) => [...attr]),
      });
      const { width, height } = pngSize(file);
      copy.attrSet("src", file);
      copy.attrSet("width", String(width));
      copy.attrSet("height", String(height));
      copy.attrSet("loading", "lazy");
      const image = renderImage([copy], 0, options, env, self);
      return `<a class="themed-shot themed-shot--${theme}" href="${file}" target="_blank" rel="noopener">${image}</a>`;
    };
    return render(src, "light") + render(dark, "dark");
  };
}
