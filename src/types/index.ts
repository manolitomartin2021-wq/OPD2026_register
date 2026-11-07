export type UserRole = 'PENYELIA' | 'STAFF';

export type PatientStatus = 'AKTIF' | 'TIDAK AKTIF' | 'MENINGGAL' | 'DIGABUNG';

export type CreatedVia = 'IMPORT' | 'SISTEM';

export type Citizenship = 'WARGANEGARA' | 'BUKAN WARGANEGARA';

export type DocumentType =
  | 'MYKAD'
  | 'MYKID'
  | 'PASPORT'
  | 'MYPR'
  | 'POLIS/TENTERA'
  | 'TIADA DOKUMEN';

export type Gender = 'LELAKI' | 'PEREMPUAN';

export type AttendanceCategory =
  | 'FUP_RUTIN'
  | 'WALK_IN'
  | 'MEDICAL_CHECKUP'
  | 'PROCEDURE_ROOM';

export const CATEGORY_LABELS: Record<AttendanceCategory, string> = {
  FUP_RUTIN: 'F/UP RUTIN',
  WALK_IN: 'WALK-IN',
  MEDICAL_CHECKUP: 'MEDICAL CHECK UP',
  PROCEDURE_ROOM: 'PROCEDURE ROOM',
};

export type AttendanceStatus = 'SAH' | 'BATAL';

export type MonthLifecycleStatus = 'TERBUKA' | 'DITUTUP' | 'DIARKIB' | 'DIBERSIHKAN';

export type BackupType =
  | 'HARIAN'
  | 'MINGGUAN'
  | 'PRA_RESET'
  | 'PRA_RESTORE'
  | 'PRA_MIGRASI';

export type BackupVerifyStatus =
  | 'BELUM DISAHKAN'
  | 'DISAHKAN DI KAUNTER'
  | 'DISAHKAN DI PC PENYELIA'
  | 'GAGAL';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_GAGAL'
  | 'REGISTER'
  | 'EDIT'
  | 'CANCEL'
  | 'IMPORT'
  | 'EXPORT'
  | 'BACKUP'
  | 'VERIFY_BACKUP'
  | 'RESTORE'
  | 'ARCHIVE'
  | 'TUTUP_HARI'
  | 'TUTUP_BULAN'
  | 'PURGE'
  | 'EDIT_MASTER_PATIENT'
  | 'MERGE_PATIENT'
  | 'STATUS_AUTO'
  | 'PERMOHONAN_PEMBETULAN'
  | 'KUNCI_JAM'
  | 'UBAH_TETAPAN'
  | 'URUS_PENGGUNA'
  | 'PERINGATAN_BACKUP_DIPAPARKAN'
  | 'PERINGATAN_DITUNDA'
  | 'PERINGATAN_SELESAI';

export interface Patient {
  patient_id: string; // UUID
  no_rn: string; // Master RN (preserved exact)
  jenis_dokumen: DocumentType;
  no_dokumen: string;
  no_dokumen_normalized: string;
  nama_pesakit: string;
  nama_normalized: string;
  nama_tokens: string[]; // for multiEntry fast partial search
  jantina: Gender;
  tarikh_lahir: string; // YYYY-MM-DD
  etnik: string;
  kewarganegaraan: Citizenship;
  no_pasport: string;
  no_pasport_normalized: string;
  alamat: string;
  nombor_telefon: string;
  nama_waris: string;
  telefon_waris: string;
  status_pesakit: PatientStatus;
  tarikh_kehadiran_terakhir: string | null; // YYYY-MM-DD
  first_visit_date: string | null; // YYYY-MM-DD
  dicipta_melalui: CreatedVia;
  merged_into_patient_id: string | null;
  tarikh_dicipta: string;
  tarikh_dikemaskini: string;
  created_by: string;
  updated_by: string;
}

export interface PatientStatusHistory {
  id: string;
  patient_id: string;
  status_lama: PatientStatus;
  status_baharu: PatientStatus;
  sebab: 'AUTO_6BULAN' | 'HADIR_SEMULA' | 'MANUAL' | 'GABUNG';
  tarikh: string;
  user_id: string | null;
}

export interface Attendance {
  attendance_id: string; // UUID
  patient_id: string;
  tahun_bulan: string; // YYYY-MM
  nombor: number; // sequential within month
  no_daftar: string; // e.g. HDalat/0001
  kategori: AttendanceCategory;
  tarikh: string; // YYYY-MM-DD
  masa: string; // HH:mm:ss
  status: AttendanceStatus;
  pesakit_baharu: boolean;
  umur_tahun: number;
  kewarganegaraan: Citizenship;
  prev_last_visit_date: string | null;
  prev_first_visit_date: string | null;
  kemasukan_lewat: boolean;
  no_rujukan_manual?: string;
  catatan?: string;
  pengecualian_oleh?: string;
  sebab_pengecualian?: string;
  registered_by: string;
  created_at: string;
  updated_at: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  arkib_status: 'BELUM' | 'DIARKIB';
}

export interface MonthlySequence {
  tahun_bulan: string; // YYYY-MM
  last_number: number;
  updated_at: string;
}

export interface RNSequence {
  tahun: string; // YYYY
  last_number: number;
  updated_at: string;
}

