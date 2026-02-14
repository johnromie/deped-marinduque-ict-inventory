const api = {
  login: "api/login.php",
  logout: "api/logout.php",
  me: "api/me.php",
  items: "api/items.php",
  changePassword: "api/change_password.php",
  imports: "api/imports.php"
};
const MASTER_TEMPLATE_FILE = "marinduque_ict-equipment-inventory-division-template (recovered).csv";

const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const loginForm = document.getElementById("loginForm");
const username = document.getElementById("username");
const password = document.getElementById("password");
const whoami = document.getElementById("whoami");
const logoutBtn = document.getElementById("logoutBtn");
const inventoryNavBtn = document.getElementById("inventoryNavBtn");

const changePasswordForm = document.getElementById("changePasswordForm");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");

const form = document.getElementById("inventoryForm");
const itemId = document.getElementById("itemId");
const propertyNo = document.getElementById("propertyNo");
const itemName = document.getElementById("itemName");
const category = document.getElementById("category");
const brandModel = document.getElementById("brandModel");
const serialNo = document.getElementById("serialNo");
const locationField = document.getElementById("location");
const assignedTo = document.getElementById("assignedTo");
const condition = document.getElementById("condition");
const acquiredDate = document.getElementById("acquiredDate");
const remarks = document.getElementById("remarks");
const inventoryBody = document.getElementById("inventoryBody");
const inventoryTableWrap = document.querySelector(".inventoryTable")?.closest(".tableWrap");
const inventoryScrollTop = document.getElementById("inventoryScrollTop");
const inventoryScrollTopInner = document.getElementById("inventoryScrollTopInner");
const searchInput = document.getElementById("searchInput");
const stats = document.getElementById("stats");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const exportBtn = document.getElementById("exportBtn");
const importCsvBtn = document.getElementById("importCsvBtn");
const importCsvInput = document.getElementById("importCsvInput");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const itemOptionsList = document.getElementById("itemOptions");
const brandModelOptionsList = document.getElementById("brandModelOptions");
const locationOptionsList = document.getElementById("locationOptions");
const underWarranty = document.getElementById("underWarranty");
const endWarrantyDate = document.getElementById("endWarrantyDate");
const equipmentLocation = document.getElementById("equipmentLocation");
const nonFunctional = document.getElementById("nonFunctional");
const equipmentCondition = document.getElementById("equipmentCondition");
const accountabilityStatus = document.getElementById("accountabilityStatus");
const accountableOfficer = document.getElementById("accountableOfficer");
const dateAssignedOfficer = document.getElementById("dateAssignedOfficer");
const custodianEndUser = document.getElementById("custodianEndUser");
const dateAssignedCustodian = document.getElementById("dateAssignedCustodian");
const nonDcp = document.getElementById("nonDcp");
const dcpPackage = document.getElementById("dcpPackage");
const dcpYearPackage = document.getElementById("dcpYearPackage");
const classification = document.getElementById("classification");
const glSlCode = document.getElementById("glSlCode");
const uacs = document.getElementById("uacs");
const acquisitionCost = document.getElementById("acquisitionCost");
const acquisitionRetrievedDate = document.getElementById("acquisitionRetrievedDate");
const estimatedUsefulLife = document.getElementById("estimatedUsefulLife");
const modeAcquisition = document.getElementById("modeAcquisition");
const sourceAcquisition = document.getElementById("sourceAcquisition");
const donor = document.getElementById("donor");
const sourceFunds = document.getElementById("sourceFunds");
const allotmentClass = document.getElementById("allotmentClass");
const pmpReferenceItemNumber = document.getElementById("pmpReferenceItemNumber");
const supportingDocuments = document.getElementById("supportingDocuments");
const parIcsRrspRsWmrNumber = document.getElementById("parIcsRrspRsWmrNumber");
const supplierDistributor = document.getElementById("supplierDistributor");
const transactionType = document.getElementById("transactionType");
const supportingDocumentsTransaction = document.getElementById("supportingDocumentsTransaction");

let items = [];
let filtered = [];
let currentUser = null;
const INVENTORY_TABLE_COLS = 37;
let isSyncingInventoryScroll = false;
let dynamicOptionsLoaded = false;
let dynamicOptionsPromise = null;

boot();

