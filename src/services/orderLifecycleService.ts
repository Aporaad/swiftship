import type { OrderStatusItem } from '../hooks/useOrderStatuses';
import type { OrderHistoryEvent } from './orderHistoryService';

export type StatusTransitionPlan = {
  allowed: boolean;
  reason?: 'same_status' | 'backward_transition' | 'status_previously_processed' | 'unknown_status';
  stagesToProcess: OrderStatusItem[];
  skippedStages: OrderStatusItem[];
};

function statusIdFromEvent(event: OrderHistoryEvent): number | null {
  if (event.eventType !== 'order.status_changed' && event.eventType !== 'order.created') return null;
  const after = event.afterData || {};
  const raw = (after as any).order_status_id ?? (after as any).orderStatusId ?? (after as any).orderStatus;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function getProcessedStatusIds(events: OrderHistoryEvent[]): Set<number> {
  return new Set(events.map(statusIdFromEvent).filter((id): id is number => id !== null));
}

export function planOrderStatusTransition(
  statuses: OrderStatusItem[],
  currentStatusId: number,
  targetStatusId: number,
  processedStatusIds: Set<number>,
): StatusTransitionPlan {
  const ordered = [...statuses]
    .filter((status) => status.code !== 'cancelled')
    .sort((left, right) => (left.sortOrder ?? left.id) - (right.sortOrder ?? right.id));
  const target = statuses.find((status) => status.id === targetStatusId);
  const currentIndex = ordered.findIndex((status) => status.id === currentStatusId);
  const targetIndex = ordered.findIndex((status) => status.id === targetStatusId);

  if (!target || currentIndex < 0 || (target.code !== 'cancelled' && targetIndex < 0)) {
    return { allowed: false, reason: 'unknown_status', stagesToProcess: [], skippedStages: [] };
  }

  if (target.code === 'cancelled') {
    return { allowed: true, stagesToProcess: [], skippedStages: [] };
  }
  if (targetStatusId === currentStatusId) {
    return { allowed: false, reason: 'same_status', stagesToProcess: [], skippedStages: [] };
  }
  if (targetIndex < currentIndex) {
    return { allowed: false, reason: 'backward_transition', stagesToProcess: [], skippedStages: [] };
  }
  if (processedStatusIds.has(targetStatusId)) {
    return { allowed: false, reason: 'status_previously_processed', stagesToProcess: [], skippedStages: [] };
  }

  const stagesToProcess = ordered.slice(currentIndex + 1, targetIndex + 1);
  return {
    allowed: true,
    stagesToProcess,
    skippedStages: stagesToProcess.slice(0, -1),
  };
}
