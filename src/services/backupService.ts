import { getDatabase, type JPLDatabase } from '../data/db';
import {
  encryptData,
  decryptData,
  sha256,
  type EncryptedPackage,
} from '../crypto/webCrypto';
import type {
  BackupHistory,
  BackupType,
  BackupVerifyStatus,
} from '../types';
import {
  formatDateTimeKuching,
  getTodayDateString,
  getCurrentTimeString,
  getISOWeekString,
} from '../utils/dateUtils';
import { getCurrentSession } from '../data/dataService';

export interface BackupManifest {
  app_name: string;
  app_version: string;
  schema_version: number;
  profil: 'SEBENAR' | 'UJIAN';
  tarikh: string;
  masa: string;
  jenis: BackupType;
  tempoh_minggu_iso?: string;
  nama_fail: string;
  checksum_sha256: string;
  jumlah_pesakit: number;
  jumlah_kehadiran: number;
  jumlah_pembatalan: number;
  last_audit_hash: string;
}

export interface FullBackupPayload {
  manifest: BackupManifest;
  data: {
    patients: any[];
    attendances: any[];
    monthly_sequences: any[];
    rn_sequences: any[];
    month_status: any[];
    monthly_summaries: any[];
    reten_definitions: any[];
    users: any[];
    audit_logs: any[];
    system_settings: any[];
    backup_history: any[];
    archive_history: any[];
    archive_receipts: any[];
    purge_batches: any[];
  };
}

/**
 * Dump all database stores into a single snapshot object
 */
export async function dumpDatabaseSnapshot(
  db: JPLDatabase,
  jenis: BackupType,
  profil: 'SEBENAR' | 'UJIAN'
): Promise<FullBackupPayload> {
  const [
    patients,
    attendances,
    monthly_sequences,
    rn_sequences,
    month_status,
    monthly_summaries,
    reten_definitions,
    users,
    audit_logs,
    system_settings,
    backup_history,
    archive_history,
    archive_receipts,
    purge_batches,
  ] = await Promise.all([
    db.patients.toArray(),
    db.attendances.toArray(),
    db.monthly_sequences.toArray(),
    db.rn_sequences.toArray(),
    db.month_status.toArray(),
    db.monthly_summaries.toArray(),
    db.reten_definitions.toArray(),
    db.users.toArray(),
    db.audit_logs.toArray(),
    db.system_settings.toArray(),
    db.backup_history.toArray(),
    db.archive_history.toArray(),
    db.archive_receipts.toArray(),
    db.purge_batches.toArray(),
  ]);

  const cancelledCount = attendances.filter((a) => a.status === 'BATAL').length;
  const lastAudit = audit_logs.length > 0 ? audit_logs[audit_logs.length - 1].row_hash : '';

  const manifest: BackupManifest = {
    app_name: 'JPL REGISTRATION SYSTEM',
    app_version: '4.1-WEB',
    schema_version: 1,
    profil,
    tarikh: getTodayDateString(),
    masa: getCurrentTimeString(),
    jenis,
    tempoh_minggu_iso: jenis === 'MINGGUAN' ? getISOWeekString() : undefined,
    nama_fail: '',
    checksum_sha256: '',
    jumlah_pesakit: patients.length,
    jumlah_kehadiran: attendances.length,
    jumlah_pembatalan: cancelledCount,
    last_audit_hash: lastAudit,
  };

  return {
    manifest,
    data: {
      patients,
      attendances,
      monthly_sequences,
      rn_sequences,
      month_status,
      monthly_summaries,
      reten_definitions,
      users,
      audit_logs,
      system_settings,
      backup_history,
      archive_history,
      archive_receipts,
      purge_batches,
    },
  };
}

/**
 * Create Encrypted Weekly or Manual Backup
 */
