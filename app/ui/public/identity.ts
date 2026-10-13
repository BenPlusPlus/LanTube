/** Shared by server rendering and browser modules: slug, hue, and initial. */
export function slugify(name: string, fallback = 'person'): string {
  let slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || fallback
}

export function hueFor(name: string): number {
  let hue = 0
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360
  return hue
}

export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? ''
}
