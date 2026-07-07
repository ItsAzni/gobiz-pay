import { GoPayMerchant } from "./client.js";
import { GoPayWatcher } from "./watcher.js";
import { buildDynamicQris } from "./qris.js";
import { loadEnv } from "./config.js";
import { ConfigError } from "./errors.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import QRCode from "qrcode";

const env = loadEnv();

async function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const isLoginCmd = process.argv.includes("login");
  const useOtp = process.argv.includes("--otp");
  const usePhone = process.argv.includes("--phone");
  const merchant = new GoPayMerchant();

  if (isLoginCmd) {
    if (usePhone) {
      const phone = await ask("Enter your phone number (e.g. 85123456789): ");
      console.log("Requesting OTP...");
      await merchant.requestPhoneOtp(phone);
      const otp = await ask("Enter the OTP sent to your phone: ");
      await merchant.loginWithPhone(otp);
      console.log("Phone OTP login successful.");
    } else if (useOtp) {
      console.log("Requesting OTP...");
      await merchant.requestLoginOtp();
      const otp = await ask("Enter the OTP sent to your email: ");
      await merchant.loginWithOtp(otp);
      console.log("OTP login successful.");
    } else {
      console.log("Authenticating to GoBiz...");
      try {
        await merchant.init();
        console.log("Authentication successful.");
      } catch (err: any) {
        console.error("Initialization failed:", err.message);
        process.exit(1);
      }
    }
    process.exit(0);
  }

  const qrisString = env.QRIS_STRING ?? process.env.QRIS_STRING;
  const amountArg = process.argv.find((arg) => !isNaN(Number(arg)) && arg !== "");
  const amount = parseInt(amountArg || process.env.PRICE_AMOUNT || "2000", 10);
  if (!qrisString) throw new ConfigError("QRIS_STRING not set in .env");

  console.log("Initializing merchant...");
  await merchant.init();

  console.log(`Payment amount: Rp ${amount.toLocaleString("id-ID")}`);
  const dynamicQris = buildDynamicQris(qrisString, amount);
  const qrTerminal = await QRCode.toString(dynamicQris, { type: "terminal", small: true });
  console.log(qrTerminal);
  console.log(`Scan the QRIS above to pay.\n  Amount: Rp ${amount.toLocaleString("id-ID")}\n  Payload: ${dynamicQris}`);

  const watcher = new GoPayWatcher(merchant, 1_000);

  watcher.on("error", (err: Error) => {
    console.error(`[GoPayWatcher] Error details:`, err);
  });

  const tx = await watcher.waitForPayment(amount, { timeout: 10 * 60_000, tolerance: 0 });
  console.log(`Payment received:\n  Amount        : Rp ${tx.amount.toLocaleString("id-ID")}\n  Transaction ID : ${tx.txId}`);
  process.exit(0);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
