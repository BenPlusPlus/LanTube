# Postgres catalogue, bytes on a mounted share

The catalogue (People, roles, channels, Videos, Playlists, Audience, History) lives in Postgres on the LAN. Video files, posters, and photos live on the Media share, mounted on the Host as an ordinary path (`LANTUBE_MEDIA_DIR`). SQLite would have been simpler on a single box; Postgres is already on the LAN and fits concurrent watch and upload. Synology File Station (and any other vendor API) was rejected so the watch path stays a filesystem and the player’s existing range-request code keeps working.
