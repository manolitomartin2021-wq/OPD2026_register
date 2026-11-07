import Dexie, { type Table } from 'dexie';
import type {
  Patient,
  PatientStatusHistory,
  Attendance,
  MonthlySequence,
  RNSequence,
  MonthStatus,
  MonthlySummary,
  RetenDefinition,
  User,
  AuditLog,
  ProfileCorrectionRequest,
  BackupHistory,
  ArchiveHistory,
  ArchiveReceipt,
  PurgeBatch,
} from '../types';

export interface SystemSettingRecord {
  key: string;
  value: any;
  updated_at: string;
}

export class JPLDatabase extends Dexie {
  patients!: Table<Patient, string>;
  patient_status_history!: Table<PatientStatusHistory, string>;
  attendances!: Table<Attendance, string>;
  monthly_sequences!: Table<MonthlySequence, string>;
  rn_sequences!: Table<RNSequence, string>;
  month_status!: Table<MonthStatus, string>;
  monthly_summaries!: Table<MonthlySummary, string>;
  reten_definitions!: Table<RetenDefinition, string>;
  users!: Table<User, string>;
  audit_logs!: Table<AuditLog, string>;
  profile_corrections!: Table<ProfileCorrectionRequest, string>;
  backup_history!: Table<BackupHistory, string>;
  archive_history!: Table<ArchiveHistory, string>;
  archive_receipts!: Table<ArchiveReceipt, string>;
  purge_batches!: Table<PurgeBatch, string>;
  system_settings!: Table<SystemSettingRecord, string>;

  constructor(dbName: string) {
    super(dbName);

    this.version(1).stores({
      patients:
        'patient_id, &no_rn, no_dokumen_normalized, no_pasport_normalized, nama_normalized, *nama_tokens, kewarganegaraan, status_pesakit, tarikh_kehadiran_terakhir, tarikh_lahir, tarikh_dicipta',
      patient_status_history: 'id, patient_id, tarikh',
      attendances:
        'attendance_id, &[tahun_bulan+nombor], patient_id, tarikh, [patient_id+tarikh], [tahun_bulan+kategori], no_daftar, status, arkib_status',
      monthly_sequences: 'tahun_bulan',
      rn_sequences: 'tahun',
      month_status: 'tahun_bulan, status',
      monthly_summaries: 'id, tahun_bulan, status, versi',
      reten_definitions: 'kod_indikator, disahkan_oleh',
      users: 'user_id, &username, role, aktif',
      audit_logs: 'audit_id, timestamp, tindakan, username',
      profile_corrections: 'id, patient_id, status, tarikh_mohon',
      backup_history: 'backup_id, tarikh, jenis, status_pengesahan',
      archive_history: 'archive_id, tahun_bulan, tarikh_arkib',
      archive_receipts: 'receipt_id, archive_id, tahun_bulan',
      purge_batches: 'batch_id, tarikh',
      system_settings: 'key',
    });

    this.version(2).stores({
      patients:
        'patient_id, &no_rn, no_dokumen_normalized, no_pasport_normalized, nama_normalized, *nama_tokens, kewarganegaraan, status_pesakit, tarikh_kehadiran_terakhir, tarikh_lahir, tarikh_dicipta',
      profile_corrections: 'id, patient_id, status, tarikh_mohon',
      archive_history: 'archive_id, tahun_bulan, tarikh_arkib',
      reten_definitions: 'kod_indikator, disahkan_oleh',
    });
  }
}

// Mod Ujian telah ditamatkan sepenuhnya untuk versi penerbitan rasmi (Production)
export function getActiveProfile(): 'SEBENAR' {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('JPL_PROFILE');
    } catch {
      // ignore
    }
  }
  return 'SEBENAR';
}

export function setActiveProfile(_profile?: string) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('JPL_PROFILE');
    } catch {
      // ignore
    }
  }
}

let dbInstance: JPLDatabase | null = null;
let currentDbName = '';

export function getDatabase(): JPLDatabase {
  const dbName = 'JPL_DALAT';

  if (!dbInstance || currentDbName !== dbName) {
    if (dbInstance) {
      dbInstance.close();
    }
    dbInstance = new JPLDatabase(dbName);
    currentDbName = dbName;
  }

  return dbInstance;
}
