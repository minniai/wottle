import { MoveSubmission } from "@/lib/types/match";

export type ResolutionResult = {
    acceptedMoves: MoveSubmission[];
    rejectedMoves: MoveSubmission[];
};

export function resolveConflicts(submissions: MoveSubmission[]): ResolutionResult {
    // For now, we accept all valid moves.
    // In the future, we might handle tile contention (e.g., if two players try to swap the same tile).
    // The spec says: "Simultaneous identical swaps: the earlier valid submission wins".
    // But for MVP, if they are just swapping tiles on their own board view (which is shared),
    // we need to define what happens if they touch the same tiles.
    // PRD §1.1 says "Simultaneous move constraints".
    // Spec FR-006 says "clients MUST allow precisely one swap submission per player".

    // Simple implementation: Accept all.
    // Real implementation would check for coordinate overlaps if that's a rule.
    // Assuming for now that if A swaps (0,0)-(0,1) and B swaps (0,2)-(0,3), both are fine.
    // If A swaps (0,0)-(0,1) and B swaps (0,1)-(0,2), we have a conflict on (0,1).

    // Let's implement a basic first-come-first-served for overlapping coordinates.

    const accepted: MoveSubmission[] = [];
    const rejected: MoveSubmission[] = [];
    const lockedTiles = new Set<string>();

    // Sort by timestamp
    const sorted = [...submissions].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const move of sorted) {
        const t1 = `${move.from_x},${move.from_y}`;
        const t2 = `${move.to_x},${move.to_y}`;

        if (lockedTiles.has(t1) || lockedTiles.has(t2)) {
            rejected.push(move);
        } else {
            accepted.push(move);
            lockedTiles.add(t1);
            lockedTiles.add(t2);
        }
    }

    return { acceptedMoves: accepted, rejectedMoves: rejected };
}
