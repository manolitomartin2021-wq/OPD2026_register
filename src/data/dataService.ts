import { getDatabase, type JPLDatabase } from './db';
import type {
  Patient,
  Attendance,
  AttendanceCategory,
  User,
  ActiveSession,
  AuditLog,
  AuditAction,
  MonthStatus,
  MonthlySummary,
  ProfileCorrectionRequest,
  RetenDefinition,
  BackupHistory,
  ArchiveHistory,
  ArchiveReceipt,
  PurgeBatch,
  Citizenship,
  DocumentType,
  Gender,
} from '../types';
import {
  hashPasswordWithSalt,
  generateRandomSalt,
  calculateAuditRowHash,
  sha256,
} from '../crypto/webCrypto';
import {
  formatDateTimeKuching,
  getTodayDateString,
  getCurrentTimeString,
  getCurrentYearMonth,
  getCurrentYear,
  isMoreThan6MonthsAgo,
  calculateAge,
  calculatePurgeEligibilityDate,
  isEligibleForPurge,
} from '../utils/dateUtils';
import {
  normalizeName,
  generateNameTokens,
  normalizeDocNumber,
} from '../utils/normalize';

// In-Memory active session (not stored in localStorage for maximum security)
let currentSession: ActiveSession | null = null;
let sessionTimeoutTimer: any = null;

export function getCurrentSession(): ActiveSession | null {
  return currentSession;
}

export function setCurrentSession(session: ActiveSession | null) {
  currentSession = session;
  resetSessionActivityTimer();
}

export function updateSessionPassphrase(passphrase: string) {
  if (currentSession) {
    currentSession.backup_passphrase = passphrase;
  }
}

export function lockCurrentSession() {
  if (currentSession) {
    currentSession.is_locked = true;
  }
}

export function unlockCurrentSession() {
  if (currentSession) {
    currentSession.is_locked = false;
    currentSession.last_activity = Date.now();
  }
}

export function resetSessionActivityTimer(timeoutMinutes = 5) {
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
  }
  if (!currentSession) return;

  currentSession.last_activity = Date.now();
  sessionTimeoutTimer = setTimeout(() => {
    if (currentSession && !currentSession.is_locked) {
      lockCurrentSession();
      // Dispatch event for UI auto-lock overlay
      window.dispatchEvent(new CustomEvent('JPL_SESSION_LOCKED'));
    }
  }, timeoutMinutes * 60 * 1000);
}

// Role Validation Guard
function requireAuth(allowedRoles?: ('PENYELIA' | 'STAFF')[]) {
  if (!currentSession) {
    throw new Error('Sesi tidak sah atau telah tamat. Sila log masuk semula.');
  }
  if (currentSession.is_locked) {
    throw new Error('Sesi dikunci. Sila masukkan kata laluan untuk membuka kunci.');
  }
  if (allowedRoles && !allowedRoles.includes(currentSession.role)) {
    throw new Error('Akses ditolak: Anda tidak mempunyai kebenaran untuk tindakan ini.');
  }
  return currentSession;
}

/**
 * Append-Only Hash-Chained Audit Logger
 */
async function recordAuditLog(
  db: JPLDatabase,
  action: AuditAction,
  modul: string,
  recordId: string | null,
  oldVal: any,
  newVal: any,
  reason: string | null = null,
  customUser?: { user_id: string; username: string; role: 'PENYELIA' | 'STAFF' }
) {
  const user = customUser || currentSession || {
    user_id: 'SYSTEM',
    username: 'SISTEM',
    role: 'PENYELIA' as const,
  };

  const lastLog = await db.audit_logs.orderBy('timestamp').last();
  const prevHash = lastLog ? lastLog.row_hash : '0000000000000000000000000000000000000000000000000000000000000000';

  const auditId = crypto.randomUUID();
  const timestamp = formatDateTimeKuching();

  const auditRow = {
    audit_id: auditId,
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    tindakan: action,
    modul,
    record_id: recordId,
    nilai_lama: oldVal ? (typeof oldVal === 'string' ? oldVal : JSON.stringify(oldVal)) : null,
    nilai_baharu: newVal ? (typeof newVal === 'string' ? newVal : JSON.stringify(newVal)) : null,
    sebab: reason,
    timestamp,
    prev_hash: prevHash,
  };

  const rowHash = await calculateAuditRowHash(auditRow);
  await db.audit_logs.add({
    ...auditRow,
    row_hash: rowHash,
  });
}

/**
 * Clock Protection check
 */
async function verifyClock(db: JPLDatabase) {
  const setting = await db.system_settings.get('last_known_timestamp');
  const now = new Date();
  const nowTime = now.getTime();

  if (setting && setting.value) {
    const lastTime = new Date(setting.value).getTime();
    // 5 minutes tolerance (300,000 ms)
    if (nowTime < lastTime - 300000) {
      throw new Error('RALAT KESELAMATAN: Jam PC tidak tepat (lebih awal daripada transaksi terdahulu). Hubungi Penyelia.');
    }
  }

  // Update last known timestamp
  await db.system_settings.put({
    key: 'last_known_timestamp',
    value: formatDateTimeKuching(now),
    updated_at: formatDateTimeKuching(now),
  });
}

// ==========================================
// SYSTEM & INITIALIZATION SERVICES
// ==========================================

export async function ensureDefaultRequestedUsers(db: JPLDatabase) {
  // 1. Ensure Incharge / Incharge123 (PENYELIA)
  const inchargeSalt = generateRandomSalt(16);
  const inchargeHash = await hashPasswordWithSalt('Incharge123', inchargeSalt);
  const inchargeUser = await db.users.where('username').equals('incharge').first();

  if (!inchargeUser) {
    await db.users.add({
      user_id: crypto.randomUUID(),
      username: 'incharge',
      nama_penuh: 'PENYELIA INCHARGE',
      role: 'PENYELIA',
      password_hash: inchargeHash,
      salt: inchargeSalt,
      aktif: true,
      gagal_login: 0,
      dikunci_hingga: null,
      wajib_tukar_password: false,
      last_login: null,
      created_at: formatDateTimeKuching(),
    });
  } else {
    await db.users.update(inchargeUser.user_id, {
      password_hash: inchargeHash,
      salt: inchargeSalt,
      aktif: true,
      dikunci_hingga: null,
      gagal_login: 0,
    });
  }

  // 2. Ensure OPD / OPD123 (STAFF)
  const opdSalt = generateRandomSalt(16);
  const opdHash = await hashPasswordWithSalt('OPD123', opdSalt);
  const opdUser = await db.users.where('username').equals('opd').first();

  if (!opdUser) {
    await db.users.add({
      user_id: crypto.randomUUID(),
      username: 'opd',
      nama_penuh: 'PETUGAS KAUNTER OPD',
      role: 'STAFF',
      password_hash: opdHash,
      salt: opdSalt,
      aktif: true,
      gagal_login: 0,
      dikunci_hingga: null,
      wajib_tukar_password: false,
      last_login: null,
      created_at: formatDateTimeKuching(),
    });
  } else {
    await db.users.update(opdUser.user_id, {
      password_hash: opdHash,
      salt: opdSalt,
      aktif: true,
      dikunci_hingga: null,
      gagal_login: 0,
    });
  }

  // Ensure settings exist
  const settingsCount = await db.system_settings.count();
  if (settingsCount === 0) {
    const settingsToInit = [
      { key: 'hospital_name', value: 'Hospital Dalat' },
      { key: 'application_name', value: 'JPL REGISTRATION SYSTEM' },
      { key: 'timezone', value: 'Asia/Kuching' },
      { key: 'mod_pemasangan', value: 'MOD_KAUNTER' },
      { key: 'tempoh_auto_lock', value: 5 },
      { key: 'printer_settings', value: 'A4' },
      { key: 'peringatan_hari', value: 5 },
      { key: 'peringatan_masa', value: '16:00' },
      { key: 'peringatan_tunda_minit', value: 30 },
      { key: 'last_known_timestamp', value: formatDateTimeKuching() },
      {
        key: 'ref_etnik',
        value: ['MELANAU', 'IBAN', 'BUMIPUTERA SARAWAK', 'BUMIPUTERA SABAH', 'MELAYU', 'CINA', 'BIDAYUH', 'KADAZAN', 'MURUT', 'BAJAU', 'INDIA', 'ORANG ASLI SEMENANJUNG', 'LAIN-LAIN'],
      },
    ];
    for (const s of settingsToInit) {
      await db.system_settings.put({ key: s.key, value: s.value, updated_at: formatDateTimeKuching() });
    }
  }
}

