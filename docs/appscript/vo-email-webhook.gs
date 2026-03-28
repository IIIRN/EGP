var DEFAULT_EMAIL_WEBHOOK_SECRET = "egp_vo_mail_7fK29xPqLm82ZtA4nR1s";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || "{}");
    var scriptPropertySecret = PropertiesService.getScriptProperties().getProperty("EMAIL_WEBHOOK_SECRET");
    var expectedSecret = scriptPropertySecret || DEFAULT_EMAIL_WEBHOOK_SECRET;
    var effectiveUserEmail = "";
    var remainingQuotaBefore = null;

    try {
      effectiveUserEmail = Session.getEffectiveUser().getEmail() || "";
    } catch (sessionError) {
      Logger.log("Cannot read Session.getEffectiveUser(): " + sessionError);
    }

    try {
      remainingQuotaBefore = MailApp.getRemainingDailyQuota();
    } catch (quotaError) {
      Logger.log("Cannot read MailApp quota: " + quotaError);
    }

    Logger.log("Incoming payload: " + JSON.stringify({
      to: payload.to || "",
      subject: payload.subject || "",
      senderName: payload.senderName || "",
      includeAttachment: Boolean(payload.includeAttachment),
      debugCc: payload.debugCc || "",
      metadata: payload.metadata || null,
      effectiveUserEmail: effectiveUserEmail,
      remainingQuotaBefore: remainingQuotaBefore,
      hasScriptPropertySecret: Boolean(scriptPropertySecret),
      usingFallbackSecret: !scriptPropertySecret
    }));

    if (!expectedSecret) {
      return jsonResponse({ success: false, error: "Missing EMAIL_WEBHOOK_SECRET and fallback secret" }, 500);
    }

    if (payload.secret !== expectedSecret) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    if (!payload.to || !payload.subject) {
      return jsonResponse({ success: false, error: "Missing to or subject" }, 400);
    }

    var mailOptions = {
      to: payload.to,
      subject: payload.subject,
      body: payload.textBody || "",
      htmlBody: payload.htmlBody || "",
      name: payload.senderName || "EGP System"
    };

    Logger.log("Using sender name: " + mailOptions.name);

    if (payload.replyTo) {
      mailOptions.replyTo = payload.replyTo;
    }

    if (payload.debugCc) {
      mailOptions.cc = payload.debugCc;
    }

    if (payload.includeAttachment && payload.attachment) {
      var attachmentBlob = createVoPdfAttachment(payload.attachment);
      Logger.log("Attachment created: " + attachmentBlob.getName() + " | bytes=" + attachmentBlob.getBytes().length);
      mailOptions.attachments = [attachmentBlob];
    }

    MailApp.sendEmail(mailOptions);

    Logger.log("Email sent to: " + payload.to + (payload.debugCc ? (" | cc: " + payload.debugCc) : ""));

    var sentSearchCount = null;
    try {
      var escapedSubject = String(payload.subject || "").replace(/"/g, '\\"');
      var searchQuery = 'in:sent newer_than:2d subject:"' + escapedSubject + '"';
      var sentThreads = GmailApp.search(searchQuery, 0, 10);
      sentSearchCount = sentThreads.length;
      Logger.log("Gmail sent search query: " + searchQuery + " | matched threads=" + sentSearchCount);
    } catch (gmailError) {
      Logger.log("Cannot inspect Gmail sent items: " + gmailError);
    }

    var remainingQuotaAfter = null;
    try {
      remainingQuotaAfter = MailApp.getRemainingDailyQuota();
      Logger.log("Remaining quota after send: " + remainingQuotaAfter);
    } catch (quotaAfterError) {
      Logger.log("Cannot read MailApp quota after send: " + quotaAfterError);
    }

    return jsonResponse({
      success: true,
      to: payload.to,
      subject: payload.subject,
      metadata: payload.metadata || null,
      debug: {
        senderName: mailOptions.name,
        effectiveUserEmail: effectiveUserEmail,
        remainingQuotaBefore: remainingQuotaBefore,
        remainingQuotaAfter: remainingQuotaAfter,
        sentSearchCount: sentSearchCount,
        debugCc: payload.debugCc || ""
      }
    }, 200);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error && error.message ? error.message : String(error)
    }, 500);
  }
}

function jsonResponse(data, status) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function createVoPdfAttachment(attachment) {
  if (attachment.contentBase64) {
    return Utilities.newBlob(
      Utilities.base64Decode(attachment.contentBase64),
      attachment.mimeType || MimeType.PDF,
      attachment.fileName || "VO.pdf"
    );
  }

  var fileName = attachment.fileName || "VO.pdf";
  var vo = attachment.vo || {};
  var project = attachment.project || {};
  var company = attachment.company || {};
  var items = Array.isArray(vo.items) ? vo.items : [];

  var doc = DocumentApp.create(fileName.replace(/\.pdf$/i, ""));
  var body = doc.getBody();

  if (company.name) {
    body.appendParagraph(company.name).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  } else {
    body.appendParagraph("Variation Order").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  }

  if (company.address) body.appendParagraph(company.address);
  if (company.phone || company.email) {
    body.appendParagraph("โทร: " + (company.phone || "-") + " | Email: " + (company.email || "-"));
  }

  body.appendParagraph("");
  body.appendParagraph("ใบสั่งเปลี่ยนแปลงงาน (VO)").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("เลขที่เอกสาร: " + (vo.voNumber || "-"));
  body.appendParagraph("เรื่อง: " + (vo.title || "-"));
  body.appendParagraph("โครงการ: " + (project.name || "-"));
  body.appendParagraph("ผู้ติดต่อโครงการ: " + (project.contactName || "-") + " (" + (project.contactEmail || "-") + ")");
  body.appendParagraph("วันที่เอกสาร: " + (vo.createdAt || "-"));
  body.appendParagraph("เหตุผล: " + (vo.reason || "-"));
  body.appendParagraph("");

  var tableData = [];
  tableData.push(["ลำดับ", "ประเภท", "รายละเอียด", "จำนวน", "หน่วย", "ราคา/หน่วย", "ผลกระทบงบ"]);

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    tableData.push([
      String(item.no || i + 1),
      String(item.type || "-"),
      String(item.description || "-"),
      String(item.quantity || "-"),
      String(item.unit || "-"),
      String(item.unitPrice || "-"),
      String(item.amount || "-")
    ]);
  }

  var table = body.appendTable(tableData);
  table.getRow(0).editAsText().setBold(true);

  body.appendParagraph("");
  body.appendParagraph("สรุปมูลค่า");
  body.appendParagraph("รวมก่อน VAT: " + (vo.subTotal || "-"));
  body.appendParagraph("VAT " + (vo.vatRate || "-") + ": " + (vo.vatAmount || "-"));
  body.appendParagraph("รวมทั้งสิ้น: " + (vo.totalAmount || "-")).setBold(true);

  doc.saveAndClose();

  var file = DriveApp.getFileById(doc.getId());
  var pdfBlob = file.getAs(MimeType.PDF).setName(fileName);
  file.setTrashed(true);

  return pdfBlob;
}
