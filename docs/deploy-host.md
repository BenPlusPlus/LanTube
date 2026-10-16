# Deploy LanTube on a Docker Host

The Host is Linux with Docker Compose (Ubuntu in WSL2 is one option). Postgres stays on the LAN, outside Compose. The Media share is bind-mounted at `/mnt/lantube-media`. Secrets live in `/etc/lantube/production.env` on the Host (never in git).

House names, LAN IPs, SSH targets, and Catalogue DNS pins stay on the Host in `$HOME/.config/lantube/compose.override.yaml` (copy from `compose.override.example.yaml` in this repo) and a symlink `compose.override.yaml` in the project. Do not commit that file.

## Where you type commands

SSH into the Linux that runs Docker. If that is WSL2 and the distro is owned by a different Windows account than the one you SSH as, use the distro's own sshd (or a scheduled task as the owner). Stay in that Linux shell for every step below.

Replace `$HOME/lantube` if the checkout lives somewhere else.

## One-time: turn the checkout into git

If the first copy on the Host was a tarball, convert it once so later deploys are `git pull`. Keep the overlay outside the checkout:

```sh
mkdir -p "$HOME/.config/lantube"
cp "$HOME/lantube/compose.override.yaml" "$HOME/.config/lantube/compose.override.yaml"
cd "$HOME"
mv lantube lantube.bak
git clone --branch master https://github.com/BenPlusPlus/LanTube.git lantube
ln -sfn "$HOME/.config/lantube/compose.override.yaml" "$HOME/lantube/compose.override.yaml"
cd lantube
docker compose up -d --build
```

Secrets stay in `/etc/lantube/production.env`; the clone does not contain them. Clone from GitHub on the Host. A Windows working copy (CRLF) makes Remix treat already-applied `up.sql` as checksum drift and the process will not listen.

Done when `cd "$HOME/lantube" && git status` shows `master`, and `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/` prints `200`.

## Routine deploy

### 1. Confirm the Host is ready

```sh
findmnt /mnt/lantube-media
docker info >/dev/null && echo docker_ok
test -r /etc/lantube/production.env && echo env_ok
test -r "$HOME/.config/lantube/compose.override.yaml" && echo overlay_ok
```

Done when the Media share is `cifs` (or the filesystem you mount), Docker answers, and `env_ok` and `overlay_ok` print. If the share is missing: `sudo systemctl start 'mnt-lantube\x2dmedia.mount'`.

If that unit fails with `could not resolve address`, WSL regenerated `/etc/hosts` and dropped the CIFS server pin. Confirm with `getent hosts` on the name in the mount unit `What=` line. Restore the pin (the Host boot unit `lantube-nas-hosts.service` does this), start the mount again, then `cd "$HOME/lantube" && docker compose restart` so the container bind sees the CIFS filesystem instead of the empty directory underneath.

### 2. Keep the running image as a rollback tag

```sh
cd "$HOME/lantube"
docker tag lantube:local lantube:previous
```

Skip this the very first time there is no `lantube:local` yet. Done when `docker images lantube` lists `previous` (or you skipped because there was no image).

### 3. Pull the commit you want to run

```sh
cd "$HOME/lantube"
git fetch origin
git checkout master
git pull --ff-only origin master
```

Done when `git log -1 --oneline` is the commit you meant to ship.

### 4. Build and replace the container

```sh
cd "$HOME/lantube"
docker compose build
docker compose up -d
```

The Host applies Catalogue migrations on start. If a migration fails, the process does not listen. Done when `docker compose ps` shows `lantube-lantube-1` healthy or starting, and logs contain `Server listening on http://0.0.0.0:44100`:

```sh
docker compose logs --tail 30
```

### 5. Smoke the Host URL

From the Host:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/
```

From another machine on the LAN, curl the name you use in the browser. Done when both print `200`. Open Home and confirm it still says **Streaming from** the hostname set in the overlay.

## Roll back

```sh
cd "$HOME/lantube"
docker tag lantube:previous lantube:local
docker compose up -d --no-build
```

Done when `curl` to `http://127.0.0.1/` is `200` again.

## After a Windows reboot (WSL2 Host)

WSL and Docker must be running. Mirrored networking lives in the WSL owner's `%USERPROFILE%\.wslconfig` (`networkingMode=mirrored`, plus `vmIdleTimeout=-1` and `[general] instanceIdleTimeout=-1` so the distro does not exit when no `wsl.exe` client is attached). `vmIdleTimeout=0` means shut down immediately. Then SSH into the Linux distro, `findmnt /mnt/lantube-media`, and `cd "$HOME/lantube" && docker compose up -d`. If `findmnt` is empty after a reboot, start the CIFS unit as in step 1 (including the hosts pin if name resolution failed) and restart Compose so `/media` in the container is CIFS.

`restart: unless-stopped` brings the container back once Docker is up. If the distro is owned by a different Windows account than the one you SSH as, register logon and periodic scheduled tasks as that owner to start WSL and run a keep-up script that brings Compose back when `http://127.0.0.1/` is not 200.

If Ubuntu boots into emergency mode, Docker and `:2222` stay down. A common cause is an `/etc/fstab` drvfs line for `/mnt/lantube-media-win` without `nofail`: that unit fails, `local-fs.target` fails, systemd isolates `emergency.target`, and `systemctl start docker` is canceled. Comment that fstab line (Compose bind-mounts the Linux CIFS path `/mnt/lantube-media`), `systemctl daemon-reload`, then `systemctl isolate multi-user.target`.

## Changing secrets or the Media share

```sh
sudo lantube-write-secrets
sudo lantube-check-host
cd "$HOME/lantube" && docker compose up -d
```

Type URLs and passwords only on the Host. Do not paste them into chat, and do not run `docker compose config` (it prints env).

The account in `/etc/lantube/cifs.cred` must have **Read/Write** on the Media shared folder (share permissions, not only a folder ACL). Uploads write under `/mnt/lantube-media`.

If the library is a subdirectory of the share, put that path in the mount unit `What=` (`//server/share/subdir`). The `prefixpath=` option is ignored on kernels after 3.10, so the mount lands on the share root and the container sees the whole share. After changing `What=`, `systemctl daemon-reload`, restart the unit, then `docker compose restart` so `/media` picks up the new filesystem.

## Layout (reference)

| Piece | Location |
| --- | --- |
| Compose project | `$HOME/lantube` |
| Image | `lantube:local` |
| Secrets | `/etc/lantube/production.env` (`640 root:docker`) |
| House overlay | `$HOME/.config/lantube/compose.override.yaml` (symlink in the project) |
| Media share | `/mnt/lantube-media` → container `/media` |
| HTTP | Host port 80 → container 44100 |
| Catalogue | LAN Postgres (not a container); host pin in the overlay |