export async function isSystemInitialized(): Promise<boolean> {
  const db = getDatabase();
  await ensureDefaultRequestedUsers(db);
  return true;
}

export async function initializeSystem(payload: {
  supervisorUsername: string;
  supervisorFullName: string;
  supervisorPassword: string;
  installationMode: 'MOD_KAUNTER' | 'MOD_PENYELIA_ARKIB';
  recoveryKey: string;
}) {
  const db = getDatabase();
  await ensureDefaultRequestedUsers(db);
  const salt = generateRandomSalt(16);
  const passwordHash = await hashPasswordWithSalt(payload.supervisorPassword, salt);
  const supervisorId = crypto.randomUUID();

  const recoverySalt = generateRandomSalt(16);
  const recoveryHash = await hashPasswordWithSalt(payload.recoveryKey, recoverySalt);

  await db.transaction(
    'rw',
    [db.users, db.system_settings, db.reten_definitions, db.audit_logs],
    async () => {
      // 1. Create first Supervisor
      await db.users.add({
        user_id: supervisorId,
        username: payload.supervisorUsername.trim().toLowerCase(),
        nama_penuh: payload.supervisorFullName.trim().toUpperCase(),
        role: 'PENYELIA',
        password_hash: passwordHash,
        salt,
        aktif: true,
        gagal_login: 0,
        dikunci_hingga: null,
        wajib_tukar_password: false,
        last_login: null,
        created_at: formatDateTimeKuching(),
      });

      // 2. Settings
      const settingsToInit = [
        { key: 'hospital_name', value: 'Hospital Dalat' },
        { key: 'application_name', value: 'JPL REGISTRATION SYSTEM' },
        { key: 'timezone', value: 'Asia/Kuching' },
        { key: 'mod_pemasangan', value: payload.installationMode },
        { key: 'tempoh_auto_lock', value: 5 },
        { key: 'printer_settings', value: 'A4' },
        { key: 'peringatan_hari', value: 5 },
        { key: 'peringatan_masa', value: '16:00' },
        { key: 'peringatan_tunda_minit', value: 30 },
        { key: 'recovery_key_hash', value: recoveryHash },
        { key: 'recovery_key_salt', value: recoverySalt },
        { key: 'last_known_timestamp', value: formatDateTimeKuching() },
        {
          key: 'ref_etnik',
          value: [
            'MELANAU',
            'IBAN',
            'MELAYU',
            'CINA',
            'BIDAYUH',
            'ORANG ULU',
            'INDIA',
            'LAIN-LAIN',
          ],
        },
      ];

      for (const s of settingsToInit) {
        await db.system_settings.put({
          key: s.key,
          value: s.value,
          updated_at: formatDateTimeKuching(),
        });
      }

      // 3. Default Reten Definitions
      const defaultRetens = [
        { kod_indikator: 'RETEN_01', nama: 'Jumlah Kehadiran Sah', definisi: 'Semua rekod pendaftaran berstatus SAH dalam bulan laporan (tidak termasuk dibatalkan).' },
        { kod_indikator: 'RETEN_02', nama: 'Pecahan 4 Kategori', definisi: 'Kehadiran sah dipecahkan mengikut F/UP RUTIN, WALK-IN, MEDICAL CHECK UP, dan PROCEDURE ROOM.' },
        { kod_indikator: 'RETEN_03', nama: 'Pesakit Baharu vs Sedia Ada', definisi: 'Pesakit baharu ialah kehadiran pertama pesakit yang baru didaftar dalam sistem JPL.' },
        { kod_indikator: 'RETEN_04', nama: 'Pesakit Unik', definisi: 'Bilangan individu pesakit berbeza (patient_id) yang hadir sekurang-kurangnya sekali dalam bulan tersebut.' },
        { kod_indikator: 'RETEN_05', nama: 'Pecahan Kewarganegaraan', definisi: 'Pecahan kehadiran pesakit Warganegara Malaysia berbanding Bukan Warganegara.' },
        { kod_indikator: 'RETEN_06', nama: 'Pecahan Demografi', definisi: 'Pecahan jantina dan kumpulan umur (bawah 12 tahun, 12-59 tahun, 60 tahun ke atas).' },
      ];

      for (const r of defaultRetens) {
        await db.reten_definitions.put({
          kod_indikator: r.kod_indikator,
          nama: r.nama,
          definisi: r.definisi,
          aktif: true,
          disahkan_oleh: null,
          tarikh_pengesahan: null,
        });
      }

      // 4. Initial audit log
      await recordAuditLog(
        db,
        'URUS_PENGGUNA',
        'SISTEM',
        supervisorId,
        null,
        { username: payload.supervisorUsername, role: 'PENYELIA' },
        'Pemasangan dan persediaan awal sistem Hospital Dalat',
        { user_id: supervisorId, username: payload.supervisorUsername, role: 'PENYELIA' }
      );
    }
  );
}

// ==========================================
// USER AUTHENTICATION & RBAC
// ==========================================

export async function loginUser(username: string, pass: string): Promise<ActiveSession> {
  const db = getDatabase();
  await ensureDefaultRequestedUsers(db);
  const cleanUsername = username.trim().toLowerCase();
  const user = await db.users.where('username').equals(cleanUsername).first();

  if (!user || !user.aktif) {
    throw new Error('Nama pengguna atau kata laluan tidak sah.');
  }

  // Check if locked
  if (user.dikunci_hingga) {
    const lockTime = new Date(user.dikunci_hingga).getTime();
    if (Date.now() < lockTime) {
      const remainingMinutes = Math.ceil((lockTime - Date.now()) / 60000);
      throw new Error(`Akaun ini dikunci buat sementara selama ${remainingMinutes} minit.`);
    }
  }

  const hash = await hashPasswordWithSalt(pass, user.salt);
  if (hash !== user.password_hash) {
    const failedAttempts = (user.gagal_login || 0) + 1;
    let lockUntil: string | null = null;
    if (failedAttempts >= 5) {
      lockUntil = new Date(Date.now() + 5 * 60000).toISOString();
    }

    await db.users.update(user.user_id, {
      gagal_login: failedAttempts,
      dikunci_hingga: lockUntil,
    });

    await recordAuditLog(
      db,
      'LOGIN_GAGAL',
      'AUTH',
      user.user_id,
      null,
      { percubaan: failedAttempts },
      'Percubaan kata laluan tidak sah',
      { user_id: user.user_id, username: user.username, role: user.role }
    );

    if (failedAttempts >= 5) {
      throw new Error('Akaun telah dikunci selama 5 minit kerana 5 kali percubaan gagal.');
    }
    throw new Error('Nama pengguna atau kata laluan tidak sah.');
  }

  // Successful login
  await db.users.update(user.user_id, {
    gagal_login: 0,
    dikunci_hingga: null,
    last_login: formatDateTimeKuching(),
  });

  const session: ActiveSession = {
    user_id: user.user_id,
    username: user.username,
    nama_penuh: user.nama_penuh,
    role: user.role,
    login_at: formatDateTimeKuching(),
    last_activity: Date.now(),
    is_locked: false,
  };

  setCurrentSession(session);

  await recordAuditLog(db, 'LOGIN', 'AUTH', user.user_id, null, null, 'Log masuk berjaya');

  // Trigger daily background tasks (auto status 6 months)
  runDailyMaintenanceChecks().catch(console.error);

  return session;
}

