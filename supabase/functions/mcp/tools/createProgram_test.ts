/**
 * Integration tests for the `create_program` MCP tool handler.
 *
 * Black-box: drives the registered handler with an in-memory mock supabase
 * scoped to the chains the handler touches. The mock records every call so
 * dry-run-zero-writes tests can assert on it.
 */

import {
  assertEquals,
  assertNotMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { createProgram } from "./createProgram.ts";

// ---------------------------------------------------------------------------
// Fixture ids (deterministic UUIDs)
// ---------------------------------------------------------------------------

const ID_USER = "11111111-1111-4111-8111-111111111111";
const ID_BENCH = "dddddddd-1111-4111-8111-dddddddddddd";
const ID_PUSHUP = "dddddddd-2222-4222-8222-dddddddddddd";

interface CatalogRow {
  id: string;
  name: string;
  muscle_group: string;
  emoji: string | null;
  equipment: string;
  measurement_type: "reps" | "duration";
  default_duration_seconds: number | null;
}

const BENCH: CatalogRow = {
  id: ID_BENCH,
  name: "Bench Press",
  muscle_group: "chest",
  emoji: null,
  equipment: "barbell",
  measurement_type: "reps",
  default_duration_seconds: null,
};

const PUSHUP: CatalogRow = {
  id: ID_PUSHUP,
  name: "Push-up",
  muscle_group: "chest",
  emoji: null,
  equipment: "bodyweight",
  measurement_type: "reps",
  default_duration_seconds: null,
};

// ---------------------------------------------------------------------------
// MockSupabase — scoped to the chains create_program's handler builds.
// ---------------------------------------------------------------------------

interface CallEntry {
  op: "select" | "insert" | "update" | "delete";
  table: string;
  payload?: unknown;
  filters: Filter[];
  returning?: string;
  terminal?: "single" | "maybeSingle";
}

interface Filter {
  type: "eq" | "in" | "is";
  col: string;
  val: unknown;
}

interface MockState {
  catalog: CatalogRow[];
  activePrograms: { id: string; user_id: string }[];
}

class MockSupabase {
  callLog: CallEntry[] = [];
  insertedProgramCount = 0;
  insertedDayCount = 0;

  constructor(
    public state: MockState,
    public currentUserId: string = ID_USER,
  ) {}

  auth = {
    getUser: () =>
      Promise.resolve({
        data: { user: { id: this.currentUserId } },
        error: null,
      }),
  };

  from(table: string): MockBuilder {
    return new MockBuilder(this, table);
  }

  nextProgramId(): string {
    this.insertedProgramCount += 1;
    return `mock-program-${this.insertedProgramCount}`;
  }

  nextDayId(): string {
    this.insertedDayCount += 1;
    return `mock-day-${this.insertedDayCount}`;
  }
}

class MockBuilder {
  private entry: CallEntry;
  private filters: Filter[] = [];

  constructor(private mock: MockSupabase, private table: string) {
    this.entry = { op: "select", table, filters: [] };
  }

  select(cols: string): this {
    this.entry.returning = cols;
    return this;
  }

  insert(payload: unknown): this {
    this.entry.op = "insert";
    this.entry.payload = payload;
    return this;
  }

  update(payload: unknown): this {
    this.entry.op = "update";
    this.entry.payload = payload;
    return this;
  }

  delete(): this {
    this.entry.op = "delete";
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ type: "eq", col, val });
    return this;
  }

  in(col: string, val: unknown[]): this {
    this.filters.push({ type: "in", col, val });
    return this;
  }

  is(col: string, val: unknown): this {
    this.filters.push({ type: "is", col, val });
    return this;
  }

  single(): Promise<{ data: unknown; error: unknown }> {
    this.entry.terminal = "single";
    return this.execute();
  }

  maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    this.entry.terminal = "maybeSingle";
    return this.execute();
  }

  then<T1, T2>(
    onFulfilled: (v: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>,
    onRejected?: (reason: unknown) => T2 | PromiseLike<T2>,
  ): Promise<T1 | T2> {
    return this.execute().then(onFulfilled, onRejected);
  }

  private async execute(): Promise<{ data: unknown; error: unknown }> {
    this.entry.filters = this.filters;
    this.mock.callLog.push(this.entry);

    if (this.entry.op === "select" && this.table === "exercises") {
      const ids = this.filters.find((f) => f.type === "in" && f.col === "id")
        ?.val as
          | string[]
          | undefined;
      const rows = (ids ?? []).flatMap((id) => {
        const found = this.mock.state.catalog.find((e) => e.id === id);
        return found ? [found] : [];
      });
      return { data: rows, error: null };
    }

    if (this.entry.op === "select" && this.table === "programs") {
      const rows = this.mock.state.activePrograms.filter((p) =>
        p.user_id === this.mock.currentUserId
      );
      return { data: rows, error: null };
    }

    if (this.entry.op === "insert" && this.table === "programs") {
      const id = this.mock.nextProgramId();
      return { data: { id }, error: null };
    }

    if (this.entry.op === "insert" && this.table === "workout_days") {
      const id = this.mock.nextDayId();
      return { data: { id }, error: null };
    }

    if (
      this.entry.op === "insert" &&
      (this.table === "workout_exercises" || this.table === "exercise_blocks" ||
        this.table === "block_exercises")
    ) {
      return { data: null, error: null };
    }

    if (this.entry.op === "update" || this.entry.op === "delete") {
      return { data: null, error: null };
    }

    throw new Error(
      `MockSupabase: unsupported chain op=${this.entry.op} table=${this.table}`,
    );
  }
}

