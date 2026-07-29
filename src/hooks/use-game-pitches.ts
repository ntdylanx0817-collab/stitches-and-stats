"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSocket, type GameSnapshot } from "@/components/socket-provider";
import type {
  EnrichedPitch, LivePitchEvent, Linescore, GameStatus, FeedTeam, StatcastPitch,
} from "@/lib/types";

interface GameFeedRest {
  pitches: EnrichedPitch[];
  linescore: Linescore | null;
  status: GameStatus | null;
  teams: { away?: FeedTeam; home?: FeedTeam };
}

export interface GamePitchFeed {
  /** Every pitch of the game, newest first. */
  pitches: EnrichedPitch[];
  linescore: Linescore | null;
  status: GameStatus | null;
  teams: { away?: FeedTeam; home?: FeedTeam } | null;
  /** True while the first load is in flight (preview games never "load"). */
  isLoadingInitial: boolean;
  /** WebSocket state — false means the REST fallback is driving updates. */
  connected: boolean;
  /** Epoch ms of the last delivery from whichever source spoke most recently. */
  lastUpdated: number | null;
}

/** Format an elapsed duration as a short "updated Xs/Xm ago" label. */
export function updatedAgoLabel(lastUpdated: number | null, now: number): string | null {
  if (!lastUpdated) return null;
  const secs = Math.max(0, Math.floor((now - lastUpdated) / 1000));
  if (secs < 3) return "Updated just now";
  if (secs < 60) return `Updated ${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `Updated ${mins}m ago`;
}

/**
 * Normalise a `game:pitch` wire payload into an `EnrichedPitch`.
 *
 * The service emits nested `batter`/`pitcher`/`call`/`count` objects; rendering
 * those raw is what used to crash the pitch log with "Objects are not valid as
 * a React child". Everything gets flattened here, once.
 */
function normaliseLivePitch(pitch: LivePitchEvent): EnrichedPitch {
  return {
    playId: pitch.playId,
    atBatIndex: pitch.atBatIndex,
    inning: pitch.inning ?? 0,
    halfInning: pitch.halfInning ?? "top",
    pitchNumber: pitch.pitchNumber,
    isPitch: true,
    batterId: pitch.batter?.id,
    batterName: pitch.batter?.fullName ?? "—",
    batterSide: pitch.batterSide,
    pitcherId: pitch.pitcher?.id,
    pitcherName: pitch.pitcher?.fullName ?? "—",
    pitchHand: pitch.pitchHand,
    description: pitch.description ?? "",
    playResult: pitch.result ?? "",
    // `call` arrives as { code, description }.
    call: pitch.call?.code,
    callDescription: pitch.call?.description,
    pitchType: pitch.pitchType,
    pitchName: pitch.pitchName,
    // The wire shape uses null for "no reading"; EnrichedPitch uses undefined.
    startSpeed: pitch.startSpeed ?? undefined,
    endSpeed: pitch.endSpeed ?? undefined,
    spinRate: pitch.spinRate ?? undefined,
    breakX: pitch.breakX ?? undefined,
    breakZ: pitch.breakZ ?? undefined,
    inducedBreakZ: pitch.inducedBreakZ ?? undefined,
    extension: pitch.extension ?? undefined,
    plateTime: pitch.plateTime ?? undefined,
    pX: pitch.pX ?? pitch.coordinates?.pX,
    pZ: pitch.pZ ?? pitch.coordinates?.pZ,
    zone: pitch.zone,
    szTop: pitch.szTop ?? undefined,
    szBot: pitch.szBot ?? undefined,
    isStrike: !!pitch.isStrike,
    isBall: !!pitch.isBall,
    isInPlay: !!pitch.isInPlay,
    isBarrel: pitch.isBarrel,
    isSword: pitch.isSword,
    exitVelocity: pitch.exitVelocity ?? null,
    launchAngle: pitch.launchAngle ?? null,
    hitDistance: pitch.hitDistance ?? null,
    xBA: pitch.xBA ?? null,
    batSpeed: pitch.batSpeed ?? null,
    balls: pitch.count?.balls ?? 0,
    strikes: pitch.count?.strikes ?? 0,
    outs: pitch.count?.outs ?? 0,
    homeScore: pitch.homeScore ?? 0,
    awayScore: pitch.awayScore ?? 0,
    timestamp: pitch.timestamp,
    result: pitch.result,
    resultDescription: pitch.resultDescription,
  };
}

/**
 * Rebuild every pitch of the game from a snapshot, joining the MLB play-by-play
 * to the Statcast feed on `{inning}-{halfInning}-{abNumber}-{pitchNumber}`.
 *
 * Iterates *all* pitch events in each play, not just the last, so the strike
 * zone and pitch log show every pitch of every at-bat.
 */
function pitchesFromSnapshot(snapshot: GameSnapshot): EnrichedPitch[] {
  const pitches: EnrichedPitch[] = [];
  const savantMap = new Map<string, StatcastPitch>();
  for (const sp of snapshot.savant?.exit_velocity ?? []) {
    savantMap.set(`${sp.inning}-${sp.half_inning}-${sp.ab_number}-${sp.pitch_number ?? 0}`, sp);
  }
  for (const play of snapshot.allPlays) {
    const inning = play.about.inning;
    const halfInning = play.about.halfInning;
    const abNumber = play.atBatIndex + 1;
    for (const ev of play.playEvents ?? []) {
      if (!ev.isPitch) continue;
      const sp = savantMap.get(`${inning}-${halfInning}-${abNumber}-${ev.pitchNumber ?? 0}`);
      pitches.push({
        playId: ev.playId,
        atBatIndex: play.atBatIndex,
        inning,
        halfInning,
        pitchNumber: ev.pitchNumber ?? 0,
        isPitch: true,
        batterId: play.matchup?.batter?.id,
        batterName: play.matchup?.batter?.fullName ?? "—",
        batterSide: play.matchup?.batterSide?.code,
        pitcherId: play.matchup?.pitcher?.id,
        pitcherName: play.matchup?.pitcher?.fullName ?? "—",
        pitchHand: play.matchup?.pitchHand?.code,
        description: ev.details?.description ?? "",
        playResult: play.result?.event ?? "",
        call: ev.details?.call?.code,
        callDescription: ev.details?.call?.description,
        pitchType: sp?.pitch_type ?? ev.details?.type?.code,
        pitchName: sp?.pitch_name ?? ev.details?.type?.description,
        startSpeed: sp?.start_speed ?? ev.pitchData?.startSpeed,
        endSpeed: sp?.end_speed ?? ev.pitchData?.endSpeed,
        spinRate: sp?.spin_rate ?? ev.pitchData?.spinRate,
        breakX: sp?.breakX ?? ev.pitchData?.breakX,
        breakZ: sp?.breakZ ?? ev.pitchData?.breakZ,
        inducedBreakZ: sp?.inducedBreakZ,
        extension: sp?.extension ?? ev.pitchData?.extension,
        plateTime: sp?.plateTime ?? ev.pitchData?.plateTime,
        pX: sp?.px ?? ev.pitchData?.coordinates?.pX,
        pZ: sp?.pz ?? ev.pitchData?.coordinates?.pZ,
        zone: sp?.zone ?? ev.pitchData?.zone,
        szTop: sp?.sz_top ?? ev.pitchData?.strikeZoneTop,
        szBot: sp?.sz_bot ?? ev.pitchData?.strikeZoneBottom,
        isStrike: !!ev.details?.isStrike,
        isBall: !!ev.details?.isBall,
        isInPlay: !!ev.details?.isInPlay,
        isBarrel: sp?.is_barrel === 1,
        isSword: !!sp?.isSword,
        exitVelocity: sp?.hit_speed != null ? parseFloat(sp.hit_speed) : null,
        launchAngle: sp?.hit_angle != null ? parseFloat(sp.hit_angle) : null,
        hitDistance: sp?.hit_distance != null ? parseFloat(sp.hit_distance) : null,
        xBA: sp?.xba != null && sp.xba !== "" ? parseFloat(sp.xba) : null,
        batSpeed: sp?.batSpeed ?? null,
        balls: ev.count?.balls ?? play.count?.balls ?? 0,
        strikes: ev.count?.strikes ?? play.count?.strikes ?? 0,
        outs: ev.count?.outs ?? play.count?.outs ?? 0,
        homeScore: play.result?.homeScore ?? 0,
        awayScore: play.result?.awayScore ?? 0,
        timestamp: ev.endTime ?? play.playEndTime,
        result: sp?.result,
        resultDescription: sp?.des,
      });
    }
  }
  return pitches.reverse(); // newest first
}

/**
 * Subscribe to a game's pitch feed.
 *
 * Merges three sources, in priority order: the granular `game:pitch` WebSocket
 * event (fires the instant a pitch lands), the 8s `game:snapshot` broadcast,
 * and a 5s REST poll used whenever the socket is unavailable. Shared by the
 * live feed and the at-bat watcher so both see identical data.
 *
 * IMPORTANT: the caller must mount this behind `key={gamePk}` so React
 * discards the accumulated pitch state on a game switch. Resetting inside an
 * effect instead would leave one render showing the previous game's pitches
 * under the new game's header.
 */
export function useGamePitches(gamePk: number): GamePitchFeed {
  const { subscribeGame, unsubscribeGame, onSnapshot, onPitch, connected } = useSocket();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [livePitches, setLivePitches] = useState<EnrichedPitch[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    subscribeGame(gamePk);
    const offSnap = onSnapshot((snap) => {
      if (snap.gamePk !== gamePk) return;
      setSnapshot(snap);
      setLastUpdated(Date.now());
    });
    const offPitch = onPitch((pitch: LivePitchEvent) => {
      if (!pitch || pitch.atBatIndex == null || pitch.pitchNumber == null) return;
      setLastUpdated(Date.now());
      setLivePitches((prev) => {
        const key = `${pitch.atBatIndex}-${pitch.pitchNumber}`;
        if (prev.some((p) => `${p.atBatIndex}-${p.pitchNumber}` === key)) return prev;
        return [normaliseLivePitch(pitch), ...prev].slice(0, 60);
      });
    });
    return () => {
      offSnap();
      offPitch();
      unsubscribeGame(gamePk);
    };
  }, [gamePk, subscribeGame, unsubscribeGame, onSnapshot, onPitch]);

  // Fallback: fetch via REST when the socket can't carry us. Preview games are
  // fetched once — there's nothing to poll for until first pitch.
  const { data: restData, isLoading: restLoading, dataUpdatedAt: restUpdatedAt } = useQuery<GameFeedRest>({
    queryKey: ["game-feed-rest", gamePk],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gamePk}`);
      if (!res.ok) throw new Error("feed failed");
      return res.json();
    },
    enabled: !connected || !snapshot,
    // TanStack passes the Query object; read query.state.data to avoid a TDZ.
    refetchInterval: (query) => {
      const data = query.state?.data;
      if (data?.status?.abstractGameState === "Preview") return false;
      if (connected && snapshot) return false;
      return 5_000;
    },
    retry: 2,
  });

  const allPitches = useMemo<EnrichedPitch[]>(() => {
    if (snapshot?.savant?.exit_velocity?.length) return pitchesFromSnapshot(snapshot);
    return (restData?.pitches ?? []).slice().reverse();
  }, [snapshot, restData]);

  // WS pitches win over the same pitch from a snapshot/REST payload.
  const pitches = useMemo(() => {
    if (livePitches.length === 0) return allPitches;
    const seen = new Set<string>();
    const result: EnrichedPitch[] = [];
    for (const p of [...livePitches, ...allPitches]) {
      const k = `${p.atBatIndex}-${p.pitchNumber}`;
      if (seen.has(k)) continue;
      seen.add(k);
      result.push(p);
    }
    return result.slice(0, 80);
  }, [livePitches, allPitches]);

  const status = snapshot?.status ?? restData?.status ?? null;

  return {
    pitches,
    linescore: snapshot?.linescore ?? restData?.linescore ?? null,
    status,
    teams: snapshot?.teams ?? restData?.teams ?? null,
    isLoadingInitial: !snapshot && restLoading && status?.abstractGameState !== "Preview",
    connected,
    // Freshness reflects whichever source last actually delivered, computed at
    // render time rather than synced into state through an effect.
    lastUpdated: Math.max(lastUpdated ?? 0, restUpdatedAt || 0) || null,
  };
}
