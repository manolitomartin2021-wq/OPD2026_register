# PANDUAN PEMASANGAN & PENGGUNAAN (DEPLOYMENT GUIDE)
## JPL REGISTRATION SYSTEM V4.1-WEB
### Hospital Dalat, Bahagian Mukah, Sarawak (KKM)

Aplikasi ini dibina sebagai Progressive Web App (PWA) luar talian sepenuhnya (offline-first) yang berjalan pada satu PC kaunter menggunakan pelayar Google Chrome atau Microsoft Edge.

---

## 1. Keperluan Sistem & Alamat Tetap (Origin)

### A. Alamat Pelayar Tetap (PENTING)
Data pesakit disimpan dalam storan **IndexedDB** pelayar yang terikat ketat kepada **Origin (Protokol + Domain + Port)**.
Contoh:
- `https://jpl.hospitaldalat.gov.my` atau
- `http://localhost:3000`

> ⚠️ **PERATURAN MUTLAK:** Catat alamat asal yang digunakan semasa pemasangan pertama. Jangan tukar port atau nama domain, kerana IndexedDB tidak akan dapat diakses sekiranya origin berubah!

### B. Pelayar Disokong
- Google Chrome (versi 110+)
- Microsoft Edge (versi 110+)
- Sistem Pengoperasian: Windows 10 / Windows 11 (disyorkan BitLocker aktif)

---

## 2. Cara Menghidang & Pemasangan PWA

### Pilihan 1: Menghidang Tempatan pada PC Kaunter
1. Pasang Node.js LTS pada PC Kaunter.
2. Buka Command Prompt / PowerShell dalam folder projek:
   ```bash
   npm install
   npm run build
   npx serve -s dist -l 3000
   ```
3. Buka pelayar Chrome dan layari `http://localhost:3000`.

### Pilihan 2: Memasang Aplikasi Sebagai PWA (Standalone)
1. Buka aplikasi di Chrome atau Edge.
2. Tekan butang biru **"PASANG APLIKASI (PWA)"** pada bar atas aplikasi atau klik ikon muat turun pada bar alamat pelayar ("Install app").
3. Aplikasi akan dibuka dalam tetingkap tersendiri tanpa bar carian pelayar, kelihatan dan bertindak seperti aplikasi desktop native.
4. Aplikasi kini boleh dilancarkan terus dari desktop atau menu Start Windows walaupun tiada sambungan internet.

---

## 3. Cetakan Senyap Tanpa Dialog (Kiosk Printing)

Aplikasi web pelayar secara lalai memaparkan dialog cetakan Windows. Untuk membolehkan cetakan slip pantas tanpa dialog pada pencetak thermal kaunter:
1. Cipta pintasan (shortcut) Chrome pada Desktop.
2. Klik kanan pintasan -> **Properties** -> **Target**.
3. Tambah bendera `--kiosk-printing`:
   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=http://localhost:3000
   ```
4. Tetapkan pencetak thermal 80mm sebagai pencetak lalai (Default Printer) di Windows.
5. Apabila petugas menekan cetak slip, slip akan dicetak serta-merta tanpa dialog pengesahan.

---

## 4. Dasar Pelayar Menghalang Pemadaman Storan (Prevent Clear Browsing Data)

Untuk mengelakkan data IndexedDB terpadam secara tidak sengaja:
1. Semasa persediaan awal, aplikasi memanggil `navigator.storage.persist()`.
2. Pada Chrome/Edge, masuk ke:
   `chrome://settings/content/siteData`
3. Tambahkan alamat aplikasi ke dalam senarai: **"Sites allowed to save data on your device"**.
4. Dalam polisi Windows Group Policy (GPO) oleh unit ICT hospital:
   Lumpuhkan fungsi "Clear browsing data on exit" bagi profil kaunter pendaftaran.