export async function unlockWithPassword(password: string): Promise<boolean> {
  if (!currentSession) return false;
  const db = getDatabase();
  const user = await db.users.get(currentSession.user_id);
  if (!user) return false;

  const hash = await hashPasswordWithSalt(password, user.salt);
  if (hash === user.password_hash) {
    unlockCurrentSession();
    return true;
  }
  return false;
}

export async function logoutUser() {
  if (currentSession) {
    const db = getDatabase();
    await recordAuditLog(db, 'LOGOUT', 'AUTH', currentSession.user_id, null, null, 'Log keluar pengguna');
  }
  setCurrentSession(null);
}

// ==========================================
// AUTOMATIC 6-MONTH INACTIVITY STATUS CHECK
// ==========================================

export async function runDailyMaintenanceChecks() {
  const db = getDatabase();
  const today = getTodayDateString();

  // Check if already checked today
  const lastCheck = await db.system_settings.get('last_status_check_date');
  if (lastCheck && lastCheck.value === today) {
    return;
  }

  // Find active patients whose last visit was > 6 months ago
  const activePatients = await db.patients.where('status_pesakit').equals('AKTIF').toArray();
  let deactivatedCount = 0;

  for (const p of activePatients) {
    if (p.tarikh_kehadiran_terakhir && isMoreThan6MonthsAgo(p.tarikh_kehadiran_terakhir)) {
      await db.transaction('rw', [db.patients, db.patient_status_history], async () => {
        await db.patients.update(p.patient_id, {
          status_pesakit: 'TIDAK AKTIF',
          tarikh_dikemaskini: formatDateTimeKuching(),
          updated_by: 'SISTEM_AUTO',
        });
        await db.patient_status_history.add({
          id: crypto.randomUUID(),
          patient_id: p.patient_id,
          status_lama: 'AKTIF',
          status_baharu: 'TIDAK AKTIF',
          sebab: 'AUTO_6BULAN',
          tarikh: formatDateTimeKuching(),
          user_id: null,
        });
      });
      deactivatedCount++;
    }
  }

  await db.system_settings.put({
    key: 'last_status_check_date',
    value: today,
    updated_at: formatDateTimeKuching(),
  });

  if (deactivatedCount > 0) {
    await recordAuditLog(
      db,
      'STATUS_AUTO',
      'PESAKIT',
      null,
      null,
      { jumlah_tidak_aktif: deactivatedCount },
      `Penilaian automatik 6 bulan: ${deactivatedCount} pesakit diubah ke TIDAK AKTIF.`
    );
  }
}

// ==========================================
// MASTER PATIENT DATABASE SERVICES
// ==========================================

export async function searchPatients(query: string): Promise<Patient[]> {
  requireAuth();
  const db = getDatabase();
  const q = query.trim();
  if (!q) return [];

  const cleanDoc = normalizeDocNumber(q);
  const cleanName = normalizeName(q);

  // 1. Exact RN search
  const exactRn = await db.patients.where('no_rn').equals(q.toUpperCase()).first();
  if (exactRn && exactRn.status_pesakit !== 'DIGABUNG') {
    return [exactRn];
  }

  // 2. Exact Doc / Passport
  if (cleanDoc.length >= 4) {
    const byDoc = await db.patients.where('no_dokumen_normalized').equals(cleanDoc).toArray();
    const byPassport = await db.patients.where('no_pasport_normalized').equals(cleanDoc).toArray();
    const matches = [...byDoc, ...byPassport].filter((p) => p.status_pesakit !== 'DIGABUNG');
    if (matches.length > 0) return matches;
  }

  // 3. Name prefix or token search
  const results = new Map<string, Patient>();

  // Prefix match on nama_normalized
  const byPrefix = await db.patients
    .where('nama_normalized')
    .startsWith(cleanName)
    .limit(30)
    .toArray();
  for (const p of byPrefix) {
    if (p.status_pesakit !== 'DIGABUNG') results.set(p.patient_id, p);
  }

  // MultiEntry tokens search
  const tokens = cleanName.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 0 && results.size < 30) {
    const firstToken = tokens[0];
    const byToken = await db.patients
      .where('nama_tokens')
      .equals(firstToken)
      .limit(30)
      .toArray();

    for (const p of byToken) {
      if (p.status_pesakit !== 'DIGABUNG') {
        // Check if all tokens match
        const matchesAll = tokens.every((tok) => p.nama_normalized.includes(tok));
        if (matchesAll) results.set(p.patient_id, p);
      }
    }
  }

  return Array.from(results.values()).slice(0, 30);
}

export async function getPatientById(patientId: string): Promise<Patient | undefined> {
  requireAuth();
  const db = getDatabase();
  return db.patients.get(patientId);
}

/**
 * Generate Next New RN for the current year: HD-RN/YYYY/NNNN
 */
async function generateNextRN(db: JPLDatabase, year: string): Promise<string> {
  let seq = await db.rn_sequences.get(year);
  let nextNumber = (seq ? seq.last_number : 0) + 1;

  while (true) {
    const numStr = nextNumber.toString().padStart(Math.max(4, nextNumber.toString().length), '0');
    const candidateRN = `HD-RN/${year}/${numStr}`;
    const existing = await db.patients.where('no_rn').equals(candidateRN).first();
    if (!existing) {
      await db.rn_sequences.put({
        tahun: year,
        last_number: nextNumber,
        updated_at: formatDateTimeKuching(),
      });
      return candidateRN;
    }
    nextNumber++;
  }
}

export interface CreateNewPatientPayload {
  kewarganegaraan: Citizenship;
  jenis_dokumen: DocumentType;
  no_dokumen: string;
  no_pasport: string;
  nama_pesakit: string;
  jantina: Gender;
  tarikh_lahir: string;
  etnik: string;
  alamat?: string;
  nombor_telefon?: string;
  nama_waris?: string;
  telefon_waris?: string;
}

export async function createNewPatient(payload: CreateNewPatientPayload): Promise<Patient> {
  const session = requireAuth();
  const db = getDatabase();

  const normName = normalizeName(payload.nama_pesakit);
  if (!normName) throw new Error('Nama pesakit adalah wajib.');

  if (!payload.tarikh_lahir) throw new Error('Tarikh lahir adalah wajib.');
  if (!payload.kewarganegaraan) throw new Error('Kewarganegaraan adalah wajib.');

  const normDoc = normalizeDocNumber(payload.no_dokumen);
  const normPassport = normalizeDocNumber(payload.no_pasport);

  // Mandatory passport for non-citizens
  if (payload.kewarganegaraan === 'BUKAN WARGANEGARA') {
    if (!normPassport) {
      throw new Error('No. Pasport adalah WAJIB bagi pesakit Bukan Warganegara.');
    }
  }

  // Duplicate check in code (excluding TIADA DOKUMEN)
  if (payload.jenis_dokumen !== 'TIADA DOKUMEN' && normDoc) {
    const existing = await db.patients
      .where('no_dokumen_normalized')
      .equals(normDoc)
      .first();
    if (existing && existing.status_pesakit !== 'DIGABUNG') {
      throw new Error(`Pesakit dengan dokumen ini telah wujud (RN: ${existing.no_rn}, Nama: ${existing.nama_pesakit}).`);
    }
  }

  if (normPassport) {
    const existingPass = await db.patients
      .where('no_pasport_normalized')
      .equals(normPassport)
      .first();
    if (existingPass && existingPass.status_pesakit !== 'DIGABUNG') {
      throw new Error(`Pesakit dengan No. Pasport ini telah wujud (RN: ${existingPass.no_rn}, Nama: ${existingPass.nama_pesakit}).`);
    }
  }

  const year = getCurrentYear();
  const patientId = crypto.randomUUID();

  return await db.transaction(
    'rw',
    [db.patients, db.rn_sequences, db.system_settings, db.audit_logs],
    async () => {
      await verifyClock(db);
      const newRN = await generateNextRN(db, year);
      const nowStr = formatDateTimeKuching();

      const newPatient: Patient = {
        patient_id: patientId,
        no_rn: newRN,
        jenis_dokumen: payload.jenis_dokumen,
        no_dokumen: payload.no_dokumen.trim(),
        no_dokumen_normalized: normDoc,
        nama_pesakit: normName,
        nama_normalized: normName,
        nama_tokens: generateNameTokens(normName),
        jantina: payload.jantina,
        tarikh_lahir: payload.tarikh_lahir,
        etnik: payload.etnik || 'LAIN-LAIN',
        kewarganegaraan: payload.kewarganegaraan,
        no_pasport: payload.no_pasport ? payload.no_pasport.trim() : '',
        no_pasport_normalized: normPassport,
        alamat: payload.alamat ? payload.alamat.trim() : '',
        nombor_telefon: payload.nombor_telefon ? payload.nombor_telefon.trim() : '',
        nama_waris: payload.nama_waris ? payload.nama_waris.trim().toUpperCase() : '',
        telefon_waris: payload.telefon_waris ? payload.telefon_waris.trim() : '',
        status_pesakit: 'AKTIF',
        tarikh_kehadiran_terakhir: null,
        first_visit_date: null,
        dicipta_melalui: 'SISTEM',
        merged_into_patient_id: null,
        tarikh_dicipta: nowStr,
        tarikh_dikemaskini: nowStr,
        created_by: session.username,
        updated_by: session.username,
      };

      await db.patients.add(newPatient);

      await recordAuditLog(
        db,
        'REGISTER',
        'MASTER_PATIENT',
        patientId,
        null,
        { no_rn: newRN, nama: normName },
        'Pendaftaran profil pesakit baharu'
      );

      return newPatient;
    }
  );
}

