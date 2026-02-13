<?php
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Imported CSV View - DepEd Marinduque</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="govBanner">
    <img src="assets/top.webp" alt="DepEd Marinduque Header" />
  </div>

  <header class="topbar">
    <div>
      <h1>Imported CSV (Excel View)</h1>
      <p>Schools Division of Marinduque</p>
    </div>
    <div class="topbarActions">
      <a href="inventory.php" class="btn btnInventoryNav">Back to Inventory List</a>
      <a href="deleted.php" class="btn ghost">View Deleted</a>
      <span id="whoami" class="pill hidden"></span>
      <button id="logoutBtn" class="btn ghost hidden">Logout</button>
    </div>
  </header>

  <main class="page">
    <section class="panel">
      <div class="tableHead importMetaHead">
        <h2>Latest Imported File</h2>
        <div class="tableActionsGroup importMetaActions">
          <small id="importMeta"></small>
          <button id="deleteImportBtn" class="btn danger" type="button">Delete Imported CSV</button>
        </div>
      </div>
      <div class="tableHead">
        <input type="search" id="importSearchInput" placeholder="Search in imported CSV..." />
        <div class="tableTools">
          <label for="importFileSelect">Imported File</label>
          <select id="importFileSelect"></select>
          <label for="rowsPerPage">Rows</label>
          <select id="rowsPerPage">
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="0">All</option>
          </select>
          <button id="prevPageBtn" class="btn ghost" type="button">Prev</button>
          <span id="pageInfo">File 1/1</span>
          <button id="nextPageBtn" class="btn ghost" type="button">Next</button>
        </div>
      </div>
      <div id="importScrollTop" class="scrollSyncTop">
        <div id="importScrollTopInner"></div>
      </div>
      <div class="tableWrap">
        <table>
          <thead id="importedCsvHead"></thead>
          <tbody id="importedCsvBody"></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="tableHead">
        <h2>Deleted Imported CSV Files</h2>
        <small id="deletedImportsMeta"></small>
      </div>
      <div class="tableHead">
        <input type="search" id="deletedImportsSearch" placeholder="Search deleted imported files..." />
      </div>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Source File</th>
              <th>Rows</th>
              <th>Imported At</th>
              <th>Deleted At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="deletedImportsBody"></tbody>
        </table>
      </div>
    </section>
  </main>

  <script src="imports.js"></script>
</body>
</html>
