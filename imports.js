const api = {
  me: "api/me.php",
  logout: "api/logout.php",
  imports: "api/imports.php",
  items: "api/items.php"
};

const whoami = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const importMeta = document.getElementById("importMeta");
const importedCsvHead = document.getElementById("importedCsvHead");
const importedCsvBody = document.getElementById("importedCsvBody");
const tableWrap = document.querySelector(".tableWrap");
const importScrollTop = document.getElementById("importScrollTop");
const importScrollTopInner = document.getElementById("importScrollTopInner");
const importSearchInput = document.getElementById("importSearchInput");
const importFileSelect = document.getElementById("importFileSelect");
const rowsPerPage = document.getElementById("rowsPerPage");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const deleteImportBtn = document.getElementById("deleteImportBtn");
const deletedImportsSearch = document.getElementById("deletedImportsSearch");
const deletedImportsBody = document.getElementById("deletedImportsBody");
const deletedImportsMeta = document.getElementById("deletedImportsMeta");

let importEntries = [];
let allImportEntries = [];
let deletedImportEntries = [];
let mergedHeaders = [];
let mergedRows = [];
let filteredRows = [];
let activeImportId = 0;
let currentImportIndex = -1;
let pageSize = 10;
let isSyncingScroll = false;
let tableResizeObserver = null;

boot();

async function boot() {
  const me = await request(api.me);
  if (!me.ok) {
    window.location.href = "index.php";
    return;
  }

  whoami.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  whoami.textContent = `${me.user.full_name} (${me.user.role})`;

  logoutBtn.addEventListener("click", async () => {
    await request(api.logout, { method: "POST" });
    window.location.href = "index.php";
  });

  if (importSearchInput) {
    importSearchInput.addEventListener("input", () => {
      applyFilterAndRender();
    });
  }
  if (deletedImportsSearch) {
    deletedImportsSearch.addEventListener("input", () => {
      renderDeletedImportsSection();
    });
  }

  if (rowsPerPage) {
    rowsPerPage.value = String(pageSize);
    rowsPerPage.addEventListener("change", () => {
      pageSize = Number(rowsPerPage.value || 10);
      renderImportedCsvPage();
    });
  }

  if (importFileSelect) {
    importFileSelect.addEventListener("change", () => {
      activeImportId = Number(importFileSelect.value || 0);
      currentImportIndex = importEntries.findIndex((e) => Number(e.id) === activeImportId);
      buildMergedRows();
      applyFilterAndRender();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentImportIndex <= 0) return;
      selectImportByIndex(currentImportIndex - 1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      if (currentImportIndex < 0 || currentImportIndex >= importEntries.length - 1) return;
      selectImportByIndex(currentImportIndex + 1);
    });
  }

  if (deleteImportBtn) {
    deleteImportBtn.addEventListener("click", deleteImportedCsv);
  }

  initHorizontalScrollSync();
  window.addEventListener("resize", updateHorizontalScrollSync);

  await loadImports();
}

async function loadImports() {
  const [importsRes, itemsRes] = await Promise.all([
    request(`${api.imports}?all=1&full=1&include_deleted=1`),
    request(api.items)
  ]);

  if (!importsRes.ok) {
    clearView("Failed to load imported CSV data.");
    return;
  }
  if (!itemsRes.ok) {
    clearView("Failed to load inventory data for imported view.");
    return;
  }

  const inventoryEntry = buildInventoryImportEntry(Array.isArray(itemsRes.items) ? itemsRes.items : []);
  const uploadedEntries = Array.isArray(importsRes.imports) ? importsRes.imports : [];

  allImportEntries = [inventoryEntry, ...uploadedEntries];
  importEntries = allImportEntries.filter((e) => !e.deleted_at);
  deletedImportEntries = uploadedEntries.filter((e) => Boolean(e.deleted_at));

  renderDeletedImportsSection();

  if (importEntries.length === 0) {
    populateFileOptions([]);
    clearView("No imported CSV yet.");
    return;
  }

  populateFileOptions(importEntries);
  if (activeImportId === 0) {
    currentImportIndex = -1;
  } else {
    const selectedIndex = importEntries.findIndex((e) => Number(e.id) === activeImportId);
    if (selectedIndex >= 0) {
      currentImportIndex = selectedIndex;
    } else {
      currentImportIndex = -1;
      activeImportId = 0;
    }
  }
  if (importFileSelect) importFileSelect.value = String(activeImportId);
  buildMergedRows();
  applyFilterAndRender();
}

