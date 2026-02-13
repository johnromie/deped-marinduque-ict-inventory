<?php
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inventory List - DepEd Marinduque ICT Inventory</title>
  <link rel="stylesheet" href="style.css?v=20260213g" />
</head>
<body class="pageInventory">
  <div class="govBanner">
    <img src="assets/top.webp" alt="DepEd Marinduque Header" />
  </div>

  <header class="topbar">
    <div>
      <h1>Inventory List</h1>
      <p>Schools Division of Marinduque</p>
    </div>
    <div class="topbarActions">
      <a href="index.php" class="btn ghost">Add / Update Item</a>
      <input type="file" id="importCsvInput" accept=".csv" class="hidden" />
      <button id="importCsvBtn" class="btn ghost btnImport" type="button">Import CSV</button>
      <a href="imports.php" class="btn ghost btnViewImported">View Imported CSV</a>
      <button id="exportBtn" class="btn secondary btnExport">Export CSV</button>
      <span id="whoami" class="pill hidden"></span>
      <button id="logoutBtn" class="btn ghost hidden">Logout</button>
    </div>
  </header>

  <main class="page">
    <section id="appSection">
      <div class="layout">
        <section class="panel">
          <div class="tableHead">
            <h2>Inventory List</h2>
            <div class="tableTools">
              <input type="search" id="searchInput" placeholder="Search property, item, location..." />
              <div class="tableActionsGroup">
                <a href="deleted.php" class="btn ghost">Show Deleted</a>
                <button id="deleteAllBtn" class="btn danger" type="button">Delete All</button>
              </div>
            </div>
          </div>

          <div class="stats" id="stats"></div>

          <div id="inventoryScrollTop" class="scrollSyncTop">
            <div id="inventoryScrollTopInner"></div>
          </div>

          <div class="tableWrap">
            <table class="inventoryTable">
              <thead>
                <tr>
                  <th>Property No</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Brand / Model</th>
                  <th>Serial No</th>
                  <th>Location</th>
                  <th>Condition</th>
                  <th>Acquired</th>
                  <th>Assigned To</th>
                  <th>Under Warranty</th>
                  <th>End Warranty Date</th>
                  <th>Equipment Location</th>
                  <th>Non-Functional</th>
                  <th>Accountability Status</th>
                  <th>Accountable Officer</th>
                  <th>Date Assigned Officer</th>
                  <th>Custodian/End User</th>
                  <th>Date Assigned Custodian</th>
                  <th>DCP Package</th>
                  <th>DCP Year</th>
                  <th>Classification</th>
                  <th>GL-SL Code</th>
                  <th>UACS</th>
                  <th>Acquisition Cost</th>
                  <th>Useful Life</th>
                  <th>Mode Acquisition</th>
                  <th>Source Acquisition</th>
                  <th>Donor</th>
                  <th>Source Funds</th>
                  <th>Allotment Class</th>
                  <th>PMP Ref No</th>
                  <th>Transaction Type</th>
                  <th>Supporting Document</th>
                  <th>Reference Number</th>
                  <th>Supplier/Distributor</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="inventoryBody"></tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </main>

  <script src="app.js?v=20260213g"></script>
</body>
</html>






