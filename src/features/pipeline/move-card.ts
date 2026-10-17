import type { Stage } from "@/shared/domain";
import type { Pipeline } from "@/shared/types";

/**
 * Pure state transition for the board cache: removes the card from `from`,
 * puts it at the top of `to`, and adjusts both column totals.
 * Returns the input unchanged if the card isn't in `from`.
 */
export function moveCard(board: Pipeline, candidateId: string, from: Stage, to: Stage, movedAt: string): Pipeline {
  const source = board.columns.find((column) => column.stage === from);
  const card = source?.candidates.find((c) => c.id === candidateId);
  if (!card || from === to) return board;

  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.stage === from) {
        return {
          ...column,
          total: Math.max(0, column.total - 1),
          candidates: column.candidates.filter((c) => c.id !== candidateId),
        };
      }
      if (column.stage === to) {
        return {
          ...column,
          total: column.total + 1,
          candidates: [{ ...card, stage: to, stageUpdatedAt: movedAt }, ...column.candidates],
        };
      }
      return column;
    }),
  };
}