function populateFileOptions(entries) {
  if (!importFileSelect) return;
  importFileSelect.innerHTML = "";

  const combinedOption = document.createElement("option");
  combinedOption.value = "0";
  combinedOption.textContent = `Combined View (${entries.length} files)`;
  importFileSelect.appendChild(combinedOption);

  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = String(entry.id || 0);
    const deletedLabel = entry.deleted_at ? " [Deleted]" : "";
    option.textContent = `${entry.source_name}${deletedLabel} (${entry.row_count} rows)`;
    importFileSelect.appendChild(option);
  }

  importFileSelect.disabled = entries.length === 0;
}

function buildMergedRows() {
  const selectedEntries = activeImportId === 0
    ? [...importEntries]
    : importEntries.filter((e) => Number(e.id) === activeImportId);
  const selectedEntry = selectedEntries[0] || null;

  const headerSet = [];
  for (const entry of selectedEntries) {
    const headers = Array.isArray(entry.headers) ? entry.headers : [];
    for (const h of headers) {
      const key = String(h || "").trim();
      const normalized = normalizeLooseKey(key);
      if (!key) continue;
      if (normalized === "no." || normalized === "no" || normalized === "source_file") continue;
      if (!headerSet.includes(key)) headerSet.push(key);
    }
  }

  mergedHeaders = ["no.", "source_file", ...headerSet];
  mergedRows = [];

  for (const entry of selectedEntries) {
    const headers = Array.isArray(entry.headers) ? entry.headers.map((h) => String(h || "").trim()) : [];
    const rows = Array.isArray(entry.rows) ? entry.rows : [];

    for (const row of rows) {
      const cells = Array.isArray(row) ? row : [];
      if (isTemplateInstructionRowForView(cells)) continue;
      const byHeader = {};
      for (let i = 0; i < headers.length; i++) {
        byHeader[headers[i]] = String(cells[i] ?? "");
      }

      const deletedTag = entry.deleted_at ? " [Deleted]" : "";
      const out = [`${String(entry.source_name || "")}${deletedTag}`];
      for (const h of headerSet) {
        out.push(String(byHeader[h] ?? ""));
      }
      mergedRows.push(out);
    }
  }

  const totalRows = mergedRows.length;
  importMeta.textContent = activeImportId === 0
    ? `Source: Combined View | Files: ${selectedEntries.length} | Rows: ${totalRows}`
    : (selectedEntry
      ? `Source: ${selectedEntry.source_name}${selectedEntry.deleted_at ? " [Deleted]" : ""} | Rows: ${totalRows} | Imported: ${selectedEntry.created_at || "-"}`
      : "No imported CSV yet.");

  if (deleteImportBtn) {
    const disableDelete =
      activeImportId === 0 ||
      !selectedEntry ||
      Boolean(selectedEntry.deleted_at) ||
      Boolean(selectedEntry.is_virtual);
    deleteImportBtn.disabled = disableDelete;
    deleteImportBtn.title = disableDelete
      ? "Select a specific active uploaded CSV to delete"
      : "Delete selected imported CSV";
  }
}

function normalizeLooseKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function isTemplateInstructionRowForView(row) {
  const cells = (Array.isArray(row) ? row : []).map((c) => String(c || "").trim());
  if (!cells.some((c) => c !== "")) return true;

  const joined = cells.join(" ").toLowerCase();
  const first = String(cells[0] || "").toLowerCase();

  if (first === "#" || first === "instructions" || first === "#name?") return true;
  if (joined.includes("type freely")) return true;
  if (joined.includes("(dropdown)")) return true;
  if (joined.includes("enter the equipment")) return true;
  if (joined.includes("following the official format")) return true;
  if (joined.includes("entries for initial beginning inventory only")) return true;
  if (joined.includes("new receipt from the delivery")) return true;
  if (joined.includes("in succeeding submissions")) return true;
  if (joined.includes("in succeding submissions")) return true;
  if (joined.includes("issuance/transfer")) return true;
  if (joined.includes("returns, or disposal")) return true;
  if (joined.includes("copy the affected row(s)")) return true;
  if (joined.includes("af & ag should remain blank")) return true;
  if (joined.includes("columns ac, ad, and ae should retain")) return true;

  return false;
}

function applyFilterAndRender() {
  const q = String(importSearchInput?.value || "").trim().toLowerCase();
  filteredRows = !q
    ? [...mergedRows]
    : mergedRows.filter((row) => row.some((cell) => String(cell || "").toLowerCase().includes(q)));
  renderImportedCsvPage();
}

function renderImportedCsvPage() {
  importedCsvHead.innerHTML = "";
  importedCsvBody.innerHTML = "";

  if (!mergedHeaders.length) {
    importedCsvBody.innerHTML = '<tr><td>No imported CSV data.</td></tr>';
    if (pageInfo) pageInfo.textContent = "File 0/0";
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    if (deleteImportBtn) deleteImportBtn.disabled = true;
    updateHorizontalScrollSync();
    return;
  }

  const headTr = document.createElement("tr");
  for (const h of mergedHeaders) {
    const th = document.createElement("th");
    th.textContent = h;
    headTr.appendChild(th);
  }
  importedCsvHead.appendChild(headTr);

  const pageRows = pageSize > 0 ? filteredRows.slice(0, pageSize) : [...filteredRows];

  if (pageRows.length === 0) {
    importedCsvBody.innerHTML = `<tr><td colspan="${mergedHeaders.length}">No matching rows.</td></tr>`;
  } else {
    for (let r = 0; r < pageRows.length; r++) {
      const row = pageRows[r];
      const tr = document.createElement("tr");
      for (let i = 0; i < mergedHeaders.length; i++) {
        const td = document.createElement("td");
        if (i === 0) {
          td.textContent = String(r + 1);
        } else {
          td.textContent = String(row[i - 1] ?? "");
        }
        tr.appendChild(td);
      }
      importedCsvBody.appendChild(tr);
    }
  }

  const fileNumber = currentImportIndex >= 0 ? currentImportIndex + 1 : 0;
  const totalFiles = importEntries.length;
  if (pageInfo) {
    pageInfo.textContent = activeImportId === 0
      ? `Combined (${totalFiles} files, showing ${pageRows.length}/${filteredRows.length} rows)`
      : `File ${fileNumber}/${totalFiles} (showing ${pageRows.length}/${filteredRows.length} rows)`;
  }
  if (prevPageBtn) prevPageBtn.disabled = activeImportId === 0 || currentImportIndex <= 0;
  if (nextPageBtn) nextPageBtn.disabled = activeImportId === 0 || currentImportIndex < 0 || currentImportIndex >= importEntries.length - 1;
  if (deleteImportBtn && importEntries.length === 0) {
    deleteImportBtn.disabled = true;
  }

  updateHorizontalScrollSync();
  requestAnimationFrame(() => updateHorizontalScrollSync());
}

