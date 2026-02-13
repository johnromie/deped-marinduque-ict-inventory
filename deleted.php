<?php
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deleted Records - DepEd Marinduque</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="govBanner">
    <img src="assets/top.webp" alt="DepEd Marinduque Header" />
  </div>

  <header class="topbar">
    <div>
      <h1>Deleted Records</h1>
      <p>Restore deleted inventory and imported CSV files</p>
    </div>
    <div class="topbarActions">
      <a href="index.php" class="btn ghost">Back to Inventory</a>
      <a href="imports.php" class="btn ghost">Back to Imported CSV</a>
      <span id="whoami" class="pill hidden"></span>
      <button id="logoutBtn" class="btn ghost hidden">Logout</button>
    </div>
  </header>

  <main class="page">
    <section class="panel">
      <div class="tableHead">
        <h2>Deleted Inventory Items</h2>
        <small id="deletedItemsMeta"></small>
      </div>
      <div class="tableHead">
        <input type="search" id="deletedItemsSearch" placeholder="Search deleted inventory..." />
      </div>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Property No</th>
              <th>Item</th>
              <th>Category</th>
              <th>Serial No</th>
              <th>Location</th>
              <th>Deleted At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="deletedItemsBody"></tbody>
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

  <script src="deleted.js"></script>
</body>
</html>
