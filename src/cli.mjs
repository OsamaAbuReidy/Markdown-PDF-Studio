#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Marked } from "marked";
import hljs from "highlight.js";
import { chromium } from "playwright-core";

export const DEFAULTS = {
  page: {
    size: "A4",
    landscape: false,
    margin: { top: "20mm", right: "18mm", bottom: "22mm", left: "18mm" }
  },
  fonts: {
    body: "Inter, Aptos, Arial, sans-serif",
    heading: "Inter, Aptos Display, Arial, sans-serif",
    code: "Cascadia Code, Consolas, monospace",
    size: "11pt",
    lineHeight: 1.58
  },
  spacing: {
    paragraph: "10px",
    headingBefore: "22px",
    headingAfter: "9px"
  },
  colors: {
    text: "#1f2937",
    muted: "#64748b",
    heading: "#0f172a",
    link: "#2563eb",
    accent: "#7c3aed",
    border: "#dbe3ee",
    surface: "#f6f8fb",
    codeBackground: "#111827",
    codeText: "#e5e7eb",
    quoteBackground: "#f5f3ff"
  },
  code: {
    theme: "github-dark",
    fontSize: "9pt",
    lineNumbers: false,
    wrap: false
  },
  markdown: { gfm: true, breaks: false },
  document: {
    title: "",
    header: "",
    footer: "<span></span><span>Page <span class='pageNumber'></span> of <span class='totalPages'></span></span>",
    printBackground: true
  },
  customCss: ""
};

const HELP = `
Custom Markdown to PDF

Usage:
  mdpdf <input.md> [-o output.pdf] [-c config.json] [--css custom.css]

Options:
  -o, --output   Output PDF path (default: beside the Markdown file)
  -c, --config   JSON configuration file
  --css          Additional CSS file; applied after the generated theme
  --chrome       Chrome/Edge executable path
  -h, --help     Show this help
`;