// ==========================================
// REGISTRATION & ATTENDANCE (4 CATEGORIES)
// ==========================================

/**
 * Generate Next HDalat sequence for month: HDalat/0001
 */
async function generateNextHDalatNumber(
  db: JPLDatabase,
  yearMonth: string
): Promise<{ nombor: number; no_daftar: string }> {
  let seq = await db.monthly_sequences.get(yearMonth);
  let nextNumber = (seq ? seq.last_number : 0) + 1;

  while (true) {
    const existing = await db.attendances
      .where('[tahun_bulan+nombor]')
      .equals([yearMonth, nextNumber])
      .first();

    if (!existing) {
      await db.monthly_sequences.put({
        tahun_bulan: yearMonth,
        last_number: nextNumber,
        updated_at: formatDateTimeKuching(),
      });
      const numStr = nextNumber.toString().padStart(Math.max(4, nextNumber.toString().length), '0');
      return {
        nombor: nextNumber,
        no_daftar: `HDalat/${numStr}`,
      };
    }
    nextNumber++;
  }
}

export interface RegisterAttendancePayload {
  patient_id: string;
  kategori: AttendanceCategory;
  catatan?: string;
  kemasukan_lewat?: boolean;
  tarikh_sebenar?: string; // for late entry
  masa_sebenar?: string; // for late entry
  no_rujukan_manual?: string; // for late entry
  pengecualian_oleh?: string;
  sebab_pengecualian?: string;
}

export async function registerAttendance(payload: RegisterAttendancePayload): Promise<Attendance> {
  const session = requireAuth();
  const db = getDatabase();

  const patient = await db.patients.get(payload.patient_id);
  if (!patient) throw new Error('Pesakit tidak dijumpai.');

  if (patient.status_pesakit === 'MENINGGAL') {
    throw new Error('Pesakit telah berstatus MENINGGAL. Pendaftaran kehadiran disekat.');
  }

  const todayStr = payload.kemasukan_lewat && payload.tarikh_sebenar ? payload.tarikh_sebenar : getTodayDateString();
  const timeStr = payload.kemasukan_lewat && payload.masa_sebenar ? payload.masa_sebenar : getCurrentTimeString();
  const yearMonth = todayStr.substring(0, 7);

  // Check same day same category registration
  const sameDayAttendances = await db.attendances
    .where('[patient_id+tarikh]')
    .equals([payload.patient_id, todayStr])
    .toArray();

  const sameCategoryExists = sameDayAttendances.find(
    (a) => a.kategori === payload.kategori && a.status === 'SAH'
  );

  if (sameCategoryExists && !payload.pengecualian_oleh) {
    throw new Error(
      `Pesakit ini telah didaftarkan bagi kategori ${payload.kategori} pada hari ini (${sameCategoryExists.no_daftar} pada jam ${sameCategoryExists.masa}). Kelulusan Penyelia diperlukan untuk pendaftaran kedua.`
    );
  }

  // Calculate age in years at registration date
  const ageObj = calculateAge(patient.tarikh_lahir, todayStr);
  const attendanceId = crypto.randomUUID();
  const isFirstVisit = !patient.first_visit_date;

  return await db.transaction(
    'rw',
    [
      db.attendances,
      db.patients,
      db.monthly_sequences,
      db.patient_status_history,
      db.system_settings,
      db.audit_logs,
    ],
    async () => {
      await verifyClock(db);

      const { nombor, no_daftar } = await generateNextHDalatNumber(db, yearMonth);
      const nowStr = formatDateTimeKuching();

      const attendance: Attendance = {
        attendance_id: attendanceId,
        patient_id: patient.patient_id,
        tahun_bulan: yearMonth,
        nombor,
        no_daftar,
        kategori: payload.kategori,
        tarikh: todayStr,
        masa: timeStr,
        status: 'SAH',
        pesakit_baharu: isFirstVisit,
        umur_tahun: ageObj.years,
        kewarganegaraan: patient.kewarganegaraan,
        prev_last_visit_date: patient.tarikh_kehadiran_terakhir,
        prev_first_visit_date: patient.first_visit_date,
        kemasukan_lewat: !!payload.kemasukan_lewat,
        no_rujukan_manual: payload.no_rujukan_manual,
        catatan: payload.catatan,
        pengecualian_oleh: payload.pengecualian_oleh,
        sebab_pengecualian: payload.sebab_pengecualian,
        registered_by: session.username,
        created_at: nowStr,
        updated_at: nowStr,
        arkib_status: 'BELUM',
      };

      await db.attendances.add(attendance);

      // Update patient profile: last visit, first visit, and status reactivation
      const updates: Partial<Patient> = {
        tarikh_kehadiran_terakhir: todayStr,
        tarikh_dikemaskini: nowStr,
        updated_by: session.username,
      };

      if (isFirstVisit) {
        updates.first_visit_date = todayStr;
      }

      // Re-activate if was TIDAK AKTIF
      if (patient.status_pesakit === 'TIDAK AKTIF') {
        updates.status_pesakit = 'AKTIF';
        await db.patient_status_history.add({
          id: crypto.randomUUID(),
          patient_id: patient.patient_id,
          status_lama: 'TIDAK AKTIF',
          status_baharu: 'AKTIF',
          sebab: 'HADIR_SEMULA',
          tarikh: nowStr,
          user_id: session.user_id,
        });
      }

      await db.patients.update(patient.patient_id, updates);

      await recordAuditLog(
        db,
        'REGISTER',
        'PENDAFTARAN',
        attendanceId,
        null,
        { no_daftar, rn: patient.no_rn, kategori: payload.kategori },
        payload.kemasukan_lewat ? `Kemasukan Lewat (Ruj: ${payload.no_rujukan_manual || '-'})` : 'Pendaftaran kehadiran pesakit'
      );

      return attendance;
    }
  );
}

// ==========================================
// EDIT & CANCELLATION SERVICES
// ==========================================

export async function editAttendance(
  attendanceId: string,
  newCategory: AttendanceCategory,
  notes: string,
  reason: string
) {
  const session = requireAuth();
  const db = getDatabase();

  const record = await db.attendances.get(attendanceId);
  if (!record) throw new Error('Rekod pendaftaran tidak dijumpai.');

  const todayStr = getTodayDateString();
  const isSameDay = record.tarikh === todayStr;

  // Staff can only edit same day
  if (!isSameDay && session.role !== 'PENYELIA') {
    throw new Error('Hanya Penyelia dibenarkan mengubah pendaftaran hari terdahulu.');
  }

  if (!reason.trim()) {
    throw new Error('Sebab pembetulan adalah WAJIB diisi.');
  }

  const oldVal = { kategori: record.kategori, catatan: record.catatan };
  const newVal = { kategori: newCategory, catatan: notes };

  await db.transaction('rw', [db.attendances, db.audit_logs], async () => {
    await db.attendances.update(attendanceId, {
      kategori: newCategory,
      catatan: notes,
      updated_at: formatDateTimeKuching(),
    });

    await recordAuditLog(
      db,
      'EDIT',
      'PENDAFTARAN',
      attendanceId,
      oldVal,
      newVal,
      `Pindaan kategori/catatan: ${reason}`
    );
  });
}