function makeMock(): MockSupabase {
  return new MockSupabase({
    catalog: [BENCH, PUSHUP],
    activePrograms: [],
  });
}

// ---------------------------------------------------------------------------
// Issue #289 regression: description/payload drift for dry-run preview keys.
// ---------------------------------------------------------------------------

Deno.test("dry_run payload has top-level days[] with rendered lines (description drift regression #289)", async () => {
  const mock = makeMock();

  const result = await createProgram.handler(
    {
      name: "Push/Pull",
      days: [
        {
          label: "Push",
          exercises: [
            {
              exercise_id: ID_BENCH,
              sets: 4,
              reps: "8",
              weight_kg: 80,
              rest_seconds: 120,
            },
          ],
        },
      ],
      dry_run: true,
    },
    mock as unknown as SupabaseClient,
  );

  assertEquals(result.isError, undefined, JSON.stringify(result.content));

  const text = result.content[0].text;
  const payload = JSON.parse(text) as Record<string, unknown>;

  // The description tells agents to look at `days[].rendered`, not `preview.days[].rendered`.
  assertEquals(
    "days" in payload,
    true,
    "dry-run payload must expose top-level `days` key",
  );
  assertEquals(
    "preview" in payload,
    false,
    "dry-run payload must NOT wrap days under a `preview` key",
  );

  const days = payload.days as Array<Record<string, unknown>>;
  assertEquals(days.length, 1);
  assertEquals(
    typeof days[0].rendered,
    "object",
    "each day must have a `rendered` array",
  );
  assertEquals(Array.isArray(days[0].rendered), true);
  const renderedLines = days[0].rendered as string[];
  assertEquals(renderedLines.length, 1);

  const rendered = renderedLines.join("\n");
  assertStringIncludes(rendered, "Bench Press");
  assertStringIncludes(rendered, "4");
  assertStringIncludes(rendered, "8");
  assertStringIncludes(rendered, "80");

  // Zero writes — dry_run is preview only.
  const writes = mock.callLog.filter(
    (e) => e.op === "insert" || e.op === "update" || e.op === "delete",
  );
  assertEquals(writes.length, 0, "dry_run must not write");
});

Deno.test("description no longer mentions the nonexistent preview.days[] wrapper", () => {
  // Regression guard: if the description drifts back to `preview.days[].rendered`,
  // this test fails and forces the two sources to be reconciled.
  assertNotMatch(createProgram.description, /preview\.days\[\]\.rendered/);
  assertStringIncludes(createProgram.description, "days[].rendered");
});