function parseArgs(argv) {
  const result = { input: "", output: "", config: "", css: "", chrome: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-h" || value === "--help") result.help = true;
    else if (value === "-o" || value === "--output") result.output = argv[++index];
    else if (value === "-c" || value === "--config") result.config = argv[++index];
    else if (value === "--css") result.css = argv[++index];
    else if (value === "--chrome") result.chrome = argv[++index];
    else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}`);
    else if (!result.input) result.input = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  return result;
}

export function merge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override ?? base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? merge(base?.[key] ?? {}, value)
      : value;
  }
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readableFile(candidate) {
  if (!candidate) return "";
  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return "";
  }
}

export async function findBrowser(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.MDPDF_CHROME,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
  for (const candidate of candidates) {
    const found = await readableFile(candidate);
    if (found) return found;
  }
  throw new Error("Chrome or Edge was not found. Pass its path with --chrome or set MDPDF_CHROME.");
}

function codeTheme(name) {
  const light = name === "github-light";
  if (light) {
    return `
      .hljs-comment,.hljs-quote { color:#6e7781 } .hljs-keyword,.hljs-selector-tag { color:#cf222e }
      .hljs-string,.hljs-attr { color:#0a3069 } .hljs-number,.hljs-literal { color:#0550ae }
      .hljs-title,.hljs-section,.hljs-function { color:#8250df } .hljs-built_in,.hljs-type { color:#953800 }
      .hljs-variable,.hljs-template-variable { color:#953800 } .hljs-meta { color:#57606a }`;
  }
  return `
    .hljs-comment,.hljs-quote { color:#8b949e } .hljs-keyword,.hljs-selector-tag { color:#ff7b72 }
    .hljs-string,.hljs-attr { color:#a5d6ff } .hljs-number,.hljs-literal { color:#79c0ff }
    .hljs-title,.hljs-section,.hljs-function { color:#d2a8ff } .hljs-built_in,.hljs-type { color:#ffa657 }
    .hljs-variable,.hljs-template-variable { color:#ffa657 } .hljs-meta { color:#8b949e }`;
}

export function buildCss(config, extraCss) {
  const { fonts, colors, code, spacing } = config;
  const numberCss = code.lineNumbers
    ? `pre code { counter-reset: line; } pre code .code-line { display:block; counter-increment:line; }
       pre code .code-line::before { content:counter(line); display:inline-block; width:2.5em; margin-right:1.2em; color:#6b7280; text-align:right; user-select:none; }`
    : "";
  return `
    :root {
      --text:${colors.text}; --muted:${colors.muted}; --heading:${colors.heading}; --link:${colors.link};
      --accent:${colors.accent}; --border:${colors.border}; --surface:${colors.surface};
      --code-bg:${colors.codeBackground}; --code-text:${colors.codeText}; --quote-bg:${colors.quoteBackground};
    }
    * { box-sizing:border-box; }
    html { font-size:${fonts.size}; }
    body { margin:0; color:var(--text); font-family:${fonts.body}; line-height:${fonts.lineHeight};
      -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    h1,h2,h3,h4,h5,h6 { color:var(--heading); font-family:${fonts.heading}; line-height:1.22;
      margin:${spacing.headingBefore} 0 ${spacing.headingAfter}; break-after:avoid-page; }
    h1 { font-size:2.15rem; margin-top:0; padding-bottom:.3em; border-bottom:2px solid var(--accent); }
    h2 { font-size:1.55rem; padding-bottom:.2em; border-bottom:1px solid var(--border); }
    h3 { font-size:1.22rem; } p { margin:0 0 ${spacing.paragraph}; } a { color:var(--link); text-decoration:none; }
    strong { color:var(--heading); } hr { border:0; border-top:1px solid var(--border); margin:1.8em 0; }
    blockquote { margin:1em 0; padding:.65em 1em; border-left:4px solid var(--accent); background:var(--quote-bg); color:var(--muted); }
    blockquote > :first-child { margin-top:0; } blockquote > :last-child { margin-bottom:0; }
    ul,ol { padding-left:1.6em; } li + li { margin-top:.2em; }
    table { width:100%; border-collapse:collapse; margin:1em 0; font-size:.94em; break-inside:avoid-page; }
    th,td { border:1px solid var(--border); padding:.5em .65em; text-align:left; vertical-align:top; }
    th { color:var(--heading); background:var(--surface); }
    img,svg { max-width:100%; height:auto; break-inside:avoid-page; }
    figure { margin:1em 0; break-inside:avoid-page; } figcaption { color:var(--muted); font-size:.9em; text-align:center; }
    :not(pre) > code { padding:.12em .35em; border:1px solid var(--border); border-radius:4px; background:var(--surface);
      color:var(--heading); font-family:${fonts.code}; font-size:.88em; }
    pre { margin:1em 0; padding:1em 1.1em; border-radius:8px; background:var(--code-bg); color:var(--code-text);
      overflow:${code.wrap ? "visible" : "hidden"}; white-space:${code.wrap ? "pre-wrap" : "pre"}; overflow-wrap:${code.wrap ? "anywhere" : "normal"};
      break-inside:avoid-page; }
    pre code { padding:0; border:0; background:transparent; color:inherit; font-family:${fonts.code}; font-size:${code.fontSize}; line-height:1.5; }
    .task-list-item { list-style:none; } input[type=checkbox] { margin-left:-1.4em; }
    .page-break { break-after:page; } .avoid-break { break-inside:avoid-page; }
    ${codeTheme(code.theme)}
    ${numberCss}
    ${config.customCss || ""}
    ${extraCss || ""}
  `;
}

function codeRenderer(config) {
  return ({ text, lang }) => {
    const language = String(lang || "").split(/\s+/)[0];
    let highlighted;
    try {
      highlighted = language && hljs.getLanguage(language)
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
    } catch {
      highlighted = escapeHtml(text);
    }
    if (config.code.lineNumbers) {
      highlighted = highlighted.split("\n").map(line => `<span class="code-line">${line || " "}</span>`).join("");
    }
    const className = language ? ` class="hljs language-${escapeHtml(language)}"` : " class=\"hljs\"";
    return `<pre><code${className}>${highlighted}</code></pre>`;
  };
}

function headerFooter(content, config) {
  if (!content) return "<span></span>";
  return `<div style="width:100%;padding:0 ${config.page.margin.right};font-family:${config.fonts.body};font-size:8px;color:${config.colors.muted};display:flex;justify-content:space-between;">${content}</div>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    process.stdout.write(HELP);
    process.exitCode = args.help ? 0 : 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output || inputPath.replace(/\.[^.]+$/, "") + ".pdf");
  const userConfig = args.config ? JSON.parse(await fs.readFile(path.resolve(args.config), "utf8")) : {};
  const config = merge(DEFAULTS, userConfig);
  const markdown = await fs.readFile(inputPath, "utf8");
  const extraCss = args.css ? await fs.readFile(path.resolve(args.css), "utf8") : "";

  const markdownParser = new Marked();
  markdownParser.use({
    gfm: config.markdown.gfm,
    breaks: config.markdown.breaks,
    renderer: { code: codeRenderer(config) }
  });
  const body = await markdownParser.parse(markdown);
  const title = config.document.title || path.basename(inputPath, path.extname(inputPath));
  const base = pathToFileURL(path.dirname(inputPath) + path.sep).href;
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="${base}">
    <meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title>
    <style>${buildCss(config, extraCss)}</style></head><body>${body}</body></html>`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const executablePath = await findBrowser(args.chrome);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.pdf({
      path: outputPath,
      format: config.page.size,
      landscape: config.page.landscape,
      margin: config.page.margin,
      printBackground: config.document.printBackground,
      displayHeaderFooter: Boolean(config.document.header || config.document.footer),
      headerTemplate: headerFooter(config.document.header, config),
      footerTemplate: headerFooter(config.document.footer, config),
      preferCSSPageSize: false
    });
  } finally {
    await browser.close();
  }
  process.stdout.write(`Created ${outputPath}\n`);
}

export async function renderMarkdown({ markdown, userConfig = {}, extraCss = "", title = "", baseDir = process.cwd(), preview = false }) {
  const config = merge(DEFAULTS, userConfig);
  const markdownParser = new Marked();
  markdownParser.use({
    gfm: config.markdown.gfm,
    breaks: config.markdown.breaks,
    renderer: { code: codeRenderer(config) }
  });
  const body = await markdownParser.parse(markdown);
  const documentTitle = title || config.document.title || "Markdown document";
  const base = pathToFileURL(path.resolve(baseDir) + path.sep).href;
  const previewCss = preview ? `
    html { min-height:100%; background:#fff; }
    body { min-height:100%; padding:${config.page.margin.top} ${config.page.margin.right} ${config.page.margin.bottom} ${config.page.margin.left}; }
  ` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><base href="${base}">
    <meta name="viewport" content="width=device-width"><title>${escapeHtml(documentTitle)}</title>
    <style>${buildCss(config, extraCss)}${previewCss}</style></head><body>${body}</body></html>`;
  return { html, config, title: documentTitle };
}

export async function renderPdf({ markdown, userConfig = {}, extraCss = "", title = "", baseDir = process.cwd(), chrome = "", outputPath = "" }) {
  const rendered = await renderMarkdown({ markdown, userConfig, extraCss, title, baseDir });
  const executablePath = await findBrowser(chrome);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(rendered.html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => { await document.fonts.ready; });
    return await page.pdf({
      ...(outputPath ? { path: outputPath } : {}),
      format: rendered.config.page.size,
      landscape: rendered.config.page.landscape,
      margin: rendered.config.page.margin,
      printBackground: rendered.config.document.printBackground,
      displayHeaderFooter: Boolean(rendered.config.document.header || rendered.config.document.footer),
      headerTemplate: headerFooter(rendered.config.document.header, rendered.config),
      footerTemplate: headerFooter(rendered.config.document.footer, rendered.config),
      preferCSSPageSize: false
    });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`mdpdf: ${error.message}\n`);
    process.exitCode = 1;
  });
}
