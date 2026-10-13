import type { ChannelFormValues } from './channel-form-page.tsx'

export function readChannelForm(formData: FormData): ChannelFormValues & { removePhoto: boolean } {
  let text = (name: string) => {
    let value = formData.get(name)
    return typeof value === 'string' ? value : ''
  }
  return {
    name: text('name'),
    description: text('description'),
    managerIds: formData.getAll('managers').filter((value): value is string => typeof value === 'string'),
    removePhoto: text('removePhoto') === '1',
  }
}
