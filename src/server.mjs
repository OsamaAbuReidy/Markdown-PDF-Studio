import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { renderMarkdown, renderPdf } from "./cli.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "ui");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const maxBodyBytes = 40 * 1024 * 1024;
const execFileAsync = promisify(execFile);
let installedFontsCache;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function send(response, status, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store", ...headers });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error("Request is larger than 40 MB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function safeName(value) {
  const base = path.basename(String(value || "document"), path.extname(String(value || "")));
  return (base.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "document") + ".pdf";
}

async function installedFonts() {
  if (installedFontsCache) return installedFontsCache;
  if (process.platform !== "win32") {
    return ["Arial", "Georgia", "Times New Roman", "Verdana"];
  }
  try {
    const command = "Add-Type -AssemblyName System.Drawing; $fonts = New-Object System.Drawing.Text.InstalledFontCollection; $fonts.Families | ForEach-Object { $_.Name } | Sort-Object -Unique";
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    installedFontsCache = [...new Set(stdout.split(/\r?\n/)
      .map(name => name.replace(/[";{}]/g, "").trim())
      .filter(name => name && !name.startsWith("@")))]
      .sort((left, right) => left.localeCompare(right));
  } catch {
    installedFontsCache = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana"];
  }
  return installedFontsCache;
}

async function serveFile(response, name) {
  const filePath = path.join(publicDir, name);
  const body = await fs.readFile(filePath);
  send(response, 200, body, types[path.extname(filePath)] || "application/octet-stream");
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    if (request.method === "GET" && url.pathname === "/") return await serveFile(response, "index.html");
    if (request.method === "GET" && url.pathname === "/bookmark") {
      const body = await fs.readFile(path.join(root, "Browser Bookmark Setup.html"));
      return send(response, 200, body, "text/html; charset=utf-8");
    }
    if (request.method === "GET" && url.pathname === "/styles.css") return await serveFile(response, "styles.css");
    if (request.method === "GET" && url.pathname === "/app.js") return await serveFile(response, "app.js");
    if (request.method === "GET" && url.pathname === "/health") return send(response, 200, "ok");
    if (request.method === "GET" && url.pathname === "/api/fonts") {
      return send(response, 200, JSON.stringify({ fonts: await installedFonts() }), "application/json; charset=utf-8");
    }

    if (request.method === "POST" && url.pathname === "/api/render") {
      const input = await readJson(request);
      const result = await renderMarkdown({
        markdown: String(input.markdown || ""),
        userConfig: input.config || {},
        extraCss: String(input.customCss || ""),
        title: String(input.name || "Preview"),
        baseDir: root,
        preview: true
      });
      return send(response, 200, result.html, "text/html; charset=utf-8");
    }

    if (request.method === "POST" && url.pathname === "/api/pdf") {
      const input = await readJson(request);
      const pdf = await renderPdf({
        markdown: String(input.markdown || ""),
        userConfig: input.config || {},
        extraCss: String(input.customCss || ""),
        title: String(input.name || "Document"),
        baseDir: root
      });
      return send(response, 200, pdf, "application/pdf", {
        "Content-Disposition": `attachment; filename="${safeName(input.name)}"`
      });
    }

    send(response, 404, "Not found");
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    send(response, status, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Markdown PDF Studio is ready at http://${host}:${port}\n`);
});