export async function cancelAttendance(attendanceId: string, reason: string) {
  const session = requireAuth();
  const db = getDatabase();

  if (!reason.trim()) {
    throw new Error('Sebab pembatalan adalah WAJIB diisi.');
  }

  const record = await db.attendances.get(attendanceId);
  if (!record) throw new Error('Rekod kehadiran tidak dijumpai.');
  if (record.status === 'BATAL') throw new Error('Rekod ini telah pun dibatalkan.');

  const patient = await db.patients.get(record.patient_id);
  if (!patient) throw new Error('Data pesakit tidak dijumpai.');

  const todayStr = getTodayDateString();
  if (record.tarikh !== todayStr && session.role !== 'PENYELIA') {
    throw new Error('Hanya Penyelia dibenarkan membatalkan pendaftaran hari terdahulu.');
  }

  await db.transaction(
    'rw',
    [db.attendances, db.patients, db.audit_logs],
    async () => {
      const nowStr = formatDateTimeKuching();

      // Soft delete: status = BATAL
      await db.attendances.update(attendanceId, {
        status: 'BATAL',
        cancelled_by: session.username,
        cancelled_at: nowStr,
        cancellation_reason: reason.trim(),
        updated_at: nowStr,
      });

      // Restore patient's previous visit dates if this was the latest visit
      if (patient.tarikh_kehadiran_terakhir === record.tarikh) {
        await db.patients.update(patient.patient_id, {
          tarikh_kehadiran_terakhir: record.prev_last_visit_date,
          first_visit_date: record.pesakit_baharu ? record.prev_first_visit_date : patient.first_visit_date,
          tarikh_dikemaskini: nowStr,
          updated_by: session.username,
        });
      }

      await recordAuditLog(
        db,
        'CANCEL',
        'PENDAFTARAN',
        attendanceId,
        { status: 'SAH', no_daftar: record.no_daftar },
        { status: 'BATAL' },
        `Pembatalan kehadiran: ${reason}`
      );
    }
  );
}

// ==========================================
// PROFILE CORRECTIONS & MERGING (PENYELIA)
// ==========================================

export async function requestProfileCorrection(
  patientId: string,
  field: string,
  oldValue: string,
  newValue: string,
  reason: string
) {
  const session = requireAuth();
  const db = getDatabase();

  const reqId = crypto.randomUUID();
  await db.profile_corrections.add({
    id: reqId,
    patient_id: patientId,
    medan: field,
    nilai_lama: oldValue,
    nilai_baharu: newValue,
    sebab: reason,
    dimohon_oleh: session.username,
    tarikh_mohon: formatDateTimeKuching(),
    status: 'MENUNGGU',
  });

  await recordAuditLog(
    db,
    'PERMOHONAN_PEMBETULAN',
    'PESAKIT',
    patientId,
    { medan: field, nilai_lama: oldValue },
    { nilai_baharu: newValue },
    `Permohonan pembetulan profil oleh ${session.username}: ${reason}`
  );
}

export async function reviewProfileCorrection(
  requestId: string,
  approved: boolean,
  supervisorNotes?: string
) {
  const session = requireAuth(['PENYELIA']);
  const db = getDatabase();

  const req = await db.profile_corrections.get(requestId);
  if (!req) throw new Error('Permohonan tidak dijumpai.');

  const patient = await db.patients.get(req.patient_id);
  if (!patient) throw new Error('Pesakit tidak dijumpai.');

  await db.transaction(
    'rw',
    [db.profile_corrections, db.patients, db.audit_logs],
    async () => {
      const nowStr = formatDateTimeKuching();
      if (approved) {
        // Apply field update to patient
        const updateData: any = {
          [req.medan]: req.nilai_baharu,
          tarikh_dikemaskini: nowStr,
          updated_by: session.username,
        };
        if (req.medan === 'nama_pesakit') {
          updateData.nama_normalized = normalizeName(req.nilai_baharu);
          updateData.nama_tokens = generateNameTokens(req.nilai_baharu);
        } else if (req.medan === 'no_dokumen') {
          updateData.no_dokumen_normalized = normalizeDocNumber(req.nilai_baharu);
        } else if (req.medan === 'no_pasport') {
          updateData.no_pasport_normalized = normalizeDocNumber(req.nilai_baharu);
        }

        await db.patients.update(patient.patient_id, updateData);
      }

      await db.profile_corrections.update(requestId, {
        status: approved ? 'DILULUSKAN' : 'DITOLAK',
        diproses_oleh: session.username,
        tarikh_proses: nowStr,
        catatan_penyelia: supervisorNotes || '',
      });

      await recordAuditLog(
        db,
        'EDIT_MASTER_PATIENT',
        'PESAKIT',
        patient.patient_id,
        { medan: req.medan, asal: req.nilai_lama },
        { keputusan: approved ? 'DILULUSKAN' : 'DITOLAK', baharu: req.nilai_baharu },
        `Kelulusan permohonan pembetulan profil: ${supervisorNotes || ''}`
      );
    }
  );
}

export async function mergeDuplicatePatients(
  keepPatientId: string,
  duplicatePatientId: string,
  reason: string
) {
  const session = requireAuth(['PENYELIA']);
  const db = getDatabase();

  if (!reason.trim()) throw new Error('Sebab penggabungan adalah WAJIB.');

  const keep = await db.patients.get(keepPatientId);
  const dup = await db.patients.get(duplicatePatientId);

  if (!keep || !dup) throw new Error('Salah satu rekod pesakit tidak dijumpai.');
  if (keep.patient_id === dup.patient_id) throw new Error('Tidak boleh menggabungkan pesakit dengan dirinya sendiri.');

  await db.transaction(
    'rw',
    [db.patients, db.attendances, db.patient_status_history, db.audit_logs],
    async () => {
      const nowStr = formatDateTimeKuching();

      // Re-assign all attendances from dup to keep
      const dupAttendances = await db.attendances.where('patient_id').equals(dup.patient_id).toArray();
      for (const a of dupAttendances) {
        await db.attendances.update(a.attendance_id, {
          patient_id: keep.patient_id,
          updated_at: nowStr,
        });
      }

      // Mark duplicate patient as DIGABUNG
      await db.patients.update(dup.patient_id, {
        status_pesakit: 'DIGABUNG',
        merged_into_patient_id: keep.patient_id,
        tarikh_dikemaskini: nowStr,
        updated_by: session.username,
      });

      await db.patient_status_history.add({
        id: crypto.randomUUID(),
        patient_id: dup.patient_id,
        status_lama: dup.status_pesakit,
        status_baharu: 'DIGABUNG',
        sebab: 'GABUNG',
        tarikh: nowStr,
        user_id: session.user_id,
      });

      await recordAuditLog(
        db,
        'MERGE_PATIENT',
        'MASTER_PATIENT',
        keep.patient_id,
        { digabung_rn: dup.no_rn, nama: dup.nama_pesakit },
        { kekal_rn: keep.no_rn, nama: keep.nama_pesakit },
        `Penggabungan rekod pesakit pendua: ${reason}`
      );
    }
  );
}

// ==========================================
// CLOSE DAY (TUTUP HARI)
// ==========================================

export async function closeDay(dateStr = getTodayDateString()) {
  const session = requireAuth();
  const db = getDatabase();

  const attendances = await db.attendances.where('tarikh').equals(dateStr).toArray();
  const count = attendances.length;

  await recordAuditLog(
    db,
    'TUTUP_HARI',
    'OPERASI',
    dateStr,
    null,
    { jumlah_pendaftaran: count },
    `Tutup Hari ${dateStr} disahkan oleh ${session.username}. Rekod sedia untuk semakan/tandatangan.`
  );
}

