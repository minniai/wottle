import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Web Audio API mocks
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSetValueAtTime = vi.fn();
const mockLinearRampToValueAtTime = vi.fn();
const mockExponentialRampToValueAtTime = vi.fn();

const mockGainNode = {
  gain: {
    setValueAtTime: mockSetValueAtTime,
    linearRampToValueAtTime: mockLinearRampToValueAtTime,
    exponentialRampToValueAtTime: mockExponentialRampToValueAtTime,
    value: 1,
  },
  connect: mockConnect,
  disconnect: mockDisconnect,
};

const mockOscillator = {
  type: "sine",
  frequency: {
    setValueAtTime: mockSetValueAtTime,
    linearRampToValueAtTime: mockLinearRampToValueAtTime,
    value: 440,
  },
  connect: mockConnect,
  start: mockStart,
  stop: mockStop,
  onended: null as (() => void) | null,
};

const mockAudioContext = {
  state: "running" as AudioContextState,
  currentTime: 0,
  destination: {},
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  createGain: vi.fn(() => ({ ...mockGainNode })),
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.stubGlobal(
  "AudioContext",
  vi.fn(() => ({ ...mockAudioContext })),
);

import { useSoundEffects } from "@/lib/audio/useSoundEffects";

describe("useSoundEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext.state = "running";
    vi.mocked(AudioContext).mockImplementation(() => ({ ...mockAudioContext } as unknown as AudioContext));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 6 named play functions", () => {
    const { result } = renderHook(() => useSoundEffects(true));
    expect(typeof result.current.playTileSelect).toBe("function");
    expect(typeof result.current.playValidSwap).toBe("function");
    expect(typeof result.current.playInvalidMove).toBe("function");
    expect(typeof result.current.playWordDiscovery).toBe("function");
    expect(typeof result.current.playMatchStart).toBe("function");
    expect(typeof result.current.playMatchEnd).toBe("function");
  });

  it("when enabled=true, playTileSelect creates an oscillator and calls start()", () => {
    const createOscillator = vi.fn(() => ({ ...mockOscillator }));
    vi.mocked(AudioContext).mockImplementation(
      () => ({ ...mockAudioContext, createOscillator, createGain: vi.fn(() => ({ ...mockGainNode })) } as unknown as AudioContext),
    );
    const { result } = renderHook(() => useSoundEffects(true));
    act(() => result.current.playTileSelect());
    expect(createOscillator).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
  });

  it("when enabled=true, playValidSwap creates an oscillator and calls start()", () => {
    const createOscillator = vi.fn(() => ({ ...mockOscillator }));
    vi.mocked(AudioContext).mockImplementation(
      () => ({ ...mockAudioContext, createOscillator, createGain: vi.fn(() => ({ ...mockGainNode })) } as unknown as AudioContext),
    );
    const { result } = renderHook(() => useSoundEffects(true));
    act(() => result.current.playValidSwap());
    expect(createOscillator).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
  });

  it("when enabled=false, no oscillator is created", () => {
    const createOscillator = vi.fn(() => ({ ...mockOscillator }));
    vi.mocked(AudioContext).mockImplementation(
      () => ({ ...mockAudioContext, createOscillator, createGain: vi.fn(() => ({ ...mockGainNode })) } as unknown as AudioContext),
    );
    const { result } = renderHook(() => useSoundEffects(false));
    act(() => result.current.playTileSelect());
    act(() => result.current.playValidSwap());
    act(() => result.current.playInvalidMove());
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("when AudioContext.state === 'suspended', play calls are no-ops", () => {
    const createOscillator = vi.fn(() => ({ ...mockOscillator }));
    vi.mocked(AudioContext).mockImplementation(
      () =>
        ({
          ...mockAudioContext,
          state: "suspended",
          createOscillator,
          createGain: vi.fn(() => ({ ...mockGainNode })),
        } as unknown as AudioContext),
    );
    const { result } = renderHook(() => useSoundEffects(true));
    act(() => result.current.playTileSelect());
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("cleans up AudioContext on unmount", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.mocked(AudioContext).mockImplementation(
      () => ({ ...mockAudioContext, close, createOscillator: vi.fn(() => ({ ...mockOscillator })), createGain: vi.fn(() => ({ ...mockGainNode })) } as unknown as AudioContext),
    );
    const { result, unmount } = renderHook(() => useSoundEffects(true));
    // Trigger context creation
    act(() => result.current.playTileSelect());
    unmount();
    expect(close).toHaveBeenCalled();
  });
});
