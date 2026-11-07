# PANDUAN BACKUP, RESTORE & PEMULIHAN BENCANA
## JPL REGISTRATION SYSTEM V4.1-WEB
### Hospital Dalat, Sarawak

---

## 1. Seni Bina Backup & Kriptografi

- **Algoritma:** AES-256-GCM.
- **Kunci Terbitan:** PBKDF2-SHA256 (310,000 lelaran WebCrypto) dengan salt rawak 16-bait.
- **Integriti Data:** Checksum SHA-256 dan rantaian hash audit.
- **Format Fail:**
  - `JPL_BACKUP_YYYY-MM-DD_YYYY-Wxx_NN.jplbak`: Payload data bersulit.
  - `...manifest.json`: Metadata pengesahan (bilangan pesakit, kehadiran, pembatalan, checksum, app_version).

---

## 2. Prosedur Mingguan Penyelia (Jumaat 16:00)

1. Jam 16:00 hari Jumaat, sistem memaparkan sepanduk peringatan.
2. Penyelia menekan butang **"BUAT BACKUP MINGGUAN SEKARANG"**.
3. Masukkan frasa laluan backup rasmi.
4. Muat turun fail `.jplbak` dan `.manifest.json`.
5. Salin fail ke pemacu kilat USB yang dikhaskan.
6. Bawa USB ke PC Penyelia (MOD PENYELIA-ARKIB) dan buka menu **Backup & Verify**.
7. Tekan **"SAHKAN FAIL (VERIFY)"**, pilih fail dan masukkan frasa laluan.
8. Pastikan status bertukar menjadi: **DISAHKAN DI PC PENYELIA**.

---

## 3. Prosedur Pemulihan Bencana (Disaster Recovery)

Sekiranya PC kaunter rosak fizikal atau profil pelayar terpadam:
1. Sediakan PC kaunter baharu yang dipasang Google Chrome / Microsoft Edge.
2. Akses aplikasi pada **ALAMAT KEKAL YANG SAMA** (cth: `http://localhost:3000`).
3. Pada halaman persediaan awal, pilih **PULIHKAN DARI BACKUP** atau log masuk Penyelia dan buka menu **Backup & Verify -> PULIHKAN (RESTORE)**.
4. Pilih fail `.jplbak` terkini dan masukkan frasa laluan backup.
5. **Perlindungan Nombor Giliran:**
   Masukkan nombor HDalat tertinggi yang telah dicetak pada slip fizikal sebelum kerosakan berlaku. Sistem akan menaikkan jujukan nombor seterusnya melepasi nombor tersebut bagi mengelakkan nombor berulang.
6. Sahkan dengan kata laluan Penyelia. Seluruh data Master Patient Database, pendaftaran, dan audit akan dipulihkan secara atomik.
