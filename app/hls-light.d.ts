// hls.js ships types for its full build only; the light build has the same API without
// subtitles, alternate audio, and DRM, none of which LanTube uses.
declare module 'hls.js/light' {
  export * from 'hls.js'
  export { default } from 'hls.js'
}
