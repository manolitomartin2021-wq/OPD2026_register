# PANDUAN PENTADBIR & PENYELIA (ADMIN GUIDE)
## JPL REGISTRATION SYSTEM V4.1-WEB
### Hospital Dalat, Bahagian Mukah, Sarawak (KKM)

---

## 1. Had Keselamatan Pelayar (Browser Security Boundaries)

Mengikut **Bahagian 4.8 Master Prompt**, had keselamatan dinyatakan secara telus:
- Aplikasi web tanpa pelayan pusat berjalan sepenuhnya dalam pelayar pengguna. Kawalan capaian (RBAC) dikuatkuasakan secara ketat di dalam **lapisan servis data tunggal** (`dataService.ts`). UI tidak boleh berhubung terus dengan storan.
- Pengguna teknikal yang membuka DevTools pelayar boleh membaca atau mengubah IndexedDB.
- **Langkah Mitigasi Diwajibkan:**
  1. Akaun Windows Terhad (Standard User) untuk petugas kaunter pada PC kaunter.
  2. Profil pelayar khusus untuk aplikasi JPL, tanpa akses ke internet awam.
  3. Mengaktifkan BitLocker Drive Encryption pada pemacu PC.
  4. Audit Log berantai hash (`row_hash = SHA-256(data + prev_hash)`) untuk mengesan sebarang pengubahan manual di luar aplikasi.
  5. Membuat salinan backup mingguan bersulit ke PC Penyelia.

---

## 2. Kunci Pemulihan (Emergency Recovery Key)

1. Semasa persediaan awal, satu Kunci Pemulihan Kecemasan 24 aksara dijana.
2. Hash kunci disimpan dalam storan selamat (`PBKDF2-SHA256`).
3. Cetak slip kunci pemulihan dan masukkan ke dalam sampul berlakri.
4. Simpan di dalam peti besi pejabat Penyelia / Penyelia Hospital Dalat.
5. Digunakan jika kedua-dua akaun Penyelia terlupa kata laluan atau terkunci.

---

## 3. Peringatan Mingguan Setiap Jumaat 4.00 Petang

1. Setiap hari Jumaat jam 16:00 (Asia/Kuching), sistem akan memaparkan sepanduk dan notifikasi peringatan salin data.
2. Penyelia perlu memilih **BUAT BACKUP MINGGUAN SEKARANG**.
3. Masukkan frasa laluan backup. Sistem akan menjana:
   - Fail data bersulit: `JPL_BACKUP_YYYY-MM-DD_YYYY-Wxx_NN.jplbak`
   - Fail manifest: `...manifest.json`
4. Pindahkan fail ke PC Penyelia melalui pemacu kilat USB yang diluluskan ICT hospital.
5. Jalankan fungsi **VERIFY** di PC Penyelia untuk mengesahkan integriti sebelum menyimpan fail dalam arkib.

---

## 4. Penutupan Bulan & Pembersihan Terkawal 4 Bulan

### Langkah Penutupan Bulan:
1. Pada akhir bulan kalendar, Penyelia membuka menu **Laporan Reten**.
2. Pastikan semua hari mempunyai pengesahan Tutup Hari.
3. Tekan butang **TUTUP BULAN INI**. Sistem akan membekukan ringkasan bulanan secara kekal ke dalam `monthly_summaries` dan mengira tarikh kelayakan pembersihan.

### Langkah Pembersihan 4 Bulan (Four-Month Controlled Purge):
Pembersihan data kehadiran HANYA dibenarkan selepas genap 4 bulan kalendar (cth: bulan November 2026 layak selepas 30 Mac 2027) dan SEMUA 8 prasyarat dipenuhi:
1. Status bulan ialah `DIARKIB`.
2. Hardcopy reten telah dicetak dan ditandatangani.
3. Backup pasca-penutupan telah disahkan di PC Penyelia.
4. Resit Arkib sah dengan HMAC yang sepadan.
5. Salinan kedua arkib telah disahkan di lokasi berasingan.
6. Tiada transaksi tergantung.
7. Semakan integriti data lulus.
8. Backup mingguan terkini tidak melebihi 10 hari.

> 🛡️ **PERHATIAN:** Master Patient Database, nombor RN, urutan HDalat, ringkasan bulanan dan audit log **TIDAK PERNAH DIPADAM**. Hanya rekod transaksi kehadiran bulan berkaitan yang dibersihkan.
