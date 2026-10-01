import { collection, db, doc, getDocs, query, where, writeBatch } from '../lib/supabase-adapter';

export async function purgeEntityAndFinancialFootprint(service: any, entityType: 'customer' | 'courier' | 'user' | 'employee', entityId: string): Promise<void> {
    try {
      // Step 0: Check if entity is linked to any orders in 'orders' collection
      const ordersSnap = await getDocs(collection(db, "orders"));
      const isLinkedToOrders = ordersSnap.docs.some(doc => {
        const o = doc.data();
        if (entityType === 'customer') {
          return o.customerId === entityId || o.customer?.id === entityId;
        } else if (entityType === 'courier') {
          return (
            o.courierId === entityId ||
            o.driverId === entityId ||
            o.courier?.id === entityId ||
            o.deliveryCourierId === entityId ||
            o.delivery_courier_id === entityId ||
            o.shippingCourierId === entityId ||
            o.shipping_courier_id === entityId
          );
        } else if (entityType === 'employee') {
          return o.employeeId === entityId;
        }
        return false;
      });

      if (isLinkedToOrders) {
        const label = entityType === 'customer' ? 'العميل' : (entityType === 'courier' ? 'المندوب' : entityType === 'user' ? 'المستخدم' : 'الموظف');
        throw new Error(`تعذر الحذف: هذا الـ (${label}) مرتبط بطلبات مسجلة في جدول الطلبات. يرجى فك ارتباط الطلبات أو حذفها أولاً والمحاولة مرة أخرى.`);
      }

      const batch = writeBatch(db);
      const affectedAccountIds = new Set<string>();

      // 1. Find the associated financial account
      const accountQuery = query(
        collection(db, "accounts"),
        where("entityId", "==", entityId)
      );
      const accountSnap = await getDocs(accountQuery);
      let accountId = "";

      if (!accountSnap.empty) {
        const accountDoc = accountSnap.docs[0];
        accountId = accountDoc.id;

        // 2. Find all account_trans legs linked to this account
        // استعلام أسطر الحسابات من جدول account_trans الجديد
        const txQuery = query(
          collection(db, "account_trans"),
          where("accountId", "==", accountId)
        );
        const txSnap = await getDocs(txQuery);

        const refNumbers = new Set<string>();
        const mainEntryIds = new Set<string>();

        txSnap.docs.forEach((d) => {
          const tx = d.data();
          const entryId = tx.entryId || tx.mainEntryId;
          if (entryId) {
            mainEntryIds.add(entryId);
          }
          if (tx.refNumber) {
            refNumbers.add(tx.refNumber);
          }
        });


        // 3. Fetch and delete all related transaction double-entry legs
        const allTxDocsToDelete = new Map<string, any>(); // docId -> docRef

        if (mainEntryIds.size > 0) {
          const jvIdsArray = Array.from(mainEntryIds);
          for (const jvId of jvIdsArray) {
            const q = query(collection(db, "account_trans"), where("entryId", "==", jvId));
            const snap = await getDocs(q);
            snap.docs.forEach(docItem => {
              allTxDocsToDelete.set(docItem.id, docItem.ref);
              const txData = docItem.data();
              if (txData.accountId && txData.accountId !== accountId) {
                affectedAccountIds.add(txData.accountId);
              }
            });
            // حذف رأس القيد من main_entry
            batch.delete(doc(db, "main_entry", jvId));
          }
        }

        if (refNumbers.size > 0) {
          const refsArray = Array.from(refNumbers);
          for (const refNo of refsArray) {
            const q = query(collection(db, "account_trans"), where("refNumber", "==", refNo));
            const snap = await getDocs(q);
            snap.docs.forEach(docItem => {
              allTxDocsToDelete.set(docItem.id, docItem.ref);
              const txData = docItem.data();
              if (txData.accountId && txData.accountId !== accountId) {
                affectedAccountIds.add(txData.accountId);
              }
            });

          }
        }

        // Add direct legs linked to this account
        txSnap.docs.forEach(d => {
          allTxDocsToDelete.set(d.id, d.ref);
        });

        // Delete all collected transaction leg documents using direct refs
        allTxDocsToDelete.forEach(ref => {
          batch.delete(ref);
        });


        // Delete the main accounts document
        batch.delete(accountDoc.ref);
      }

      // 4. Delete the core entity document
      const collectionName = entityType === 'user' ? 'users' : (entityType === 'employee' ? 'employees' : (entityType === 'courier' ? 'couriers' : 'customers'));
      batch.delete(doc(db, collectionName, entityId));

      // 5. Commit all deletions
      await batch.commit();

      // 6. Recalculate & sync all financial balances system-wide
      await service.recalculateAllBalances();
    } catch (err) {
      console.error(`[purgeEntityAndFinancialFootprint] Purge failed:`, err);
      throw err;
    }
  }
