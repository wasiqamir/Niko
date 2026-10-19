"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMinuteClock, TIME_ZONE_LABEL } from "@/lib/time";

type Role = "host" | "participant";
type Peer = { peerId: string; name: string; role?: Role };
type Signal = { id: number; fromId: string; kind: string; payload: string };
type Remote = {
  peerId: string;
  name: string;
  role: Role;
  stream: MediaStream;
  audio: MediaStream;
  revision: number;
};
type Seat = {
  key: string;
  name: string;
  stream: MediaStream | null;
  audio: MediaStream | null;
  revision: number;
  hear: boolean;
  cameraOn: boolean;
  waiting: boolean;
};
type ScreenTile = {
  id: string;
  peerId: string;
  name: string;
  label: string;
  stream: MediaStream;
  local: boolean;
};
type LocalShare = {
  id: string;
  stream: MediaStream;
  track: MediaStreamTrack;
  label: string;
};

const SCREEN_LIMIT = 4;

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function CallRoom({
  code,
  title,
  name,
  role,
  startsAt,
  endsAt,
  open = false,
  leaveHref = `/m/${code}`,
}: {
  code: string;
  title: string;
  name: string;
  role: Role;
  startsAt: string;
  endsAt: string;
  open?: boolean;
  leaveHref?: string;
}) {
  const [started, setStarted] = useState(open);
  const [ended, setEnded] = useState(false);
  const selfId = useRef("");
  if (!selfId.current) selfId.current = crypto.randomUUID();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localPreview, setLocalPreview] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [status, setStatus] = useState("Opening your camera and microphone…");
  const [alone, setAlone] = useState(true);
  const [needSound, setNeedSound] = useState(false);
  const [screens, setScreens] = useState<ScreenTile[]>([]);
  const soundBlocked = useRef(() => setNeedSound(true));
  const soundReady = useRef(() => setNeedSound(false));
  const roomApi = useRef<{ share: () => void; stop: (id: string) => void }>({
    share: () => undefined,
    stop: () => undefined,
  });

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => {
      if (Date.now() >= end) setEnded(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  useEffect(() => {
    if (!started || ended) return;
    const peerId = selfId.current;
    const pcs = new Map<string, RTCPeerConnection>();
    const names = new Map<string, string>();
    const roles = new Map<string, Role>();
    const videos = new Map<string, MediaStream>();
    const audios = new Map<string, MediaStream>();
    const iceQueue = new Map<string, RTCIceCandidateInit[]>();
    const restarted = new Set<string>();
    const localShares = new Map<string, LocalShare>();
    const remoteTiles = new Map<string, ScreenTile>();
    const remoteScreenIds = new Set<string>();
    const screenLabels = new Map<string, string>();
    const trackOwners = new Map<string, { remoteId: string; track: MediaStreamTrack }>();
    const pendingOffer = new Set<string>();
    let stream: MediaStream | null = null;
    let after = 0;
    let cancelled = false;
    let timer = 0;

    async function post(body: Record<string, string>) {
      await fetch(`/api/call/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ peerId, ...body }),
        keepalive: true,
      });
    }

    function leave() {
      const payload = JSON.stringify({ peerId, kind: "leave" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/call/${encodeURIComponent(code)}`,
          new Blob([payload], { type: "application/json" }),
        );
      }
      for (const pc of pcs.values()) pc.close();
      pcs.clear();
      stream?.getTracks().forEach((track) => track.stop());
      for (const share of localShares.values()) share.track.stop();
      localShares.clear();
    }

    function paintScreens() {
      const local = [...localShares.values()].map((share) => ({
        id: share.id,
        peerId,
        name,
        label: share.label,
        stream: share.stream,
        local: true,
      }));
      setScreens([...local, ...remoteTiles.values()]);
    }

    function announce(remoteId: string, share: LocalShare, active: boolean) {
      void post({
        toId: remoteId,
        kind: "share",
        payload: JSON.stringify({ streamId: share.stream.id, label: share.label, active }),
      });
    }

    function renegotiate(remoteId: string) {
      const pc = pcs.get(remoteId);
      if (!pc || pc.signalingState !== "stable") {
        pendingOffer.add(remoteId);
        return;
      }
      pendingOffer.delete(remoteId);
      void createOffer(remoteId);
    }

    function settle(remoteId: string) {
      if (!pendingOffer.has(remoteId)) return;
      pendingOffer.delete(remoteId);
      void createOffer(remoteId);
    }

    function showRemoteScreen(remoteId: string, streamId: string, track: MediaStreamTrack, label: string) {
      const camera = videos.get(remoteId);
      if (camera?.getTracks().some((item) => item.id === track.id)) {
        camera.removeTrack(track);
        publish(remoteId);
      }
      const tile: ScreenTile = {
        id: streamId,
        peerId: remoteId,
        name: names.get(remoteId) ?? "Guest",
        label,
        stream: new MediaStream([track]),
        local: false,
      };
      remoteTiles.set(streamId, tile);
      track.onended = () => {
        remoteTiles.delete(streamId);
        remoteScreenIds.delete(streamId);
        paintScreens();
      };
      paintScreens();
    }

    async function shareScreen() {
      if (localShares.size >= SCREEN_LIMIT) {
        setStatus("You can share up to 4 screens.");
        return;
      }
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setStatus("This browser cannot share a screen.");
        return;
      }
      let display: MediaStream;
      try {
        display = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 30 } },
          audio: false,
        });
      } catch {
        return;
      }
      if (cancelled) {
        display.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = display.getVideoTracks()[0];
      if (!track) {
        display.getTracks().forEach((item) => item.stop());
        return;
      }
      track.contentHint = "detail";
      const share: LocalShare = {
        id: display.id,
        stream: display,
        track,
        label: prettyScreen(track.label, localShares.size + 1),
      };
      localShares.set(share.id, share);
      track.onended = () => stopShare(share.id);
      for (const [remoteId, pc] of pcs) {
        if (!pc.getSenders().some((sender) => sender.track === track)) pc.addTrack(track, display);
        announce(remoteId, share, true);
        renegotiate(remoteId);
      }
      paintScreens();
      setStatus("");
    }

    function stopShare(id: string) {
      const share = localShares.get(id);
      if (!share) return;
      localShares.delete(id);
      share.track.onended = null;
      share.track.stop();
      for (const [remoteId, pc] of pcs) {
        const sender = pc.getSenders().find((item) => item.track === share.track);
        if (sender) pc.removeTrack(sender);
        announce(remoteId, share, false);
        renegotiate(remoteId);
      }
      paintScreens();
    }

    roomApi.current = { share: () => void shareScreen(), stop: stopShare };

    function publish(remoteId: string) {
      const video = videos.get(remoteId);
      const audio = audios.get(remoteId);
      if (!video && !audio) return;
      setRemotes((current) => {
        const previous = current.find((item) => item.peerId === remoteId);
        const next: Remote = {
          peerId: remoteId,
          name: names.get(remoteId) ?? previous?.name ?? "Guest",
          role: roles.get(remoteId) ?? previous?.role ?? "participant",
          stream: video ?? previous?.stream ?? new MediaStream(),
          audio: audio ?? previous?.audio ?? new MediaStream(),
          revision: (previous?.revision ?? 0) + 1,
        };
        return [...current.filter((item) => item.peerId !== remoteId), next];
      });
    }

    async function tune(pc: RTCPeerConnection) {
      await Promise.all(
        pc.getSenders().map(async (sender) => {
          const track = sender.track;
          if (!track) return;
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          const encoding = params.encodings[0];
          const shared = [...localShares.values()].some((share) => share.track === track);
          if (track.kind === "video" && shared) {
            track.contentHint = "detail";
            params.degradationPreference = "maintain-resolution";
            encoding.maxBitrate = 4_000_000;
            encoding.maxFramerate = 15;
            encoding.scaleResolutionDownBy = 1;
          } else if (track.kind === "video") {
            track.contentHint = "motion";
            params.degradationPreference = "maintain-framerate";
            encoding.maxBitrate = 2_500_000;
            encoding.maxFramerate = 30;
            encoding.scaleResolutionDownBy = 1;
          } else {
            encoding.maxBitrate = 96_000;
          }
          try {
            await sender.setParameters(params);
          } catch {
            // The browser accepts these settings once the connection is up.
          }
        }),
      );
    }

    function makePeer(remoteId: string) {
      const existing = pcs.get(remoteId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      pcs.set(remoteId, pc);
      stream?.getTracks().forEach((track) => {
        if (!pc.getSenders().some((sender) => sender.track === track)) pc.addTrack(track);
      });
      for (const share of localShares.values()) {
        if (!pc.getSenders().some((sender) => sender.track === share.track)) {
          pc.addTrack(share.track, share.stream);
        }
        announce(remoteId, share, true);
      }
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        void post({
          toId: remoteId,
          kind: "ice",
          payload: JSON.stringify(event.candidate.toJSON()),
        });
      };
      pc.ontrack = (event) => {
        const incoming = event.track;
        const mine =
          stream?.getTracks().some((track) => track.id === incoming.id) ||
          [...localShares.values()].some((share) => share.track.id === incoming.id);
        if (mine) return;
        if (incoming.kind === "video") {
          const streamId = event.streams[0]?.id ?? incoming.id;
          trackOwners.set(streamId, { remoteId, track: incoming });
          if (remoteScreenIds.has(streamId) || looksLikeScreen(incoming)) {
            showRemoteScreen(remoteId, streamId, incoming, screenLabels.get(streamId) ?? prettyScreen(incoming.label));
            return;
          }
        }
        const bucket = incoming.kind === "audio" ? audios : videos;
        const remoteStream = bucket.get(remoteId) ?? new MediaStream();
        bucket.set(remoteId, remoteStream);
        if (!remoteStream.getTracks().some((track) => track.id === incoming.id)) {
          remoteStream.addTrack(incoming);
        }
        incoming.onunmute = () => publish(remoteId);
        publish(remoteId);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") void tune(pc);
        if (
          pc.connectionState === "failed" &&
          peerId < remoteId &&
          !restarted.has(remoteId) &&
          !cancelled
        ) {
          restarted.add(remoteId);
          void createOffer(remoteId, true);
        }
      };
      return pc;
    }

    async function flushIce(remoteId: string) {
      const pc = pcs.get(remoteId);
      const queued = iceQueue.get(remoteId) ?? [];
      iceQueue.delete(remoteId);
      if (!pc?.remoteDescription) return;
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // A late candidate from a replaced offer can be ignored.
        }
      }
    }

    async function createOffer(remoteId: string, iceRestart = false) {
      const pc = makePeer(remoteId);
      if (!iceRestart && pc.signalingState !== "stable") return;
      try {
        const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await pc.setLocalDescription(offer);
        await tune(pc);
        await post({ toId: remoteId, kind: "offer", payload: JSON.stringify(offer) });
      } catch {
        // The next poll tries again if this offer did not land.
      }
    }

    async function handleSignal(signal: Signal) {
      if (signal.kind === "ice") {
        const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
        const pc = pcs.get(signal.fromId);
        if (!pc?.remoteDescription) {
          const queued = iceQueue.get(signal.fromId) ?? [];
          queued.push(candidate);
          iceQueue.set(signal.fromId, queued);
          return;
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Ignore a candidate that arrived for an old description.
        }
        return;
      }

      if (signal.kind === "offer") {
        const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
        let pc = pcs.get(signal.fromId);
        if (pc?.signalingState === "have-local-offer") {
          if (peerId < signal.fromId) return;
          await pc.setLocalDescription({ type: "rollback" });
        }
        pc = makePeer(signal.fromId);
        await pc.setRemoteDescription(description);
        await flushIce(signal.fromId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await tune(pc);
        await post({ toId: signal.fromId, kind: "answer", payload: JSON.stringify(answer) });
        settle(signal.fromId);
        return;
      }

      if (signal.kind === "answer") {
        const pc = pcs.get(signal.fromId);
        if (!pc || pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(JSON.parse(signal.payload) as RTCSessionDescriptionInit);
        await flushIce(signal.fromId);
        await tune(pc);
        settle(signal.fromId);
        return;
      }

      if (signal.kind === "share") {
        try {
          const info = JSON.parse(signal.payload) as { streamId?: string; label?: string; active?: boolean };
          if (!info.streamId) return;
          const owned = trackOwners.get(info.streamId);
          if (info.active === false) {
            remoteScreenIds.delete(info.streamId);
            screenLabels.delete(info.streamId);
            remoteTiles.delete(info.streamId);
            if (owned) {
              videos.get(owned.remoteId)?.removeTrack(owned.track);
              publish(owned.remoteId);
            }
            paintScreens();
            return;
          }
          const label = prettyScreen(info.label ?? "", remoteTiles.size + 1);
          remoteScreenIds.add(info.streamId);
          screenLabels.set(info.streamId, label);
          if (owned) showRemoteScreen(signal.fromId, info.streamId, owned.track, label);
        } catch {
          // Ignore a share notice this browser cannot read.
        }
      }
    }

    function syncPeers(peers: Peer[]) {
      names.clear();
      roles.clear();
      for (const peer of peers) {
        names.set(peer.peerId, peer.name);
        roles.set(peer.peerId, peer.role === "host" ? "host" : "participant");
      }
      setRemotes((current) => {
        let changed = false;
        const next = current.map((item) => {
          const nextName = names.get(item.peerId) ?? item.name;
          const nextRole = roles.get(item.peerId) ?? item.role;
          if (nextName === item.name && nextRole === item.role) return item;
          changed = true;
          return { ...item, name: nextName, role: nextRole };
        });
        return changed ? next : current;
      });
      let renamed = false;
      for (const [tileId, tile] of remoteTiles) {
        const nextName = names.get(tile.peerId);
        if (!nextName || nextName === tile.name) continue;
        remoteTiles.set(tileId, { ...tile, name: nextName });
        renamed = true;
      }
      if (renamed) paintScreens();
      const live = new Set(peers.map((peer) => peer.peerId));
      for (const [remoteId, pc] of pcs) {
        if (!live.has(remoteId)) {
          pc.close();
          pcs.delete(remoteId);
          videos.delete(remoteId);
          audios.delete(remoteId);
          for (const [tileId, tile] of remoteTiles) {
            if (tile.peerId === remoteId) remoteTiles.delete(tileId);
          }
          paintScreens();
          setRemotes((current) => current.filter((item) => item.peerId !== remoteId));
        }
      }
      setAlone(peers.every((peer) => peer.peerId === peerId));
      for (const peer of peers) {
        if (peer.peerId !== peerId && peerId < peer.peerId && !pcs.has(peer.peerId)) {
          void createOffer(peer.peerId);
        }
      }
    }

    async function poll() {
      const response = await fetch(
        `/api/call/${encodeURIComponent(code)}?peerId=${encodeURIComponent(peerId)}&after=${after}`,
        { cache: "no-store" },
      );
      if (response.status === 409) {
        setStatus("The live room is full. Eight people can be on the call at once.");
        return;
      }
      if (response.status === 403) {
        setEnded(true);
        return;
      }
      if (!response.ok) {
        setStatus("This call is closed.");
        return;
      }
      const data = (await response.json()) as { peers: Peer[]; signals: Signal[] };
      for (const signal of data.signals) {
        after = Math.max(after, signal.id);
        await handleSignal(signal);
      }
      syncPeers(data.peers);
      if (!cancelled) setStatus("");
    }

    async function loop() {
      if (cancelled) return;
      try {
        await poll();
      } catch {
        if (!cancelled) setStatus("Reconnecting…");
      }
      if (!cancelled) timer = window.setTimeout(loop, 400);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setCameraOn(false);
        } catch {
          if (!cancelled) setStatus("Allow the camera and microphone, then reload this page.");
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      await Promise.all(
        stream.getAudioTracks().map((track) =>
          track
            .applyConstraints({
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            })
            .catch(() => undefined),
        ),
      );
      for (const track of stream.getVideoTracks()) track.contentHint = "motion";
      setLocalPreview(new MediaStream(stream.getVideoTracks()));
      setLocalStream(stream);
      setStatus("");
      void loop();
    }

    window.addEventListener("pagehide", leave);
    void start();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", leave);
      roomApi.current = { share: () => undefined, stop: () => undefined };
      leave();
      setScreens([]);
    };
  }, [code, started, ended]);

  function toggleMic() {
    const next = !micOn;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  }

  function toggleCamera() {
    const next = !cameraOn;
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraOn(next);
  }

  function enableSound() {
    const clips = Array.from(document.querySelectorAll("audio"));
    if (clips.length === 0) {
      setNeedSound(false);
      return;
    }
    void Promise.all(
      clips.map((node) => {
        const audio = node as HTMLAudioElement;
        audio.muted = false;
        audio.volume = 1;
        return audio.play();
      }),
    )
      .then(() => setNeedSound(false))
      .catch(() => setNeedSound(true));
    document.querySelectorAll("video").forEach((node) => {
      const video = node as HTMLVideoElement;
      video.muted = true;
      video.volume = 0;
      void video.play().catch(() => undefined);
    });
  }

  if (ended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#10241c] px-6 text-center text-background">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Live room</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Meeting is ended</h1>
        <p className="mt-3 text-sm text-background/70">The meeting time is over, so the room is closed.</p>
        <Link
          href={leaveHref}
          className="mt-8 inline-flex h-12 items-center rounded-full bg-clay px-5 text-sm font-medium text-background"
        >
          Leave
        </Link>
      </div>
    );
  }

  if (!started) {
    return <Lobby title={title} startsAt={startsAt} leaveHref={leaveHref} onStart={() => setStarted(true)} />;
  }

  const hostRemote = remotes.find((item) => item.role === "host");
  const participantRemotes = remotes.filter((item) => item.role !== "host");
  const selfSeat = {
    key: "self",
    name,
    stream: localPreview,
    audio: null,
    revision: 0,
    hear: false,
    cameraOn,
    waiting: false,
  };
  const hostSeat: Seat =
    role === "host"
      ? selfSeat
      : hostRemote
        ? {
            key: hostRemote.peerId,
            name: hostRemote.name,
            stream: hostRemote.stream,
            audio: hostRemote.audio,
            revision: hostRemote.revision,
            hear: true,
            cameraOn: true,
            waiting: false,
          }
        : emptySeat("host-wait");
  const participantSeats: Seat[] =
    role === "participant"
      ? [
          selfSeat,
          ...participantRemotes.map((item) => remoteSeat(item)),
        ]
      : participantRemotes.map((item) => remoteSeat(item));
  if (participantSeats.length === 0) participantSeats.push(emptySeat("participant-wait"));

  return (
    <div className="rise flex min-h-screen flex-col bg-[#10241c] text-background">
      <header className="flex items-start justify-between gap-3 px-4 py-4 sm:items-center sm:px-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Live room</p>
          <h1 className="truncate font-serif text-xl tracking-tight sm:text-2xl">{title}</h1>
        </div>
        <p className="shrink-0 text-right text-xs text-background/70 sm:text-sm">
          {alone ? "Waiting" : `${remotes.length + 1} here`}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-36 sm:px-5">
        {screens.length > 0 ? (
          <div className="grid max-h-[46vh] gap-3 overflow-y-auto sm:grid-cols-2">
            {screens.map((tile) => (
              <ScreenView key={tile.id} tile={tile} onStop={(id) => roomApi.current.stop(id)} />
            ))}
          </div>
        ) : null}
        <div className="relative grid h-[min(32rem,calc(100dvh-13rem))] min-h-48 w-full flex-1 grid-cols-2 overflow-hidden rounded-2xl bg-black sm:min-h-[28rem] sm:rounded-[28px]">
          <Pane
            seat={hostSeat}
            position="Host"
            onSoundBlocked={() => soundBlocked.current()}
            onSoundReady={() => soundReady.current()}
          />
          <div className="flex min-h-0 min-w-0 flex-col border-l-2 border-white">
            {participantSeats.map((seat) => (
              <Pane
                key={seat.key}
                seat={seat}
                position="Participant"
                onSoundBlocked={() => soundBlocked.current()}
                onSoundReady={() => soundReady.current()}
              />
            ))}
          </div>
          {needSound ? (
            <button
              type="button"
              onClick={enableSound}
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-foreground"
            >
              Turn on sound
            </button>
          ) : null}
        </div>
      </div>

      {status ? (
        <p className="fixed bottom-24 left-0 right-0 px-5 text-center text-sm text-gold">{status}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-2 border-t border-white/10 bg-[#10241c]/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:px-5 sm:pb-4">
        <button
          type="button"
          onClick={toggleMic}
          className="h-11 rounded-full bg-background px-3 text-sm font-medium text-foreground sm:h-12 sm:px-5"
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          className="h-11 rounded-full bg-background px-3 text-sm font-medium text-foreground sm:h-12 sm:px-5"
        >
          {cameraOn ? "Camera off" : "Camera on"}
        </button>
        <button
          type="button"
          onClick={() => roomApi.current.share()}
          className="h-11 rounded-full bg-gold px-3 text-sm font-medium text-foreground sm:h-12 sm:px-5"
        >
          {screens.some((tile) => tile.local) ? "Share another" : "Share a screen"}
        </button>
        <Link
          href={leaveHref}
          className="inline-flex h-11 items-center justify-center rounded-full bg-clay px-3 text-sm font-medium text-background sm:h-12 sm:px-5"
        >
          Leave
        </Link>
      </div>
    </div>
  );
}

function looksLikeScreen(track: MediaStreamTrack) {
  if (track.contentHint === "detail") return true;
  const label = track.label.toLowerCase();
  return (
    label.includes("screen") ||
    label.includes("window") ||
    label.includes("monitor") ||
    label.includes("display") ||
    label.startsWith("web-contents")
  );
}

function prettyScreen(label: string, index = 1) {
  const clean = label
    .replace(/^screen:\d+:\d+$/i, "")
    .replace(/^window:\d+:\d+$/i, "")
    .trim();
  return clean || `Screen ${index}`;
}

function ScreenView({ tile, onStop }: { tile: ScreenTile; onStop: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.srcObject = tile.stream;
    const play = () => {
      video.muted = true;
      video.volume = 0;
      void video.play().catch(() => undefined);
    };
    play();
    const tracks = tile.stream.getTracks();
    for (const track of tracks) track.addEventListener("unmute", play);
    return () => {
      for (const track of tracks) track.removeEventListener("unmute", play);
    };
  }, [tile.stream]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/15 bg-black">
      <div className="relative aspect-video">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <figcaption className="flex items-center justify-between gap-3 bg-[#0c1a14] px-3 py-2">
        <span className="truncate text-sm">
          {tile.name} · {tile.label}
        </span>
        {tile.local ? (
          <button type="button" onClick={() => onStop(tile.id)} className="shrink-0 text-sm font-medium text-gold">
            Stop
          </button>
        ) : null}
      </figcaption>
    </figure>
  );
}

function remoteSeat(item: Remote): Seat {
  return {
    key: item.peerId,
    name: item.name,
    stream: item.stream,
    audio: item.audio,
    revision: item.revision,
    hear: true,
    cameraOn: true,
    waiting: false,
  };
}

function emptySeat(key: string): Seat {
  return {
    key,
    name: "Waiting",
    stream: null,
    audio: null,
    revision: 0,
    hear: false,
    cameraOn: false,
    waiting: true,
  };
}

function Pane({
  seat,
  position,
  onSoundBlocked,
  onSoundReady,
}: {
  seat: Seat;
  position: "Host" | "Participant";
  onSoundBlocked: () => void;
  onSoundReady: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blocked = useRef(onSoundBlocked);
  const ready = useRef(onSoundReady);
  blocked.current = onSoundBlocked;
  ready.current = onSoundReady;

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.srcObject = seat.stream;
      void video.play().catch(() => undefined);
    }
    const playSound = () => {
      if (!audio || !seat.hear || !seat.audio || seat.audio.getAudioTracks().length === 0) return;
      audio.srcObject = seat.audio;
      audio.muted = false;
      audio.volume = 1;
      void audio
        .play()
        .then(() => ready.current())
        .catch(() => blocked.current());
    };
    playSound();

    const wake = () => {
      if (video) {
        video.muted = true;
        video.volume = 0;
        void video.play().catch(() => undefined);
      }
      playSound();
    };
    const tracks = [...(seat.stream?.getTracks() ?? []), ...(seat.audio?.getTracks() ?? [])];
    for (const track of tracks) {
      track.addEventListener("unmute", wake);
      track.addEventListener("mute", wake);
    }
    const keep = window.setInterval(() => {
      if (video && video.paused && video.srcObject) void video.play().catch(() => undefined);
    }, 1000);
    return () => {
      window.clearInterval(keep);
      for (const track of tracks) {
        track.removeEventListener("unmute", wake);
        track.removeEventListener("mute", wake);
      }
    };
  }, [seat.stream, seat.audio, seat.revision, seat.hear]);

  const liveVideo = Boolean(
    seat.cameraOn &&
      seat.stream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled && !track.muted),
  );
  const initial = seat.waiting ? "…" : seat.name.slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-black">
      <div className="relative min-h-40 flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
        />
        {seat.hear ? <audio ref={audioRef} autoPlay className="absolute h-px w-px" /> : null}
        {liveVideo ? null : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#10241c] font-serif text-5xl text-gold">
            {initial}
          </div>
        )}
      </div>
      <div className="border-t border-white/15 bg-[#0c1a14] px-4 py-3 text-center">
        <p className="truncate text-sm font-medium sm:text-base">{seat.name}</p>
        <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-gold">{position}</p>
      </div>
    </div>
  );
}