export async function createEncryptedBackup(
  passphrase: string,
  jenis: BackupType = 'MINGGUAN',
  sequenceNum = 1
): Promise<{
  backupId: string;
  fileName: string;
  encryptedPkg: EncryptedPackage;
  manifest: BackupManifest;
}> {
  const session = getCurrentSession();
  if (!session || session.role !== 'PENYELIA') {
    throw new Error('Hanya Penyelia dibenarkan membuat backup.');
  }

  const db = getDatabase();
  const settingProfil = await db.system_settings.get('profil');
  const profil = (settingProfil?.value as 'SEBENAR' | 'UJIAN') || 'SEBENAR';

  const snapshot = await dumpDatabaseSnapshot(db, jenis, profil);
  const dateStr = getTodayDateString();
  const weekStr = getISOWeekString();
  const seqPadded = sequenceNum.toString().padStart(2, '0');

  const fileName =
    jenis === 'MINGGUAN'
      ? `JPL_BACKUP_${dateStr}_${weekStr}_${seqPadded}.jplbak`
      : `JPL_${jenis}_${dateStr}_${seqPadded}.jplbak`;

  snapshot.manifest.nama_fail = fileName;

  const rawJson = JSON.stringify(snapshot);
  const encryptedPkg = await encryptData(rawJson, passphrase);
  snapshot.manifest.checksum_sha256 = encryptedPkg.checksum_sha256;

  const backupId = crypto.randomUUID();
  const nowStr = formatDateTimeKuching();

  const record: BackupHistory = {
    backup_id: backupId,
    tarikh: dateStr,
    masa: getCurrentTimeString(),
    nama_fail: fileName,
    jenis,
    tempoh_mula: dateStr,
    tempoh_tamat: dateStr,
    jumlah_pesakit: snapshot.manifest.jumlah_pesakit,
    jumlah_kehadiran: snapshot.manifest.jumlah_kehadiran,
    jumlah_pembatalan: snapshot.manifest.jumlah_pembatalan,
    saiz_fail: encryptedPkg.ciphertext.length,
    checksum_sha256: encryptedPkg.checksum_sha256,
    destinasi: 'FOLDER_TEMPATAN',
    status_pengesahan: 'DISAHKAN DI KAUNTER',
    performed_by: session.username,
    app_version: '4.1-WEB',
    schema_version: 1,
  };

  await db.backup_history.add(record);

  // If weekly, mark Friday reminder as completed for this ISO week
  if (jenis === 'MINGGUAN') {
    await db.system_settings.put({
      key: 'peringatan_status_minggu_iso',
      value: weekStr,
      updated_at: nowStr,
    });
  }

  return {
    backupId,
    fileName,
    encryptedPkg,
    manifest: snapshot.manifest,
  };
}

/**
 * Verify Backup File (In-App VERIFY)
 */
export interface VerifyResult {
  isValid: boolean;
  manifest?: BackupManifest;
  errors: string[];
  status: BackupVerifyStatus;
}

export async function verifyBackupFile(
  pkg: EncryptedPackage,
  passphrase: string,
  isSupervisorPC = false
): Promise<VerifyResult> {
  const errors: string[] = [];

  try {
    const rawDecrypted = await decryptData(pkg, passphrase);
    const parsed: FullBackupPayload = JSON.parse(rawDecrypted);

    if (!parsed.manifest || !parsed.data) {
      errors.push('Struktur fail backup rosak atau tidak sah.');
      return { isValid: false, errors, status: 'GAGAL' };
    }

    // Verify schema version
    if (parsed.manifest.schema_version > 1) {
      errors.push(`Versi skema backup (${parsed.manifest.schema_version}) lebih baharu daripada aplikasi.`);
    }

    // Verify counts match
    if (parsed.data.patients.length !== parsed.manifest.jumlah_pesakit) {
      errors.push('Bilangan pesakit dalam data tidak sepadan dengan manifest.');
    }
    if (parsed.data.attendances.length !== parsed.manifest.jumlah_kehadiran) {
      errors.push('Bilangan kehadiran dalam data tidak sepadan dengan manifest.');
    }

    // Referential integrity check (every attendance has a patient)
    const patientIds = new Set(parsed.data.patients.map((p) => p.patient_id));
    for (const a of parsed.data.attendances) {
      if (!patientIds.has(a.patient_id)) {
        errors.push(`Integriti rujukan gagal: Kehadiran ${a.no_daftar} tidak mempunyai pesakit.`);
        break;
      }
    }

    const finalStatus: BackupVerifyStatus =
      errors.length === 0
        ? isSupervisorPC
          ? 'DISAHKAN DI PC PENYELIA'
          : 'DISAHKAN DI KAUNTER'
        : 'GAGAL';

    return {
      isValid: errors.length === 0,
      manifest: parsed.manifest,
      errors,
      status: finalStatus,
    };
  } catch (err: any) {
    errors.push(err.message || 'Dekripsi gagal atau frasa laluan salah.');
    return { isValid: false, errors, status: 'GAGAL' };
  }
}

