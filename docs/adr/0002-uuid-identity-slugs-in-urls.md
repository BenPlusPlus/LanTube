# UUID identity, slugs in URLs

Rows use UUID primary keys. People, channels, Videos, and Playlists also have a unique slug, which is what URLs use (`/watch/tahoe-day-2`, `/channel/mia`). A Person and their Home channel share a slug. Removing a Person does not free that slug, so the Frozen channel keeps its URL. Slug-as-primary-key would have matched the mockup and made SQL easier to read; UUID-plus-slug survives restore and frozen-name collisions without making a display string the key.
