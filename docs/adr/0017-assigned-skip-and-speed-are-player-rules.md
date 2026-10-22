# Assigned skip and speed are player rules

On an assigned Video the Watch player caps speed at 1.5× and will not seek past this Person’s furthest playhead. `/media` still serves the original file with range requests so the player can buffer. Clamping ranges at the high-water mark would break playback. The play gate still 403s media for a *different*, non-assigned Video. This is not DRM.
