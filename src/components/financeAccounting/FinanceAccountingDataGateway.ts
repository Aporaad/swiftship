import { collection, onSnapshot, orderBy, query } from '../../lib/supabase-adapter';
import { db } from '../../lib/supabase-adapter';

type SnapshotRow = { id: any; data: () => any };
type Snapshot = { docs: SnapshotRow[] };
type Unsubscribe = () => void;

const rowsFromSnapshot = (snapshot: Snapshot) =>
  snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));

export const financeAccountingDataGateway = {
  subscribeCollection<T = any>(
    collectionName: string,
    onData: (rows: T[]) => void,
    onError: (error: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(collection(db, collectionName), (snapshot: Snapshot) => {
      onData(rowsFromSnapshot(snapshot) as T[]);
    }, onError);
  },

  subscribeOrderedCollection<T = any>(
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
