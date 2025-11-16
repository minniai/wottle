import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";

export interface SupabaseBoardFetchResponse {
  data: { id: string } | null;
  error: Error | null;
}

export interface SupabaseBoardLimitResponse {
  error: Error | null;
}

export interface SupabaseMutationResponse {
  error: Error | null;
}

export interface SupabaseClientStubOptions {
  boardFetchResponses?: SupabaseBoardFetchResponse[];
  boardLimitResponses?: SupabaseBoardLimitResponse[];
  boardUpdateResponses?: SupabaseMutationResponse[];
  boardInsertResponses?: SupabaseMutationResponse[];
  movesDeleteResponses?: SupabaseMutationResponse[];
}

export interface SupabaseClientStubHistory {
  fromTables: string[];
  boardSelectColumns: Array<string | undefined>;
  boardSelectFilters: Array<{ column: string; value: unknown }>;
  boardLimitValues: number[];
  boardUpdatePayloads: unknown[];
  boardUpdateFilters: Array<{ column: string; value: unknown }>;
  boardInsertPayloads: unknown[];
  movesDeleteFilters: Array<{ column: string; value: unknown }>;
  genericSelectTables: string[];
  genericSelectLimitValues: Array<{ table: string; value: number }>;
}

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

export interface SupabaseClientStub {
  client: AnySupabaseClient;
  history: SupabaseClientStubHistory;
}

export function createSupabaseClientStub(
  options: SupabaseClientStubOptions = {}
): SupabaseClientStub {
  const boardFetchQueue = [...(options.boardFetchResponses ?? [])];
  const boardLimitQueue = [...(options.boardLimitResponses ?? [])];
  const boardUpdateQueue = [...(options.boardUpdateResponses ?? [])];
  const boardInsertQueue = [...(options.boardInsertResponses ?? [])];
  const movesDeleteQueue = [...(options.movesDeleteResponses ?? [])];

  const history: SupabaseClientStubHistory = {
    fromTables: [],
    boardSelectColumns: [],
    boardSelectFilters: [],
    boardLimitValues: [],
    boardUpdatePayloads: [],
    boardUpdateFilters: [],
    boardInsertPayloads: [],
    movesDeleteFilters: [],
    genericSelectTables: [],
    genericSelectLimitValues: [],
  };

  const clientImpl = {
    from: vi.fn((table: string) => {
      history.fromTables.push(table);

      if (table === "boards") {
        return {
          select: vi.fn((columns?: string) => {
            history.boardSelectColumns.push(columns);
            return {
              eq: vi.fn((column: string, value: unknown) => {
                history.boardSelectFilters.push({ column, value });
                return {
                  maybeSingle: vi.fn(async () => {
                    return (
                      boardFetchQueue.shift() ?? {
                        data: null,
                        error: null,
                      }
                    );
                  }),
                  limit: vi.fn(async (value: number) => {
                    history.boardLimitValues.push(value);
                    return boardLimitQueue.shift() ?? { error: null };
                  }),
                };
              }),
            };
          }),
          update: vi.fn((payload: unknown) => {
            history.boardUpdatePayloads.push(payload);
            return {
              eq: vi.fn(async (column: string, value: unknown) => {
                history.boardUpdateFilters.push({ column, value });
                return boardUpdateQueue.shift() ?? { error: null };
              }),
            };
          }),
          insert: vi.fn(async (payload: unknown) => {
            history.boardInsertPayloads.push(payload);
            return boardInsertQueue.shift() ?? { error: null };
          }),
        };
      }

      if (table === "moves") {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(async (column: string, value: unknown) => {
              history.movesDeleteFilters.push({ column, value });
              return movesDeleteQueue.shift() ?? { error: null };
            }),
          })),
        };
      }

      return {
        select: vi.fn(() => {
          history.genericSelectTables.push(table);
          return {
            limit: vi.fn(async (value: number) => {
              history.genericSelectLimitValues.push({ table, value });
              return { error: null };
            }),
          };
        }),
      };
    }),
  };

  return {
    client: clientImpl as unknown as AnySupabaseClient,
    history,
  };
}

