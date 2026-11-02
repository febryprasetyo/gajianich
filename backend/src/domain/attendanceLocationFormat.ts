/**
 * Attendance Location Formatter & Highlight Detection for Daily Report
 */

export interface LocationFormatInput {
  sourceType: 'ADMS' | 'MOBILE' | 'LEAVE' | 'MANUAL' | 'NONE';
  rawAddress?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

/**
 * Extracts [Kabupaten/Kota], [Provinsi] from address strings returned by Nominatim / reverse geocoders.
 */
export function extractCityAndProvince(rawAddress?: string | null): string {
  if (!rawAddress || !rawAddress.trim()) return '';

  const cleaned = rawAddress.trim();

  // Pattern 1: Look for "Kabupaten X" or "Kota X"
  const kabKotaMatch = cleaned.match(/(?:Kabupaten|Kota|Kab\.)\s+([A-Za-z\s]+?)(?:,|$)/i);
  // Indonesian provinces list
  const provinces = [
    'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi',
    'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung',
    'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
    'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
    'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
    'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
    'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan', 'Papua Barat Daya'
  ];

  let foundProvince = '';
  for (const prov of provinces) {
    const provRegex = new RegExp(`\\b${prov}\\b`, 'i');
    if (provRegex.test(cleaned)) {
      foundProvince = prov;
      break;
    }
  }

  if (kabKotaMatch && foundProvince) {
    const kabKota = kabKotaMatch[0].replace(/,$/, '').trim();
    return `${kabKota}, ${foundProvince}`;
  }

  if (kabKotaMatch) {
    return kabKotaMatch[0].replace(/,$/, '').trim();
  }

  // Fallback: If parts exist separated by commas, try taking the relevant tokens
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // If last part is "Indonesia", check previous parts
    const withoutCountry = parts.filter(p => !/^Indonesia$/i.test(p) && !/^\d{5}$/.test(p));
    if (withoutCountry.length >= 2) {
      return `${withoutCountry[withoutCountry.length - 2]}, ${withoutCountry[withoutCountry.length - 1]}`;
    }
    return withoutCountry.join(', ');
  }

  return cleaned;
}

/**
 * Formats the Lokasi Update column:
 * - ADMS machine -> static "Jakarta/ Kantor"
 * - Mobile face scan -> formatted [Kabupaten/Kota], [Provinsi]
 * - None / Absent -> empty ""
 */
export function formatLocationUpdate(input: LocationFormatInput): string {
  if (input.sourceType === 'ADMS') {
    return 'Jakarta/ Kantor';
  }

  if (input.sourceType === 'MOBILE') {
    if (input.rawAddress) {
      return extractCityAndProvince(input.rawAddress);
    }
    if (input.latitude && input.longitude) {
      return `${input.latitude}, ${input.longitude}`;
    }
    return 'Dinas Luar';
  }

  if (input.sourceType === 'LEAVE' || input.sourceType === 'NONE') {
    return '';
  }

  return '';
}

/**
 * Determines whether an employee should be automatically highlighted in yellow
 * based on Level Jabatan = Koordinator / Direktur (case-insensitive).
 */
export function shouldAutoHighlightEmployee(position?: string | null, jobLevel?: string | null): boolean {
  const combined = `${position || ''} ${jobLevel || ''}`.toLowerCase();
  return combined.includes('koordinator') || combined.includes('direktur');
}
