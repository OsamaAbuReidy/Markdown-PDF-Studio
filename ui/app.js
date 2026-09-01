const $ = id => document.getElementById(id);
const markdown = $("markdown");
const status = $("status");
const exportButton = $("exportButton");
let documentName = "document.md";
let refreshTimer;
let refreshController;
let refreshSequence = 0;
let availableFontFamilies = [];
let importedFontCss = [];

const pagePixels = {
  A4: [794, 1123],
  Letter: [816, 1056],
  Legal: [816, 1344],
  A3: [1123, 1587]
};

function config() {
  const margin = `${$("margin").value}mm`;
  return {
    page: {
      size: $("pageSize").value,
      landscape: $("orientation").value === "landscape",
      margin: { top: margin, right: margin, bottom: margin, left: margin }
    },
    fonts: {
      body: $("bodyFont").value,
      heading: $("headingFont").value,
      code: $("codeFont").value,
      size: $("fontSize").value,
      lineHeight: Number($("lineHeight").value)
    },
    spacing: {
      paragraph: `${$("paragraphSpacing").value}px`,
      headingBefore: `${$("headingBefore").value}px`,
      headingAfter: `${$("headingAfter").value}px`
    },
    colors: {
      accent: $("accent").value,
      text: $("textColor").value,
      heading: $("headingColor").value,
      codeBackground: $("codeBackground").value
    },
    code: {
      theme: $("codeTheme").value,
      fontSize: $("codeSize").value,
      lineNumbers: $("lineNumbers").checked,
      wrap: $("codeWrap").checked
    }
  };
}

function payload() {
  return {
    markdown: markdown.value,
    config: config(),
    customCss: `${importedFontCss.join("\n")}\n${$("customCss").value}`,
    name: documentName
  };
}

function setStatus(label, kind = "") {
  status.className = `status ${kind}`;
  status.innerHTML = `<i></i>${label}`;
}

async function refresh() {
  refreshController?.abort();
  refreshController = new AbortController();
  const sequence = ++refreshSequence;
  setStatus("Rendering…", "busy");
  try {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
      signal: refreshController.signal
    });
    if (!response.ok) throw new Error("Preview failed");
    const html = await response.text();
    if (sequence !== refreshSequence) return;
    $("preview").srcdoc = html;
    updatePreviewShape();
    setStatus("Preview current");
  } catch (error) {
    if (error.name === "AbortError") return;
    setStatus(error.message, "error");
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 280);
}

function updatePreviewShape() {
  const size = $("pageSize").value;
  const landscape = $("orientation").value === "landscape";
  const dimensions = pagePixels[size] || pagePixels.A4;
  const [width, height] = landscape ? [dimensions[1], dimensions[0]] : dimensions;
  const preview = $("preview");
  preview.style.setProperty("--preview-width", `${width}px`);
  preview.style.setProperty("--preview-height", `${height}px`);
  $("pageChip").textContent = `Live ${size} ${landscape ? "landscape" : "portrait"} preview`;
}

