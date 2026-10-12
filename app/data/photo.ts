/** Reads an optional `photo` upload into a data URL kept on the host. */
export async function readPhoto(formData: FormData, field = 'photo'): Promise<string | undefined | { error: string }> {
  let file = formData.get(field)
  if (!(file instanceof File) || file.size === 0) return undefined
  if (file.size > 1024 * 1024) return { error: 'Keep the photo under 1 MB.' }
  if (!file.type.startsWith('image/')) return { error: 'Choose a photo file (JPEG, PNG, or WebP).' }
  let bytes = Buffer.from(await file.arrayBuffer())
  return `data:${file.type};base64,${bytes.toString('base64')}`
}
