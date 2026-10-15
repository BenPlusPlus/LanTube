# Deploy LanTube on the PHANTOM Host

The Host is Ubuntu in WSL2 on **PHANTOM**. Docker Compose runs the app. Postgres stays on **expsql01**. The Media share is bind-mounted at `/mnt/lantube-media`. Secrets live in `/etc/lantube/production.env` on the Host (never in git).

House URLs after a good deploy: [http://lantube.metropolis.excaliburstudios.org/](http://lantube.metropolis.excaliburstudios.org/) and [http://bairdtube.metropolis.excaliburstudios.org/](http://bairdtube.metropolis.excaliburstudios.org/).

## Where you type commands

SSH into Ubuntu (not Windows):

```sh
ssh -p 2222 ben@phantom
```

The WSL distro belongs to **METROPOLIS\ben**. A Windows SSH session as `phantom\ben` cannot see that distro. Stay in the Ubuntu shell for every step below.

## One-time: turn the checkout into git

The first copy on the Host was a tarball. Git is installed. Do this once so later deploys are `git pull`.

```sh
cd /home/ben
mv lantube lantube.bak
git clone --branch docker-compose-host https://github.com/BenPlusPlus/LanTube.git lantube
cd lantube
docker compose up -d --build
```

Secrets stay in `/etc/lantube/production.env`; the clone does not contain them. After Docker files land on `master`, clone that branch instead and use it in the routine steps.

Done when `cd /home/ben/lantube && git status` shows a branch, and `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/` prints `200`.

## Routine deploy

### 1. Confirm the Host is ready

```sh
findmnt /mnt/lantube-media
docker info >/dev/null && echo docker_ok
test -r /etc/lantube/production.env && echo env_ok
```

Done when the Media share is `cifs`, Docker answers, and `env_ok` prints. If the share is missing: `sudo systemctl start 'mnt-lantube\x2dmedia.mount'`.

### 2. Keep the running image as a rollback tag

```sh
cd /home/ben/lantube
docker tag lantube:local lantube:previous
```

Skip this the very first time there is no `lantube:local` yet. Done when `docker images lantube` lists `previous` (or you skipped because there was no image).

### 3. Pull the commit you want to run

```sh
cd /home/ben/lantube
git fetch origin
git checkout docker-compose-host
git pull --ff-only origin docker-compose-host
```

Switch `docker-compose-host` to `master` once that branch holds the Docker files. Done when `git log -1 --oneline` is the commit you meant to ship.

### 4. Build and replace the container

```sh
cd /home/ben/lantube
docker compose build
docker compose up -d
```

The Host applies Catalogue migrations on start. If a migration fails, the process does not listen. Done when `docker compose ps` shows `lantube-lantube-1` healthy or starting, and logs contain `Server listening on http://0.0.0.0:44100`:

```sh
docker compose logs --tail 30
```

### 5. Smoke the house URL

From the Host:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1/
```

From another machine on the LAN:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' http://lantube.metropolis.excaliburstudios.org/
```

Done when both print `200`. Open Home in a browser and confirm it still says **Streaming from phantom**.

## Roll back

```sh
cd /home/ben/lantube
docker tag lantube:previous lantube:local
docker compose up -d --no-build
```

Done when `curl` to `http://127.0.0.1/` is `200` again.

## After a Windows reboot

WSL and Docker must be running. Mirrored networking is in `%USERPROFILE%\.wslconfig` for **METROPOLIS\ben**. Then:

```sh
ssh -p 2222 ben@phantom
findmnt /mnt/lantube-media
cd /home/ben/lantube && docker compose up -d
```

`restart: unless-stopped` brings the container back once Docker is up.

## Changing secrets or the Media share

```sh
sudo lantube-write-secrets
sudo lantube-check-host
cd /home/ben/lantube && docker compose up -d
```

Type URLs and passwords only on the Host. Do not paste them into chat, and do not run `docker compose config` (it prints env).

The Synology account in `/etc/lantube/cifs.cred` must have **Read/Write** on shared folder **InternetVideo** (share permissions, not only a folder ACL). Uploads write under `/mnt/lantube-media`.

## Layout (reference)

| Piece | Location |
| --- | --- |
| Compose project | `/home/ben/lantube` |
| Image | `lantube:local` |
| Secrets | `/etc/lantube/production.env` (`640 root:docker`) |
| Media share | `/mnt/lantube-media` → container `/media` |
| HTTP | Host port 80 → container 44100 |
| Catalogue | `expsql01:5432` (not a container) |
