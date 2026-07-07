# gobiz-pay

SDK/Modul TypeScript untuk berinteraksi dengan API GoBiz (GoPay Merchant). Memungkinkan pengambilan riwayat transaksi, pemantauan pembayaran masuk secara real-time (polling), serta pembuatan QRIS dinamis.

## Fitur Utama

- **Autentikasi Fleksibel**: Mendukung login berbasis password maupun passwordless (OTP email/nomor HP).
- **Manajemen Sesi Otomatis**: Kredensial disimpan terenkripsi secara lokal di direktori kerja (`.gobiz-cache.json`).
- **QRIS Dinamis**: Memformat payload QRIS statis menjadi dinamis berdasarkan nominal transaksi.
- **Real-time Monitoring**: Memantau pembayaran masuk dengan mekanisme polling yang toleran terhadap perbedaan nominal bayar.

## Persyaratan Sistem

- Node.js >= 18
- Akun Merchant GoBiz aktif
- QRIS statis merchant (untuk pembentukan QRIS dinamis)

## Instalasi

```bash
npm install gobiz-pay
```

## Konfigurasi

Buat file `.env` pada root direktori proyek Anda:

```env
GOPAY_EMAIL=email@merchant.com
GOPAY_PASSWORD=password_merchant
QRIS_STRING=0002010102112657...
```

*Catatan: Token autentikasi dan ID Merchant akan disimpan otomatis dalam `.gobiz-cache.json` untuk menghindari proses login berulang.*

---

## Panduan Penggunaan

### 1. Autentikasi (Login)

#### Menggunakan Kredensial `.env` (Email & Password)
```ts
import { GoPayMerchant } from "gobiz-pay";

const merchant = new GoPayMerchant();
await merchant.init(); // Otomatis melakukan autentikasi & inisialisasi sesi
```

#### Menggunakan OTP (Email / Nomor HP)
```ts
import { GoPayMerchant } from "gobiz-pay";

const merchant = new GoPayMerchant();

// Pilihan A: OTP via Email
await merchant.requestLoginOtp();
await merchant.loginWithOtp("123456");

// Pilihan B: OTP via Nomor HP
await merchant.requestPhoneOtp("85123456789"); // Default kode negara "62"
await merchant.loginWithPhone("123456");
```

---

### 2. Riwayat Transaksi

```ts
const result = await merchant.getHistory({ days: 1, size: 20 });

if (result.status && result.data) {
  for (const tx of result.data.histories) {
    console.log(`${tx.time} - ${tx.amount.displayed_text}`);
  }
} else {
  console.log(result.message || "Transaksi tidak ditemukan.");
}
```

#### Parameter `getHistory`:
| Parameter | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `days` | `number` | `1` | Jangkauan hari penarikan data ke belakang |
| `size` | `number` | `50` | Jumlah maksimal transaksi yang diambil |

---

### 3. Pemantauan Pembayaran Masuk

Gunakan watcher singleton untuk memantau pembayaran masuk secara real-time:

```ts
import { getGoPayWatcher } from "gobiz-pay";

const watcher = getGoPayWatcher();

try {
  // Menunggu pembayaran Rp 50.000 dengan batas waktu 5 menit dan toleransi selisih Rp 100
  const tx = await watcher.waitForPayment(50000, { 
    timeout: 300_000, 
    tolerance: 100 
  });
  console.log(`Pembayaran Diterima! ID: ${tx.txId}, Nominal: Rp ${tx.amount}`);
} catch (error) {
  console.error("Gagal mendeteksi pembayaran:", error.message);
}
```

#### Parameter `waitForPayment`:
| Parameter | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `amount` | `number` | *Wajib* | Nominal pembayaran yang ditunggu |
| `timeout` | `number` | `300000` | Batas waktu pemantauan dalam milidetik (ms) |
| `tolerance` | `number` | `0` | Toleransi perbedaan selisih nominal transaksi |

---

### 4. Membuat QRIS Dinamis

```ts
import { buildDynamicQris } from "gobiz-pay";

const payloadDinamis = buildDynamicQris(process.env.QRIS_STRING!, 50000);
```

---

## CLI Demo

Proyek menyediakan utilitas CLI untuk menguji alur secara langsung.

### Langkah 1: Login & Simpan Sesi
Pilih salah satu perintah login untuk mendapatkan token:
```bash
# Login menggunakan GOPAY_EMAIL & GOPAY_PASSWORD dari .env
npm run demo -- login

# Login interaktif menggunakan OTP Email
npm run demo -- login --otp

# Login interaktif menggunakan OTP Nomor HP
npm run demo -- login --phone
```

### Langkah 2: Buat QRIS & Pantau Pembayaran
Setelah sesi tersimpan, jalankan pemantauan transaksi:
```bash
# Membuat QRIS Rp 50.000 dan memantau status pembayaran masuk
npm run demo -- 50000
```

---

## Lisensi

[MIT License](LICENSE)
