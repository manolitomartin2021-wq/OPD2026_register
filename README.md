# JPL REGISTRATION SYSTEM (Hospital Dalat, Sarawak)
## Versi 4.1-WEB · Kementerian Kesihatan Malaysia (KKM)

Aplikasi web Progressive Web App (PWA) luar talian sepenuhnya (offline-first) untuk kaunter pendaftaran Jabatan Pesakit Luar (JPL), Hospital Dalat, Bahagian Mukah, Sarawak.

---

## 🌟 Ciri-Ciri Utama

1. **Operasi Luar Talian 100% (Offline-First PWA):**
   - Tidak memerlukan internet untuk operasi pendaftaran harian.
   - PWA Service Worker dan Web App Manifest membolehkan aplikasi dipasang sebagai program tersendiri pada Windows.
   - Menggunakan storan IndexedDB pelayar dengan transaksi atomik berbilang store.

2. **Master Patient Database Kekal:**
   - Rekod pesakit induk tidak pernah dipadam oleh sebarang proses automatik.
   - Format nombor RN sedia ada dipelihara tepat seperti asal.
   - Penjanaan nombor RN baharu tahunan: `HD-RN/YYYY/NNNN`.
   - Status automatik 6 bulan (pertukaran ke `TIDAK AKTIF` dan kembali `AKTIF` apabila mendaftar).

3. **Pendaftaran 4 Kategori Sahaja:**
   - **F/UP RUTIN** (Rawatan ulangan)
   - **WALK-IN** (Hadir terus)
   - **MEDICAL CHECK UP** (Pemeriksaan kesihatan)
   - **PROCEDURE ROOM** (Rawatan luka/prosedur)
   - Penomboran giliran bulanan: `HDalat/NNNN`.

4. **Reka Bentuk UI Mesra Staf Veteran:**
   - Saiz teks asas besar (18 px - 24 px) dengan suis penskalaan pantas A− / A+.
   - Warna lembut tidak menyilaukan mata (#2F5D8A, #F4F7FA) dengan nisbah kontras teks 7:1.
   - Sasaran klik besar (48px - 56px) dan sokongan pintasan papan kekunci (F1 - F4).

5. **Backup Bersulit & Peringatan Jumaat 4.00 Petang:**
   - Kriptografi WebCrypto: AES-256-GCM dan PBKDF2-SHA256 (310,000 lelaran).
   - Notifikasi peringatan salin data setiap hari Jumaat jam 16:00 dengan butang tunda 30 minit.
   - Pengesahan fail in-app (VERIFY) sebelum diarkibkan.

6. **Pembersihan Terkawal Selepas Genap 4 Bulan (Four-Month Controlled Purge):**
   - Hanya bulan penuh berstatus `DIARKIB` yang melepasi genap 4 bulan kalendar boleh dibersihkan.
   - Disahkan melalui 8 semakan prasyarat keselamatan dan kelulusan Penyelia.

---

## 🛠️ Arahan Pemasangan & Menjalankan Aplikasi

```bash
# Pasang semua kebergantungan
npm install

# Uji dan bina kod aplikasi
npm run build

# Jalankan pelayan dev tempatan pada port 3000
npm run dev
```

---

## 📚 Dokumentasi Berkaitan

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Panduan pemasangan, alamat tetap origin, dan cetakan kiosk.
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) - Panduan pentadbir, had keselamatan, dan pembersihan 4 bulan.
- [USER_GUIDE.md](./USER_GUIDE.md) - Panduan operasi harian untuk petugas kaunter.
- [BACKUP_RESTORE_GUIDE.md](./BACKUP_RESTORE_GUIDE.md) - Panduan backup, verifikasi, dan pemulihan bencana.
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) - Senarai andaian dan tetapan lalai sistem.
- [CHANGELOG.md](./CHANGELOG.md) - Rekod versi dan penambahbaikan.
