# ANDAIAN DAN TETAPAN LALAI SISTEM (ASSUMPTIONS.MD)
## JPL REGISTRATION SYSTEM V4.1-WEB
### Hospital Dalat, Bahagian Mukah, Sarawak

Dokumen ini merekodkan semua nilai lalai yang diguna pakai selaras dengan **Bahagian 29 Master Prompt**:

1. **Format No. RN Baharu:** `HD-RN/YYYY/NNNN` (contoh: `HD-RN/2026/0001`), bermula semula daripada 0001 setiap 1 Januari. Urutan disimpan dalam jadual `rn_sequences`.
2. **Format No. Giliran Bulanan:** `HDalat/NNNN` (contoh: `HDalat/0001`), bermula semula daripada 0001 setiap 1 haribulan. Nombor yang dikeluarkan tidak pernah dikitar semula walaupun dibatalkan.
3. **Format Reten Rasmi KKM:** Formula reten rasmi Kementerian Kesihatan Malaysia (KKM) disimpan dalam jadual `reten_definitions` dengan tanda "DRAF – DEFINISI BELUM DISAHKAN" sehingga disemak dan disahkan oleh Penyelia Hospital Dalat.
4. **Kewarganegaraan & Pasport:** Medan kewarganegaraan adalah WAJIB. Bagi Bukan Warganegara, No. Pasport dan Tarikh Lahir adalah WAJIB. Bagi Warganegara Malaysia, No. Pasport tidak diperlukan.
5. **Senarai Rujukan Etnik:** Lalai merangkumi etnik Sarawak iaitu Melanau, Iban, Melayu, Cina, Bidayuh, Orang Ulu, India, dan Lain-lain. Boleh diubah oleh Penyelia dalam Tetapan.
6. **Dasar Keselamatan Sesi:** Auto-lock selepas 5 minit tiada aktiviti; kata laluan minimum 8 aksara mengandungi huruf dan nombor; 5 percubaan gagal mencetuskan kunci 5 minit.
7. **Pencetak:** Menyokong format A4 Standard dan Thermal 80mm melalui pemacu pencetak Windows.
8. **Peringatan Salin Data:** Hari Jumaat jam 16:00 (Asia/Kuching), tempoh tunda 30 minit.
9. **Saiz Teks Paparan:** Tetapan lalai adalah "Besar" (20 px) dengan pilihan "Biasa" (18 px) dan "Sangat Besar" (24 px) untuk keselesaan staf veteran.
10. **Kelulusan Hospital:** Penggunaan data pesakit sebenar tertakluk kepada kelulusan Pengarah Hospital Dalat dan unit ICT KKM.
