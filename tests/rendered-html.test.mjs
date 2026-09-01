import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("renders the BLADERS X storefront shell", async () => {
  const [page, layout, packageJson, globals] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /BLADERS X Member Utility Store/);
  assert.match(page, /className="store-frame"/);
  assert.match(layout, /BLADERS X/);
  assert.match(globals, /\.store-frame/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  const previewFiles = await readdir(new URL("app/_sites-preview", templateRoot));
  assert.deepEqual(previewFiles, []);
});

test("keeps production storefront assets in place", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/demo/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/demo/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /OFFICIAL ONLINE STORE/);
  assert.match(html, /CONFIRM ORDER DETAILS/);
  assert.match(app, /ORDER<br \/>RECEIVED\./);
  assert.doesNotMatch(html, /STRIPE/i);
  assert.doesNotMatch(html, /DEMO MODE|DEMONSTRATION STORE|示範價/);
  assert.doesNotMatch(app, /付款測試/);
});
