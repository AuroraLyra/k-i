export type RuntimeWorkKind = 'proactive' | 'backup-github' | 'backup-cloud' | 'keep-alive-reconcile';
export type RuntimeWorkState = 'pending' | 'running' | 'failed';

export interface RuntimeWorkRecord {
  id: string;
  kind: RuntimeWorkKind;
  state: RuntimeWorkState;
  nextRunAt: number;
  attempt: number;
  leaseOwner: string;
  leaseUntil: number;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  lastStartedAt: number;
  lastCompletedAt: number;
  lastError: string;
  payloadVersion: number;
}