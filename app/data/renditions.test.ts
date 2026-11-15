import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, describe, it } from 'remix/test'

import { addUploadedVideo, deleteVideo, getVideo, type Video } from './library.ts'
import { mediaDir } from './media.ts'
import {
  ffmpegArgs,
  LADDER,
  LADDER_VERSION,
  parseProbe,
  planLadder,
  queueRenditions,
  removeRenditions,
  renditionFileFor,
  renditionsDir,
  renditionsReady,
  renditionsStatus,
  startRenditions,
  stopRenditions,
} from './renditions.ts'

describe('parseProbe', () => {
  it('reads a sideways phone video as portrait', () => {
    let probe = parseProbe({
      streams: [
        {
          index: 0,
          codec_type: 'video',
          width: 1920,
          height: 1080,
          bit_rate: '16000000',
          side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }],
        },
        { index: 1, codec_type: 'audio', bit_rate: '192000' },
      ],
      format: { duration: '61.5' },
    })
    assert.deepEqual(probe, { videoIndex: 0, width: 1080, height: 1920, videoKbps: 16000, audioIndex: 1, durationSec: 61.5 })
  })

  it('skips cover art for the real picture and estimates bitrate from the container', () => {
    let probe = parseProbe({
      streams: [
        { index: 0, codec_type: 'video', width: 600, height: 600, disposition: { attached_pic: 1 } },
        { index: 1, codec_type: 'audio', bit_rate: '128000' },
        { index: 2, codec_type: 'video', width: 1280, height: 720 },
      ],
      format: { duration: '10', bit_rate: '3128000' },
    })
    assert.equal(probe?.videoIndex, 2)
    assert.equal(probe?.videoKbps, 3000)
    assert.equal(probe?.audioIndex, 1)
  })

  it('finds nothing to copy in an audio-only or broken file', () => {
    assert.equal(parseProbe({ streams: [{ index: 0, codec_type: 'audio' }], format: {} }), null)
    assert.equal(parseProbe({}), null)
    assert.equal(parseProbe(null), null)
  })
})

describe('planLadder', () => {
  it('makes every step for a 4K file, none larger than the ladder says', () => {
    let rungs = planLadder({ width: 3840, height: 2160, videoKbps: 45000 })
    assert.deepEqual(
      rungs.map((rung) => [rung.name, rung.width, rung.height, rung.videoKbps]),
      [
        ['1080p', 1920, 1080, 5000],
        ['720p', 1280, 720, 2800],
        ['480p', 852, 480, 1200],
        ['360p', 640, 360, 700],
      ],
    )
    assert.equal(rungs.length, LADDER.length)
  })

  it('never makes a copy taller than the source', () => {
    let rungs = planLadder({ width: 1280, height: 720 })
    assert.deepEqual(
      rungs.map((rung) => rung.name),
      ['720p', '480p', '360p'],
    )
  })

  it('keeps portrait videos portrait, with the step on the short side', () => {
    let rungs = planLadder({ width: 1080, height: 1920 })
    assert.deepEqual(rungs[0], { name: '1080p', width: 1080, height: 1920, videoKbps: 5000, audioKbps: 128 })
    assert.equal(rungs[1].width, 720)
    assert.equal(rungs[1].height, 1280)
  })

  it('never spends more bits than the source and drops steps that would cost the same as the one above', () => {
    let rungs = planLadder({ width: 1920, height: 1080, videoKbps: 1500 })
    assert.deepEqual(
      rungs.map((rung) => [rung.name, rung.videoKbps]),
      [
        ['1080p', 1500],
        ['480p', 1200],
        ['360p', 700],
      ],
    )
  })

  it('gives a tiny file one copy at its own size with even dimensions', () => {
    let rungs = planLadder({ width: 321, height: 241 })
    assert.equal(rungs.length, 1)
    assert.equal(rungs[0].height, 240)
    assert.equal(rungs[0].width % 2, 0)
    assert.ok(rungs[0].width <= 321)
  })
})

describe('ffmpegArgs', () => {
  it('leaves audio out of every step when the file has none', () => {
    let probe = { videoIndex: 0, width: 1280, height: 720 }
    let args = ffmpegArgs('in.mp4', probe, planLadder(probe), 'out')
    let map = args[args.indexOf('-var_stream_map') + 1]
    assert.equal(map, 'v:0,name:720p v:1,name:480p v:2,name:360p')
    assert.equal(args.includes('-c:a'), false)
  })

  it('pairs each step with the source audio stream it found', () => {
    let probe = { videoIndex: 1, audioIndex: 0, width: 1280, height: 720 }
    let args = ffmpegArgs('in.mp4', probe, planLadder(probe), 'out')
    assert.equal(args.filter((arg) => arg === '0:0').length, 3)
    assert.match(args[args.indexOf('-filter_complex') + 1], /^\[0:1\]split=3/)
    assert.equal(args[args.indexOf('-var_stream_map') + 1], 'v:0,a:0,name:720p v:1,a:1,name:480p v:2,a:2,name:360p')
  })
})

/** A fake finished set for the fixture file, as the encoder would leave it. */
function fakeRenditions(videoId: string, sourceFile: string, version = LADDER_VERSION) {
  let dir = path.join(renditionsDir, videoId)
  fs.mkdirSync(path.join(dir, '720p'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'master.m3u8'), '#EXTM3U\n')
  fs.writeFileSync(path.join(dir, '720p', 'index.m3u8'), '#EXTM3U\n')
  fs.writeFileSync(path.join(dir, '720p', 'init_0.mp4'), 'init')
  fs.writeFileSync(path.join(dir, '720p', 'seg-00000.m4s'), 'seg')
  let stat = fs.statSync(path.join(mediaDir, sourceFile))
  fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify({ version, size: stat.size, mtimeMs: Math.round(stat.mtimeMs) }))
  return dir
}

