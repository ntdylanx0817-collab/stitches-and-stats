"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { EnrichedPitch } from "@/lib/types";

interface GameSnapshot {
  gamePk: number;
  status: any;
  linescore: any;
  teams: { away: any; home: any };
  allPlays: any[];
  currentPlay: any | null;
  playCount: number;
  savant: any | null;
  latestPitch: EnrichedPitch | null;
  isNewPlay: boolean;
  timestamp: number;
}

interface SocketCtx {
  connected: boolean;
  subscribeGame: (gamePk: number) => void;
  unsubscribeGame: (gamePk: number) => void;
  onSnapshot: (cb: (snap: GameSnapshot) => void) => () => void;
  onPitch: (cb: (pitch: EnrichedPitch) => void) => () => void;
}

const Ctx = createContext<SocketCtx | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const snapshotCbsRef = useRef<Set<(s: GameSnapshot) => void>>(new Set());
  const pitchCbsRef = useRef<Set<(p: EnrichedPitch) => void>>(new Set());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // IMPORTANT: per Caddy gateway rule, use relative path with XTransformPort
    const sock = io("/?XTransformPort=3003", {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      // Infinite reconnection attempts — never give up on the WS server.
      // The user should not have to manually refresh to reconnect.
      reconnectionAttempts: Infinity,
    });
    socketRef.current = sock;

    sock.on("connect", () => setConnected(true));
    sock.on("disconnect", () => setConnected(false));
    sock.on("game:snapshot", (snap: GameSnapshot) => {
      snapshotCbsRef.current.forEach((cb) => cb(snap));
    });
    sock.on("game:pitch", (pitch: EnrichedPitch) => {
      pitchCbsRef.current.forEach((cb) => cb(pitch));
    });

    return () => {
      sock.removeAllListeners();
      sock.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribeGame = useCallback((gamePk: number) => {
    socketRef.current?.emit("subscribe:game", { gamePk });
  }, []);

  const unsubscribeGame = useCallback((gamePk: number) => {
    socketRef.current?.emit("unsubscribe:game", { gamePk });
  }, []);

  const onSnapshot = useCallback((cb: (s: GameSnapshot) => void) => {
    snapshotCbsRef.current.add(cb);
    return () => { snapshotCbsRef.current.delete(cb); };
  }, []);

  const onPitch = useCallback((cb: (p: EnrichedPitch) => void) => {
    pitchCbsRef.current.add(cb);
    return () => { pitchCbsRef.current.delete(cb); };
  }, []);

  return (
    <Ctx.Provider value={{ connected, subscribeGame, unsubscribeGame, onSnapshot, onPitch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}

export type { GameSnapshot };
