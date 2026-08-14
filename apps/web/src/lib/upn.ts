/* Slovenian UPN QR (bank-transfer QR code) payload + SVG. */
import { ECL, encodeSegments, makeBytesSegment, makeEciSegment } from './qrcodegen';
import type { Invoice, Profile } from './types';

const ISO88592_MAP: Record<number, number> = {
  0x0104: 0xa1, 0x02d8: 0xa2, 0x0141: 0xa3, 0x00a4: 0xa4, 0x013d: 0xa5, 0x015a: 0xa6, 0x00a7: 0xa7, 0x00a8: 0xa8,
  0x0160: 0xa9, 0x015e: 0xaa, 0x0164: 0xab, 0x0179: 0xac, 0x00ad: 0xad, 0x017d: 0xae, 0x017b: 0xaf, 0x00b0: 0xb0,
  0x00b1: 0xb1, 0x02db: 0xb2, 0x0142: 0xb3, 0x00b4: 0xb4, 0x013e: 0xb5, 0x015b: 0xb6, 0x02c7: 0xb7, 0x00b8: 0xb8,
  0x0161: 0xb9, 0x015f: 0xba, 0x0165: 0xbb, 0x017a: 0xbc, 0x02dd: 0xbd, 0x017e: 0xbe, 0x017c: 0xbf, 0x0154: 0xc0,
  0x00c1: 0xc1, 0x00c2: 0xc2, 0x0102: 0xc3, 0x00c4: 0xc4, 0x0139: 0xc5, 0x0106: 0xc6, 0x00c7: 0xc7, 0x010c: 0xc8,
  0x00c9: 0xc9, 0x0118: 0xca, 0x00cb: 0xcb, 0x011a: 0xcc, 0x00cd: 0xcd, 0x00ce: 0xce, 0x010e: 0xcf, 0x0110: 0xd0,
  0x0143: 0xd1, 0x0147: 0xd2, 0x00d3: 0xd3, 0x00d4: 0xd4, 0x0150: 0xd5, 0x00d6: 0xd6, 0x00d7: 0xd7, 0x0158: 0xd8,
  0x016e: 0xd9, 0x00da: 0xda, 0x0170: 0xdb, 0x00dc: 0xdc, 0x00dd: 0xdd, 0x0162: 0xde, 0x00df: 0xdf, 0x0155: 0xe0,
  0x00e1: 0xe1, 0x00e2: 0xe2, 0x0103: 0xe3, 0x00e4: 0xe4, 0x013a: 0xe5, 0x0107: 0xe6, 0x00e7: 0xe7, 0x010d: 0xe8,
  0x00e9: 0xe9, 0x0119: 0xea, 0x00eb: 0xeb, 0x011b: 0xec, 0x00ed: 0xed, 0x00ee: 0xee, 0x010f: 0xef, 0x0111: 0xf0,
  0x0144: 0xf1, 0x0148: 0xf2, 0x00f3: 0xf3, 0x00f4: 0xf4, 0x0151: 0xf5, 0x00f6: 0xf6, 0x00f7: 0xf7, 0x0159: 0xf8,
  0x016f: 0xf9, 0x00fa: 0xfa, 0x0171: 0xfb, 0x00fc: 0xfc, 0x00fd: 0xfd, 0x0163: 0xfe, 0x02d9: 0xff,
};

function toIso88592Bytes(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0xa0) out.push(cp & 0xff);
    else if (ISO88592_MAP[cp] !== undefined) out.push(ISO88592_MAP[cp]);
    else out.push(0x3f); // '?' fallback for unmappable characters
  }
  return out;
}

function upnControlSum(fields: string[]): string {
  const sum = fields.reduce((s, f) => s + f.length, 0) + 19;
  return String(sum).padStart(3, '0');
}

export function buildUpnQrString(profile: Profile, invoice: Invoice): string | null {
  const iban = (profile.iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(iban)) return null; // no usable IBAN
  // The bank checks the UPN against the account holder, so a personal account
  // is paid in that person's name rather than the firma.
  const name = (profile.accountHolder || profile.name || '').trim();
  if (!name) return null;
  // The UPN form wants street and locality on separate lines, which is how
  // the profile stores them.
  const street = (profile.street || '').slice(0, 33);
  const city = [profile.postalCode, profile.city].filter(Boolean).join(' ').slice(0, 33);
  const amountCents = Math.round(invoice.total * 100);
  if (!(amountCents > 0) || amountCents >= 1e11) return null;
  const purpose = `Racun ${invoice.number}`.slice(0, 42);
  const dueDate = invoice.dueDate ? invoice.dueDate.split('-').reverse().join('.') : '';

  const fields = [
    'UPNQR',
    '', '', '', '',
    '', '', '',
    String(amountCents).padStart(11, '0'),
    '', '',
    'OTHR',
    purpose,
    dueDate,
    iban,
    'SI99',
    name.slice(0, 33),
    street,
    city,
  ];
  return fields.concat([upnControlSum(fields), '']).join('\n');
}

/** Returns the QR as an SVG path string plus viewBox size, or null if unusable. */
export function buildUpnQr(
  profile: Profile,
  invoice: Invoice,
): { path: string; box: number } | null {
  try {
    const text = buildUpnQrString(profile, invoice);
    if (!text) return null;
    const bytes = toIso88592Bytes(text);
    const segs = [makeEciSegment(4), makeBytesSegment(bytes)];
    const qr = encodeSegments(segs, ECL.MEDIUM, 15, 15);
    const border = 2;
    return { path: qr.toSvgPath(border), box: qr.size + border * 2 };
  } catch (e) {
    console.error('UPN QR generation failed', e);
    return null;
  }
}
