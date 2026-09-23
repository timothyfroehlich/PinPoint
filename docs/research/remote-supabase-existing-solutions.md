# Existing solutions for Mac development against remote Supabase containers

Research date: 2026-09-21

## Verdict

Yes: the exact architecture already has public prior art, and current stable Supabase CLI support is farther along than the original pilot plan assumed.

The closest match is Thai Pangsakulyanont's short recipe, [Running Supabase on a remote VPS while keeping local development workflow](https://dt.in.th/SupabaseLocalVPS). It runs the Supabase CLI on the developer's Mac against an SSH-backed remote Docker context, forwards ports 54321-54324 back with `autossh`, supplies a loopback-bound Docker network, and calls `supabase start --network-id ...`. The author explicitly says the result behaves like local Supabase development and notes the remaining bind-mount limitation.

A second, more defensive public implementation is Keepr Compliance's
[`supabase-nas-stack.sh`](https://github.com/Keepr-Compliance/Mad/blob/1fc8cee83306d9000956a687e55cb2f9f889c0dc/scripts/supabase-nas-stack.sh).
It requires an SSH `DOCKER_HOST`, verifies the target database identity, checks
for local port conflicts, creates a restricted Docker network, holds temporary
port forwards while `supabase start` performs its health checks, and scopes
shutdown to its project. It is Docker/NAS-specific and not directly reusable on
Bazzite's Podman 5, but it independently proves the same architecture and the
guards a production-quality helper needs.

There is no mature, maintained, Supabase-specific wrapper to adopt wholesale in the results reviewed. The useful pieces are already in Supabase CLI, Docker/Podman, OpenSSH, and `autossh`; the missing piece is a small project-specific lifecycle wrapper. One repository that claims to package this, [bbleak-repo/supabase-self-hosted-platform](https://github.com/bbleak-repo/supabase-self-hosted-platform), is not suitable: it has one commit, zero stars, no declared license, hard-coded IPs and credentials, broad `pkill` cleanup, and uses the full self-hosted Compose stack rather than the CLI's local-development stack.

## What stable Supabase CLI already supports

The current stable release is [v2.117.0](https://github.com/supabase/cli/releases/tag/v2.117.0). The important remote-daemon work predates it:

- Docker contexts, including an `ssh://` context, have been supported since the fix for [supabase/cli#1223](https://github.com/supabase/cli/issues/1223). The reporter verified the follow-up beta with `docker context use test-context` against an SSH-backed daemon.
- `SUPABASE_SERVICES_HOSTNAME` was added by [supabase/cli#1852](https://github.com/supabase/cli/pull/1852) specifically for Docker-in-Docker and remote Docker hosts.
- Stable v2.117's hostname resolver honors `SUPABASE_SERVICES_HOSTNAME`, then a TCP `DOCKER_HOST`, then the active Docker context, and otherwise returns `127.0.0.1`; see [`legacy-hostname.ts` at v2.117.0](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-hostname.ts). An `ssh://` or Unix-socket daemon therefore intentionally yields localhost-facing service URLs, which is exactly right when SSH service-port forwards are present.
- The stable CLI invokes the local `docker` or `podman` executable and inherits `DOCKER_HOST` and related environment state; see [`legacy-container-cli.ts` at v2.117.0](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-container-cli.ts). It prefers `docker` and falls back to `podman` only when `docker` cannot be spawned—not when a present Docker CLI returns an error.
- [v2.115.0](https://github.com/supabase/cli/releases/tag/v2.115.0) explicitly fixed `supabase start` for remote Docker contexts by streaming generated container secrets through `docker cp` instead of host temporary-file bind mounts. The tagged [`start` side-effect contract](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/commands/start/SIDE_EFFECTS.md) explains that this transport works against remote `DOCKER_HOST`/Docker-context daemons.

This is real stable functionality, not a reason to adopt a beta.

## What v2.118 beta/main changes

The latest prerelease reviewed was [v2.118.0-beta.60](https://github.com/supabase/cli/releases/tag/v2.118.0-beta.60). The v2.118 line begins with a [managed local-stack runtime rewrite](https://github.com/supabase/cli/releases/tag/v2.118.0-beta.1), but it does not introduce an end-to-end remote-development command or automatic SSH forwarding.

The current TypeScript source refactors the same behavior into [`hostname.ts`](https://github.com/supabase/cli/blob/v2.118.0-beta.60/apps/cli/src/command-internal/hostname.ts): `DOCKER_HOST`, `DOCKER_CONTEXT`, the Docker context store, and `SUPABASE_SERVICES_HOSTNAME` are still the primitives. The beta therefore does not remove the need for a tunnel/lifecycle wrapper, and there is no remote-Supabase benefit here that justifies moving PinPoint off its locked stable CLI for the pilot.

## Remaining upstream limitation: host bind mounts

Remote-daemon support is not universal because a bind source path is interpreted on the daemon host, not on the Mac.

The v2.117 `start` contract says generated Kong/Postgres/Supavisor secrets and the Edge Runtime bootstrap now use `docker cp`, but user function sources and multiline Edge Function secret staging still use host bind mounts. Studio also resolves function-source mounts. Those paths require the remote daemon to see the client's project path.

PinPoint's lightweight [`supabase/config.toml.template`](../../supabase/config.toml.template) currently disables both Studio and Edge Runtime, so the known remaining bind-mount paths should not be exercised by this pilot. That must still be verified from the actual container-create arguments; it should not be assumed for future configurations that enable those services.

## Bazzite/Podman adaptation

The public VPS recipe assumes a real remote Docker Engine. Bazzite has rootless Podman, so two parts need adaptation.

### Remote container API transport

Do not expose Podman's API over an unauthenticated TCP port. Podman's official [`podman system service` documentation](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html) says its socket exposes a Docker-compatible API, grants arbitrary code execution as the socket's user, and recommends forwarding the Unix socket over SSH for remote access.

Two clean Mac-side transports are available:

1. Point Docker directly at Bazzite's rootless Podman socket with
   `DOCKER_HOST=ssh://<user>@bazzite/run/user/<uid>/podman/podman.sock`; or
2. SSH-forward that socket to a private Unix socket on the Mac and use
   `DOCKER_HOST=unix://...`.

Both keep the privileged container API behind SSH. In a read-only live check on
2026-09-21, the Mac Docker client reached Bazzite's rootless socket with the
first form and reported Podman server `5.8.4`; the installed Supabase CLI
`2.117.0` then followed the same `DOCKER_HOST` and attempted to inspect the
expected remote project container. This proves the control-plane route without
starting a stack.

Podman also has its own SSH-backed remote client and `CONTAINER_HOST`; see
[`podman-remote`](https://docs.podman.io/en/latest/markdown/podman-remote.1.html).
It is a poorer fit for this project because stable Supabase prefers an installed
`docker` executable and its hostname resolver understands Docker variables and
contexts, not `CONTAINER_HOST`.

### Loopback-only service publishing

Supabase's [official local-development guide](https://supabase.com/docs/guides/local-development) recommends a Docker network with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`, then `supabase start --network-id ...`, to keep published service ports on loopback. That is the same technique used by the public VPS recipe.

Podman does not implement Docker's
`com.docker.network.bridge.host_binding_ipv4` network option; the Bazzite probe
rejected it. Podman added a different `[network] default_host_ips` setting in
[Podman 6.0](https://github.com/podman-container-tools/podman/releases/tag/v6.0.0),
via [podman#27938](https://github.com/podman-container-tools/podman/pull/27938).
Bazzite currently has Podman `5.8.4`, so that setting is not available there;
the probe correctly continued to publish on `0.0.0.0`.

This is the one material gap an adopted recipe does not solve. The pilot must either:

- prove that Bazzite's host firewall limits the published ports to the intended private path,
- move the pilot to Podman 6+ and use `default_host_ips = ["127.0.0.1", "::1"]`, or
- use a tightly scoped wrapper that rewrites this pilot's publish arguments to `127.0.0.1:<port>:<container-port>`.

It should not expose or forward the Podman API over TCP as a workaround.

## Existing approaches compared

| Approach                                                                     | Reuses local CLI config and volumes          | Works with Bazzite Podman                                         | Preserves Mac localhost URLs  | Assessment                                                                    |
| ---------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| Public VPS recipe: Mac CLI + remote Docker context + `autossh`               | Yes                                          | Yes for control plane; replace Docker-only bind-network hardening | Yes                           | Best prior art and architecture model                                         |
| Keepr NAS lifecycle script: Mac CLI + SSH `DOCKER_HOST` + guarded forwarding | Yes                                          | Not unchanged; Docker-specific bind network                       | Yes                           | Strong operational precedent; borrow the guard design, not the file wholesale |
| Run CLI over SSH on Bazzite + forward service ports                          | Yes                                          | Yes                                                               | Yes                           | Closest to the original plan; still needs a small lifecycle helper            |
| Podman's native remote client via `CONTAINER_HOST`                           | Mostly                                       | Yes                                                               | With separate service tunnels | Possible, but Supabase's Docker-first runtime selection makes it awkward      |
| Official self-hosted Supabase Compose stack                                  | No; different config/version/lifecycle model | Compose may work                                                  | With tunnels/reconfiguration  | Wrong abstraction for a worktree-isolated local-development pilot             |
| `bbleak-repo/supabase-self-hosted-platform` scripts                          | No                                           | Docker-oriented                                                   | Partly                        | Unsafe/unmaintained example, not adoptable                                    |

## Recommendation for the proof

Do not build a novel remote-Supabase orchestrator and do not switch to v2.118 beta. Base the proof on stable v2.117's existing remote-daemon support and the published Docker-context + `autossh` recipe.

For the lowest-risk Bazzite proof, retain a small pilot-only `start/status/stop` wrapper but reduce its responsibility to:

- own and verify one SSH control process;
- select the rootless Podman socket through Docker's SSH transport (or a forwarded Unix socket) and forward the selected service ports;
- export `DOCKER_HOST` and `SUPABASE_SERVICES_HOSTNAME` only for the invoked stable CLI command;
- verify project/container labels and readiness;
- stop only its recorded SSH process and project-scoped containers; and
- explicitly report the Podman loopback-binding/firewall result.

If keeping the requirement that lifecycle commands execute _on Bazzite_ is more important than using the CLI's remote-daemon support, run the stable CLI in the isolated Bazzite worktree and borrow only the `autossh` service-port portion of the public recipe. That still avoids inventing the networking design; it simply chooses the Podman-native side of the same established pattern.

## Podman 6 addendum (2026-09-21)

The pilot remains paused. This addendum is source research only; no Bazzite service, image, or configuration was changed.

### `default_host_ips` also covers Docker-compatible creates

Podman 6.0 added `[network] default_host_ips` specifically for published ports whose caller does not provide a host IP. The merged implementation says that an explicit IP always wins ([podman#27938](https://github.com/podman-container-tools/podman/pull/27938)); the 6.1 documentation makes the cases explicit: `0.0.0.0` is wildcard IPv4, `[::]` is wildcard IPv6, any other explicit address is exact, and an omitted address receives the configured defaults ([Podman 6.1.2 publish documentation](https://github.com/podman-container-tools/podman/blob/v6.1.2/docs/source/markdown/options/publish.md)).

This is honored by Docker-compatible API container creation, not only by the native `podman` CLI. In Podman 6.0, the compatibility handler converts Docker `HostConfig.PortBindings` into the same libpod port-mapping structure and leaves `HostIP` empty when the request does not contain a valid address ([compat create handler](https://github.com/podman-container-tools/podman/blob/v6.0.0/pkg/api/handlers/compat/containers_create.go)). Container creation then expands every empty `HostIP` using `DefaultHostIPs`; a non-empty value is retained unchanged ([libpod create path](https://github.com/podman-container-tools/podman/blob/v6.0.0/libpod/runtime_ctr.go#L311-L326)). Docker's own `-p hostPort:containerPort` parser produces an empty `HostIP` when no address is written ([Docker `ParsePortSpec`](https://github.com/docker/go-connections/blob/main/nat/nat.go#L156-L165)). Therefore Supabase's ordinary `docker create --publish hostPort:containerPort` requests should receive `default_host_ips` through the compatibility API.

The practical bypass rule is: **every valid explicit `HostIp` bypasses the setting**. That includes `0.0.0.0`, `::`, `127.0.0.1`, and a Tailscale/LAN address. Omitted or empty `HostIp` receives the defaults. A malformed value should be rejected or treated as absent depending on decoder behavior and is not a safe interface to rely on.

### It can be isolated to a pilot API socket

`containers.conf` is loaded by the Podman process. `CONTAINERS_CONF=/path/file` makes that process ignore the normal system and user files and load only the named file; modules instead load after the normal configuration and override only their specified fields ([containers.conf environment and module rules](https://github.com/podman-container-tools/container-libs/blob/common/v0.68.0/common/docs/containers.conf.5.md)). Podman exposes modules through its global, repeatable `--module` flag ([Podman 6 configuration loading](https://github.com/podman-container-tools/podman/blob/v6.0.0/cmd/podman/registry/config.go#L63-L96)). There is no documented `CONTAINERS_CONF_MODULES` variable.

Podman also supports a custom Unix endpoint for a service process, for example `podman system service --time 0 unix:///path/pilot.sock` ([service documentation](https://github.com/podman-container-tools/podman/blob/v6.0.0/docs/source/markdown/podman-system-service.1.md)). Combining those interfaces permits a dedicated rootless pilot service such as `podman --module=/absolute/path/pilot.conf system service ...`, with only:

```toml
[network]
default_host_ips = ["127.0.0.1", "::1"]
```

Requests through that socket get the override; Crabbox's existing default socket and ordinary Podman processes do not. A dedicated service with a service-local `CONTAINERS_CONF` environment is also process-scoped, but a module is safer because `CONTAINERS_CONF` discards the normal configuration chain.

This isolates configuration, **not authority or storage**: both sockets still address the same rootless user's libpod database and containers. The pilot socket must remain SSH-protected, and lifecycle code must still verify project labels/IDs and never issue broad stop or removal operations. Existing and already-created Crabbox containers are not rebound; `default_host_ips` is applied when a new container's port mappings are created.

### Podman 6 contains the archive-upload broken-pipe fix

The observed `docker cp -` failure has an exact upstream diagnosis. [Buildah issue #6573](https://github.com/podman-container-tools/buildah/issues/6573) reports `PUT /containers/.../archive` returning HTTP 500 with `passing bulk input to subprocess: ... broken pipe`: Go's tar reader stops after the two-block end marker while trailing zero padding remains, so the copier subprocess can exit before the API request finishes writing.

[Buildah PR #6678](https://github.com/podman-container-tools/buildah/pull/6678), commit [`595af50`](https://github.com/podman-container-tools/buildah/commit/595af5038d125d7b79ff112171f9ab5d834da708), fixes that race by draining the remainder of the tar stream before the subprocess exits. The fix is present in Buildah 1.44.0 ([fixed source](https://github.com/podman-container-tools/buildah/blob/v1.44.0/copier/copier.go#L2282-L2295)). Podman's Docker-compatible archive handler reaches `ContainerCopyFromArchive`, whose libpod implementation calls Buildah's copier ([API handler](https://github.com/podman-container-tools/podman/blob/v6.0.0/pkg/api/handlers/compat/containers_archive.go#L123-L131), [copy implementation](https://github.com/podman-container-tools/podman/blob/v6.0.0/libpod/container_copy_common.go#L210-L229)).

Podman 6.0.0 explicitly requires and ships with Buildah 1.44.0 ([6.0.0 release notes](https://github.com/podman-container-tools/podman/releases/tag/v6.0.0)); 6.0.1 remains on 1.44.0, 6.0.2 uses 1.44.1, 6.1.0/6.1.1 use 1.45.0, and 6.1.2 uses 1.45.1 (the corresponding tagged [`go.mod` files](https://github.com/podman-container-tools/podman/blob/v6.1.2/go.mod)). Thus **every upstream Podman release from 6.0.0 through 6.1.2 contains the relevant fix**. This is a strong reason not to invest in a pilot-specific retry or archive rewrite once Podman 6 is available.

### Bazzite stable does not yet provide Podman 6

The current Bazzite stable release is Fedora 44-based ([Bazzite `44.20260921`](https://github.com/ublue-os/bazzite/releases/tag/44.20260921)). Fedora's package index currently lists Podman `5.8.7` for Fedora 44, `6.1.1` stable / `6.1.2` testing for Fedora 45, and `6.1.2` for Rawhide ([Fedora Podman package matrix](https://packages.fedoraproject.org/pkgs/podman/podman/)). Consequently, a normal update of today's stable Bazzite/Fedora 44 image cannot produce Podman 6; availability begins at the Fedora 45 image boundary unless Bazzite deliberately backports it.

A read-only live probe on 2026-09-21 found the shared host booted into Bazzite
`44.20260902` with Podman `5.8.4`, Buildah `1.43.2`, containers-common
`0.67.0`, Netavark `1.17.2`, and Aardvark DNS `1.17.1`; its already-staged
`44.20260908` deployment did not change those container packages. The host is
already using SQLite storage metadata, Netavark networking, Pasta for rootless
networking, and cgroups v2. Those facts avoid Podman 6's BoltDB, CNI,
slirp4netns, and cgroups-v1 migration paths, but they do not make a single-binary
upgrade safe: Podman 6 explicitly requires the coordinated 2.x networking and
0.68+ configuration libraries shipped together at the Fedora 45 boundary.

Bazzite updates are whole-image deployments applied on reboot, with stable normally refreshed on its release cadence ([Bazzite update guide](https://docs.bazzite.gg/Installing_and_Managing_Software/Updates_Rollbacks_and_Rebasing/updating_guide/)). Moving early requires rebasing to another Bazzite channel/image, while Bazzite warns that package layering can block future image upgrades and should be a last resort ([rebase guide](https://docs.bazzite.gg/Installing_and_Managing_Software/Updates_Rollbacks_and_Rebasing/rebase_guide/), [package-layering warning](https://docs.bazzite.gg/Installing_and_Managing_Software/rpm-ostree/)). Replacing only the host Podman package is therefore not a low-risk pilot prerequisite: Podman 6 also declares coordinated Buildah, Netavark/Aardvark, and container-libs versions in its release notes.

**Decision for this pilot:** wait for a normal Bazzite Fedora 45/stable image before using the clean `default_host_ips` + fixed archive path, or explicitly approve a separate experimental OS/image boundary. Do not layer or hand-install Podman 6 onto the shared stable host, and do not change Crabbox's socket. If the proof must proceed on Fedora 44, its loopback binding and archive-copy workarounds remain pilot-specific evidence gaps rather than solved platform behavior.

## Archive-transfer options addendum (2026-09-22)

As of this check, GitHub's [latest stable Supabase CLI release](https://github.com/supabase/cli/releases/latest) still resolves to v2.117.0. Its [published `start` flags](https://supabase.com/docs/reference/cli/supabase-start) are `--exclude` and `--ignore-health-check`; its [tagged startup contract](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/commands/start/SIDE_EFFECTS.md#files-written) lists configuration and environment overrides but no supported option to replace, disable, or retune streamed `docker cp -` secret delivery. `--ignore-health-check` changes failure handling, not copying; `--network-id` changes the container network. The v2.118 prerelease line is not a stable upgrade path for PinPoint's locked CLI.

For the present lightweight [`config.toml.template`](../../supabase/config.toml.template), Postgres and Kong are needed for the app's database, Auth, and API. The v2.117 [startup contract](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/commands/start/SIDE_EFFECTS.md#files-written) says both receive generated secret files via `docker cp -` before `docker start` (Postgres `pgsodium_root.key`; Kong `kong.yml`, plus TLS material only if enabled). `--exclude kong` would remove the API gateway the app needs; Postgres is not even in the documented exclude list. Pooler, Studio, and Edge Runtime are disabled by this template, so their additional copies or bind mounts are not needed for this pilot. `supabase db start` can start only a database; it is not a substitute for the required Auth/API stack. These are conclusions from the tagged startup contract and this repository's configuration, not a live comparison of all startup modes.

The current pilot's [512-byte relay](../../scripts/remote-supabase-pilot.py) reads stdin in 512-byte chunks and flushes each chunk before invoking Docker's streamed copy. It neither removes tar padding nor changes Podman's archive reader. It is therefore an **empirical timing workaround**, not a deterministic fix or supported Supabase setting. The exact [upstream failure](https://github.com/podman-container-tools/buildah/issues/6573) is a server-side race: the tar reader can stop at the end marker while trailing bytes are still arriving. [Buildah's fix](https://github.com/podman-container-tools/buildah/pull/6678) drains the remaining stream. Fedora 44 currently packages [Buildah 1.43.4](https://packages.fedoraproject.org/pkgs/buildah/buildah/), and [Podman 5.8.7's dependency](https://github.com/containers/podman/blob/v5.8.7/go.mod) is Buildah 1.43.4. The [1.43.4 copier](https://github.com/containers/buildah/blob/v1.43.4/copier/copier.go) lacks the drain; the [1.44.0 copier](https://github.com/containers/buildah/blob/v1.44.0/copier/copier.go) contains it. Updating the separate `buildah` executable alone would not update the Buildah code compiled into Podman. No Fedora 44/Podman 5.8.7 backport of this fix was found in the checked package/source versions.

There is a stronger client-side precedent than pacing: [Testcontainers .NET PR #1684](https://github.com/testcontainers/testcontainers-dotnet/pull/1684) fixed the identical Podman 5 error by making its tar producer emit only the required two 512-byte end blocks, with no trailing record padding. Supabase v2.117 generates its archives with [`new Bun.Archive(...).bytes()`](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/shared/functions/functions-docker.ts#L97-L115); its start interface exposes no tar block-factor setting. A local, non-secret probe with Bun 1.4.2 produced a 10,240-byte tar for one five-byte file; only 2,048 bytes were needed through the two EOF blocks, leaving 8,192 bytes of trailing record padding. **Unverified for this pilot:** a wrapper could parse each in-memory tar archive and remove _only validated bytes after the two end blocks_ before passing it to Docker. Such a parser must honor header sizes and 512-byte alignment; merely trimming trailing zero bytes could truncate valid secret content that happens to end in zero. This is a plausible deterministic client-side fix and merits an isolated test before adopting it. The current 512-byte relay does not implement it.

The clean remedies are a Podman build containing that upstream fix (normally Podman 6 with Buildah 1.44+) or a separate Docker Engine; the latter introduces another daemon and container store and has not been evaluated for Bazzite. **Unverified inference:** running the same Supabase CLI directly on Bazzite might change timing or the local `podman cp` implementation path, but it still sends the same tar stream and should not be treated as a reliable cure without an isolated repeat test. Downgrading to v2.114 changes the producer to [`docker cp <temporary-host-file>`](https://github.com/supabase/cli/blob/v2.114.0/apps/cli/src/legacy/shared/db-bootstrap/container-lifecycle.ts), but it still uses the remote archive API and stages generated secrets on host disk, so it does not establish a reliable escape. An alternative CLI-only stack assembled by hand or the self-hosted Compose stack would materially change Supabase's local-development lifecycle and is outside this pilot's architecture.

## Separate Docker Engine on Bazzite (research, 2026-09-22)

**Feasible in principle, not yet proved on this host.** Docker documents a [rootless, no-package installer](https://docs.docker.com/engine/security/rootless/) that downloads the [static engine and rootless-extras tarballs](https://github.com/docker/docker-install/blob/master/rootless-install.sh) into a user's home directory. Its normal service is a user `docker.service`, socket `/run/user/$UID/docker.sock`, and data directory `~/.local/share/docker` ([rootless service and paths](https://docs.docker.com/engine/security/rootless/tips/)). Thus it can coexist with rootless Podman's separate socket and store without an rpm-ostree overlay, system service, or reboot. It still introduces a second daemon, image cache, volume store, manual binary-update obligation, and a real setup/maintenance footprint; Docker explicitly calls static binary installs suitable mainly for testing ([binary install guidance](https://docs.docker.com/engine/install/binaries/)). No daemon was installed or launched during this research.

A read-only Bazzite check found UID `1000`, `newuidmap` and `newgidmap`, a 65,536-ID subordinate UID/GID range, `slirp4netns`, `iptables`, `fuse-overlayfs`, a private `/run/user/1000`, and user lingering already enabled. These meet Docker's [published rootless prerequisites](https://docs.docker.com/engine/security/rootless/) and startup needs in principle. The Docker `rootlesskit` executable is absent, but the [rootless-extras static archive supplies it](https://github.com/docker/docker-install/blob/master/rootless-install.sh). Bazzite currently has no `dockerd`, Docker Engine RPM, or rootless Docker service. Actual installation, SELinux behavior, image pulls, and the Supabase stack are **unverified**.

For remote control, Docker supports a rootless Unix socket [over SSH](https://docs.docker.com/engine/security/rootless/tips/#expose-docker-api-socket-through-ssh). The existing Bazzite `~/.local/bin/docker` is a Podman symlink, so an `ssh://` Docker client could invoke that binary remotely; Docker's SSH transport runs remote `docker system dial-stdio` ([Docker CLI issue showing the command](https://github.com/docker/cli/issues/4718)). A dedicated Unix-socket SSH forward to `/run/user/1000/docker.sock`, selected with child-only Mac `DOCKER_HOST=unix://...`, avoids changing the Mac's global Docker context or Crabbox's shim. This is a design inference, not a live connection test. Note that Docker's [rootless setup tool automatically switches the Bazzite user's Docker CLI context](https://docs.docker.com/engine/security/rootless/); deployment must account for that side effect or set up the user service without it. Docker's and Podman's container/volume stores remain separate, but host TCP ports are shared and still need the pilot lease/conflict checks.

Docker's [user-defined bridge network option](https://docs.docker.com/engine/network/port-publishing/#setting-the-default-bind-address-for-containers) `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` is exactly what Supabase's [local-development guide](https://supabase.com/docs/guides/local-development) recommends before `supabase start --network-id ...`. It applies when a publish request omits a host address. Rootless Docker adds a RootlessKit forwarding layer, so verify an actual published listener and both tailnet/LAN rejection before calling this solved. In particular, an [upstream rootless+pasta report](https://github.com/moby/moby/issues/48838) found localhost publishing broken with pasta on Docker 27; the current rootless launcher [chooses slirp4netns when installed](https://github.com/moby/moby/blob/master/contrib/dockerd-rootless.sh), as it is on Bazzite. Use Docker 28+ because [older Docker releases could expose localhost-published ports to same-L2 hosts](https://docs.docker.com/engine/network/port-publishing/#setting-the-default-bind-address-for-containers).

## Rootless Docker live pilot (2026-09-22; supersedes the unverified assessment above)

Docker Engine 29.8.1 was installed under `/var/home/froeht/.local/share/remote-supabase-docker/bin` as a rootless user service. Its API is the Unix socket `/run/user/1000/docker.sock`; its data store is `/var/home/froeht/.local/share/docker`. Bazzite's `~/.local/bin/docker` remains a Podman shim, the Podman socket and Crabbox volumes are unchanged, and no TCP Docker API, rpm-ostree overlay, system daemon, or reboot was needed. Because Bazzite's `/home` is a symlink, the initial default data-root produced `invalid rootfs: not an absolute path, or a symlink`; setting the new daemon's private `data-root` to the canonical `/var/home/...` path fixed this. The static Docker binaries need an explicit future update/maintenance policy.

The Mac's locked Supabase CLI 2.117.0 now drives that daemon through a pilot-owned SSH Unix-socket forward. [`remote-supabase-pilot.py`](../../scripts/remote-supabase-pilot.py) also forwards the worktree's existing API, Postgres, Mailpit UI, and SMTP localhost ports. It reserves a separate slot in Bazzite's existing worktree registry without a Bazzite source worktree, writes only private, gitignored Mac runtime state, and selects the remote Docker socket only for child commands. There is no local-daemon fallback. Its `start`, `status`, and `stop` operations are scoped to the pinned project and verified tunnel PID; `stop` retains volumes, network, lease, and bootstrap marker. The remote service bindings use a Docker network with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`.

The first live pilot uses remote slot **13**, project ID `pinpoint-codex-remote-supabase-pilot`, and Mac browser `http://localhost:3030`. Its Bazzite bindings are API `127.0.0.1:55621`, Postgres `127.0.0.1:55622`, Mailpit UI `127.0.0.1:55624`, and SMTP `127.0.0.1:55625`; the Mac sees the corresponding worktree ports `54621`, `54622`, `54624`, and `54625`. The final recorded tunnel PID is **93487** (verify with `status`, since a reconnect changes it). The five running containers are `supabase_db_`, `supabase_kong_`, `supabase_auth_`, `supabase_rest_`, and `supabase_inbucket_`, each suffixed with the project ID. A probe container published only on `127.0.0.1:55999`: Bazzite loopback connected, while the Mac's tailnet connection to `100.87.228.116:55999` was refused. The Mac was remote, so a separate same-LAN reachability attempt timed out rather than establishing a definitive LAN-firewall measurement; the effective Docker bindings themselves are loopback-only. The probe container and network were removed.

The Mac started a fresh remote Supabase stack, applied **79 Drizzle migrations**, and ran the complete existing `db:fast-reset` development seed sequence once (**12 machines, 20 issues**). A later `start` reapplied migrations without resetting data; the migration journal still had 79 entries. With Next.js running on the Mac, `pnpm run dev:status` passed through the tunnel. Browser checks covered dashboard, machine and issue pages, dev-admin sign-in, protected issue editing, issue creation, title update, and persistence after refresh. The sentinel issue `GDZ3-01` remains in the remote database with title “Remote Docker pilot persistence sentinel edited.” Its existence survived both an intentional pilot-tunnel interruption and a scoped remote-stack stop/start; `status` correctly reported `TUNNEL DOWN` while the remote services were healthy. A later unplanned SSH timeout also produced that state and recovered with `start` (no reseed).

Auth refresh succeeded for the seeded development admin and retained the same user. A Mailpit one-time email link verified with HTTP 303 back to `http://localhost:3030/auth/callback?next=...`; the token was kept in memory and not logged. Supabase generated a Discord authorization redirect to `https://discord.com` with provider callback `http://localhost:54621/auth/v1/callback`; Discord returned a login redirect, but an interactive provider login and external callback allowlist were **not** verified. This remains an explicit auth acceptance gap, not a pass.

Measured while the Mac was remote: tailnet RTT (5 pings) min/avg/max **115/173/226 ms**. An initial browser machine page logged **4.6 s** including **1.5 s** Next compilation; an initial issue page had a separate compile cost. Subsequent unauthenticated HTTP page responses (three samples each, after a warm-up request) were **1.93/1.68/1.83 s** for `/m/GDZ3` and **0.40/0.40/0.37 s** for `/m/GDZ3/i/1`. These are server-response timings, not full browser paint or authenticated action timings; the latter remain unmeasured. The Mac Next.js listener's RSS was **85,584 KiB** at measurement. Bazzite per-container memory was DB **78.5 MiB**, Kong **94.21 MiB**, Auth **10.57 MiB**, REST **13.42 MiB**, and Mailpit **9.40 MiB**. The machine-page cost warrants a more representative branch-specific performance pass before making this the default.

Validation: `pnpm run check:python` passed (633 tests, including focused lifecycle cases), and `pnpm run check` passed with pre-existing warnings. Full unit, integration, smoke, and E2E suites were not run for this infrastructure proof. Crabbox runner stacks were paused by scoped project stop, with their volumes retained; the first pilot used a separate Docker daemon, slot, network, and container identities. A second pilot on the in-progress Machine View branch is planned only after coordinating its exact head and worktree runtime-file scope with its owner.

From the dedicated Mac pilot worktree, use `python3 scripts/remote-supabase-pilot.py start`, `python3 scripts/remote-supabase-pilot.py status`, and `python3 scripts/remote-supabase-pilot.py stop`. Start Next.js separately with `pnpm exec next dev --port 3030` for this worktree; the usual `pnpm run dev` may start a local Supabase stack on connection failure and is deliberately not used for the proof. Runtime config, state, and tunnel log remain under `.agent/tmp/remote-supabase-docker-pilot/` with private permissions. The database volume remains intact for inspection.

### Branch-specific Machine View pilot

At Tim's request, a second pilot was coordinated with the “Refactor machine collections” task on its exact clean head `53229b756ae701bed741e502eb2b247e2df52f73`. The helper was invoked from `/Users/froeht/.codex/worktrees/machine-view-refactor/PinPoint` without copying source to Bazzite or modifying tracked files. Its independent Bazzite slot is **15**, project `pinpoint-codex-pp-rwhu-machine-view`, Mac app `http://localhost:3150`, API `localhost:55821`, Postgres `localhost:55822`, and Mailpit `localhost:55824`; its tunnel PID at handoff was **26586**. Its five containers are separately named and publish only on Bazzite `127.0.0.1`. The same project had no Mac Docker containers. Fresh migrations and complete seeds finished, and `bash scripts/dev-status.sh --wait --timeout=90` passed for Next.js, API, and Postgres. The collaborator approved only gitignored `.agent/tmp/remote-supabase-docker-pilot/` runtime writes, and `git status --short` remained clean after bootstrap.

For this branch, `/m` first response was **3.76 s** and warmed responses **0.89/1.52 s**; `/m/GDZ3` first was **2.69 s** and warmed **1.72/1.25 s**. These are unauthenticated HTML-response measurements over a roughly 173 ms tailnet RTT, not browser-paint or signed-in action timings. The branch owner completed a signed-in browser pass: `/m` showed 9 on-floor rows, the private APC Tournament Bank Collection showed 6, and the Admin User owner Collection showed 5. At 390 px the owner Collection used compact cards; phone Table mode retained a pinned identity and a horizontal-scroll cue. The seeded view-token route showed the same 6 rows while signed out, without Share/Edit controls; the private UUID route returned 404 signed out. Searching the shared view for out-of-scope Black Knight returned 0 rows, and clearing the search restored 6. These checks support the remote-development pilot, not final visual sign-off or a production-ready verdict for the refactor.

One `status` run initially reported `TUNNEL BROKEN: timed out` while the tunnel was still present and the API/Postgres immediately passed independent probes. Its former 2-second local check was too aggressive for intermittent remote latency. The pilot-only helper now probes IPv4 loopback with a 5-second budget; `status` returned READY on the unchanged tunnel PID. The focused lifecycle tests and the full Python gate passed again (633 tests). This adjustment does not provide automatic reconnect: a real SSH timeout still requires `start` to re-establish the owned tunnel.

Genuine Docker Engine uses its native archive endpoint, so it should avoid Podman 5's Buildah `docker cp -` broken-pipe bug; Supabase's remote stream-copy design is expressly built for Docker ([v2.115.0 change](https://github.com/supabase/cli/releases/tag/v2.115.0)). **Still unverified:** startup and a repeated archive-upload stress test against an actual rootless Docker daemon on Bazzite. Installing Fedora's rootful Docker packages instead would require privileged [RPM installation and a system daemon](https://docs.docker.com/engine/install/fedora/), hence rpm-ostree layering/reboot on Bazzite, and would widen the host/networking footprint. For this isolated pilot, rootless Docker is the viable Docker alternative; rootful layered Docker is disproportionate.

## Default-workflow adoption (2026-09-22)

The measured sections above record the pilot as it ran; the pilot-named script
path remains as a compatibility entry point. The maintained lifecycle is now
[`scripts/remote-supabase.py`](../../scripts/remote-supabase.py), and the
current start/status/stop, local opt-in, E2E safety, and teardown instructions
are in [the operational runbook](../runbooks/remote-supabase.md). Normal Mac
`pnpm run dev` uses remote mode only when Tim's Mac dotfiles export the backend
selector; remote failure never starts a local stack. Existing Mac-local
volumes are deliberately not migrated or deleted by this change.

An adoption-worktree proof on the newer `origin/main` used independent Bazzite
slot **17**, project `pinpoint-codex-remote-supabase-default`, and Mac browser
`http://localhost:3200`. A first, empty-volume CLI start hit
`LegacyDbConnectError` while Postgres finished initializing; the CLI removed
that attempt's containers. A second start against the same scoped volume
succeeded, then applied **82** Drizzle migrations and the full once-only seed
sequence. The journal contained 82 entries, and the database contained
**12 machines and 20 issues**. A subsequent ordinary `pnpm run dev` reused the tunnel and
volumes, reapplied migrations without reseeding, and started Next.js on the
Mac. `dev:status` passed for Next.js, API, and Postgres after allowing a larger
remote probe budget; the one-second local-only probe had intermittently
misclassified healthy services over the hotspot. The new helper retries only
that exact fresh-Postgres handshake failure once and never selects local
Docker. All four published service ports on Bazzite remained bound to
`127.0.0.1`; the older slot-13 and slot-15 pilot containers and Crabbox
runners remained up with distinct ports. The full Discord login/callback and
same-LAN reachability are still unproved, as above.

Code review found that an idle Mac worktree already held slot 17, so a stopped
stack could later collide with the adoption pilot's same-number CLI health
forwards. The helper now serializes Bazzite lease selection with the Mac
worktree registry and persists a Mac-side remote reservation; new worktrees
also account for pre-registry pilot state files. On 2026-09-23 only the adoption
pilot was stopped and relocated **17 → 20**, then restarted against the same
`supabase_db_pinpoint-codex-remote-supabase-default` volume. Before and after,
the database contained **20 issues, 12 machines, and 82 migration entries**.
The final adoption-pilot tunnel PID at that check was **56365**, with service
bindings on Bazzite `127.0.0.1:56321/56322/56324/56325`; the Mac browser and
generated localhost URLs stayed at `3200/56321/56322/56324`. The older pilots
remain on their own slots, untouched. Local opt-in and destructive DB commands
now require Docker container labels, worktree path, and port bindings to prove
that localhost points to this worktree's local stack, never an active remote
tunnel. SSH control commands are bounded to 60 seconds, and `dev:status --wait`
retries remote ownership checks within its wait budget.
