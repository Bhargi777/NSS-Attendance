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
 * Sheets required (created automatically on first write if missing), one
 * pair per batch year (parsed from the roll number's trailing YYNNN):
 *   Log_24    / Totals_24  : roll_number | date | hours | scanned_at
 *   Log_25    / Totals_25    ...(same columns, one pair per KNOWN_BATCHES entry)
 *   Log_26    / Totals_26
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Batch years currently in the system. Add the new 2-digit year here each
// intake (e.g. push "27") — everything else derives from this list.
const KNOWN_BATCHES = ["24", "25", "26"];

// CB.SC.U4CSE24268 -> "24". Amrita roll numbers end in 2-digit intake year
// followed by a 3-digit serial; unrecognized/garbage rolls return null.
function parseBatch(rollNumber) {
  var m = /(\d{2})(\d{3})$/.exec(rollNumber);
  if (!m) return null;
  var yy = m[1];
  return KNOWN_BATCHES.indexOf(yy) === -1 ? null : yy;
}

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

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function getLogSheet(batch) {
  return getOrCreateSheet("Log_" + batch, ["roll_number", "date", "hours", "scanned_at"]);
}

function getTotalsSheet(batch) {
  return getOrCreateSheet("Totals_" + batch, ["roll_number", "total_hours", "last_date", "last_scanned_at"]);
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

  var batch = parseBatch(rollNumber);
  if (!batch) {
    return { success: false, code: "UNKNOWN_BATCH", message: "Unrecognized roll number: " + rollNumber };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var totalsSheet = getTotalsSheet(batch);
    var rowIndex = findRowByRollNumber(totalsSheet, rollNumber);

    if (rowIndex !== -1) {
      var existingLastDate = formatDate(totalsSheet.getRange(rowIndex, 3).getValue());
      if (existingLastDate === date) {
        return { success: false, code: "DUPLICATE_SCAN", message: rollNumber + " already scanned on " + date };
      }
    }

    var logSheet = getLogSheet(batch);
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
      data: { roll_number: rollNumber, total_hours: newTotal, last_date: date, batch: batch }
    };
  } finally {
    lock.releaseLock();
  }
}

function sheetExists(name) {
  return !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function handleListTotals() {
  var rows = [];
  KNOWN_BATCHES.forEach(function (batch) {
    if (!sheetExists("Totals_" + batch)) return;
    sheetToObjects(getTotalsSheet(batch)).forEach(function (r) {
      rows.push({
        roll_number: r.roll_number,
        total_hours: r.total_hours,
        last_date: formatDate(r.last_date),
        last_scanned_at: r.last_scanned_at,
        batch: batch
      });
    });
  });
  return { success: true, data: rows };
}

function handleDeleteEntry(body) {
  var rollNumber = String(body.rollNumber || "").trim().toUpperCase();
  if (!rollNumber) {
    return { success: false, message: "rollNumber is required" };
  }

  var batch = parseBatch(rollNumber);
  if (!batch) {
    return { success: false, code: "UNKNOWN_BATCH", message: "Unrecognized roll number: " + rollNumber };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var totalsSheet = getTotalsSheet(batch);
    var totalsRow = findRowByRollNumber(totalsSheet, rollNumber);
    if (totalsRow !== -1) totalsSheet.deleteRow(totalsRow);

    var logSheet = getLogSheet(batch);
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
    KNOWN_BATCHES.forEach(function (batch) {
      if (sheetExists("Log_" + batch)) {
        var logSheet = getLogSheet(batch);
        if (logSheet.getLastRow() > 1) {
          logSheet.getRange(2, 1, logSheet.getLastRow() - 1, logSheet.getLastColumn()).clearContent();
        }
      }
      if (sheetExists("Totals_" + batch)) {
        var totalsSheet = getTotalsSheet(batch);
        if (totalsSheet.getLastRow() > 1) {
          totalsSheet.getRange(2, 1, totalsSheet.getLastRow() - 1, totalsSheet.getLastColumn()).clearContent();
        }
      }
    });
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function handleListAll() {
  var log = [];
  var totals = [];
  KNOWN_BATCHES.forEach(function (batch) {
    if (sheetExists("Log_" + batch)) {
      sheetToObjects(getLogSheet(batch)).forEach(function (r) {
        log.push({ roll_number: r.roll_number, date: formatDate(r.date), hours: r.hours, batch: batch });
      });
    }
    if (sheetExists("Totals_" + batch)) {
      sheetToObjects(getTotalsSheet(batch)).forEach(function (r) {
        totals.push({ roll_number: r.roll_number, total_hours: r.total_hours, batch: batch });
      });
    }
  });
  return { success: true, data: { log: log, totals: totals } };
}

// ---------- One-off migration helper ----------
// Run manually from the Apps Script editor to split the legacy single
// Log/Totals tab pair into per-batch Log_YY/Totals_YY tabs. Safe to run
// only once — refuses if any Log_YY already has data rows. Rows whose roll
// number doesn't parse to a known batch are skipped and reported via
// Logger.log (View > Logs) instead of being written anywhere; fix those up
// by hand afterwards. Legacy Log/Totals tabs are left untouched — rename or
// delete them yourself once you've verified the split.
function migrateToBatchSheets() {
  var alreadyMigrated = KNOWN_BATCHES.some(function (batch) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log_" + batch);
    return sheet && sheet.getLastRow() > 1;
  });
  if (alreadyMigrated) {
    throw new Error("migrateToBatchSheets: a Log_YY sheet already has data — aborting to avoid duplicating rows.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var legacyLog = ss.getSheetByName("Log");
  if (!legacyLog) {
    throw new Error("migrateToBatchSheets: no legacy \"Log\" sheet found.");
  }

  var log = sheetToObjects(legacyLog);
  var rowsByBatch = {};
  var skipped = [];

  log.forEach(function (row) {
    var roll = String(row.roll_number || "").trim().toUpperCase();
    var batch = parseBatch(roll);
    if (!batch) {
      skipped.push(roll);
      return;
    }
    if (!rowsByBatch[batch]) rowsByBatch[batch] = [];
    rowsByBatch[batch].push({
      roll_number: roll,
      date: formatDate(row.date),
      hours: Number(row.hours) || 0,
      scanned_at: row.scanned_at
    });
  });

  Object.keys(rowsByBatch).forEach(function (batch) {
    var logSheet = getLogSheet(batch);
    var totalsByRoll = {};

    rowsByBatch[batch].forEach(function (row) {
      logSheet.appendRow([row.roll_number, row.date, row.hours, row.scanned_at]);

      if (!totalsByRoll[row.roll_number]) {
        totalsByRoll[row.roll_number] = { total_hours: 0, last_date: row.date };
      }
      totalsByRoll[row.roll_number].total_hours += row.hours;
      if (row.date > totalsByRoll[row.roll_number].last_date) {
        totalsByRoll[row.roll_number].last_date = row.date;
      }
    });

    var totalsSheet = getTotalsSheet(batch);
    Object.keys(totalsByRoll).forEach(function (roll) {
      var t = totalsByRoll[roll];
      totalsSheet.appendRow([roll, t.total_hours, t.last_date, new Date()]);
    });
  });

  if (skipped.length) {
    Logger.log("migrateToBatchSheets: skipped %s row(s) with unrecognized roll numbers: %s", skipped.length, skipped.join(", "));
  }
  Logger.log("migrateToBatchSheets: done. Batches written: %s", Object.keys(rowsByBatch).join(", ") || "(none)");
}
