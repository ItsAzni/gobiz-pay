import crc from "crc";
import QRCode from "qrcode";
import { QrisError } from "./errors.js";

export function convertCRC16(str: string): string {
  const hex = crc.crc16ccitt(Buffer.from(str, "utf8")).toString(16).toUpperCase();
  return ("0000" + hex).slice(-4);
}

export function buildDynamicQris(staticQris: string, amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new QrisError("Amount must be a positive number.");
  }

  let rawBase = staticQris;
  if (staticQris.slice(-8, -4) === "6304") {
    rawBase = staticQris.slice(0, -4);
  }

  const step1 = rawBase.replace("010211", "010212");
  if (!step1.includes("5802ID")) {
    throw new QrisError("Invalid QRIS format — ensure QRIS_STRING is correct.");
  }

  const [before, after] = step1.split("5802ID");
  const nominalField = "54" + String(amount.toString().length).padStart(2, "0") + amount;

  let crcPayload = before + nominalField + "5802ID" + after;
  if (!crcPayload.endsWith("6304")) {
    crcPayload += "6304";
  }

  return crcPayload + convertCRC16(crcPayload);
}

export async function generateQrisImage(qrisString: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(qrisString, { scale: 8, errorCorrectionLevel: "M" });
  return Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
}
