import {
  claimRuntimeWorkRecord,
  completeRuntimeWorkRecord,
  deleteRuntimeWorkRecord,
  failRuntimeWorkRecord,
  getRuntimeWorkRecord,
  listRuntimeWorkRecords,
  putRuntimeWorkRecord
} from '@/data/db';
import type { RuntimeWorkKind, RuntimeWorkRecord } from '@/types/runtimeWork';

export interface RuntimeWorkSchedule {
  id: string;
  kind: RuntimeWorkKind;
  nextRunAt: number;
  idempotencyKey?: string;
  payloadVersion?: number;
}

export interface RuntimeWorkResult {
  nextRunAt: number;
}

export type RuntimeWorkHandler = (work: RuntimeWorkRecord) => Promise<RuntimeWorkResult>;

export interface RuntimeWorkScheduler {
  cancel(id: string): Promise<void>;
  register(kind: RuntimeWorkKind, handler: RuntimeWorkHandler): void;
  runDue(id?: string): Promise<void>;
  schedule(work: RuntimeWorkSchedule): Promise<void>;
  start(): void;
  stop(): void;
}

const pollIntervalMs = 30_000;
const leaseDurationMs = 2 * 60_000;
const initialRetryDelayMs = 30_000;
const maxRetryDelayMs = 15 * 60_000;

function createLeaseOwner() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `runtime-${randomId}` : `runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nextRetryAt(now: number, attempt: number) {
  const delay = Math.min(maxRetryDelayMs, initialRetryDelayMs * 2 ** Math.min(8, Math.max(0, attempt - 1)));
  return now + delay;
}

export function createRuntimeWorkScheduler(): RuntimeWorkScheduler {
  const leaseOwner = createLeaseOwner();
  const handlers = new Map<RuntimeWorkKind, RuntimeWorkHandler>();
  let timerId: number | undefined;
  let running = false;
  let rerunRequested = false;
  const handlePageShow = () => void runDue();
  const handleOnline = () => void runDue();
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') void runDue();
  };

  async function schedule(work: RuntimeWorkSchedule) {
    const now = Date.now();
    const existing = await getRuntimeWorkRecord(work.id);
    const nextRunAt = Math.max(0, Math.round(work.nextRunAt));
    const record: RuntimeWorkRecord = {
      id: work.id,
      kind: work.kind,
      state: existing?.state === 'running' && existing.leaseUntil > now ? 'running' : 'pending',
      nextRunAt: existing?.state === 'running' && existing.leaseUntil > now
        ? existing.nextRunAt
        : Math.min(existing?.nextRunAt ?? nextRunAt, nextRunAt),
      attempt: existing?.attempt ?? 0,
      leaseOwner: existing?.state === 'running' && existing.leaseUntil > now ? existing.leaseOwner : '',
      leaseUntil: existing?.state === 'running' && existing.leaseUntil > now ? existing.leaseUntil : 0,
      idempotencyKey: work.idempotencyKey ?? existing?.idempotencyKey ?? work.id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastStartedAt: existing?.lastStartedAt ?? 0,
      lastCompletedAt: existing?.lastCompletedAt ?? 0,
      lastError: existing?.lastError ?? '',
      payloadVersion: work.payloadVersion ?? existing?.payloadVersion ?? 1
    };
    await putRuntimeWorkRecord(record);
  }

  async function runDue(id?: string) {
    if (running) {
      rerunRequested = true;
      return;
    }

    running = true;
    try {
      do {
        rerunRequested = false;
        const now = Date.now();
        const records = (await listRuntimeWorkRecords())
          .filter((record) => (!id || record.id === id) && record.nextRunAt <= now && (record.state !== 'running' || record.leaseUntil <= now))
          .sort((left, right) => left.nextRunAt - right.nextRunAt);

        for (const record of records) {
          const claimed = await claimRuntimeWorkRecord(record.id, leaseOwner, Date.now(), leaseDurationMs);
          if (!claimed) continue;
          const handler = handlers.get(claimed.kind);
          if (!handler) {
            await failRuntimeWorkRecord(claimed.id, leaseOwner, Date.now(), nextRetryAt(Date.now(), claimed.attempt), new Error(`No handler registered for ${claimed.kind}`));
            continue;
          }

          try {
            const result = await handler(claimed);
            await completeRuntimeWorkRecord(claimed.id, leaseOwner, Date.now(), result.nextRunAt);
          } catch (error) {
            const failedAt = Date.now();
            await failRuntimeWorkRecord(claimed.id, leaseOwner, failedAt, nextRetryAt(failedAt, claimed.attempt), error);
          }
        }
      } while (rerunRequested);
    } finally {
      running = false;
    }
  }

  function start() {
    if (timerId !== undefined || typeof window === 'undefined') return;
    timerId = window.setInterval(() => void runDue(), pollIntervalMs);
    window.addEventListener('pageshow', handlePageShow, { passive: true });
    window.addEventListener('online', handleOnline, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void runDue();
  }

  function stop() {
    if (timerId !== undefined) window.clearInterval(timerId);
    timerId = undefined;
    if (typeof window === 'undefined') return;
    window.removeEventListener('pageshow', handlePageShow);
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  return {
    cancel: deleteRuntimeWorkRecord,
    register(kind, handler) {
      handlers.set(kind, handler);
    },
    runDue,
    schedule,
    start,
    stop
  };
}