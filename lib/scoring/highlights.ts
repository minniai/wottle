import type { Coordinate } from "@/lib/types/board";
import type { WordScore } from "@/lib/types/match";

/**
 * Extract tile coordinates for word highlighting.
 * Returns an array of coordinate arrays, one per word.
 */
export function extractHighlights(wordScores: WordScore[]): Coordinate[][] {
    return wordScores.map((wordScore) => wordScore.coordinates);
}

/**
 * Get all unique coordinates from a list of highlights.
 * Useful for overlaying multiple word highlights on the board.
 */
export function getUniqueCoordinates(highlights: Coordinate[][]): Coordinate[] {
    const unique = new Map<string, Coordinate>();
    
    for (const wordCoords of highlights) {
        for (const coord of wordCoords) {
            const key = `${coord.x},${coord.y}`;
            if (!unique.has(key)) {
                unique.set(key, coord);
            }
        }
    }
    
    return Array.from(unique.values());
}

/**
 * Check if a coordinate is part of any highlighted word.
 */
export function isHighlighted(coordinate: Coordinate, highlights: Coordinate[][]): boolean {
    for (const wordCoords of highlights) {
        for (const coord of wordCoords) {
            if (coord.x === coordinate.x && coord.y === coordinate.y) {
                return true;
            }
        }
    }
    return false;
}

