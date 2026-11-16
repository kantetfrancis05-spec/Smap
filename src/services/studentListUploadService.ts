import { Student } from '../types/attendance';

export interface ParsedRosterEntry {
  name: string;
  regNumber: string;
  department: string;
  year: number;
}

const REG_LIKE_PATTERN = /^(?=.*\d)[A-Z0-9/_-]{4,}$/i;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

export function isTextParsableDocument(file: File): boolean {
  if (
    file.type === 'text/csv' ||
    file.type === 'text/plain' ||
    file.type === 'text/tab-separated-values' ||
    file.type === 'application/json'
  ) {
    return true;
  }
  return /\.(csv|txt|tsv|json)$/i.test(file.name);
}

export async function readStudentListFileAsDataUrl(file: File): Promise<string> {
  // Compress large camera photos slightly so localStorage stays lightweight
  if (isImageFile(file)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          reject(new Error('Empty image data.'));
          return;
        }
        const img = new Image();
        img.onerror = () => resolve(result);
        img.onload = () => {
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read document file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Document file appears empty.'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

export function parseStudentRosterText(rawText: string): ParsedRosterEntry[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Try JSON array first if applicable
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.students) ? parsed.students : [];
      const entries: ParsedRosterEntry[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const name = String(item.name || item.studentName || item.fullName || '').trim();
        const regNumber = String(item.regNumber || item.admissionNumber || item.reg || item.id || '')
          .trim()
          .toUpperCase();
        if (name && regNumber) {
          entries.push({
            name,
            regNumber,
            department: String(item.department || 'Computer Science').trim(),
            year: Math.min(6, Math.max(1, Number(item.year) || 3)),
          });
        }
      }
      if (entries.length > 0) return entries;
    } catch {
      // fall through to CSV/line parsing
    }
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedRosterEntry[] = [];
  const seenRegs = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Split on comma, semicolon, tab, or pipe
    const cols = line
      .split(/[,;\t|]+/)
      .map((c) => c.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);

    if (cols.length < 2) continue;

    // Skip obvious header lines
    const joinedLower = cols.join(' ').toLowerCase();
    if (
      i === 0 &&
      (joinedLower.includes('admission') ||
        joinedLower.includes('reg') ||
        joinedLower.includes('student name'))
    ) {
      continue;
    }

    // Identify which column is the admission number vs student name
    let regNumber = '';
    let name = '';
    let department = 'Computer Science';
    let year = 3;

    const col0IsReg = REG_LIKE_PATTERN.test(cols[0]) && !cols[0].includes(' ');
    const col1IsReg = REG_LIKE_PATTERN.test(cols[1]) && !cols[1].includes(' ');

    if (col0IsReg && !col1IsReg) {
      regNumber = cols[0].toUpperCase();
      name = cols[1];
    } else if (col1IsReg) {
      name = cols[0];
      regNumber = cols[1].toUpperCase();
    } else {
      // Fallback: assume Name, Admission Number
      name = cols[0];
      regNumber = cols[1].toUpperCase();
    }

    if (cols[2]) {
      const maybeYear = Number(cols[2]);
      if (!Number.isNaN(maybeYear) && maybeYear >= 1 && maybeYear <= 6) {
        year = maybeYear;
      } else {
        department = cols[2];
      }
    }
    if (cols[3]) {
      const maybeYear = Number(cols[3]);
      if (!Number.isNaN(maybeYear) && maybeYear >= 1 && maybeYear <= 6) {
        year = maybeYear;
      }
    }

    if (!name || !regNumber || seenRegs.has(regNumber)) continue;
    seenRegs.add(regNumber);
    results.push({ name, regNumber, department, year });
  }

  return results;
}

export function buildStudentsFromRosterEntries(entries: ParsedRosterEntry[]): Student[] {
  return entries.map((entry, index) => ({
    id: `s-${Date.now()}-${index}`,
    regNumber: entry.regNumber,
    name: entry.name,
    department: entry.department,
    year: entry.year,
    registeredDeviceId: `DEV-LIST-${Math.floor(1000 + Math.random() * 9000)}`,
    biometricEnrolled: true,
    avatarSeed: entry.name.toLowerCase().replace(/\s+/g, '-'),
  }));
}
