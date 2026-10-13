import { MaxFileSizeExceededError, MaxFilesExceededError, MaxTotalSizeExceededError, parseFormData } from 'remix/form-data-parser'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { personFromSession } from '../../data/household.ts'
import { getStaged, publishUpload, stageUpload, UploadTooLargeError, uploadLimits, type UploadField } from '../../data/uploads.ts'
import { routes } from '../../routes.ts'
import type { UploadFormValues } from '../public/upload-form.tsx'
import { defaultUploadValues, SignInToUpload, UploadPage } from '../upload-page.tsx'

const MB = 1024 ** 2
const UNSUPPORTED = 'unsupported'
const TOO_BIG_WITHOUT_JS =
  'Without JavaScript, LanTube can take videos up to 512 MB in one go. Turn JavaScript on to send bigger ones.'

function readValues(formData: FormData, uploadId: string): UploadFormValues {
  let text = (name: string) => {
    let value = formData.get(name)
    return typeof value === 'string' ? value : ''
  }
  let duration = Number(text('duration'))
  return {
    channelId: text('channel'),
    title: text('title'),
    tags: formData.getAll('tags').filter((value): value is string => typeof value === 'string'),
    playlistId: text('playlist'),
    visibility: text('visibility') === 'private' ? 'private' : 'house',
    uploadId,
    durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0,
  }
}

export default createController(routes.upload, {
  actions: {
    index(context) {
      let person = personFromSession(context.session)
      if (!person) return context.render(<SignInToUpload />, { status: 401 })
      let requested = new URL(context.request.url).searchParams.get('to')
      return context.render(<UploadPage person={person} values={defaultUploadValues(person, requested)} />)
    },
    // The global form middleware skips this route: a no-JS upload carries the whole video, which is
    // streamed to disk here instead of being held in memory with a 1 MB cap.
    async action(context) {
      let person = personFromSession(context.session)
      if (!person) return context.render(<SignInToUpload />, { status: 401 })

      let formData: FormData
      try {
        formData = await parseFormData(
          context.request,
          { maxFiles: 2, maxFileSize: uploadLimits.formFile, maxTotalSize: uploadLimits.formFile + 4 * MB },
          async (file) => {
            if (file.fieldName === 'video') {
              if (file.size === 0) return null
              let upload = await stageUpload(person.id, file.name, file.stream(), uploadLimits.formFile)
              return upload ? upload.id : UNSUPPORTED
            }
            if (file.fieldName === 'poster') return file.size > 0 ? file : null
            return null
          },
        )
      } catch (error) {
        let tooBig =
          error instanceof MaxFileSizeExceededError ||
          error instanceof MaxTotalSizeExceededError ||
          error instanceof UploadTooLargeError
        if (!tooBig && !(error instanceof MaxFilesExceededError)) throw error
        return context.render(
          <UploadPage
            person={person}
            values={defaultUploadValues(person, null)}
            error={tooBig ? TOO_BIG_WITHOUT_JS : 'Send one video at a time.'}
            errorField="file"
          />,
          { status: 413 },
        )
      }

      let sent = formData.get('video')
      let hidden = formData.get('uploadId')
      let uploadId = typeof sent === 'string' && sent ? sent : typeof hidden === 'string' ? hidden : ''
      let poster = formData.get('poster')
      let values = readValues(formData, uploadId === UNSUPPORTED ? '' : uploadId)

      let fail = (error: string, errorField: UploadField) => {
        let staged = values.uploadId ? getStaged(values.uploadId, person.id) : undefined
        if (!staged) values.uploadId = ''
        return context.render(
          <UploadPage
            person={person}
            values={values}
            staged={staged ? { id: staged.id, name: staged.name, size: staged.size } : undefined}
            error={error}
            errorField={errorField}
          />,
          { status: 400 },
        )
      }

      if (uploadId === UNSUPPORTED) return fail('LanTube can’t play that kind of file. Choose a video like an MP4, MOV or WebM.', 'file')

      let result = await publishUpload(person.id, { ...values, poster: poster instanceof Blob ? poster : undefined })
      if ('error' in result) return fail(result.error, result.field)
      return redirect(routes.watch.href({ videoId: result.video.id }), 303)
    },
  },
})