async function deleteImportedCsv() {
  if (!importEntries.length) {
    alert("No imported CSV to delete.");
    return;
  }

  const targetId = activeImportId;
  const target = importEntries.find((e) => Number(e.id) === targetId);
  if (!targetId || !target) {
    alert("No imported CSV to delete.");
    return;
  }
  if (target.is_virtual) {
    alert("Inventory List (Live) cannot be deleted from Imported CSV.");
    return;
  }
  if (target.deleted_at) {
    alert("Imported CSV is already deleted.");
    return;
  }

  const okDelete = confirm(`Delete imported CSV: ${target.source_name}?`);
  if (!okDelete) return;

  const res = await request(`${api.imports}?id=${targetId}`, { method: "DELETE" });
  if (!res.ok) {
    alert(res.error || "Unable to delete imported CSV.");
    return;
  }

  if (currentImportIndex > 0) {
    currentImportIndex--;
  }
  const fallback = importEntries[currentImportIndex] || importEntries[0] || null;
  activeImportId = fallback ? Number(fallback.id || 0) : 0;
  await loadImports();
  alert("Imported CSV deleted.");
}

function clearView(message) {
  importEntries = [];
  mergedHeaders = [];
  mergedRows = [];
  filteredRows = [];
  activeImportId = 0;
  currentImportIndex = -1;
  importMeta.textContent = message;
  if (importSearchInput) importSearchInput.value = "";
  renderImportedCsvPage();
}

function buildInventoryImportEntry(items) {
  const headers = [
    "property_no",
    "item_name",
    "category",
    "brand_model",
    "serial_no",
    "location",
    "assigned_to",
    "item_condition",
    "acquired_date",
    "remarks",
    "under_warranty",
    "end_warranty_date",
    "equipment_location",
    "non_functional",
    "accountability_status",
    "accountable_officer",
    "date_assigned_officer",
    "custodian_end_user",
    "date_assigned_custodian",
    "dcp_package",
    "dcp_year_package",
    "classification",
    "gl_sl_code",
    "uacs",
    "acquisition_cost",
    "estimated_useful_life",
    "mode_acquisition",
    "source_acquisition",
    "donor",
    "source_funds",
    "allotment_class",
    "pmp_reference_item_number",
    "transaction_type",
    "supporting_documents",
    "par_ics_rrsp_rs_wmr_number",
    "supplier_distributor"
  ];

  const rows = [];
  for (const item of items) {
    const x = parseExtraJson(item.extra_json);
    rows.push([
      String(item.property_no ?? ""),
      String(item.item_name ?? ""),
      String(item.category ?? ""),
      String(item.brand_model ?? ""),
      String(item.serial_no ?? ""),
      String(item.location ?? ""),
      String(item.assigned_to ?? ""),
      String(item.item_condition ?? ""),
      String(item.acquired_date ?? ""),
      String(item.remarks ?? ""),
      String(x.under_warranty ? "Yes" : "No"),
      String(x.end_warranty_date ?? ""),
      String(x.equipment_location ?? ""),
      String(x.non_functional ? "Yes" : "No"),
      String(x.accountability_status ?? ""),
      String(x.accountable_officer ?? ""),
      String(x.date_assigned_officer ?? ""),
      String(x.custodian_end_user ?? ""),
      String(x.date_assigned_custodian ?? ""),
      String(x.dcp_package ?? ""),
      String(x.dcp_year_package ?? ""),
      String(x.classification ?? ""),
      String(x.gl_sl_code ?? ""),
      String(x.uacs ?? ""),
      String(x.acquisition_cost ?? ""),
      String(x.estimated_useful_life ?? ""),
      String(x.mode_acquisition ?? ""),
      String(x.source_acquisition ?? ""),
      String(x.donor ?? ""),
      String(x.source_funds ?? ""),
      String(x.allotment_class ?? ""),
      String(x.pmp_reference_item_number ?? ""),
      String(x.transaction_type ?? ""),
      String(x.supporting_documents ?? ""),
      String(x.par_ics_rrsp_rs_wmr_number ?? ""),
      String(x.supplier_distributor ?? "")
    ]);
  }

  return {
    id: -1,
    source_name: "Inventory List (Live)",
    created_at: "-",
    deleted_at: null,
    row_count: rows.length,
    header_count: headers.length,
    headers,
    rows,
    is_virtual: true
  };
}

