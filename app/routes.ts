import { form, get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  watch: get('/watch/:videoId'),
  channel: get('/channel/:channelId'),
  channels: get('/channels'),
  playlists: get('/playlists'),
  history: get('/history'),
  upload: get('/upload'),
  signin: form('/signin'),
  signout: post('/signout'),
})