// ==========================================
// RETEN BULANAN & MONTH CLOSE
// ==========================================

export async function calculateMonthlyReten(yearMonth: string): Promise<MonthlySummary['data_json']> {
  requireAuth();
  const db = getDatabase();

  const attendances = await db.attendances.where('tahun_bulan').equals(yearMonth).toArray();

  let sahCount = 0;
  let fupCount = 0;
  let walkinCount = 0;
  let checkupCount = 0;
  let procedureCount = 0;
  let newPatientCount = 0;
  let existingPatientCount = 0;
  let cancelCount = 0;
  let warganegaraCount = 0;
  let bukanWarganegaraCount = 0;
  let lelakiCount = 0;
  let perempuanCount = 0;
  let bawah12 = 0;
  let umur12_59 = 0;
  let umur60Keatas = 0;

  const uniquePatients = new Set<string>();

  for (const a of attendances) {
    if (a.status === 'BATAL') {
      cancelCount++;
      continue;
    }

    sahCount++;
    uniquePatients.add(a.patient_id);

    if (a.kategori === 'FUP_RUTIN') fupCount++;
    else if (a.kategori === 'WALK_IN') walkinCount++;
    else if (a.kategori === 'MEDICAL_CHECKUP') checkupCount++;
    else if (a.kategori === 'PROCEDURE_ROOM') procedureCount++;

    if (a.pesakit_baharu) newPatientCount++;
    else existingPatientCount++;

    if (a.kewarganegaraan === 'WARGANEGARA') warganegaraCount++;
    else bukanWarganegaraCount++;

    if (a.umur_tahun < 12) bawah12++;
    else if (a.umur_tahun <= 59) umur12_59++;
    else umur60Keatas++;
  }

  // Look up patient genders
  const patientIds = Array.from(uniquePatients);
  const patientList = await db.patients.where('patient_id').anyOf(patientIds).toArray();
  const genderMap = new Map<string, Gender>(patientList.map((p) => [p.patient_id, p.jantina]));

  for (const a of attendances) {
    if (a.status !== 'BATAL') {
      const g = genderMap.get(a.patient_id);
      if (g === 'LELAKI') lelakiCount++;
      else if (g === 'PEREMPUAN') perempuanCount++;
    }
  }

  return {
    jumlah_kehadiran_sah: sahCount,
    kategori_fup: fupCount,
    kategori_walkin: walkinCount,
    kategori_checkup: checkupCount,
    kategori_procedure: procedureCount,
    pesakit_baharu: newPatientCount,
    pesakit_sedia_ada: existingPatientCount,
    jumlah_batal: cancelCount,
    pesakit_unik: uniquePatients.size,
    warganegara: warganegaraCount,
    bukan_warganegara: bukanWarganegaraCount,
    lelaki: lelakiCount,
    perempuan: perempuanCount,
    umur_bawah_12: bawah12,
    umur_12_59: umur12_59,
    umur_60_keatas: umur60Keatas,
  };
}

export async function closeMonth(yearMonth: string): Promise<MonthStatus> {
  const session = requireAuth(['PENYELIA']);
  const db = getDatabase();

  const data = await calculateMonthlyReten(yearMonth);
  const eligibleDate = calculatePurgeEligibilityDate(yearMonth);
  const nowStr = formatDateTimeKuching();

  return await db.transaction(
    'rw',
    [db.month_status, db.monthly_summaries, db.audit_logs],
    async () => {
      // Create or update monthly summary (frozen snapshot)
      const existingSummary = await db.monthly_summaries.where('tahun_bulan').equals(yearMonth).last();
      const version = (existingSummary ? existingSummary.versi : 0) + 1;

      // Check if definitions are all verified
      const unverifiedCount = await db.reten_definitions.where('disahkan_oleh').equals('').count();
      const summaryStatus = unverifiedCount === 0 ? 'RASMI' : 'DRAF';

      await db.monthly_summaries.add({
        id: crypto.randomUUID(),
        tahun_bulan: yearMonth,
        versi: version,
        status: summaryStatus,
        data_json: data,
        definisi_versi: 'V1.0',
        dikira_pada: nowStr,
        dikira_oleh: session.username,
      });

      const monthStatus: MonthStatus = {
        tahun_bulan: yearMonth,
        status: 'DITUTUP',
        tarikh_tutup: nowStr,
        ditutup_oleh: session.username,
        tarikh_layak_bersih: eligibleDate,
        hardcopy_disahkan_oleh: session.username,
        hardcopy_disahkan_tarikh: nowStr,
      };

      await db.month_status.put(monthStatus);

      await recordAuditLog(
        db,
        'TUTUP_BULAN',
        'RETEN',
        yearMonth,
        null,
        { data, tarikh_layak_bersih: eligibleDate },
        `Penutupan rasmi bulan ${yearMonth} oleh Penyelia ${session.username}. Ringkasan dikunci.`
      );

      return monthStatus;
    }
  );
}

// ==========================================
// FOUR-MONTH CONTROLLED PURGE (BAHAGIAN 20)
// ==========================================

export interface PurgePrerequisiteStatus {
  canPurge: boolean;
  reasons: string[];
  recordsToPurgeCount: number;
}

export async function checkPurgePrerequisites(yearMonth: string): Promise<PurgePrerequisiteStatus> {
  requireAuth(['PENYELIA']);
  const db = getDatabase();
  const reasons: string[] = [];

  const mStatus = await db.month_status.get(yearMonth);
  if (!mStatus) {
    reasons.push('Bulan belum mempunyai status penutupan dalam sistem.');
    return { canPurge: false, reasons, recordsToPurgeCount: 0 };
  }

  // 1. Month must be DIARKIB and past tarikh_layak_bersih
  if (mStatus.status !== 'DIARKIB') {
    reasons.push('Bulan belum berstatus DIARKIB. Arkib digital mesti dibina dan disahkan dahulu.');
  }

  if (!isEligibleForPurge(mStatus.tarikh_layak_bersih)) {
    reasons.push(
      `Bulan belum genap 4 bulan kalendar. Tarikh layak bersih ialah ${mStatus.tarikh_layak_bersih}.`
    );
  }

  // 2. Hardcopy confirmed
  if (!mStatus.hardcopy_disahkan_oleh) {
    reasons.push('Hardcopy laporan bulanan belum disahkan cetak dan tandatangan.');
  }

  // 3. Archive receipt verified
  const receipt = await db.archive_receipts.where('tahun_bulan').equals(yearMonth).first();
  if (!receipt || !receipt.hmac_sah) {
    reasons.push('Resit Arkib digital dari PC Penyelia belum diimport atau tandatangan HMAC tidak sah.');
  }

  // 4. Secondary copy verified
  const archive = await db.archive_history.where('tahun_bulan').equals(yearMonth).first();
  if (!archive || !archive.salinan_2_disahkan) {
    reasons.push('Salinan KEDUA arkib di lokasi berasingan belum disahkan.');
  }

  // 5. Weekly backup within 10 days
  const lastWeeklyBackup = await db.backup_history
    .where('jenis')
    .equals('MINGGUAN')
    .last();
  if (!lastWeeklyBackup) {
    reasons.push('Tiada rekod backup mingguan dijumpai. Backup mingguan terkini diperlukan.');
  } else {
    const daysSince = (Date.now() - new Date(lastWeeklyBackup.tarikh).getTime()) / (1000 * 3600 * 24);
    if (daysSince > 10) {
      reasons.push(`Backup mingguan telah melebihi 10 hari yang lalu (${Math.round(daysSince)} hari).`);
    }
  }

  const attendancesInMonth = await db.attendances.where('tahun_bulan').equals(yearMonth).toArray();

  return {
    canPurge: reasons.length === 0,
    reasons,
    recordsToPurgeCount: attendancesInMonth.length,
  };
}

