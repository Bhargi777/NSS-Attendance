/**
 * NSS Attendance backend — Google Apps Script Web App.
 *
 * Deploy: Extensions > Apps Script in the target Spreadsheet, paste this file,
 * then Deploy > New deployment > Web app, Execute as "Me", Access "Anyone".
 *
 * Required Script Properties (Project Settings > Script Properties):
 *   PASSCODE      - the shared scanner passcode
 *   TOKEN_SECRET  - random string used to sign session tokens
 *
 * Sheets required (created automatically on first write if missing):
 *   Log    : roll_number | date | hours | scanned_at
 *   Totals : roll_number | total_hours | last_date | last_scanned_at
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function doPost(e) {
  var response;
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    // Reads are unauthenticated (dashboard is meant to be viewable without the
    // scanner passcode). Writes below require a valid session token.
    if (action === "verifyPasscode") {
      response = handleVerifyPasscode(body);
    } else if (action === "listTotals") {
      response = handleListTotals();
    } else if (action === "listAll") {
      response = handleListAll();
    } else {
      requireValidToken(body.token);
      if (action === "recordScan") {
        response = handleRecordScan(body);
      } else if (action === "deleteEntry") {
        response = handleDeleteEntry(body);
      } else if (action === "clearAll") {
        response = handleClearAll();
      } else {
        response = { success: false, message: "Unknown action" };
      }
    }
  } catch (err) {
    response = { success: false, message: String(err.message || err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Auth ----------

function handleVerifyPasscode(body) {
  var props = PropertiesService.getScriptProperties();
  var passcode = props.getProperty("PASSCODE");

  if (!body.passcode || body.passcode !== passcode) {
    return { success: false, message: "Invalid passcode" };
  }

  var expiry = Date.now() + TOKEN_TTL_MS;
  var token = expiry + "." + signPayload(String(expiry));
  return { success: true, token: token };
}

function requireValidToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Missing session token");
  }
  var parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed session token");
  }
  var expiry = parts[0];
  var signature = parts[1];

  if (signPayload(expiry) !== signature) {
    throw new Error("Invalid session token");
  }
  if (Date.now() > Number(expiry)) {
    throw new Error("Session expired");
  }
}

function signPayload(payload) {
  var secret = PropertiesService.getScriptProperties().getProperty("TOKEN_SECRET");
  var rawSignature = Utilities.computeHmacSha256Signature(payload, secret);
  return rawSignature.map(function (byte) {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
}

// ---------- Sheet helpers ----------

function getLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Log");
  if (!sheet) {
    sheet = ss.insertSheet("Log");
    sheet.appendRow(["roll_number", "date", "hours", "scanned_at"]);
  }
  return sheet;
}

function getTotalsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Totals");
  if (!sheet) {
    sheet = ss.insertSheet("Totals");
    sheet.appendRow(["roll_number", "total_hours", "last_date", "last_scanned_at"]);
  }
  return sheet;
}

function sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = values.slice(1);
  return rows
    .filter(function (row) { return row[0] !== "" && row[0] !== null; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (header, i) { obj[header] = row[i]; });
      return obj;
    });
}

function findRowByRollNumber(sheet, rollNumber) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === rollNumber) {
      return i + 1; // 1-indexed sheet row
    }
  }
  return -1;
}

function formatDate(d) {
  if (Object.prototype.toString.call(d) === "[object Date]") {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return d;
}

// ---------- Actions ----------

function handleRecordScan(body) {
  var rollNumber = String(body.rollNumber || "").trim().toUpperCase();
  var date = String(body.date || "");
  var hours = Number(body.hours || 0);

  if (!rollNumber || !date || !hours) {
    return { success: false, message: "rollNumber, date and hours are required" };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var totalsSheet = getTotalsSheet();
    var rowIndex = findRowByRollNumber(totalsSheet, rollNumber);

    if (rowIndex !== -1) {
      var existingLastDate = formatDate(totalsSheet.getRange(rowIndex, 3).getValue());
      if (existingLastDate === date) {
        return { success: false, code: "DUPLICATE_SCAN", message: rollNumber + " already scanned on " + date };
      }
    }

    var logSheet = getLogSheet();
    logSheet.appendRow([rollNumber, date, hours, new Date()]);

    var newTotal;
    if (rowIndex === -1) {
      newTotal = hours;
      totalsSheet.appendRow([rollNumber, newTotal, date, new Date()]);
    } else {
      var currentTotal = Number(totalsSheet.getRange(rowIndex, 2).getValue()) || 0;
      newTotal = currentTotal + hours;
      totalsSheet.getRange(rowIndex, 2, 1, 3).setValues([[newTotal, date, new Date()]]);
    }

    return {
      success: true,
      data: { roll_number: rollNumber, total_hours: newTotal, last_date: date }
    };
  } finally {
    lock.releaseLock();
  }
}

function handleListTotals() {
  var rows = sheetToObjects(getTotalsSheet()).map(function (r) {
    return {
      roll_number: r.roll_number,
      total_hours: r.total_hours,
      last_date: formatDate(r.last_date),
      last_scanned_at: r.last_scanned_at
    };
  });
  return { success: true, data: rows };
}

function handleDeleteEntry(body) {
  var rollNumber = String(body.rollNumber || "").trim().toUpperCase();
  if (!rollNumber) {
    return { success: false, message: "rollNumber is required" };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var totalsSheet = getTotalsSheet();
    var totalsRow = findRowByRollNumber(totalsSheet, rollNumber);
    if (totalsRow !== -1) totalsSheet.deleteRow(totalsRow);

    var logSheet = getLogSheet();
    var logValues = logSheet.getDataRange().getValues();
    for (var i = logValues.length - 1; i >= 1; i--) {
      if (logValues[i][0] === rollNumber) logSheet.deleteRow(i + 1);
    }

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function handleClearAll() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var logSheet = getLogSheet();
    if (logSheet.getLastRow() > 1) {
      logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).clearContent();
    }
    var totalsSheet = getTotalsSheet();
    if (totalsSheet.getLastRow() > 1) {
      totalsSheet.getRange(2, 1, totalsSheet.getLastRow() - 1, totalsSheet.getLastColumn()).clearContent();
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function handleListAll() {
  var log = sheetToObjects(getLogSheet()).map(function (r) {
    return { roll_number: r.roll_number, date: formatDate(r.date), hours: r.hours };
  });
  var totals = sheetToObjects(getTotalsSheet()).map(function (r) {
    return { roll_number: r.roll_number, total_hours: r.total_hours };
  });
  return { success: true, data: { log: log, totals: totals } };
}

// ---------- One-off migration helper ----------
// Run manually from the Apps Script editor after pasting exported Supabase
// `attendance` rows into the Log tab, to rebuild Totals from history.
function rebuildTotals() {
  var log = sheetToObjects(getLogSheet());
  var totalsByRoll = {};

  log.forEach(function (row) {
    var roll = row.roll_number;
    var date = formatDate(row.date);
    var hours = Number(row.hours) || 0;
    if (!totalsByRoll[roll]) {
      totalsByRoll[roll] = { total_hours: 0, last_date: date };
    }
    totalsByRoll[roll].total_hours += hours;
    if (date > totalsByRoll[roll].last_date) {
      totalsByRoll[roll].last_date = date;
    }
  });

  var totalsSheet = getTotalsSheet();
  totalsSheet.clear();
  totalsSheet.appendRow(["roll_number", "total_hours", "last_date", "last_scanned_at"]);
  Object.keys(totalsByRoll).forEach(function (roll) {
    var t = totalsByRoll[roll];
    totalsSheet.appendRow([roll, t.total_hours, t.last_date, new Date()]);
  });
}
