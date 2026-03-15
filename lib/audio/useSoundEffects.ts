"use client";

import { useRef, useCallback, useEffect } from "react";

function playTone(
  ctx: AudioContext,
  frequency: number,
  type: OscillatorType,
  durationMs: number,
  gainPeak: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + durationMs / 1000);
}

function playFreqSweep(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  durationMs: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dur = durationMs / 1000;
  osc.type = "sine";
  osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + dur);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur);
}

function playChord(ctx: AudioContext, frequencies: number[], durationMs: number): void {
  const dur = durationMs / 1000;
  for (const freq of frequencies) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  }
}

function playArpeggio(ctx: AudioContext, frequencies: number[], noteDurationMs: number): void {
  const noteDur = noteDurationMs / 1000;
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + i * noteDur;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.25, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + noteDur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + noteDur);
  });
}

export interface SoundEffects {
  playTileSelect: () => void;
  playValidSwap: () => void;
  playInvalidMove: () => void;
  playWordDiscovery: () => void;
  playMatchStart: () => void;
  playMatchEnd: () => void;
}

export function useSoundEffects(enabled: boolean): SoundEffects {
  const ctxRef = useRef<AudioContext | null>(null);
  // Use a ref so callbacks remain stable across renders
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const ctx = ctxRef;
    return () => {
      if (ctx.current?.state !== "closed") {
        ctx.current?.close();
      }
    };
  }, []);

  const getCtx = useCallback((): AudioContext | null => {
    if (!enabledRef.current) return null;
    if (typeof AudioContext === "undefined") return null;
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") return null;
    return ctx;
  }, []);

  const playTileSelect = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // 880Hz sine, 80ms, fast decay
    playTone(ctx, 880, "sine", 80, 0.3);
  }, [getCtx]);

  const playValidSwap = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // 440→660Hz sine sweep, 180ms
    playFreqSweep(ctx, 440, 660, 180);
  }, [getCtx]);

  const playInvalidMove = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // 180Hz sawtooth, 120ms
    playTone(ctx, 180, "sawtooth", 120, 0.35);
  }, [getCtx]);

  const playWordDiscovery = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // 523+659+784Hz chord (C5 major), 350ms
    playChord(ctx, [523, 659, 784], 350);
  }, [getCtx]);

  const playMatchStart = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // 392→523→659Hz arpeggio, 400ms total (133ms per note)
    playArpeggio(ctx, [392, 523, 659], 133);
  }, [getCtx]);

  const playMatchEnd = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // 659→523→392Hz descending arpeggio, 400ms total
    playArpeggio(ctx, [659, 523, 392], 133);
  }, [getCtx]);

  return { playTileSelect, playValidSwap, playInvalidMove, playWordDiscovery, playMatchStart, playMatchEnd };
}
