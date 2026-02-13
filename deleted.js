const api = {
  me: "api/me.php",
  logout: "api/logout.php",
  items: "api/items.php",
  imports: "api/imports.php"
};

const whoami = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const deletedItemsBody = document.getElementById("deletedItemsBody");
const deletedImportsBody = document.getElementById("deletedImportsBody");
const deletedItemsMeta = document.getElementById("deletedItemsMeta");
const deletedImportsMeta = document.getElementById("deletedImportsMeta");
const deletedItemsSearch = document.getElementById("deletedItemsSearch");
const deletedImportsSearch = document.getElementById("deletedImportsSearch");

let deletedItemsRows = [];
let deletedImportsRows = [];

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

  if (deletedItemsSearch) {
    deletedItemsSearch.addEventListener("input", () => renderDeletedItems());
  }
  if (deletedImportsSearch) {
    deletedImportsSearch.addEventListener("input", () => renderDeletedImports());
  }

  await loadDeletedData();
}

async function loadDeletedData() {
  const [itemsRes, importsRes] = await Promise.all([
    request(`${api.items}?include_deleted=1`),
    request(`${api.imports}?all=1&include_deleted=1`)
  ]);

  if (!itemsRes.ok) {
    deletedItemsBody.innerHTML = '<tr><td colspan="7">Failed to load deleted inventory items.</td></tr>';
  } else {
    deletedItemsRows = (itemsRes.items || []).filter((i) => Boolean(i.deleted_at));
    renderDeletedItems();
  }

  if (!importsRes.ok) {
    deletedImportsBody.innerHTML = '<tr><td colspan="5">Failed to load deleted imported CSV files.</td></tr>';
  } else {
    deletedImportsRows = (importsRes.imports || []).filter((f) => Boolean(f.deleted_at));
    renderDeletedImports();
  }
}

function renderDeletedItems() {
  const q = String(deletedItemsSearch?.value || "").trim().toLowerCase();
  const rows = !q
    ? [...deletedItemsRows]
    : deletedItemsRows.filter((row) =>
        String(row.property_no || "").toLowerCase().includes(q) ||
        String(row.item_name || "").toLowerCase().includes(q) ||
        String(row.category || "").toLowerCase().includes(q) ||
        String(row.serial_no || "").toLowerCase().includes(q) ||
        String(row.location || "").toLowerCase().includes(q)
      );

  deletedItemsBody.innerHTML = "";
  deletedItemsMeta.textContent = `Deleted: ${rows.length}/${deletedItemsRows.length}`;

  if (rows.length === 0) {
    deletedItemsBody.innerHTML = '<tr><td colspan="7">No deleted inventory items.</td></tr>';
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.property_no || "-")}</td>
      <td>${escapeHtml(row.item_name)}</td>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.serial_no)}</td>
      <td>${escapeHtml(row.location)}</td>
      <td>${escapeHtml(row.deleted_at || "-")}</td>
      <td><button class="btn secondary" data-action="restore-item" data-id="${row.id}">Restore</button></td>
    `;
    deletedItemsBody.appendChild(tr);
  }

  deletedItemsBody.querySelectorAll("button[data-action='restore-item']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const res = await request(api.items, { method: "POST", body: { restore_id: id } });
      if (!res.ok) {
        alert(res.error || "Unable to restore item.");
        return;
      }
      await loadDeletedData();
      alert("Inventory item restored.");
    });
  });
}

function renderDeletedImports() {
  const q = String(deletedImportsSearch?.value || "").trim().toLowerCase();
  const rows = !q
    ? [...deletedImportsRows]
    : deletedImportsRows.filter((row) =>
        String(row.source_name || "").toLowerCase().includes(q) ||
        String(row.created_at || "").toLowerCase().includes(q) ||
        String(row.deleted_at || "").toLowerCase().includes(q)
      );

  deletedImportsBody.innerHTML = "";
  deletedImportsMeta.textContent = `Deleted: ${rows.length}/${deletedImportsRows.length}`;

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
      const res = await request(api.imports, { method: "POST", body: { restore_id: id } });
      if (!res.ok) {
        alert(res.error || "Unable to restore imported CSV.");
        return;
      }
      await loadDeletedData();
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