export async function executePurge(
  yearMonth: string,
  backupPraResetId: string,
  supervisorPasswordVerification: string
) {
  const session = requireAuth(['PENYELIA']);
  const db = getDatabase();

  // Verify supervisor password
  const supervisor = await db.users.get(session.user_id);
  if (!supervisor) throw new Error('Pengguna tidak sah.');
  const pHash = await hashPasswordWithSalt(supervisorPasswordVerification, supervisor.salt);
  if (pHash !== supervisor.password_hash) {
    throw new Error('Kata laluan pengesahan Penyelia tidak tepat. Pembersihan dibatalkan.');
  }

  const check = await checkPurgePrerequisites(yearMonth);
  if (!check.canPurge) {
    throw new Error(`Pembersihan disekat oleh sistem:\n${check.reasons.join('\n')}`);
  }

  const baselinePatientCount = await db.patients.count();
  const attendancesToDelete = await db.attendances.where('tahun_bulan').equals(yearMonth).toArray();
  const expectedDeleteCount = attendancesToDelete.length;

  const batchId = crypto.randomUUID();
  const nowStr = formatDateTimeKuching();

  await db.transaction(
    'rw',
    [
      db.attendances,
      db.month_status,
      db.purge_batches,
      db.patients,
      db.audit_logs,
    ],
    async () => {
      // Delete ONLY the attendances in the target month with status DIARKIB
      const idsToDelete = attendancesToDelete.map((a) => a.attendance_id);
      await db.attendances.bulkDelete(idsToDelete);

      // Verify baseline patient count did NOT change
      const postPatientCount = await db.patients.count();
      if (postPatientCount !== baselinePatientCount) {
        throw new Error('RALAT KRITIKAL: Bilangan pesakit Master Patient Database berubah! Transaksi dibatalkan automatik.');
      }

      await db.month_status.update(yearMonth, {
        status: 'DIBERSIHKAN',
      });

      await db.purge_batches.add({
        batch_id: batchId,
        bulan_dibersihkan: [yearMonth],
        jumlah_rekod_dipadam: expectedDeleteCount,
        backup_pra_reset_id: backupPraResetId,
        diluluskan_oleh: session.username,
        tarikh: nowStr,
        hasil: 'BERJAYA',
        laporan: `Pembersihan ${expectedDeleteCount} rekod kehadiran bulan ${yearMonth} selesai dengan selamat.`,
      });

      await recordAuditLog(
        db,
        'PURGE',
        'PEMBERSIHAN',
        batchId,
        { bulan: yearMonth, rekod_sebelum: expectedDeleteCount },
        { status: 'DIBERSIHKAN', dipadam: expectedDeleteCount },
        `FOUR-MONTH CONTROLLED PURGE: ${expectedDeleteCount} rekod dipadam. Master Patient Database utuh.`
      );
    }
  );
}

// ==========================================
// DATA INTEGRITY CHECK (BAHAGIAN 23)
// ==========================================

export interface IntegrityCheckResult {
  passed: boolean;
  issues: string[];
  summary: {
    totalPatients: number;
    totalAttendances: number;
    totalUsers: number;
    totalAuditLogs: number;
    auditChainValid: boolean;
  };
}

export async function runIntegrityCheck(): Promise<IntegrityCheckResult> {
  const db = getDatabase();
  const issues: string[] = [];

  const patients = await db.patients.toArray();
  const attendances = await db.attendances.toArray();
  const users = await db.users.toArray();
  const auditLogs = await db.audit_logs.orderBy('timestamp').toArray();

  const patientIdSet = new Set(patients.map((p) => p.patient_id));
  const rnSet = new Set<string>();

  // Check unique RN
  for (const p of patients) {
    if (rnSet.has(p.no_rn)) {
      issues.push(`Pendua No. RN dikesan: ${p.no_rn}`);
    }
    rnSet.add(p.no_rn);
  }

  // Check orphaned attendances
  for (const a of attendances) {
    if (!patientIdSet.has(a.patient_id)) {
      issues.push(`Rekod kehadiran yatim dikesan: ${a.no_daftar} (patient_id tidak wujud).`);
    }
  }

  // Check hash chain on audit logs
  let auditChainValid = true;
  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (const log of auditLogs) {
    if (log.prev_hash !== expectedPrevHash) {
      auditChainValid = false;
      issues.push(`Rantaian audit terputus pada log ID: ${log.audit_id}`);
      break;
    }
    const calculated = await calculateAuditRowHash(log);
    if (calculated !== log.row_hash) {
      auditChainValid = false;
      issues.push(`Pengubahan integriti dikesan pada log ID: ${log.audit_id}`);
      break;
    }
    expectedPrevHash = log.row_hash;
  }

  return {
    passed: issues.length === 0,
    issues,
    summary: {
      totalPatients: patients.length,
      totalAttendances: attendances.length,
      totalUsers: users.length,
      totalAuditLogs: auditLogs.length,
      auditChainValid,
    },
  };
}

// ==========================================
// MONTHLY DAILY ATTENDANCE BREAKDOWN REPORT
// ==========================================

export interface DailyAttendanceSummary {
  tarikh: string; // YYYY-MM-DD
  hari: string; // e.g. "Isnin"
  hariNum: number; // 1-31
  jumlah_sah: number;
  fup: number;
  walkin: number;
  checkup: number;
  procedure: number;
  baharu: number;
  sedia_ada: number;
  batal: number;
  tutup_hari: boolean;
}

export interface MonthlyDetailedReport {
  yearMonth: string;
  totalAttendances: number;
  totalUniquePatients: number;
  dailySummaries: DailyAttendanceSummary[];
  patientList: Array<{
    attendance_id: string;
    no_daftar: string;
    no_rn: string;
    nama_pesakit: string;
    kategori: string;
    tarikh: string;
    masa: string;
    status: string;
    pesakit_baharu: boolean;
    umur_tahun: number;
    kewarganegaraan: string;
  }>;
}

export async function getMonthlyDetailedReport(yearMonth: string): Promise<MonthlyDetailedReport> {
  requireAuth();
  const db = getDatabase();

  const [yStr, mStr] = yearMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  // Total days in month
  const daysInMonth = new Date(y, m, 0).getDate();

  const attendances = await db.attendances.where('tahun_bulan').equals(yearMonth).toArray();

  // Load patients
  const patientIds = Array.from(new Set(attendances.map((a) => a.patient_id)));
  const patients = await db.patients.where('patient_id').anyOf(patientIds).toArray();
  const patientMap = new Map(patients.map((p) => [p.patient_id, p]));

  // Check Tutup Hari audit logs for each day
  const tutupHariLogs = await db.audit_logs
    .where('tindakan')
    .equals('TUTUP_HARI')
    .toArray();
  const tutupHariDates = new Set(tutupHariLogs.map((l) => l.record_id).filter(Boolean));

  const dayNames = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

  const dailySummaries: DailyAttendanceSummary[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayPadded = day.toString().padStart(2, '0');
    const dateStr = `${yearMonth}-${dayPadded}`;
    const dateObj = new Date(y, m - 1, day);
    const dayName = dayNames[dateObj.getDay()];

    const dayAttendances = attendances.filter((a) => a.tarikh === dateStr);
    const sahList = dayAttendances.filter((a) => a.status === 'SAH');
    const batalList = dayAttendances.filter((a) => a.status === 'BATAL');

    dailySummaries.push({
      tarikh: dateStr,
      hari: dayName,
      hariNum: day,
      jumlah_sah: sahList.length,
      fup: sahList.filter((a) => a.kategori === 'FUP_RUTIN').length,
      walkin: sahList.filter((a) => a.kategori === 'WALK_IN').length,
      checkup: sahList.filter((a) => a.kategori === 'MEDICAL_CHECKUP').length,
      procedure: sahList.filter((a) => a.kategori === 'PROCEDURE_ROOM').length,
      baharu: sahList.filter((a) => a.pesakit_baharu).length,
      sedia_ada: sahList.filter((a) => !a.pesakit_baharu).length,
      batal: batalList.length,
      tutup_hari: tutupHariDates.has(dateStr),
    });
  }

  const patientList = attendances.map((a) => {
    const p = patientMap.get(a.patient_id);
    return {
      attendance_id: a.attendance_id,
      no_daftar: a.no_daftar,
      no_rn: p ? p.no_rn : '-',
      nama_pesakit: p ? p.nama_pesakit : '-',
      kategori: a.kategori,
      tarikh: a.tarikh,
      masa: a.masa,
      status: a.status,
      pesakit_baharu: a.pesakit_baharu,
      umur_tahun: a.umur_tahun,
      kewarganegaraan: a.kewarganegaraan,
    };
  });

  // Sort by date and time descending
  patientList.sort((a, b) => (b.tarikh + b.masa).localeCompare(a.tarikh + a.masa));

  return {
    yearMonth,
    totalAttendances: attendances.filter((a) => a.status === 'SAH').length,
    totalUniquePatients: patientIds.length,
    dailySummaries,
    patientList,
  };
}