async function boot() {
  const hasAuthUi = Boolean(loginSection && appSection && loginForm);
  const needsData = Boolean(form || inventoryBody);
  const me = await request(api.me);
  if (me.ok) {
    currentUser = me.user;
    showApp();
    initInventoryHorizontalScrollSync();
    window.addEventListener("resize", updateInventoryHorizontalScrollSync);
    if (needsData) await fetchItems();
  } else {
    if (hasAuthUi) showLogin();
    else window.location.href = "index.php";
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await request(api.login, {
      method: "POST",
      body: { username: username.value.trim(), password: password.value }
    });

    if (!res.ok) {
      alert(res.error || "Login failed");
      return;
    }

    currentUser = res.user;
    showApp();
    if (form || inventoryBody) await fetchItems();
    loginForm.reset();
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await request(api.logout, { method: "POST" });
    currentUser = null;
    items = [];
    filtered = [];
    renderTable();
    renderStats();
    if (loginSection && appSection && loginForm) showLogin();
    else window.location.href = "index.php";
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const current = currentPassword.value;
    const next = newPassword.value;
    const confirm = confirmPassword.value;

    if (next.length < 8) {
      alert("New password must be at least 8 characters.");
      return;
    }

    if (next !== confirm) {
      alert("New password and confirm password do not match.");
      return;
    }

    const res = await request(api.changePassword, {
      method: "POST",
      body: {
        current_password: current,
        new_password: next,
        confirm_password: confirm
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        showLogin();
        return;
      }
      alert(res.error || "Unable to change password");
      return;
    }

    alert("Password changed successfully.");
    changePasswordForm.reset();
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

  const payload = {
    id: itemId.value || undefined,
    property_no: propertyNo.value.trim(),
    item_name: itemName.value.trim(),
    category: category.value,
    brand_model: brandModel.value.trim(),
    serial_no: serialNo.value.trim(),
    location: (locationField.value.trim() || (equipmentLocation?.value || "").trim()),
    assigned_to: (assignedTo.value.trim() || (accountableOfficer?.value || "").trim() || (custodianEndUser?.value || "").trim()),
    item_condition: (condition.value || (equipmentCondition?.value || "")),
    acquired_date: acquiredDate.value,
    remarks: remarks.value.trim(),
    extra_json: getExtraFormData()
  };

    const res = await request(api.items, { method: "POST", body: payload });
    if (!res.ok) {
      alert(res.error || "Unable to save item");
      return;
    }

    await fetchItems();
    clearForm();
  });
}

if (cancelEditBtn) cancelEditBtn.addEventListener("click", clearForm);
if (searchInput) searchInput.addEventListener("input", applySearch);

