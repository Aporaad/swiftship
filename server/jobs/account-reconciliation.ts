/**
 * خدمة مطابقة أرصدة الحسابات (Realtime Reconciliation)
 * Account Reconciliation Job — listens to account_trans changes and recalculates balances.
 *
 * هذا الملف مُستخرج من server.ts لعزل منطق إعادة الحساب عن بقية الخادم.
 * Extracted from server.ts to isolate reconciliation logic.
 *
 * ⚠️ ملاحظة هامة: هذا المستمع يُنفِّذ Business Logic مالياً داخل Realtime Listener.
 * هذا النمط خطير ومُوثَّق لإعادة التصميم في المرحلة الثامنة.
 * ⚠️ Important: This listener executes financial business logic inside a Realtime listener.
 * This pattern is documented for redesign in Phase 8.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from '../current-db/client';

/**
 * يبدأ مستمع Realtime لمطابقة أرصدة الحسابات.
 * Starts the Realtime listener for account balance reconciliation.
 *
 * @param db - كائن قاعدة البيانات / Database client object
 * @returns دالة إيقاف المستمع / Unsubscribe function
 */
export function startAccountReconciliationListener(db: any): () => void {
  console.log('[Reconciliation] Starting account_trans Realtime listener...');

  const unsubscribe = onSnapshot(collection(db, 'account_trans'), async (snapshot: any) => {
    const changes = snapshot.docChanges();
    if (changes.length === 0) return;

    console.log(`[Reconciliation] Detected ${changes.length} change(s) in account_trans`);

    // جمع معرفات الحسابات المتأثرة / Collect affected account IDs
    const affectedAccountIds = new Set<string>();
    for (const change of changes) {
      const data = change.doc.data();
      if (data?.accountId) {
        affectedAccountIds.add(data.accountId);
      }
    }

    // إعادة احتساب رصيد كل حساب متأثر / Recalculate balance for each affected account
    for (const accountId of affectedAccountIds) {
      try {
        console.log(`[Reconciliation] Reconciling ledger account ID: ${accountId}`);

        // جلب كل حركات الحساب / Fetch all transactions for this account
        const txsQuery = query(
          collection(db, 'account_trans'),
          where('accountId', '==', accountId),
        );
        const txsSnap = await getDocs(txsQuery);

        let debitTotal = 0;
        let creditTotal = 0;

        txsSnap.forEach((txDoc: any) => {
          const tx = txDoc.data();
          const amt = parseFloat(tx.amount) || 0;
          if (tx.transType === 'Debit') {
            debitTotal += amt;
          } else if (tx.transType === 'Credit') {
            creditTotal += amt;
          }
        });

        // قراءة معلومات الحساب / Read account information
        const accountRef = doc(db, 'accounts', accountId);
        const accountSnap = await getDoc(accountRef);

        if (accountSnap.exists()) {
          const accountData = accountSnap.data();
          const prefix = accountData.accountPrefix || '';

          // حسابات الأصول مدين طبيعي / Asset accounts have natural debit balance
          const isAsset = prefix.startsWith('1');
          const balance = isAsset
            ? (debitTotal - creditTotal)
            : (creditTotal - debitTotal);

          console.log(
            `[Reconciliation] Account ${accountData.accountCode} (${accountData.entityName}): ` +
            `Balance=${balance}, Debit=${debitTotal}, Credit=${creditTotal}`,
          );

          await updateDoc(accountRef, {
            balance,
            debitTotal,
            creditTotal,
            updatedAt: Date.now(),
          });
        }
      } catch (reconErr: any) {
        console.error(`[Reconciliation] Error for account ${accountId}:`, reconErr.message);
      }
    }
  });

  return unsubscribe;
}