// ==========================================
// RETEN RASMI KKM: OPD 212
// Laporan Bulanan Kedatangan Pesakit Luar Mengikut Umur/Jantina dan Kumpulan Etnik
// ==========================================

export interface OPD212CellData {
  u10_l: number;
  u10_p: number;
  u19_l: number;
  u19_p: number;
  u59_l: number;
  u59_p: number;
  u60_l: number;
  u60_p: number;
  total_l: number;
  total_p: number;
  grand_total: number;
}

export interface OPD212RowData extends OPD212CellData {
  id: string;
  label: string;
  code: number;
  isBukanWargaGroup?: boolean;
}

export interface OPD212Report {
  yearMonth: string;
  monthName: string;
  year: string;
  unitKlinik: string;
  hospital: string;
  negeri: string;
  rows: OPD212RowData[];
  totalRow: OPD212CellData;
}

export const OPD212_ROW_DEFS: Array<{ id: string; label: string; isBukanWargaGroup?: boolean }> = [
  { id: 'MELAYU', label: 'Melayu' },
  { id: 'CINA', label: 'Cina' },
  { id: 'INDIA', label: 'India' },
  { id: 'KADAZAN', label: 'Kadazan' },
  { id: 'MURUT', label: 'Murut' },
  { id: 'BAJAU', label: 'Bajau' },
  { id: 'MELANAU', label: 'Melanau' },
  { id: 'IBAN', label: 'Iban' },
  { id: 'BIDAYUH', label: 'Bidayuh' },
  { id: 'ORANG_ASLI', label: 'Orang Asli Semenanjung' },
  { id: 'PERIBUMI_SABAH', label: 'Peribumi Sabah Lain' },
  { id: 'PERIBUMI_SARAWAK', label: 'Peribumi Sarawak Lain' },
  { id: 'LAIN_LAIN', label: 'Lain-Lain' },
  { id: 'BUKAN_WARGA_DENGAN_IZIN', label: 'Dengan Izin', isBukanWargaGroup: true },
  { id: 'BUKAN_WARGA_TANPA_IZIN', label: 'Tanpa Izin', isBukanWargaGroup: true },
];

export async function calculateOPD212Reten(yearMonth: string): Promise<OPD212Report> {
  requireAuth();
  const db = getDatabase();

  const [yStr, mStr] = yearMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  ];
  const monthName = monthNames[m - 1] || yStr;

  const attendances = await db.attendances.where('tahun_bulan').equals(yearMonth).toArray();
  const validAttendances = attendances.filter((a) => a.status === 'SAH');

  const patientIds = Array.from(new Set(validAttendances.map((a) => a.patient_id)));
  const patients = await db.patients.where('patient_id').anyOf(patientIds).toArray();
  const patientMap = new Map(patients.map((p) => [p.patient_id, p]));

  // Inisialisasi setiap baris dengan nilai 0
  const gridMap = new Map<string, OPD212CellData>();
  for (const def of OPD212_ROW_DEFS) {
    gridMap.set(def.id, {
      u10_l: 0,
      u10_p: 0,
      u19_l: 0,
      u19_p: 0,
      u59_l: 0,
      u59_p: 0,
      u60_l: 0,
      u60_p: 0,
      total_l: 0,
      total_p: 0,
      grand_total: 0,
    });
  }

  for (const a of validAttendances) {
    const p = patientMap.get(a.patient_id);
    const gender: Gender = p ? p.jantina : 'LELAKI';
    const isMale = gender === 'LELAKI';
    const age = a.umur_tahun;

    let rowId = 'LAIN_LAIN';
    if (a.kewarganegaraan === 'BUKAN WARGANEGARA' || (p && p.kewarganegaraan === 'BUKAN WARGANEGARA')) {
      const hasPassport = p?.no_pasport && p.no_pasport.trim().length > 0;
      rowId = hasPassport ? 'BUKAN_WARGA_DENGAN_IZIN' : 'BUKAN_WARGA_TANPA_IZIN';
    } else {
      const e = (p?.etnik || '').trim().toUpperCase();
      if (e.includes('MELAYU')) rowId = 'MELAYU';
      else if (e.includes('CINA')) rowId = 'CINA';
      else if (e.includes('INDIA')) rowId = 'INDIA';
      else if (e.includes('KADAZAN')) rowId = 'KADAZAN';
      else if (e.includes('MURUT')) rowId = 'MURUT';
      else if (e.includes('BAJAU')) rowId = 'BAJAU';
      else if (e.includes('MELANAU')) rowId = 'MELANAU';
      else if (e.includes('IBAN')) rowId = 'IBAN';
      else if (e.includes('BIDAYUH')) rowId = 'BIDAYUH';
      else if (e.includes('ORANG ASLI') || e.includes('SEMENANJUNG')) rowId = 'ORANG_ASLI';
      else if (e.includes('SABAH') || e.includes('DUSUN')) rowId = 'PERIBUMI_SABAH';
      else if (e.includes('SARAWAK') || e.includes('ULU') || e.includes('KAYAN') || e.includes('KENYAH')) rowId = 'PERIBUMI_SARAWAK';
      else rowId = 'LAIN_LAIN';
    }

    const row = gridMap.get(rowId);
    if (!row) continue;

    if (age < 10) {
      if (isMale) row.u10_l++;
      else row.u10_p++;
    } else if (age <= 19) {
      if (isMale) row.u19_l++;
      else row.u19_p++;
    } else if (age <= 59) {
      if (isMale) row.u59_l++;
      else row.u59_p++;
    } else {
      if (isMale) row.u60_l++;
      else row.u60_p++;
    }

    if (isMale) row.total_l++;
    else row.total_p++;
    row.grand_total++;
  }

  // Pengiraan baris jumlah keseluruhan
  const totalRow: OPD212CellData = {
    u10_l: 0,
    u10_p: 0,
    u19_l: 0,
    u19_p: 0,
    u59_l: 0,
    u59_p: 0,
    u60_l: 0,
    u60_p: 0,
    total_l: 0,
    total_p: 0,
    grand_total: 0,
  };

  const rows: OPD212RowData[] = OPD212_ROW_DEFS.map((def, idx) => {
    const cell = gridMap.get(def.id)!;
    totalRow.u10_l += cell.u10_l;
    totalRow.u10_p += cell.u10_p;
    totalRow.u19_l += cell.u19_l;
    totalRow.u19_p += cell.u19_p;
    totalRow.u59_l += cell.u59_l;
    totalRow.u59_p += cell.u59_p;
    totalRow.u60_l += cell.u60_l;
    totalRow.u60_p += cell.u60_p;
    totalRow.total_l += cell.total_l;
    totalRow.total_p += cell.total_p;
    totalRow.grand_total += cell.grand_total;

    return {
      id: def.id,
      label: def.label,
      code: idx + 1,
      isBukanWargaGroup: def.isBukanWargaGroup,
      ...cell,
    };
  });

  return {
    yearMonth,
    monthName,
    year: yStr,
    unitKlinik: 'OUTPATIENT DEPARTMENT',
    hospital: 'DALAT',
    negeri: 'SARAWAK',
    rows,
    totalRow,
  };
}