if (exportBtn) exportBtn.addEventListener("click", () => {
  if (items.length === 0) {
    alert("No inventory data to export.");
    return;
  }

  const headers = [
    "Property No", "Item Name", "Category", "Brand/Model", "Serial No",
    "Location", "Assigned To", "Condition", "Acquired Date", "Remarks",
    "Under Warranty", "End Warranty Date", "Equipment Location", "Non-Functional",
    "Accountability/Disposition Status", "Accountable Officer", "Date Assigned to Officer",
    "Custodian/End User", "Date Assigned to Custodian", "DCP Package", "DCP Year Package",
    "Classification", "GL-SL Code", "UACS", "Acquisition Cost", "Estimated Useful Life",
    "Mode of Acquisition", "Source of Acquisition", "Donor", "Source of Funds",
    "Allotment Class", "PMP Reference Item Number", "Transaction Type",
    "Supporting Documents", "PAR/ICS/RRSP/RS/WMR Number", "Supplier/Distributor"
  ];

  const rows = items.map((i) => {
    const x = parseExtraJson(i.extra_json);
    return [
      i.property_no,
      i.item_name,
      i.category,
      i.brand_model,
      i.serial_no,
      i.location,
      i.assigned_to,
      i.item_condition,
      i.acquired_date,
      i.remarks,
      boolLabel(x.under_warranty),
      x.end_warranty_date || "",
      x.equipment_location || "",
      boolLabel(x.non_functional),
      x.accountability_status || "",
      x.accountable_officer || "",
      x.date_assigned_officer || "",
      x.custodian_end_user || "",
      x.date_assigned_custodian || "",
      x.dcp_package || "",
      x.dcp_year_package || "",
      x.classification || "",
      x.gl_sl_code || "",
      x.uacs || "",
      x.acquisition_cost || "",
      x.estimated_useful_life || "",
      x.mode_acquisition || "",
      x.source_acquisition || "",
      x.donor || "",
      x.source_funds || "",
      x.allotment_class || "",
      x.pmp_reference_item_number || "",
      x.transaction_type || "",
      x.supporting_documents || "",
      x.par_ics_rrsp_rs_wmr_number || "",
      x.supplier_distributor || ""
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `deped-marinduque-ict-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

if (importCsvBtn && importCsvInput) {
  importCsvBtn.addEventListener("click", () => importCsvInput.click());
  importCsvInput.addEventListener("change", importCsvFile);
}
if (deleteAllBtn) {
  deleteAllBtn.addEventListener("click", deleteAllItems);
}

async function fetchItems() {
  const res = await request(api.items);
  if (!res.ok) {
    if (res.status === 401) {
      if (loginSection && appSection && loginForm) showLogin();
      else window.location.href = "index.php";
      return;
    }
    alert(res.error || "Failed to load inventory");
    return;
  }

  items = res.items || [];
  applySearch();
  // Inventory List page does not need dynamic form options.
  // Load them only when the add/update form exists and do it in background.
  if (form) {
    ensureDynamicOptionsLoaded();
  }
}

function ensureDynamicOptionsLoaded() {
  if (dynamicOptionsLoaded) return Promise.resolve();
  if (dynamicOptionsPromise) return dynamicOptionsPromise;
  dynamicOptionsPromise = loadDynamicOptionsFromImports()
    .catch(() => {})
    .finally(() => {
      dynamicOptionsLoaded = true;
      dynamicOptionsPromise = null;
    });
  return dynamicOptionsPromise;
}

function applySearch() {
  const q = String(searchInput?.value || "").trim().toLowerCase();
  filtered = items.filter((i) => {
    if (!q) return true;
    const x = parseExtraJson(i.extra_json);
    const extraJoined = [
      x.accountable_officer, x.custodian_end_user, x.dcp_package, x.classification,
      x.gl_sl_code, x.uacs, x.mode_acquisition, x.source_acquisition, x.donor,
      x.source_funds, x.allotment_class, x.transaction_type, x.supporting_documents,
      x.par_ics_rrsp_rs_wmr_number, x.supplier_distributor, x.equipment_location,
      x.accountability_status, x.acquisition_cost, x.estimated_useful_life
    ].join(" ").toLowerCase();
    return (
      String(i.property_no || "").toLowerCase().includes(q) ||
      String(i.item_name || "").toLowerCase().includes(q) ||
      String(i.category || "").toLowerCase().includes(q) ||
      String(i.location || "").toLowerCase().includes(q) ||
      String(i.serial_no || "").toLowerCase().includes(q) ||
      String(i.item_condition || "").toLowerCase().includes(q) ||
      extraJoined.includes(q)
    );
  });

  renderTable();
  renderStats();
}

function renderTable() {
  if (!inventoryBody) return;
  const canEditHere = Boolean(form && itemId);
  inventoryBody.innerHTML = "";

  if (filtered.length === 0) {
    inventoryBody.innerHTML = `<tr><td colspan="${INVENTORY_TABLE_COLS}">No records found.</td></tr>`;
    return;
  }

  for (const item of filtered) {
    const x = parseExtraJson(item.extra_json);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.property_no)}</td>
      <td>${escapeHtml(item.item_name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.brand_model)}</td>
      <td>${escapeHtml(item.serial_no)}</td>
      <td>${escapeHtml(item.location)}</td>
      <td>${escapeHtml(item.item_condition)}</td>
      <td>${escapeHtml(item.acquired_date)}</td>
      <td>${escapeHtml(item.assigned_to || "-")}</td>
      <td>${escapeHtml(boolLabel(x.under_warranty))}</td>
      <td>${escapeHtml(x.end_warranty_date || "-")}</td>
      <td>${escapeHtml(x.equipment_location || "-")}</td>
      <td>${escapeHtml(boolLabel(x.non_functional))}</td>
      <td>${escapeHtml(x.accountability_status || "-")}</td>
      <td>${escapeHtml(x.accountable_officer || "-")}</td>
      <td>${escapeHtml(x.date_assigned_officer || "-")}</td>
      <td>${escapeHtml(x.custodian_end_user || "-")}</td>
      <td>${escapeHtml(x.date_assigned_custodian || "-")}</td>
      <td>${escapeHtml(x.dcp_package || "-")}</td>
      <td>${escapeHtml(x.dcp_year_package || "-")}</td>
      <td>${escapeHtml(x.classification || "-")}</td>
      <td>${escapeHtml(x.gl_sl_code || "-")}</td>
      <td>${escapeHtml(x.uacs || "-")}</td>
      <td>${escapeHtml(x.acquisition_cost || "-")}</td>
      <td>${escapeHtml(x.estimated_useful_life || "-")}</td>
      <td>${escapeHtml(x.mode_acquisition || "-")}</td>
      <td>${escapeHtml(x.source_acquisition || "-")}</td>
      <td>${escapeHtml(x.donor || "-")}</td>
      <td>${escapeHtml(x.source_funds || "-")}</td>
      <td>${escapeHtml(x.allotment_class || "-")}</td>
      <td>${escapeHtml(x.pmp_reference_item_number || "-")}</td>
      <td>${escapeHtml(x.transaction_type || "-")}</td>
      <td>${escapeHtml(x.supporting_documents || "-")}</td>
      <td>${escapeHtml(x.par_ics_rrsp_rs_wmr_number || "-")}</td>
      <td>${escapeHtml(x.supplier_distributor || "-")}</td>
      <td><span class="statusTag active">Active</span></td>
      <td>
        <div class="rowActions">
          ${canEditHere ? `<button class="btn ghost" data-action="edit" data-id="${item.id}">Edit</button>` : ""}
          <button class="btn danger" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;
    inventoryBody.appendChild(tr);
  }

  updateInventoryHorizontalScrollSync();
  requestAnimationFrame(() => updateInventoryHorizontalScrollSync());

  if (canEditHere) {
    inventoryBody.querySelectorAll("button[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => editItem(Number(btn.dataset.id)));
    });
  }

  inventoryBody.querySelectorAll("button[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(Number(btn.dataset.id)));
  });
}

function renderStats() {
  if (!stats) return;
  const total = items.length;
  const serviceable = items.filter((i) => {
    const c = String(i.item_condition || "").toLowerCase();
    return c === "working" || c === "serviceable";
  }).length;
  const repair = items.filter((i) => String(i.item_condition || "").toLowerCase().includes("repair")).length;
  const condemned = items.filter((i) => {
    const c = String(i.item_condition || "").toLowerCase();
    return c === "condemned" || c === "unserviceable" || c === "disposed";
  }).length;

  stats.innerHTML = `
    <span class="stat">Total: ${total}</span>
    <span class="stat">Serviceable: ${serviceable}</span>
    <span class="stat">For Repair: ${repair}</span>
    <span class="stat">Unserviceable/Disposed: ${condemned}</span>
  `;
}

function editItem(id) {
  if (!form) return;
  const i = items.find((x) => Number(x.id) === Number(id));
  if (!i) return;

  itemId.value = i.id;
  propertyNo.value = i.property_no;
  itemName.value = i.item_name;
  category.value = i.category;
  brandModel.value = i.brand_model;
  serialNo.value = i.serial_no;
  locationField.value = i.location;
  assignedTo.value = i.assigned_to || "";
  condition.value = i.item_condition;
  acquiredDate.value = i.acquired_date;
  remarks.value = i.remarks || "";
  setExtraFormData(i.extra_json);

  cancelEditBtn.classList.remove("hidden");
  propertyNo.focus();
}

async function deleteItem(id) {
  const target = items.find((x) => Number(x.id) === Number(id));
  if (!target) return;

  if (!confirm(`Delete ${target.property_no} - ${target.item_name}?`)) return;

  const res = await request(`${api.items}?id=${id}`, { method: "DELETE" });
  if (!res.ok) {
    alert(res.error || "Unable to delete item");
    return;
  }

  await fetchItems();
}

async function deleteAllItems() {
  const total = items.length;
  if (total <= 0) {
    alert("No inventory items to delete.");
    return;
  }

  const ok = confirm(`Delete all ${total} inventory items? This will move them to Deleted Records.`);
  if (!ok) return;

  const oldLabel = deleteAllBtn ? deleteAllBtn.textContent : "";
  if (deleteAllBtn) {
    deleteAllBtn.disabled = true;
    deleteAllBtn.textContent = "Deleting...";
  }

  // Clear UI immediately after confirmation.
  items = [];
  filtered = [];
  renderTable();
  renderStats();

  const res = await request(`${api.items}?all=1`, { method: "DELETE" });
  if (!res.ok) {
    await fetchItems();
    if (deleteAllBtn) {
      deleteAllBtn.disabled = false;
      deleteAllBtn.textContent = oldLabel || "Delete All";
    }
    alert(res.error || "Unable to delete all items.");
    return;
  }

  await fetchItems();
  if (deleteAllBtn) {
    deleteAllBtn.disabled = false;
    deleteAllBtn.textContent = oldLabel || "Delete All";
  }
  alert(`Delete all done.\nDeleted: ${Number(res.deleted || 0)}\nFailed: 0`);
}

function getExtraFormData() {
  return {
    under_warranty: Boolean(underWarranty?.checked),
    end_warranty_date: endWarrantyDate?.value || "",
    equipment_location: equipmentLocation?.value?.trim() || "",
    non_functional: Boolean(nonFunctional?.checked),
    equipment_condition: equipmentCondition?.value || "",
    accountability_status: accountabilityStatus?.value || "",
    accountable_officer: accountableOfficer?.value?.trim() || "",
    date_assigned_officer: dateAssignedOfficer?.value || "",
    custodian_end_user: custodianEndUser?.value?.trim() || "",
    date_assigned_custodian: dateAssignedCustodian?.value || "",
    non_dcp: Boolean(nonDcp?.checked),
    dcp_package: dcpPackage?.value || "",
    dcp_year_package: dcpYearPackage?.value?.trim() || "",
    classification: classification?.value?.trim() || "",
    gl_sl_code: glSlCode?.value?.trim() || "",
    uacs: uacs?.value?.trim() || "",
    acquisition_cost: acquisitionCost?.value?.trim() || "",
    acquisition_retrieved_date: acquisitionRetrievedDate?.value || "",
    estimated_useful_life: estimatedUsefulLife?.value?.trim() || "",
    mode_acquisition: modeAcquisition?.value || "",
    source_acquisition: sourceAcquisition?.value || "",
    donor: donor?.value?.trim() || "",
    source_funds: sourceFunds?.value || "",
    allotment_class: allotmentClass?.value || "",
    pmp_reference_item_number: pmpReferenceItemNumber?.value?.trim() || "",
    supporting_documents: supportingDocuments?.value || "",
    par_ics_rrsp_rs_wmr_number: parIcsRrspRsWmrNumber?.value?.trim() || "",
    supplier_distributor: supplierDistributor?.value?.trim() || "",
    transaction_type: transactionType?.value || "",
    supporting_documents_transaction: supportingDocumentsTransaction?.value || ""
  };
}

function setExtraFormData(raw) {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      data = {};
    }
  }
  if (!data || typeof data !== "object") data = {};

  if (underWarranty) underWarranty.checked = Boolean(data.under_warranty);
  if (endWarrantyDate) endWarrantyDate.value = String(data.end_warranty_date || "");
  if (equipmentLocation) equipmentLocation.value = String(data.equipment_location || "");
  if (nonFunctional) nonFunctional.checked = Boolean(data.non_functional);
  if (equipmentCondition) equipmentCondition.value = String(data.equipment_condition || "");
  if (accountabilityStatus) accountabilityStatus.value = String(data.accountability_status || "");
  if (accountableOfficer) accountableOfficer.value = String(data.accountable_officer || "");
  if (dateAssignedOfficer) dateAssignedOfficer.value = String(data.date_assigned_officer || "");
  if (custodianEndUser) custodianEndUser.value = String(data.custodian_end_user || "");
  if (dateAssignedCustodian) dateAssignedCustodian.value = String(data.date_assigned_custodian || "");
  if (nonDcp) nonDcp.checked = Boolean(data.non_dcp);
  if (dcpPackage) dcpPackage.value = String(data.dcp_package || "");
  if (dcpYearPackage) dcpYearPackage.value = String(data.dcp_year_package || "");
  if (classification) classification.value = String(data.classification || "");
  if (glSlCode) glSlCode.value = String(data.gl_sl_code || "");
  if (uacs) uacs.value = String(data.uacs || "");
  if (acquisitionCost) acquisitionCost.value = String(data.acquisition_cost || "");
  if (acquisitionRetrievedDate) acquisitionRetrievedDate.value = String(data.acquisition_retrieved_date || "");
  if (estimatedUsefulLife) estimatedUsefulLife.value = String(data.estimated_useful_life || "");
  if (modeAcquisition) modeAcquisition.value = String(data.mode_acquisition || "");
  if (sourceAcquisition) sourceAcquisition.value = String(data.source_acquisition || "");
  if (donor) donor.value = String(data.donor || "");
  if (sourceFunds) sourceFunds.value = String(data.source_funds || "");
  if (allotmentClass) allotmentClass.value = String(data.allotment_class || "");
  if (pmpReferenceItemNumber) pmpReferenceItemNumber.value = String(data.pmp_reference_item_number || "");
  if (supportingDocuments) supportingDocuments.value = String(data.supporting_documents || "");
  if (parIcsRrspRsWmrNumber) parIcsRrspRsWmrNumber.value = String(data.par_ics_rrsp_rs_wmr_number || "");
  if (supplierDistributor) supplierDistributor.value = String(data.supplier_distributor || "");
  if (transactionType) transactionType.value = String(data.transaction_type || "");
  if (supportingDocumentsTransaction) supportingDocumentsTransaction.value = String(data.supporting_documents_transaction || "");
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

function boolLabel(value) {
  return value ? "Yes" : "No";
}

function initInventoryHorizontalScrollSync() {
  if (!inventoryTableWrap || !inventoryScrollTop || !inventoryScrollTopInner) return;

  inventoryScrollTop.addEventListener("scroll", () => {
    if (isSyncingInventoryScroll) return;
    isSyncingInventoryScroll = true;
    inventoryTableWrap.scrollLeft = inventoryScrollTop.scrollLeft;
    isSyncingInventoryScroll = false;
  });

  inventoryTableWrap.addEventListener("scroll", () => {
    if (isSyncingInventoryScroll) return;
    isSyncingInventoryScroll = true;
    inventoryScrollTop.scrollLeft = inventoryTableWrap.scrollLeft;
    isSyncingInventoryScroll = false;
  });
}

function updateInventoryHorizontalScrollSync() {
  if (!inventoryTableWrap || !inventoryScrollTop || !inventoryScrollTopInner) return;

  const table = inventoryTableWrap.querySelector("table");
  if (!table) return;

  const targetWidth = Math.max(table.scrollWidth, inventoryTableWrap.clientWidth) + 2;
  inventoryScrollTopInner.style.width = `${targetWidth}px`;

  const maxLeft = Math.max(0, inventoryTableWrap.scrollWidth - inventoryTableWrap.clientWidth);
  const safeLeft = Math.min(inventoryTableWrap.scrollLeft, maxLeft);
  inventoryTableWrap.scrollLeft = safeLeft;
  inventoryScrollTop.scrollLeft = safeLeft;
}

function clearForm() {
  if (!form) return;
  form.reset();
  itemId.value = "";
  cancelEditBtn.classList.add("hidden");
}

function showLogin() {
  if (!loginSection || !appSection) return;
  loginSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  if (inventoryNavBtn) inventoryNavBtn.classList.add("hidden");
  if (whoami) whoami.classList.add("hidden");
  if (logoutBtn) logoutBtn.classList.add("hidden");
  if (changePasswordForm) {
    changePasswordForm.reset();
  }
}

function showApp() {
  if (loginSection) loginSection.classList.add("hidden");
  if (appSection) appSection.classList.remove("hidden");
  if (inventoryNavBtn) inventoryNavBtn.classList.remove("hidden");
  if (whoami) whoami.classList.remove("hidden");
  if (logoutBtn) logoutBtn.classList.remove("hidden");
  if (whoami && currentUser) whoami.textContent = `${currentUser.full_name} (${currentUser.role})`;
}

async function loadDynamicOptionsFromImports() {
  const itemSet = new Set();
  const categorySet = new Set();
  const brandModelSet = new Set();
  const locationSet = new Set();
  const conditionSet = new Set();

  const importsRes = await request(`${api.imports}?all=1&full=1`);
  if (importsRes.ok && Array.isArray(importsRes.imports) && importsRes.imports.length) {
    const match = importsRes.imports.find((entry) => {
      const src = String(entry?.source_name || "").trim().toLowerCase();
      return src === MASTER_TEMPLATE_FILE || src.includes(MASTER_TEMPLATE_FILE);
    });
    const sourceEntry = match || importsRes.imports[0];
    const headers = Array.isArray(sourceEntry.headers) ? sourceEntry.headers.map(normalizeHeader) : [];
    const rows = Array.isArray(sourceEntry.rows) ? sourceEntry.rows : [];

    for (const row of rows) {
      const cells = Array.isArray(row) ? row : [];

      const itemValue = getByHeaders(headers, cells, ["item"]);
      const categoryValue = getByHeaders(headers, cells, ["category", "classification"]);
      const brandValue = getByHeaders(headers, cells, ["brand / manufacturer", "brand"]);
      const modelValue = getByHeaders(headers, cells, ["model"]);
      const locationValue = getByHeaders(headers, cells, ["office", "school", "source of acquisition", "location"]);
      const conditionValue = getByHeaders(headers, cells, ["equipment condition", "accountability / disposition status", "condition"]);

      if (isTemplateInstructionRow("", itemValue, cells) || isOptionNoise(cells.join(" "))) {
        continue;
      }

      addCleanOption(itemSet, itemValue);
      addCleanOption(categorySet, categoryValue);
      addCleanOption(brandModelSet, [brandValue, modelValue].filter(Boolean).join(" ").trim());
      addCleanOption(locationSet, locationValue);
      addCleanOption(conditionSet, inferCondition(conditionValue));
    }
  }

  // Fallback: if target CSV parsing produced empty option sets,
  // use values already present in active inventory items.
  if (itemSet.size === 0 && categorySet.size === 0 && brandModelSet.size === 0 && locationSet.size === 0 && conditionSet.size === 0) {
    for (const i of items || []) {
      addCleanOption(itemSet, i.item_name);
      addCleanOption(categorySet, i.category);
      addCleanOption(brandModelSet, i.brand_model);
      addCleanOption(locationSet, i.location);
      addCleanOption(conditionSet, inferCondition(i.item_condition));
    }
  }

  applyDatalistOptions(itemOptionsList, itemSet);
  applyDatalistOptions(brandModelOptionsList, brandModelSet);
  applyDatalistOptions(locationOptionsList, locationSet);
  applySelectOptions(category, categorySet, "Select category");
  applySelectOptions(condition, conditionSet, "Select condition");
}

function addCleanOption(targetSet, value) {
  const text = String(value || "").trim();
  if (!text || isOptionNoise(text)) return;
  targetSet.add(text);
}

function isOptionNoise(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return true;
  if (v === "#" || v === "instructions" || v === "#name?") return true;
  if (v.includes("(dropdown)")) return true;
  if (v.includes("type freely")) return true;
  if (v.includes("select the")) return true;
  if (v.includes("enter the equipment")) return true;
  if (v.includes("beginning inventory")) return true;
  if (v.includes("succeeding submissions") || v.includes("succeding submissions")) return true;
  if (v.includes("issuance/transfer") || v.includes("returns") || v.includes("disposal")) return true;
  return false;
}

function applyDatalistOptions(listEl, valueSet) {
  if (!listEl) return;
  const values = Array.from(valueSet).sort((a, b) => a.localeCompare(b));
  listEl.innerHTML = values.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
}

function applySelectOptions(selectEl, valueSet, placeholder) {
  if (!selectEl) return;
  const values = Array.from(valueSet).sort((a, b) => a.localeCompare(b));

  const safePlaceholder = escapeHtml(placeholder || "Select");
  let html = `<option value="">${safePlaceholder}</option>`;
  html += values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  selectEl.innerHTML = html;
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

function csvEscape(value) {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function importCsvFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const raw = await file.text();
    const contentHash = await computeFileHash(raw);
    const duplicateCheck = await request(`${api.imports}?hash=${encodeURIComponent(contentHash)}`);
    if (!duplicateCheck.ok) {
      alert(duplicateCheck.error || "Unable to validate duplicate CSV upload.");
      return;
    }
    if (duplicateCheck.ok && duplicateCheck.exists) {
      const existing = duplicateCheck.import;
      const when = existing?.created_at ? ` on ${existing.created_at}` : "";
      alert(`This CSV was already uploaded before (${existing?.source_name || "import file"}${when}). Upload rejected.`);
      return;
    }

    await fetchItems();
    const existingByProperty = new Map(
      (items || [])
        .filter((i) => String(i.property_no || "").trim() !== "")
        .map((i) => [String(i.property_no || "").trim().toLowerCase(), i])
    );
    const existingBySignature = new Set(
      (items || []).map((i) => buildInventorySignature({
        property_no: i.property_no,
        item_name: i.item_name,
        brand_model: i.brand_model,
        serial_no: i.serial_no
      }))
    );

    const rows = parseCsv(raw);
    if (rows.length < 2) {
      alert("CSV file has no data rows.");
      return;
    }

    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);
    let success = 0;
    let skipped = 0;
    let failed = 0;
    const failedRows = [];
    const bulkPayload = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const mapped = mapDepEdRowToPayload(headers, row, i);
      if (!mapped) {
        skipped++;
        continue;
      }

      const key = String(mapped.property_no || "").trim().toLowerCase();
      const signature = buildInventorySignature(mapped);
      const existing = key ? existingByProperty.get(key) : null;
      const hasDuplicateSignature = signature ? existingBySignature.has(signature) : false;
      if (existing || hasDuplicateSignature) {
        skipped++;
        continue;
      }

      bulkPayload.push(mapped);
      if (key) {
        existingByProperty.set(key, {
          id: 0,
          property_no: mapped.property_no
        });
      }
      if (signature) {
        existingBySignature.add(signature);
      }
    }

    if (bulkPayload.length > 0) {
      const bulkRes = await request(api.items, {
        method: "POST",
        body: { bulk_items: bulkPayload }
      });

      if (!bulkRes.ok) {
        alert(bulkRes.error || "Failed to import CSV.");
        return;
      }

      success = Number(bulkRes.success || 0);
      failed = Number(bulkRes.failed || 0);
      if (Array.isArray(bulkRes.failed_rows)) {
        failedRows.push(...bulkRes.failed_rows.map((line) => String(line)));
      }
    }

    let snapshotId = 0;
    let snapshotWarning = "";
    try {
      snapshotId = await saveImportSnapshot(file.name, rows[0], dataRows, contentHash);
    } catch (snapshotError) {
      snapshotWarning = `\n\nNote: Imported rows were saved to inventory, but CSV preview could not be saved (${snapshotError?.message || "unknown error"}).`;
    }

    await fetchItems();
    const details = failedRows.length ? `\n\n${failedRows.slice(0, 5).join("\n")}` : "";
    alert(`Import done.\nSuccess: ${success}\nSkipped: ${skipped}\nFailed: ${failed}${details}${snapshotWarning}`);
    const target = snapshotId > 0
      ? `imports.php?id=${snapshotId}&t=${Date.now()}`
      : `imports.php?t=${Date.now()}`;
    window.location.href = target;
  } catch (error) {
    alert(`Failed to import CSV.\n${error?.message || "Unknown error"}`);
  } finally {
    importCsvInput.value = "";
  }
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < csv.length) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cell += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }

    if (char === "\r") {
      i++;
      continue;
    }

    cell += char;
    i++;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getByHeaders(headers, row, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h.includes(alias));
    if (idx >= 0) {
      return String(row[idx] || "").trim();
    }
  }
  return "";
}

function inferCondition(value) {
  const v = String(value || "").toLowerCase();
  if (!v) return "";
  if (v.includes("serviceable") || v.includes("working")) return "Serviceable";
  if (v.includes("for repair") || v.includes("repair")) return "For Repair";
  if (v.includes("disposed")) return "Disposed";
  if (v.includes("unserviceable")) return "Unserviceable";
  if (v.includes("condemned")) return "Condemned";
  return String(value || "").trim();
}

function normalizeDate(value) {
  const v = String(value || "").trim();
  if (!v) return "";

  const mdy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const mm = mdy[1].padStart(2, "0");
    const dd = mdy[2].padStart(2, "0");
    const yyyy = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return v;

  return "";
}

function mapDepEdRowToPayload(headers, row, index) {
  const propertyNoValue = getByHeaders(headers, row, ["property no", "old / previous property no"]);
  const itemNameValue = getByHeaders(headers, row, ["item"]);
  const serialValue = getByHeaders(headers, row, ["serial number"]);
  const brandValue = getByHeaders(headers, row, ["brand / manufacturer", "brand"]);
  const modelValue = getByHeaders(headers, row, ["model"]);
  const specsValue = getByHeaders(headers, row, ["specifications"]);
  const categoryValue = getByHeaders(headers, row, ["category", "classification"]);
  const assignedValue = getByHeaders(headers, row, ["accountable officer", "received by", "custodian"]);
  const locationValue = getByHeaders(headers, row, ["source of acquisition", "office", "school"]);
  const conditionValue = getByHeaders(headers, row, ["equipment condition", "accountability / disposition status"]);
  const acquiredDateValue = getByHeaders(headers, row, ["acquisition / received date", "acquisition date"]);
  const remarksValue = getByHeaders(headers, row, ["remarks"]);

  if (!propertyNoValue && !itemNameValue && !serialValue) return null;
  if (isTemplateInstructionRow(propertyNoValue, itemNameValue, row)) return null;

  const brandModelValue = [brandValue, modelValue].filter(Boolean).join(" ").trim();
  const safeProperty = propertyNoValue || "";
  const safeSerial = serialValue || "";

  return {
    property_no: safeProperty,
    item_name: itemNameValue || "",
    category: categoryValue || "",
    brand_model: brandModelValue,
    serial_no: safeSerial,
    location: locationValue || "",
    assigned_to: assignedValue,
    item_condition: inferCondition(conditionValue),
    acquired_date: normalizeDate(acquiredDateValue),
    remarks: [remarksValue, specsValue].filter(Boolean).join(" | ")
  };
}

function isTemplateInstructionRow(propertyNoValue, itemNameValue, row) {
  const property = String(propertyNoValue || "").trim().toLowerCase();
  const item = String(itemNameValue || "").trim().toLowerCase();
  const joined = (Array.isArray(row) ? row : [])
    .map((c) => String(c || "").trim().toLowerCase())
    .join(" ");

  if (property === "#" || property === "instructions" || property === "#name?") return true;
  if (item.includes("(dropdown)") || item.includes("type freely")) return true;
  if (joined.includes("type freely") || joined.includes("instructions") || joined.includes("(dropdown)")) return true;
  return false;
}

async function saveImportSnapshot(sourceName, originalHeaders, dataRows, contentHash) {
  const headersLimited = (Array.isArray(originalHeaders) ? originalHeaders : [])
    .slice(0, 80)
    .map((h) => String(h ?? "").slice(0, 160));

  const maxColumns = Math.max(1, headersLimited.length);
  const rowsLimited = (Array.isArray(dataRows) ? dataRows : [])
    .slice(0, 500)
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return cells.slice(0, maxColumns).map((cell) => String(cell ?? "").slice(0, 500));
    });

  const res = await request(api.imports, {
    method: "POST",
    body: {
      source_name: sourceName || "import.csv",
      headers: headersLimited,
      rows: rowsLimited,
      content_hash: String(contentHash || "")
    }
  });

  if (!res.ok) {
    throw new Error(res.error || "Unable to save import snapshot");
  }

  return Number(res.id || 0);
}

async function computeFileHash(content) {
  const text = String(content ?? "");
  try {
    if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
      const bytes = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (hashError) {
    // fall through to non-crypto hash fallback
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash)}`;
}

function buildInventorySignature(item) {
  const serial = String(item?.serial_no || "").trim().toLowerCase();
  const name = String(item?.item_name || "").trim().toLowerCase();
  const brand = String(item?.brand_model || "").trim().toLowerCase();
  const category = String(item?.category || "").trim().toLowerCase();
  const location = String(item?.location || "").trim().toLowerCase();
  if (!serial && !name && !brand && !category && !location) {
    return "";
  }
  return `${serial}|${name}|${brand}|${category}|${location}`;
}

function makeStableRowFingerprint(row) {
  const base = (Array.isArray(row) ? row : [])
    .map((cell) => String(cell || "").trim().toLowerCase())
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
