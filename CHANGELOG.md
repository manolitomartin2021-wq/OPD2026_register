# LOG PERUBAHAN (CHANGELOG)
## JPL REGISTRATION SYSTEM – HOSPITAL DALAT, SARAWAK

### Versi 4.1-WEB (Google AI Studio Build) - November 2026
- **Seni Bina Web PWA Luar Talian (Offline-First):**
  - Menggantikan versi desktop Electron dengan aplikasi web React + TypeScript + Vite + Tailwind CSS.
  - Storan tempatan menggunakan IndexedDB (Dexie) dengan transaksi atomik berbilang store.
  - Kriptografi WebCrypto standard: PBKDF2-SHA256 (310,000 lelaran), AES-256-GCM, SHA-256, dan HMAC-SHA256.
  - Pengesanan dan sekatan satu tetingkap (single-instance) melalui Web Locks API.
- **Master Patient Database Kekal:**
  - Tiada pemadaman pesakit induk secara automatik.
  - Carian pantas berbilang indeks (RN, MyKad, Pasport, Nama dengan MultiEntry tokens).
  - Status automatik 6 bulan (AKTIF ke TIDAK AKTIF) dan pengaktifan semula automatik apabila hadir mendaftar.
- **Pendaftaran 4 Kategori Sahaja:**
  - F/UP Rutin, Walk-In, Medical Check Up, dan Procedure Room dengan 4 butang gergasi mesra veteran.
  - Penomboran jujukan tahunan `HD-RN/YYYY/NNNN` dan bulanan `HDalat/NNNN`.
  - Mod Kemasukan Lewat untuk gangguan kuasa elektrik / kerosakan PC.
  - Perlindungan jam sistem komputer terhadap pengunduran masa.
- **Backup & Pembersihan Terkawal 4 Bulan:**
  - Peringatan salin data setiap hari Jumaat jam 16:00 dengan notifikasi dan tunda 30 minit.
  - Fail backup `.jplbak` dan manifest disahkan melalui fungsi in-app VERIFY.
  - Arkib digital `.jplarc` dengan resit tandatangan HMAC-SHA256.
  - Four-Month Controlled Purge dengan semakan 8 prasyarat keselamatan ketat.
- **Reka Bentuk UI Mesra Veteran:**
  - Saiz fon asas 18px - 24px dengan butang penskalaan pantas A- / A+.
  - Kontras tinggi dan palet warna lembut tidak menyilaukan mata (#2F5D8A, #F4F7FA).