function parseExtraJson(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw || {};
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function renderDeletedImportsSection() {
  if (!deletedImportsBody || !deletedImportsMeta) return;

  const q = String(deletedImportsSearch?.value || "").trim().toLowerCase();
  const rows = !q
    ? [...deletedImportEntries]
    : deletedImportEntries.filter((r) =>
        String(r.source_name || "").toLowerCase().includes(q) ||
        String(r.created_at || "").toLowerCase().includes(q) ||
        String(r.deleted_at || "").toLowerCase().includes(q)
      );

  deletedImportsMeta.textContent = `Deleted: ${rows.length}/${deletedImportEntries.length}`;
  deletedImportsBody.innerHTML = "";

  if (rows.length === 0) {
    deletedImportsBody.innerHTML = '<tr><td colspan="5">No deleted imported CSV files.</td></tr>';
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.source_name)}</td>
      <td>${escapeHtml(String(row.row_count || 0))}</td>
      <td>${escapeHtml(row.created_at || "-")}</td>
      <td>${escapeHtml(row.deleted_at || "-")}</td>
      <td><button class="btn secondary" data-action="restore-import" data-id="${row.id}">Restore</button></td>
    `;
    deletedImportsBody.appendChild(tr);
  }

  deletedImportsBody.querySelectorAll("button[data-action='restore-import']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const target = deletedImportEntries.find((e) => Number(e.id) === id);
      if (!target) return;
      const okRestore = confirm(`Restore imported CSV: ${target.source_name}?`);
      if (!okRestore) return;

      const res = await request(api.imports, { method: "POST", body: { restore_id: id } });
      if (!res.ok) {
        alert(res.error || "Unable to restore imported CSV.");
        return;
      }
      await loadImports();
      alert("Imported CSV restored.");
    });
  });
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function selectImportByIndex(index) {
  if (!importEntries.length) return;
  const safeIndex = Math.max(0, Math.min(index, importEntries.length - 1));
  currentImportIndex = safeIndex;
  activeImportId = Number(importEntries[safeIndex].id || 0);
  if (importFileSelect) {
    importFileSelect.value = String(activeImportId);
  }
  buildMergedRows();
  applyFilterAndRender();
}

async function request(url, options = {}) {
  const cfg = {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store"
  };

  if (options.body !== undefined) {
    cfg.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, cfg);
  const data = await response.json().catch(() => ({}));
  return { ...data, status: response.status };
}

function initHorizontalScrollSync() {
  if (!tableWrap || !importScrollTop) return;

  importScrollTop.addEventListener("scroll", () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    tableWrap.scrollLeft = importScrollTop.scrollLeft;
    isSyncingScroll = false;
  });

  tableWrap.addEventListener("scroll", () => {
    if (isSyncingScroll) return;
    isSyncingScroll = true;
    importScrollTop.scrollLeft = tableWrap.scrollLeft;
    isSyncingScroll = false;
  });

  const table = tableWrap.querySelector("table");
  if (table && "ResizeObserver" in window) {
    tableResizeObserver = new ResizeObserver(() => updateHorizontalScrollSync());
    tableResizeObserver.observe(table);
  }
}

function updateHorizontalScrollSync() {
  if (!tableWrap || !importScrollTop || !importScrollTopInner) return;

  const table = tableWrap.querySelector("table");
  if (!table) return;

  const targetWidth = Math.max(table.scrollWidth, tableWrap.clientWidth) + 2;
  importScrollTopInner.style.width = `${targetWidth}px`;

  const maxLeft = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth);
  const safeLeft = Math.min(tableWrap.scrollLeft, maxLeft);
  tableWrap.scrollLeft = safeLeft;
  importScrollTop.scrollLeft = safeLeft;

  if (targetWidth <= tableWrap.clientWidth + 2) {
    importScrollTop.classList.add("hidden");
  } else {
    importScrollTop.classList.remove("hidden");
  }
}