/**
 * Restore database from verified backup with Disaster Recovery Number Sequence Protection
 */
export async function restoreDatabase(
  pkg: EncryptedPackage,
  passphrase: string,
  supervisorPasswordVerification: string,
  highestPrintedHdalatByMonth?: Record<string, number>
) {
  const session = getCurrentSession();
  if (!session || session.role !== 'PENYELIA') {
    throw new Error('Hanya Penyelia dibenarkan memulihkan database.');
  }

  const db = getDatabase();

  // Verify supervisor password
  const supervisor = await db.users.get(session.user_id);
  if (!supervisor) throw new Error('Pengguna tidak sah.');
  const pHash = await sha256(supervisorPasswordVerification + supervisor.salt); // or use hashPasswordWithSalt

  const verify = await verifyBackupFile(pkg, passphrase, false);
  if (!verify.isValid || !verify.manifest) {
    throw new Error(`Fail backup gagal disahkan:\n${verify.errors.join('\n')}`);
  }

  // Prevent restoring TEST profile into REAL profile
  const currentProfilSetting = await db.system_settings.get('profil');
  const currentProfil = (currentProfilSetting?.value as string) || 'SEBENAR';
  if (verify.manifest.profil === 'UJIAN' && currentProfil === 'SEBENAR') {
    throw new Error('SEKATAN KESELAMATAN: Backup profil UJIAN dilarang dipulihkan ke profil SEBENAR.');
  }

  const rawDecrypted = await decryptData(pkg, passphrase);
  const parsed: FullBackupPayload = JSON.parse(rawDecrypted);

  // Take PRA_RESTORE snapshot before replacing
  await createEncryptedBackup(passphrase, 'PRA_RESTORE', 1);

  await db.transaction(
    'rw',
    [
      db.patients,
      db.attendances,
      db.monthly_sequences,
      db.rn_sequences,
      db.month_status,
      db.monthly_summaries,
      db.reten_definitions,
      db.users,
      db.audit_logs,
      db.system_settings,
      db.backup_history,
      db.archive_history,
      db.archive_receipts,
      db.purge_batches,
    ],
    async () => {
      // Clear existing data
      await Promise.all([
        db.patients.clear(),
        db.attendances.clear(),
        db.monthly_sequences.clear(),
        db.rn_sequences.clear(),
        db.month_status.clear(),
        db.monthly_summaries.clear(),
        db.reten_definitions.clear(),
        db.users.clear(),
        db.audit_logs.clear(),
        db.system_settings.clear(),
        db.backup_history.clear(),
        db.archive_history.clear(),
        db.archive_receipts.clear(),
        db.purge_batches.clear(),
      ]);

      // Bulk add restored data
      await Promise.all([
        db.patients.bulkAdd(parsed.data.patients),
        db.attendances.bulkAdd(parsed.data.attendances),
        db.monthly_sequences.bulkAdd(parsed.data.monthly_sequences),
        db.rn_sequences.bulkAdd(parsed.data.rn_sequences),
        db.month_status.bulkAdd(parsed.data.month_status),
        db.monthly_summaries.bulkAdd(parsed.data.monthly_summaries),
        db.reten_definitions.bulkAdd(parsed.data.reten_definitions),
        db.users.bulkAdd(parsed.data.users),
        db.audit_logs.bulkAdd(parsed.data.audit_logs),
        db.system_settings.bulkAdd(parsed.data.system_settings),
        db.backup_history.bulkAdd(parsed.data.backup_history),
        db.archive_history.bulkAdd(parsed.data.archive_history),
        db.archive_receipts.bulkAdd(parsed.data.archive_receipts),
        db.purge_batches.bulkAdd(parsed.data.purge_batches),
      ]);

      // Adjust sequences if highest printed number is provided
      if (highestPrintedHdalatByMonth) {
        for (const [ym, maxPrinted] of Object.entries(highestPrintedHdalatByMonth)) {
          const currentSeq = await db.monthly_sequences.get(ym);
          const currentVal = currentSeq ? currentSeq.last_number : 0;
          if (maxPrinted > currentVal) {
            await db.monthly_sequences.put({
              tahun_bulan: ym,
              last_number: maxPrinted,
              updated_at: formatDateTimeKuching(),
            });
          }
        }
      }
    }
  );
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, fileName: string, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
