// Pesan error ke aplikasi tidak boleh membocorkan detail database (nama tabel/kolom, SQL, file DDL).
// Dipasang global di server: setiap respons JSON gagal yang message/error-nya berbau teknis
// diganti pesan umum. Detail asli tetap dicatat di console server oleh controller masing-masing.

export const MAINTENANCE_MESSAGE = 'Fitur ini sedang dalam perbaikan. Silakan coba lagi nanti atau hubungi admin.';

const TECHNICAL_PATTERNS = [
  /\b(tr|mst|ms|map|tmp)_[a-z0-9_]+/i, // nama tabel
  /\bER_[A-Z_]+/, // kode error MySQL
  /Table '|Unknown column|doesn't exist|Duplicate entry|foreign key|Cannot (add|delete) or update/i,
  /SQL syntax|\bsql\b|sqlMessage|\bmysql\b|ECONNREFUSED|ETIMEDOUT|ECONNRESET|PROTOCOL_/i,
  /Incorrect \w+ value|Data too long|cannot be null|Deadlock|Lock wait timeout|Too many connections/i,
  /\bDDL\b|\.sql\b|\bagent\/|migrasi|\bmigrat|\bschema\b|\bdatabase\b|\bkolom\b|\btabel\b|\btable\b|\bcolumn\b/i,
];

export function isTechnicalMessage(text) {
  return typeof text === 'string' && TECHNICAL_PATTERNS.some((re) => re.test(text));
}

export function safeErrorMessage(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const failed = res.statusCode >= 400 || (body && body.success === false);
    if (!failed || !body || typeof body !== 'object' || Array.isArray(body)) {
      return originalJson(body);
    }
    const safe = { ...body };
    delete safe.sql;
    delete safe.sqlMessage;
    for (const key of ['message', 'error', 'detail', 'details']) {
      if (!(key in safe)) continue;
      const val = safe[key];
      const text = typeof val === 'string' ? val : JSON.stringify(val ?? '');
      if (!isTechnicalMessage(text)) continue;
      if (key === 'message') safe.message = MAINTENANCE_MESSAGE;
      else delete safe[key];
    }
    return originalJson(safe);
  };
  next();
}
