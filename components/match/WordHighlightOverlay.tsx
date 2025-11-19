"use client";

import { useEffect, useRef } from "react";
import type { Coordinate } from "@/lib/types/board";

interface WordHighlightOverlayProps {
    highlights: Coordinate[][];
    boardSize: number;
    tileSize?: number;
    durationMs?: number;
    onComplete?: () => void;
}

/**
 * Overlays highlights on board tiles to show scored words.
 * Displays for a minimum of 3 seconds per spec FR-010.
 */
export function WordHighlightOverlay({
    highlights,
    boardSize,
    tileSize = 40,
    durationMs = 3000,
    onComplete,
}: WordHighlightOverlayProps) {
    // Track highlights to reset timer when they change
    const highlightsIdRef = useRef<string>("");

    // Auto-dismiss timer
    useEffect(() => {
        if (highlights.length === 0) {
            return;
        }

        // Create a stable ID for current highlights
        const highlightsId = highlights.map((h) => 
            h.map((c) => `${c.x},${c.y}`).join("|")
        ).join(";");

        // Reset timer if highlights changed
        if (highlightsIdRef.current !== highlightsId) {
            highlightsIdRef.current = highlightsId;
        }

        const timer = setTimeout(() => {
            onComplete?.();
        }, durationMs);

        return () => clearTimeout(timer);
    }, [highlights, durationMs, onComplete]);

    if (highlights.length === 0) {
        return null;
    }

    // Flatten highlights to get all coordinates
    const allCoordinates = highlights.flat();

    return (
        <div
            className="pointer-events-none absolute inset-0 z-10"
            data-testid="word-highlight-overlay"
            aria-hidden="true"
        >
            {allCoordinates.map((coord, idx) => {
                const x = coord.x * tileSize;
                const y = coord.y * tileSize;

                return (
                    <div
                        key={`${coord.x},${coord.y}-${idx}`}
                        className="absolute animate-pulse rounded border-2 border-emerald-400 bg-emerald-500/30"
                        style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            width: `${tileSize}px`,
                            height: `${tileSize}px`,
                        }}
                    />
                );
            })}
        </div>
    );
}

