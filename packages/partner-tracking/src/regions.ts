/* Countries grouped into the regions a partner's reach is reported by. The app can pass its own table instead. */

export const REGIONS: Record<string, string[]> = {
  'East Africa': ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS'],
  'Horn of Africa': ['ET', 'DJ', 'ER', 'SO'],
  'North Africa': ['SD', 'EG', 'LY', 'TN', 'DZ', 'MA'],
  'West Africa': ['GH', 'NG', 'SN', 'CI', 'BF', 'ML', 'NE', 'BJ', 'TG', 'SL', 'LR', 'GN', 'GM', 'CV', 'MR', 'GW'],
  'Central Africa': ['CD', 'CG', 'CM', 'CF', 'TD', 'GA', 'GQ', 'AO', 'ST'],
  'Southern Africa': ['ZA', 'ZM', 'MW', 'MZ', 'ZW', 'BW', 'NA', 'LS', 'SZ', 'MG', 'MU', 'KM', 'SC'],
  'North America': ['US', 'CA', 'MX'],
};

/** The region a country is in ("Other" when it is not in the table, "Unknown" when no country is set). */
export function regionOf(country: string | null | undefined, table: Record<string, string[]> = REGIONS): string {
  const c = (country ?? '').toUpperCase();
  if (!c) return 'Unknown';
  for (const [region, list] of Object.entries(table)) if (list.includes(c)) return region;
  return 'Other';
}
