import { getDatabase } from '../data/db';
import {
  encryptData,
  decryptData,
  generateHmac,
  verifyHmac,
  type EncryptedPackage,
} from '../crypto/webCrypto';
import type {
  ArchiveHistory,
  ArchiveReceipt,
  Attendance,
  Patient,
} from '../types';
import {
  formatDateTimeKuching,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/dateUtils';
import { maskIdentity } from '../utils/normalize';
import { getCurrentSession } from '../data/dataService';

export interface ArchivedMonthlyRecord {
  yearMonth: string;
  totalRecords: number;
  totalPatients: number;
  records: Array<{
    attendance: Attendance;
    patient_snapshot: {
      no_rn: string;
      nama_pesakit: string;
      jantina: string;
      tarikh_lahir: string;
      kewarganegaraan: string;
      dokumen_bertopeng: string;
    };
  }>;
}

export async function buildMonthlyArchive(
  yearMonth: string,
  passphrase: string,
  secondaryPath?: string
): Promise<{
  archiveId: string;
  fileName: string;
  encryptedPkg: EncryptedPackage;
  receipt: ArchiveReceipt;
}> {
  const session = getCurrentSession();
  if (!session || session.role !== 'PENYELIA') {
    throw new Error('Hanya Penyelia dibenarkan membina arkib digital.');
  }

  const db = getDatabase();
  const mStatus = await db.month_status.get(yearMonth);
  if (!mStatus || mStatus.status === 'TERBUKA') {
    throw new Error('Bulan mesti berstatus DITUTUP sebelum arkib digital boleh dibina.');
  }

  const attendances = await db.attendances.where('tahun_bulan').equals(yearMonth).toArray();
  const patientIds = Array.from(new Set(attendances.map((a) => a.patient_id)));
  const patients = await db.patients.where('patient_id').anyOf(patientIds).toArray();
  const patientMap = new Map<string, Patient>(patients.map((p) => [p.patient_id, p]));

  const payload: ArchivedMonthlyRecord = {
    yearMonth,
    totalRecords: attendances.length,
    totalPatients: patients.length,
    records: attendances.map((a) => {
      const p = patientMap.get(a.patient_id);
      return {
        attendance: a,
        patient_snapshot: {
          no_rn: p ? p.no_rn : 'TIDAK DIKETAHUI',
          nama_pesakit: p ? p.nama_pesakit : 'TIDAK DIKETAHUI',
          jantina: p ? p.jantina : '-',
          tarikh_lahir: p ? p.tarikh_lahir : '-',
          kewarganegaraan: p ? p.kewarganegaraan : 'WARGANEGARA',
          dokumen_bertopeng: p ? maskIdentity(p.no_dokumen || p.no_pasport) : '-',
        },
      };
    }),
  };

  const rawJson = JSON.stringify(payload);
  const encryptedPkg = await encryptData(rawJson, passphrase);
  const fileName = `JPL_ARCHIVE_${yearMonth}.jplarc`;

  const archiveId = crypto.randomUUID();
  const receiptId = crypto.randomUUID();
  const nowStr = formatDateTimeKuching();

  // Create HMAC signature using passphrase as key
  const receiptDataString = `${receiptId}|${archiveId}|${yearMonth}|${attendances.length}|${encryptedPkg.checksum_sha256}`;
  const hmacSig = await generateHmac(passphrase, receiptDataString);

  const receipt: ArchiveReceipt = {
    receipt_id: receiptId,
    archive_id: archiveId,
    tahun_bulan: yearMonth,
    jumlah_rekod: attendances.length,
    checksum: encryptedPkg.checksum_sha256,
    hmac_sah: true,
    diimport_pada: nowStr,
    diimport_oleh: session.username,
  };

  const archiveRecord: ArchiveHistory = {
    archive_id: archiveId,
    tahun_bulan: yearMonth,
    jumlah_rekod: attendances.length,
    jumlah_pesakit: patients.length,
    nama_fail: fileName,
    checksum: encryptedPkg.checksum_sha256,
    tarikh_arkib: nowStr,
    salinan_1_lokasi: 'FOLDER_ARKIB_UTAMA',
    salinan_2_lokasi: secondaryPath || 'LOKASI_KEDUA_BELUM_DITETAPKAN',
    salinan_2_disahkan: !!secondaryPath,
    status_arkib: 'LENGKAP',
    disahkan_oleh: session.username,
    versi_arkib: 1,
  };

  await db.transaction('rw', [db.archive_history, db.archive_receipts, db.month_status, db.attendances], async () => {
    await db.archive_history.put(archiveRecord);
    await db.archive_receipts.put(receipt);
    await db.month_status.update(yearMonth, { status: 'DIARKIB' });
    // Mark attendances in this month as DIARKIB
    for (const a of attendances) {
      await db.attendances.update(a.attendance_id, { arkib_status: 'DIARKIB' });
    }
  });

  return {
    archiveId,
    fileName,
    encryptedPkg,
    receipt,
  };
}

/**
 * Verify Archive Receipt on Counter PC
 */
export async function verifyAndImportArchiveReceipt(
  receiptJsonText: string,
  passphrase: string
): Promise<boolean> {
  const session = getCurrentSession();
  if (!session || session.role !== 'PENYELIA') {
    throw new Error('Hanya Penyelia dibenarkan mengimport resit arkib.');
  }

  const receipt: ArchiveReceipt & { hmac_signature?: string } = JSON.parse(receiptJsonText);
  const db = getDatabase();

  const receiptDataString = `${receipt.receipt_id}|${receipt.archive_id}|${receipt.tahun_bulan}|${receipt.jumlah_rekod}|${receipt.checksum}`;
  const isValidHmac = receipt.hmac_signature
    ? await verifyHmac(passphrase, receiptDataString, receipt.hmac_signature)
    : true;

  if (!isValidHmac) {
    throw new Error('Resit arkib TIDAK SAH: Tandatangan HMAC gagal disahkan.');
  }

  await db.transaction('rw', [db.archive_receipts, db.month_status], async () => {
    await db.archive_receipts.put({
      ...receipt,
      hmac_sah: true,
      diimport_pada: formatDateTimeKuching(),
      diimport_oleh: session.username,
    });

    await db.month_status.update(receipt.tahun_bulan, {
      status: 'DIARKIB',
    });
  });

  return true;
}

/**
 * Read and search within an encrypted .jplarc archive file
 */
export async function readArchiveFile(
  pkg: EncryptedPackage,
  passphrase: string
): Promise<ArchivedMonthlyRecord> {
  const decrypted = await decryptData(pkg, passphrase);
  return JSON.parse(decrypted);
}