describe('Renditions on disk', () => {
  afterEach(() => {
    fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
  })

  it('is ready only when made from the file that is there now, by this ladder', () => {
    let video = getVideo('tahoe-day-2')!
    assert.equal(renditionsReady(video), false)
    fakeRenditions(video.id, video.file ?? `${video.id}.mp4`)
    assert.equal(renditionsReady(video), true)

    fakeRenditions(video.id, video.file ?? `${video.id}.mp4`, LADDER_VERSION - 1)
    assert.equal(renditionsReady(video), false, 'an older ladder is made again')

    let dir = fakeRenditions(video.id, video.file ?? `${video.id}.mp4`)
    let stamp = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8'))
    fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify({ ...stamp, size: stamp.size + 1 }))
    assert.equal(renditionsReady(video), false, 'a replaced file is made again')
  })

  it('serves only playlist and segment files inside the Video’s own folder', () => {
    let video = getVideo('tahoe-day-2')!
    fakeRenditions(video.id, video.file ?? `${video.id}.mp4`)

    assert.equal(renditionFileFor(video, 'master.m3u8')?.type, 'application/vnd.apple.mpegurl')
    assert.equal(renditionFileFor(video, '720p/init_0.mp4')?.type, 'video/mp4')
    assert.equal(renditionFileFor(video, '720p/seg-00000.m4s')?.type, 'video/iso.segment')
    assert.equal(renditionFileFor(video, '720p/seg-00001.m4s'), null, 'missing segment')
    assert.equal(renditionFileFor(video, 'source.json'), null)
    assert.equal(renditionFileFor(video, '720p/../../tahoe-day-2.failed.json'), null)
    assert.equal(renditionFileFor(video, '../../../tahoe-day-2.mp4'), null)
    assert.equal(renditionFileFor({ ...video, id: '..' }, 'master.m3u8'), null)
  })
})

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0

async function until(check: () => boolean, ms: number) {
  let end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) return false
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return true
}

describe('making Renditions with ffmpeg', () => {
  let clip = 'renditions-test-clip.mp4'
  let id = 'renditions-test-clip'

  afterEach(async () => {
    stopRenditions()
    await removeRenditions(id)
    deleteVideo(id)
    fs.rmSync(path.join(mediaDir, clip), { force: true })
    fs.rmSync(path.join(mediaDir, '.lantube'), { recursive: true, force: true })
  })

  function addClip(seconds: number): Video {
    let made = spawnSync('ffmpeg', [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=854x480:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440',
      '-t', String(seconds), '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
      path.join(mediaDir, clip),
    ])
    assert.equal(made.status, 0, String(made.stderr))
    return addUploadedVideo({ id, title: 'Renditions test clip', channelId: 'mia', durationSec: seconds, thumb: '', tags: [], file: clip })
  }

  it('makes an HLS ladder a player can walk, then deletes it with the Video', { skip: hasFfmpeg ? undefined : 'ffmpeg is not installed', timeout: 120_000 }, async () => {
    let video = addClip(6)
    startRenditions({ NODE_ENV: 'test', LANTUBE_RENDITIONS: 'on' }, { backfill: false })
    queueRenditions(video.id)
    assert.ok(await until(() => renditionsReady(video), 100_000), 'Renditions never finished')
    assert.equal(renditionsStatus().making, undefined)

    let master = fs.readFileSync(renditionFileFor(video, 'master.m3u8')!.path, 'utf8')
    let steps = [...master.matchAll(/^(\d+p)\/index\.m3u8$/gm)].map((match) => match[1])
    assert.deepEqual(steps, ['480p', '360p'], master)
    assert.doesNotMatch(master, /\\/, 'playlist URIs use forward slashes')
    for (let step of steps) {
      let playlist = fs.readFileSync(renditionFileFor(video, `${step}/index.m3u8`)!.path, 'utf8')
      let uris = playlist.split('\n').filter((line) => line && !line.startsWith('#'))
      let init = /#EXT-X-MAP:URI="([^"]+)"/.exec(playlist)?.[1]
      assert.ok(init && renditionFileFor(video, `${step}/${init}`), `${step} init segment is servable`)
      assert.ok(uris.length >= 2, `${step} has segments`)
      for (let uri of uris) assert.ok(renditionFileFor(video, `${step}/${uri}`), `${step}/${uri} is servable`)
    }
    assert.deepEqual(
      fs.readdirSync(renditionsDir).filter((name) => name.includes('.partial-')),
      [],
      'no half-made folder is left behind',
    )

    await removeRenditions(video.id)
    assert.equal(renditionsReady(video), false)
    assert.equal(fs.existsSync(path.join(renditionsDir, video.id)), false)
  })

  it('stops the encode and leaves nothing when the Video goes mid-way', { skip: hasFfmpeg ? undefined : 'ffmpeg is not installed', timeout: 60_000 }, async () => {
    let video = addClip(180)
    startRenditions({ NODE_ENV: 'test', LANTUBE_RENDITIONS: 'on' }, { backfill: false })
    queueRenditions(video.id)
    assert.ok(await until(() => renditionsStatus().making?.videoId === video.id, 30_000), 'encode never started')

    await removeRenditions(video.id)
    assert.ok(await until(() => renditionsStatus().making === undefined, 30_000), 'encode never stopped')
    assert.equal(renditionsReady(video), false)
    let left = fs.existsSync(renditionsDir) ? fs.readdirSync(renditionsDir) : []
    assert.deepEqual(left, [])
  })
})
