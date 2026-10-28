import test from "node:test";
import assert from "node:assert/strict";

import {
  getStorageUploadErrorMessage,
  getSupportedDocumentMimeType
} from "./fileUpload.js";

test("accepts supported document MIME types", () => {
  assert.equal(getSupportedDocumentMimeType({ type: "image/jpeg", name: "photo.jpg" }), "image/jpeg");
  assert.equal(getSupportedDocumentMimeType({ type: "image/png", name: "photo.png" }), "image/png");
  assert.equal(getSupportedDocumentMimeType({ type: "application/pdf", name: "document.pdf" }), "application/pdf");
});

test("uses a supported extension when mobile browsers omit the MIME type", () => {
  assert.equal(getSupportedDocumentMimeType({ type: "", name: "receipt.JPG" }), "image/jpeg");
  assert.equal(getSupportedDocumentMimeType({ type: "application/octet-stream", name: "document.pdf" }), "application/pdf");
  assert.equal(getSupportedDocumentMimeType({ type: "", name: "photo.webp" }), "image/webp");
});

test("rejects unsupported MIME types and extensions", () => {
  assert.equal(getSupportedDocumentMimeType({ type: "image/heic", name: "photo.heic" }), null);
  assert.equal(getSupportedDocumentMimeType({ type: "", name: "archive.zip" }), null);
  assert.equal(
    getSupportedDocumentMimeType({ type: "", name: "photo.webp" }, new Set(["image/jpeg", "image/png"])),
    null
  );
});

test("explains storage permission, size, and format errors", () => {
  assert.match(getStorageUploadErrorMessage({ statusCode: "403" }), /MFA/);
  assert.match(getStorageUploadErrorMessage({ statusCode: "413" }), /5 MB/);
  assert.match(getStorageUploadErrorMessage({ statusCode: "415" }), /JPG\/PNG/);
});