export interface MonthStatus {
  tahun_bulan: string; // YYYY-MM
  status: MonthLifecycleStatus;
  tarikh_tutup: string | null;
  ditutup_oleh: string | null;
  tarikh_layak_bersih: string | null; // last day of month + 4 calendar months
  hardcopy_disahkan_oleh: string | null;
  hardcopy_disahkan_tarikh: string | null;
}

export interface MonthlySummary {
  id: string;
  tahun_bulan: string;
  versi: number;
  status: 'DRAF' | 'RASMI';
  data_json: {
    jumlah_kehadiran_sah: number;
    kategori_fup: number;
    kategori_walkin: number;
    kategori_checkup: number;
    kategori_procedure: number;
    pesakit_baharu: number;
    pesakit_sedia_ada: number;
    jumlah_batal: number;
    pesakit_unik: number;
    warganegara: number;
    bukan_warganegara: number;
    lelaki: number;
    perempuan: number;
    umur_bawah_12: number;
    umur_12_59: number;
    umur_60_keatas: number;
  };
  definisi_versi: string;
  dikira_pada: string;
  dikira_oleh: string;
}

export interface RetenDefinition {
  kod_indikator: string;
  nama: string;
  definisi: string;
  aktif: boolean;
  disahkan_oleh: string | null;
  tarikh_pengesahan: string | null;
}

export interface User {
  user_id: string;
  username: string;
  nama_penuh: string;
  role: UserRole;
  password_hash: string;
  salt: string;
  aktif: boolean;
  gagal_login: number;
  dikunci_hingga: string | null;
  wajib_tukar_password: boolean;
  last_login: string | null;
  created_at: string;
}

export interface AuditLog {
  audit_id: string;
  user_id: string;
  username: string;
  role: UserRole;
  tindakan: AuditAction;
  modul: string;
  record_id: string | null;
  nilai_lama: string | null;
  nilai_baharu: string | null;
  sebab: string | null;
  timestamp: string;
  prev_hash: string;
  row_hash: string;
}

export interface ProfileCorrectionRequest {
  id: string;
  patient_id: string;
  medan: string;
  nilai_lama: string;
  nilai_baharu: string;
  sebab: string;
  dimohon_oleh: string;
  tarikh_mohon: string;
  status: 'MENUNGGU' | 'DILULUSKAN' | 'DITOLAK';
  diproses_oleh?: string;
  tarikh_proses?: string;
  catatan_penyelia?: string;
}

export interface BackupHistory {
  backup_id: string;
  tarikh: string;
  masa: string;
  nama_fail: string;
  jenis: BackupType;
  tempoh_mula: string;
  tempoh_tamat: string;
  jumlah_pesakit: number;
  jumlah_kehadiran: number;
  jumlah_pembatalan: number;
  saiz_fail: number;
  checksum_sha256: string;
  destinasi: string;
  status_pengesahan: BackupVerifyStatus;
  performed_by: string;
  app_version: string;
  schema_version: number;
}

export interface ArchiveHistory {
  archive_id: string;
  tahun_bulan: string;
  jumlah_rekod: number;
  jumlah_pesakit: number;
  nama_fail: string;
  checksum: string;
  tarikh_arkib: string;
  salinan_1_lokasi: string;
  salinan_2_lokasi: string;
  salinan_2_disahkan: boolean;
  status_arkib: 'LENGKAP' | 'RALAT';
  disahkan_oleh: string;
  versi_arkib: number;
}

export interface ArchiveReceipt {
  receipt_id: string;
  archive_id: string;
  tahun_bulan: string;
  jumlah_rekod: number;
  checksum: string;
  hmac_sah: boolean;
  diimport_pada: string;
  diimport_oleh: string;
}

export interface PurgeBatch {
  batch_id: string;
  bulan_dibersihkan: string[];
  jumlah_rekod_dipadam: number;
  backup_pra_reset_id: string;
  diluluskan_oleh: string;
  tarikh: string;
  hasil: 'BERJAYA' | 'DIBATALKAN' | 'GAGAL';
  laporan: string;
}

export interface SystemSettings {
  hospital_name: string;
  application_name: string;
  timezone: string;
  mod_pemasangan: 'MOD_KAUNTER' | 'MOD_PENYELIA_ARKIB';
  profil: 'SEBENAR' | 'UJIAN';
  last_known_timestamp: string;
  tempoh_auto_lock: number; // in minutes (2 - 15)
  printer_settings: 'A4' | 'THERMAL_80MM';
  peringatan_hari: number; // 5 = Friday
  peringatan_masa: string; // '16:00'
  peringatan_tunda_minit: number; // 30
  peringatan_status_minggu_iso?: string; // YYYY-Wxx marked as done
  salinan_kedua_arkib_lokasi?: string;
  recovery_key_hash?: string;
  recovery_key_salt?: string;
}

export interface ActiveSession {
  user_id: string;
  username: string;
  nama_penuh: string;
  role: UserRole;
  login_at: string;
  last_activity: number;
  is_locked: boolean;
  backup_passphrase?: string; // stored strictly in memory during session
}

export type TextSize = 'biasa' | 'besar' | 'sangat_besar';
