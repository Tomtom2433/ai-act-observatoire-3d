/** Utilitaires de temps — dates locales pour éviter les décalages de fuseau. */

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function tsOf(iso: string): number {
  return parseISODate(iso).getTime()
}

const longFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const shortFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatDateLong(ts: number): string {
  return longFmt.format(new Date(ts))
}

export function formatDateShort(ts: number): string {
  return shortFmt.format(new Date(ts))
}

/** Durée moyenne d'un mois en ms (pour la vitesse de lecture : 1 mois / seconde). */
export const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000