function Lobby({
  title,
  startsAt,
  leaveHref,
  onStart,
}: {
  title: string;
  startsAt: string;
  leaveHref: string;
  onStart: () => void;
}) {
  const startMs = new Date(startsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const tick = () => {
      const next = Date.now();
      if (next >= startMs) {
        if (!started.current) {
          started.current = true;
          ring();
          window.setTimeout(onStart, 700);
        }
        return;
      }
      setNow(next);
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [onStart, startMs]);

  const remaining = now === null ? null : Math.max(0, startMs - now);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#10241c] px-6 text-center text-background">
      <p className="text-xs uppercase tracking-[0.18em] text-gold">Live room</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">{title}</h1>
      <p className="mt-10 font-serif text-5xl tracking-tight sm:text-7xl">
        {formatMinuteClock(new Date(now ?? startsAt))}
      </p>
      <p className="mt-2 text-sm text-background/70">{TIME_ZONE_LABEL}</p>
      <p className="mt-8 text-sm uppercase tracking-[0.16em] text-gold">Starts in</p>
      <p className="mt-2 font-serif text-5xl">{remaining === null ? "—" : formatRemaining(remaining)}</p>
      <p className="mt-4 text-sm text-background/70">
        The meeting starts at {formatMinuteClock(new Date(startsAt))}.
      </p>
      <Link
        href={leaveHref}
        className="mt-10 inline-flex h-12 items-center rounded-full bg-clay px-5 text-sm font-medium text-background"
      >
        Leave
      </Link>
    </div>
  );
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ring() {
  try {
    const audio = new AudioContext();
    void audio.resume();
    [523, 659, 784].forEach((frequency, index) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + index * 0.16;
      tone.frequency.value = frequency;
      tone.type = "sine";
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.07, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      tone.connect(gain).connect(audio.destination);
      tone.start(at);
      tone.stop(at + 0.3);
    });
    window.setTimeout(() => void audio.close(), 1200);
  } catch {
    // The meeting still opens if this browser blocks the chime.
  }
}
