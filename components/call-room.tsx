"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMinuteClock, TIME_ZONE_LABEL } from "@/lib/time";

type Peer = { peerId: string; name: string };
type Signal = { id: number; fromId: string; kind: string; payload: string };
type Remote = { peerId: string; name: string; stream: MediaStream };

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function CallRoom({
  code,
  title,
  name,
  startsAt,
  open = false,
  leaveHref = `/m/${code}`,
}: {
  code: string;
  title: string;
  name: string;
  startsAt: string;
  open?: boolean;
  leaveHref?: string;
}) {
  const startMs = new Date(startsAt).getTime();
  const [started, setStarted] = useState(open);
  const selfId = useRef("");
  if (!selfId.current) selfId.current = crypto.randomUUID();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [status, setStatus] = useState("Opening your camera and microphone…");
  const [alone, setAlone] = useState(true);

  useEffect(() => {
    if (!started) return;
    const peerId = selfId.current;
    const pcs = new Map<string, RTCPeerConnection>();
    const names = new Map<string, string>();
    const iceQueue = new Map<string, RTCIceCandidateInit[]>();
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
    }

    function makePeer(remoteId: string) {
      const existing = pcs.get(remoteId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcs.set(remoteId, pc);
      stream?.getTracks().forEach((track) => pc.addTrack(track, stream as MediaStream));
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        void post({
          toId: remoteId,
          kind: "ice",
          payload: JSON.stringify(event.candidate.toJSON()),
        });
      };
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteStream) return;
        setRemotes((current) => [
          ...current.filter((item) => item.peerId !== remoteId),
          { peerId: remoteId, name: names.get(remoteId) ?? "Guest", stream: remoteStream },
        ]);
      };
      return pc;
    }

    async function flushIce(remoteId: string) {
      const pc = pcs.get(remoteId);
      const queued = iceQueue.get(remoteId) ?? [];
      iceQueue.delete(remoteId);
      if (!pc) return;
      for (const candidate of queued) {
        await pc.addIceCandidate(candidate);
      }
    }

    async function createOffer(remoteId: string) {
      const pc = makePeer(remoteId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await post({ toId: remoteId, kind: "offer", payload: JSON.stringify(offer) });
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
        await pc.addIceCandidate(candidate);
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
        await post({ toId: signal.fromId, kind: "answer", payload: JSON.stringify(answer) });
        return;
      }

      if (signal.kind === "answer") {
        const pc = pcs.get(signal.fromId);
        if (!pc || pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(JSON.parse(signal.payload) as RTCSessionDescriptionInit);
        await flushIce(signal.fromId);
      }
    }

    function syncPeers(peers: Peer[]) {
      names.clear();
      for (const peer of peers) names.set(peer.peerId, peer.name);
      setRemotes((current) =>
        current.map((item) => ({ ...item, name: names.get(item.peerId) ?? item.name })),
      );
      const live = new Set(peers.map((peer) => peer.peerId));
      for (const [remoteId, pc] of pcs) {
        if (!live.has(remoteId)) {
          pc.close();
          pcs.delete(remoteId);
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
      if (!cancelled) timer = window.setTimeout(loop, 800);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
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
      setLocalStream(stream);
      setStatus("");
      void loop();
    }

    const onHide = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("pagehide", onHide);
    void start();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", onHide);
      leave();
    };
  }, [code, started]);

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

  if (!started) {
    return <Lobby title={title} startsAt={startsAt} leaveHref={leaveHref} onStart={() => setStarted(true)} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#10241c] text-background">
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Live room</p>
          <h1 className="font-serif text-2xl tracking-tight">{title}</h1>
        </div>
        <p className="text-sm text-background/70">{alone ? "Waiting for others" : `${remotes.length + 1} here`}</p>
      </header>

      <div className="grid flex-1 content-start gap-3 px-5 pb-28 sm:grid-cols-2">
        <Tile stream={localStream} label={`${name} (you)`} muted mirror cameraOn={cameraOn} />
        {remotes.map((remote) => (
          <Tile key={remote.peerId} stream={remote.stream} label={remote.name} cameraOn />
        ))}
      </div>

      {status ? (
        <p className="fixed bottom-24 left-0 right-0 px-5 text-center text-sm text-gold">{status}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-[#10241c]/90 px-5 py-4">
        <button
          type="button"
          onClick={toggleMic}
          className="h-12 rounded-full bg-background px-5 text-sm font-medium text-foreground"
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          onClick={toggleCamera}
          className="h-12 rounded-full bg-background px-5 text-sm font-medium text-foreground"
        >
          {cameraOn ? "Camera off" : "Camera on"}
        </button>
        <Link
          href={leaveHref}
          className="inline-flex h-12 items-center rounded-full bg-clay px-5 text-sm font-medium text-background"
        >
          Leave
        </Link>
      </div>
    </div>
  );
}

function Tile({
  stream,
  label,
  muted = false,
  mirror = false,
  cameraOn,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
  cameraOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const showVideo = Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live") && cameraOn);

  return (
    <div className="relative aspect-video overflow-hidden rounded-3xl bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""} ${showVideo ? "" : "hidden"}`}
      />
      {showVideo ? null : (
        <div className="flex h-full items-center justify-center font-serif text-4xl text-gold">
          {label.replace(" (you)", "").slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-sm">{label}</span>
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
      <p className="mt-10 font-serif text-7xl tracking-tight">
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
