import { collection, onSnapshot, orderBy, query } from '../../data/legacy/legacy-adapter';
import { db } from '../../data/legacy/legacy-adapter';

type SnapshotRow = { id: string; data: () => Record<string, unknown> };
type Snapshot = { docs: SnapshotRow[] };
type Unsubscribe = () => void;

const rowsFromSnapshot = (snapshot: Snapshot) =>
  snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));

export const financeAccountingDataGateway = {
  subscribeCollection<T = Record<string, unknown>>(
    collectionName: string,
    onData: (rows: T[]) => void,
    onError: (error: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(collection(db, collectionName), (snapshot: Snapshot) => {
      onData(rowsFromSnapshot(snapshot) as T[]);
    }, onError);
  },

  subscribeOrderedCollection<T = Record<string, unknown>>(
    collectionName: string,
    field: string,
    onData: (rows: T[]) => void,
    onError: (error: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(query(collection(db, collectionName), orderBy(field, 'desc')), (snapshot: Snapshot) => {
      onData(rowsFromSnapshot(snapshot) as T[]);
    }, onError);
  },
};
