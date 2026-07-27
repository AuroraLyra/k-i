export interface MemoryCaptureFloor<TMessage> {
  floor: number;
  messages: TMessage[];
}

function floorEndsWithUser<TMessage extends { sender: string }>(entry: MemoryCaptureFloor<TMessage>) {
  return entry.messages.at(-1)?.sender === 'user';
}

export function selectMemoryCaptureFloors<TMessage extends { sender: string }>(
  floors: MemoryCaptureFloor<TMessage>[],
  threshold: number,
  options: { force?: boolean; forceLimit?: number; segmentClosed?: boolean } = {}
): MemoryCaptureFloor<TMessage>[] {
  if (!floors.length) return [];
  const normalizedThreshold = Math.max(2, Math.round(Number(threshold) || 2));
  if (options.force) return floors.slice(0, Math.max(normalizedThreshold, options.forceLimit ?? 12));
  if (floors.length < normalizedThreshold && !options.segmentClosed) return [];

  let endExclusive = Math.min(normalizedThreshold, floors.length);
  while (endExclusive > 0 && floorEndsWithUser(floors[endExclusive - 1])) {
    if (endExclusive >= floors.length) return options.segmentClosed ? floors.slice(0, endExclusive) : [];
    endExclusive += 1;
  }
  return floors.slice(0, endExclusive);
}