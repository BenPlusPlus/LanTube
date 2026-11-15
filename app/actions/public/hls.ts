// The player loads this only when a Video has Renditions and the browser needs hls.js to play
// them. Importing it here (not in the player) keeps hls.js in the page's import map without
// preloading it on every page. See `importMap` in app/assets.ts.
export { default } from 'hls.js/light'
