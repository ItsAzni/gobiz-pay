# gobiz-pay

TypeScript SDK/module for interacting with the GoBiz (GoPay Merchant) API. It supports fetching transaction history, monitoring incoming payments in real-time (via polling), and generating dynamic QRIS payloads.

## Key Features

- **Flexible Authentication**: Supports both password-based and passwordless (Email/Phone OTP) login.
- **Automatic Session Management**: Credentials and session tokens are securely cached locally in the working directory (`.gobiz-cache.json`).
- **Dynamic QRIS Generation**: Formats static QRIS payloads into dynamic QRIS based on transaction amounts.
- **Real-Time Monitoring**: Monitors incoming payments via a polling mechanism with customizable amount tolerances.

## System Requirements

- Node.js >= 18
- An active GoBiz Merchant Account
- Merchant's static QRIS string (for dynamic QRIS generation)

## Installation

```bash
npm install gobiz-pay
```

## Configuration

Create a `.env` file in the root of your project:

```env
GOPAY_EMAIL=email@merchant.com
GOPAY_PASSWORD=password_merchant
QRIS_STRING=0002010102112657...
```

*Note: Session tokens and Merchant IDs are cached automatically in `.gobiz-cache.json` in the current working directory to avoid re-authentication.*

---

## Usage Guide

### 1. Authentication (Login)

#### Using Credentials from `.env` (Email & Password)
```ts
import { GoPayMerchant } from "gobiz-pay";

const merchant = new GoPayMerchant();
await merchant.init(); // Authenticates and initializes the session automatically
```

#### Using OTP (Email / Phone Number)
```ts
import { GoPayMerchant } from "gobiz-pay";

const merchant = new GoPayMerchant();

// Option A: OTP via Email
await merchant.requestLoginOtp();
await merchant.loginWithOtp("123456");

// Option B: OTP via Phone Number
await merchant.requestPhoneOtp("85123456789"); // Defaults to country code "62"
await merchant.loginWithPhone("123456");
```

---

### 2. Transaction History

```ts
const result = await merchant.getHistory({ days: 1, size: 20 });

if (result.status && result.data) {
  for (const tx of result.data.histories) {
    console.log(`${tx.time} - ${tx.amount.displayed_text}`);
  }
} else {
  console.log(result.message || "No transactions found.");
}
```

#### `getHistory` Options:
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `days` | `number` | `1` | Range of days in the past to fetch transaction history |
| `size` | `number` | `50` | Maximum number of transaction records to retrieve |

---

### 3. Monitoring Incoming Payments

Use the shared watcher singleton to monitor incoming payments in real-time:

```ts
import { getGoPayWatcher } from "gobiz-pay";

const watcher = getGoPayWatcher();

try {
  // Waits for an IDR 50,000 payment with a 5-minute timeout and an IDR 100 tolerance
  const tx = await watcher.waitForPayment(50000, { 
    timeout: 300_000, 
    tolerance: 100 
  });
  console.log(`Payment Received! ID: ${tx.txId}, Amount: IDR ${tx.amount.toLocaleString("en-US")}`);
} catch (error) {
  console.error("Failed to detect payment:", error.message);
}
```

#### `waitForPayment` Options:
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `amount` | `number` | *Required* | Expected transaction amount (IDR) |
| `timeout` | `number` | `300000` | Timeout threshold in milliseconds (ms) |
| `tolerance` | `number` | `0` | Expected amount deviation tolerance (IDR) |

---

### 4. Generating Dynamic QRIS

```ts
import { buildDynamicQris } from "gobiz-pay";

const dynamicPayload = buildDynamicQris(process.env.QRIS_STRING!, 50000);
```

---

## CLI Demo

The project includes a CLI utility for testing the payment workflow directly.

### Step 1: Authenticate and Save Session
Run one of the login commands to generate and cache your token:
```bash
# Login using GOPAY_EMAIL & GOPAY_PASSWORD from .env
npm run demo -- login

# Interactive login using Email OTP
npm run demo -- login --otp

# Interactive login using Phone OTP
npm run demo -- login --phone
```

### Step 2: Generate QRIS & Watch Payment
Once authenticated, you can initiate a transaction:
```bash
# Generates an IDR 50,000 QRIS and monitors the payment status in real-time
npm run demo -- 50000
```

---

## License

[MIT License](LICENSE)
