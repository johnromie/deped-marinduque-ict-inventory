<?php
// Simple ICT Inventory System for DepEd Marinduque
// Stack: PHP + SQLite + vanilla JS frontend

declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DepEd Marinduque ICT Inventory</title>
  <link rel="stylesheet" href="style.css?v=20260213h" />
</head>
<body class="pageIndex">
  <div class="govBanner">
    <img src="assets/top.webp" alt="DepEd Marinduque Header" />
  </div>

  <header class="topbar">
    <div>
      <h1>ICT Inventory Management System</h1>
      <p>Schools Division of Marinduque</p>
    </div>
    <div class="topbarActions">
      <a href="inventory.php" id="inventoryNavBtn" class="btn btnInventoryNav hidden">Inventory List</a>
      <span id="whoami" class="pill hidden"></span>
      <button id="logoutBtn" class="btn ghost hidden">Logout</button>
    </div>
  </header>

  <main class="page">
    <section id="loginSection" class="panel authPanel loginHeroPanel">
      <div class="loginHeroHead">
        <h2>Login Account</h2>
        <p>Secure access for DepEd Marinduque ICT inventory users.</p>
      </div>
      <div class="loginBadgeRow">
        <span class="loginBadge">Division ICT</span>
        <span class="loginBadge">Inventory Tracking</span>
      </div>
      <form id="loginForm">
        <label>Username
          <input id="username" type="text" required placeholder="ICT" />
        </label>
        <label>Password
          <input id="password" type="password" required placeholder="admin" />
        </label>
        <button type="submit" class="btn primary">Sign In</button>
      </form>
      <p class="hint">Default account: <code>ICT / admin</code></p>
    </section>

    <section id="appSection" class="hidden">
      <div class="layout">
        <section class="panel addUpdatePanel">
          <h2>Add / Update Item</h2>
          <form id="inventoryForm">
            <input type="hidden" id="itemId" />

            <h3 class="formSectionTitle">Equipment Details</h3>
            <div class="formGrid3">
              <label>Property Number
                <input type="text" id="propertyNo" placeholder="Enter property number (can be blank if not assigned yet)" />
              </label>
              <label>Item Name
                <input type="text" id="itemName" list="itemOptions" required placeholder="Type or select item name" />
              </label>
              <label>Category
                <select id="category" required>
                  <option value="">Select category</option>
                </select>
              </label>
              <label>Brand / Model
                <input type="text" id="brandModel" list="brandModelOptions" required placeholder="Type or select brand/model" />
              </label>
              <label>Serial Number
                <input type="text" id="serialNo" required placeholder="SN-12345" />
              </label>
              <label>Office / School
                <input type="text" id="location" list="locationOptions" required placeholder="Type or select office/school" />
              </label>
              <label>Assigned To
                <input type="text" id="assignedTo" placeholder="Assigned person" />
              </label>
              <label>Condition
                <select id="condition" required>
                  <option value="">Select condition</option>
                </select>
              </label>
              <label>Date Acquired
                <input type="date" id="acquiredDate" />
              </label>
            </div>

            <label>Remarks
              <textarea id="remarks" rows="2" placeholder="Any notes"></textarea>
            </label>

            <datalist id="itemOptions">
              <option value="Desktop (package)"></option>
              <option value="Laptop"></option>
              <option value="Scanner"></option>
              <option value="Projector"></option>
              <option value="Mouse"></option>
              <option value="UPS"></option>
              <option value="Multifunction Printer"></option>
              <option value="Printer"></option>
              <option value="Monitor"></option>
              <option value="Keyboard"></option>
              <option value="Webcam"></option>
            </datalist>

            <datalist id="brandModelOptions">
              <option value="Lenovo"></option>
              <option value="LENOVO (SYSTEM X310 M5)"></option>
              <option value="MSI"></option>
              <option value="Epson"></option>
              <option value="Acer"></option>
              <option value="EPSON WorkForce DS-530"></option>
              <option value="Epson EB-X52"></option>
              <option value="Acer Aspire Go 15"></option>
              <option value="Intel Core i5 1355U"></option>
              <option value="Intel Core i7 Ryzen 7"></option>
            </datalist>

            <datalist id="locationOptions">
              <option value="School Division Office"></option>
              <option value="Division Office"></option>
              <option value="Boac North District"></option>
              <option value="Boac South District"></option>
              <option value="Gasan District"></option>
              <option value="Mogpog District"></option>
              <option value="Santa Cruz District"></option>
              <option value="Torrijos District"></option>
            </datalist>

            <h3 class="formSectionTitle">Warranty & Equipment Condition</h3>
            <div class="formGrid3">
              <label class="inlineCheck blockCheck">
                <input type="checkbox" id="underWarranty" />
                <span>Under Warranty</span>
              </label>
              <label>End of Warranty Date
                <input type="date" id="endWarrantyDate" />
              </label>
              <label>Equipment Location
                <input type="text" id="equipmentLocation" placeholder="Equipment location" />
              </label>
              <label class="inlineCheck blockCheck">
                <input type="checkbox" id="nonFunctional" />
                <span>Non-Functional</span>
              </label>
              <label>Equipment Condition
                <select id="equipmentCondition">
                  <option value="">Select Equipment Condition</option>
                  <option>Serviceable</option>
                  <option>Working</option>
                  <option>For Repair</option>
                  <option>Unserviceable</option>
                  <option>Condemned</option>
                  <option>Disposed</option>
                </select>
              </label>
              <label>Accountability/Disposition Status
                <select id="accountabilityStatus">
                  <option value="">Select Accountability/Disposition Status</option>
                  <option>Normal</option>
                  <option>Transferred</option>
                  <option>Disposed</option>
                  <option>Lost</option>
                </select>
              </label>
            </div>

            <h3 class="formSectionTitle">Assignment Details (Initial/New Receipt)</h3>
            <div class="formGrid3">
              <label>Accountable Officer
                <input type="text" id="accountableOfficer" placeholder="Accountable officer" />
              </label>
              <label>Date Assigned to Officer
                <input type="date" id="dateAssignedOfficer" />
              </label>
              <label>Custodian/End User
                <input type="text" id="custodianEndUser" placeholder="Custodian / end user" />
              </label>
              <label>Date Assigned to Custodian
                <input type="date" id="dateAssignedCustodian" />
              </label>
            </div>

            <h3 class="formSectionTitle">DCP Information</h3>
            <div class="formGrid3">
              <label class="inlineCheck blockCheck">
                <input type="checkbox" id="nonDcp" />
                <span>Non-DCP</span>
              </label>
              <label>DCP Package
                <select id="dcpPackage">
                  <option value="">Select DCP Package</option>
                  <option>Batch 2019</option>
                  <option>Batch 2020</option>
                  <option>Batch 2021</option>
                  <option>Batch 2022</option>
                  <option>Batch 2023</option>
                  <option>Batch 2024</option>
                </select>
              </label>
              <label>DCP Year Package
                <input type="text" id="dcpYearPackage" placeholder="YYYY" />
              </label>
            </div>

            <h3 class="formSectionTitle">Classification & Coding</h3>
            <div class="formGrid3">
              <label>Classification
                <input type="text" id="classification" placeholder="Classification" />
              </label>
              <label>GL-SL Code
                <input type="text" id="glSlCode" placeholder="GL-SL Code" />
              </label>
              <label>UACS
                <input type="text" id="uacs" placeholder="UACS" />
              </label>
            </div>

            <h3 class="formSectionTitle">Acquisition Details</h3>
            <div class="formGrid3">
              <label>Acquisition Cost
                <input type="text" id="acquisitionCost" placeholder="Acquisition cost" />
              </label>
              <label>Acquisition/Retrieved Date
                <input type="date" id="acquisitionRetrievedDate" />
              </label>
              <label>Estimated Useful Life (years)
                <input type="text" id="estimatedUsefulLife" placeholder="e.g. 5 years" />
              </label>
              <label>Mode of Acquisition
                <select id="modeAcquisition">
                  <option value="">Select Mode of Acquisition</option>
                  <option>DepEd Purchase</option>
                  <option>Donation</option>
                  <option>Transfer</option>
                  <option>Others</option>
                </select>
              </label>
              <label>Source of Acquisition
                <select id="sourceAcquisition">
                  <option value="">Select Source of Acquisition</option>
                  <option>School Division Office</option>
                  <option>Regional Office</option>
                  <option>Central Office</option>
                  <option>LGU</option>
                  <option>Private Donor</option>
                </select>
              </label>
              <label>Donor
                <input type="text" id="donor" placeholder="Donor" />
              </label>
              <label>Source of Funds
                <select id="sourceFunds">
                  <option value="">Select Source of Funds</option>
                  <option>General Fund (GF)</option>
                  <option>SEF</option>
                  <option>Donation/Grant</option>
                  <option>Other Funds</option>
                </select>
              </label>
              <label>Allotment Class
                <select id="allotmentClass">
                  <option value="">Select Allotment Class</option>
                  <option>Maintenance and Other Operating Expenses</option>
                  <option>Capital Outlay</option>
                </select>
              </label>
              <label>PMP Reference Item Number
                <input type="text" id="pmpReferenceItemNumber" placeholder="PMP reference item number" />
              </label>
            </div>

            <h3 class="formSectionTitle">Supporting Documents</h3>
            <div class="formGrid3">
              <label>Supporting Documents (Reference Item)
                <select id="supportingDocuments">
                  <option value="">Select Supporting Documents</option>
                  <option>Property Acknowledgment Receipt (PAR)</option>
                  <option>Inventory Custodian Slip (ICS)</option>
                  <option>Requisition and Issue Slip (RIS)</option>
                </select>
              </label>
              <label>PAR/ICS/RRSP/RS/WMR Number
                <input type="text" id="parIcsRrspRsWmrNumber" placeholder="Reference number" />
              </label>
              <label>Supplier/Distributor
                <input type="text" id="supplierDistributor" placeholder="Supplier/Distributor" />
              </label>
              <label>Transaction Type
                <select id="transactionType">
                  <option value="">Select Transaction Type</option>
                  <option>Beginning Inventory</option>
                  <option>Issuance</option>
                  <option>Transfer</option>
                  <option>Return</option>
                  <option>Disposal</option>
                </select>
              </label>
              <label>Supporting Documents (Transaction)
                <select id="supportingDocumentsTransaction">
                  <option value="">Select Supporting Documents (Transaction)</option>
                  <option>PAR</option>
                  <option>ICS</option>
                  <option>RRSP</option>
                  <option>RS</option>
                  <option>WMR</option>
                </select>
              </label>
            </div>

            <div class="actions">
              <button type="submit" class="btn primary">Save Item</button>
              <button type="button" id="cancelEditBtn" class="btn ghost hidden">Cancel Edit</button>
            </div>
          </form>

          <hr />

          <h2>Account Security</h2>
          <form id="changePasswordForm">
            <label>Current Password
              <input id="currentPassword" type="password" required />
            </label>
            <label>New Password
              <input id="newPassword" type="password" required minlength="8" />
            </label>
            <label>Confirm New Password
              <input id="confirmPassword" type="password" required minlength="8" />
            </label>
            <button type="submit" class="btn secondary">Change Password</button>
          </form>
        </section>

      </div>
    </section>
  </main>

  <script src="app.js?v=20260213h"></script>
</body>
</html>