function fontCssValue(family, fallback) {
  const safeFamily = family.replace(/[";{}]/g, "").trim();
  return `"${safeFamily}", ${fallback}`;
}

function populateFontSelect(select, fonts, fallback) {
  const previousOption = select.options[select.selectedIndex];
  const previousLabelText = previousOption?.textContent?.trim() || "";
  const previousLabel = previousLabelText.toLowerCase();
  const previousValue = previousOption?.value || "";
  const fragment = document.createDocumentFragment();
  const hasPreviousFamily = fonts.some(family => family.toLowerCase() === previousLabel);
  if (previousLabelText && !hasPreviousFamily) {
    const preserved = document.createElement("option");
    preserved.textContent = previousLabelText;
    preserved.value = previousValue;
    preserved.selected = true;
    fragment.appendChild(preserved);
  }
  for (const family of fonts) {
    const option = document.createElement("option");
    option.textContent = family;
    option.value = fontCssValue(family, fallback);
    if (family.toLowerCase() === previousLabel) option.selected = true;
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);
}

function mergeFontFamilies(fonts) {
  availableFontFamilies = [...new Set([...availableFontFamilies, ...fonts]
    .map(name => String(name).replace(/[";{}]/g, "").trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  populateFontSelect($("bodyFont"), availableFontFamilies, "Arial, sans-serif");
  populateFontSelect($("headingFont"), availableFontFamilies, "Arial, sans-serif");
  populateFontSelect($("codeFont"), availableFontFamilies, "Consolas, monospace");
}

async function loadSystemFonts() {
  try {
    const response = await fetch("/api/fonts");
    if (!response.ok) throw new Error("Could not load fonts");
    const { fonts } = await response.json();
    if (!Array.isArray(fonts) || !fonts.length) return;
    mergeFontFamilies(fonts);
    $("fontHint").textContent = `${availableFontFamilies.length} Windows font families available.`;
    scheduleRefresh();
  } catch {
    $("fontHint").textContent = "Using the standard font list; system fonts could not be read.";
  }
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function importedFontFormat(extension) {
  return ({ otf: "opentype", ttf: "truetype", woff: "woff", woff2: "woff2" })[extension] || "opentype";
}

function fontFaceDetails(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const match = stem.match(/^(.*?)[-_](BoldItalic|BoldOblique|BookItalic|BookOblique|Bold|Italic|Oblique|Regular|Book)$/i);
  const familyStem = match ? match[1] : stem;
  const face = (match?.[2] || "Regular").toLowerCase();
  return {
    family: `Imported · ${familyStem.replace(/[-_]+/g, " ").trim()}`.replace(/[";{}]/g, ""),
    weight: face.includes("bold") ? 700 : 400,
    style: face.includes("italic") ? "italic" : face.includes("oblique") ? "oblique" : "normal"
  };
}

async function importFontFiles(event) {
  const files = [...event.target.files];
  if (!files.length) return;
  setStatus("Importing fonts…", "busy");
  try {
    const importedFamilies = [];
    for (const file of files) {
      const extension = file.name.split(".").pop().toLowerCase();
      const face = fontFaceDetails(file.name);
      const dataUrl = await fileAsDataUrl(file);
      importedFontCss.push(`@font-face { font-family:"${face.family}"; src:url("${dataUrl}") format("${importedFontFormat(extension)}"); font-style:${face.style}; font-weight:${face.weight}; font-display:block; }`);
      importedFamilies.push(face.family);
    }
    const uniqueFamilies = [...new Set(importedFamilies)];
    mergeFontFamilies(uniqueFamilies);
    const textFamily = uniqueFamilies.find(family => !/mono|math/i.test(family));
    const monoFamily = uniqueFamilies.find(family => /mono/i.test(family));
    if (textFamily) {
      $("bodyFont").value = fontCssValue(textFamily, "Arial, sans-serif");
      $("headingFont").value = fontCssValue(textFamily, "Arial, sans-serif");
    }
    if (monoFamily) $("codeFont").value = fontCssValue(monoFamily, "Consolas, monospace");
    $("fontHint").textContent = `${files.length} font file${files.length === 1 ? "" : "s"} grouped into ${uniqueFamilies.length} embedded famil${uniqueFamilies.length === 1 ? "y" : "ies"}.`;
    setStatus("Fonts imported");
    scheduleRefresh();
  } catch {
    setStatus("Font import failed", "error");
    $("fontHint").textContent = "One or more font files could not be read.";
  } finally {
    event.target.value = "";
  }
}

async function exportPdf() {
  exportButton.disabled = true;
  setStatus("Building PDF…", "busy");
  try {
    const response = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload())
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || "Export failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentName.replace(/\.[^.]+$/, "") || "document"}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("PDF exported");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    exportButton.disabled = false;
  }
}

function showTab(name) {
  const previewActive = name === "preview";
  $("previewPanel").classList.toggle("hidden", !previewActive);
  $("editorPanel").classList.toggle("hidden", previewActive);
  $("previewTab").classList.toggle("active", previewActive);
  $("editorTab").classList.toggle("active", !previewActive);
  $("previewTab").setAttribute("aria-selected", String(previewActive));
  $("editorTab").setAttribute("aria-selected", String(!previewActive));
}

$("fileInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  documentName = file.name;
  $("fileLabel").textContent = file.name;
  markdown.value = await file.text();
  scheduleRefresh();
});

document.querySelectorAll("input, select, textarea").forEach(control => {
  if (control.type === "file") return;
  control.addEventListener("input", scheduleRefresh);
  control.addEventListener("change", scheduleRefresh);
});
$("margin").addEventListener("input", () => { $("marginValue").textContent = `${$("margin").value} mm`; });
$("paragraphSpacing").addEventListener("input", () => { $("paragraphSpacingValue").textContent = `${$("paragraphSpacing").value} px`; });
$("headingBefore").addEventListener("input", () => { $("headingBeforeValue").textContent = `${$("headingBefore").value} px`; });
$("headingAfter").addEventListener("input", () => { $("headingAfterValue").textContent = `${$("headingAfter").value} px`; });
$("pageSize").addEventListener("change", updatePreviewShape);
$("orientation").addEventListener("change", updatePreviewShape);
$("previewTab").addEventListener("click", () => showTab("preview"));
$("editorTab").addEventListener("click", () => showTab("editor"));
exportButton.addEventListener("click", exportPdf);
$("fontFiles").addEventListener("change", importFontFiles);

updatePreviewShape();
refresh();
loadSystemFonts();
