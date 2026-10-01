import type * as React from 'react';

type ActionDependencies = Record<string, any>;

export function createFinanceAccountingJournalActions(dependencies: ActionDependencies) {
  const { adjustData, adjustLoading, adjustSalaryMonth, auditedCustomerId, collection, currentUser, customerLedgerDetails, db, dbRates, deletePin, doc, editJournalData, employees, entryToDelete, financialAccountService, getDocs, isAr, isSalaryPayment, notificationService, orders, payAmount, payLoading, payNotes, postingFinancialAccounts, query, selectedEditEntry, setAdjustData, setAdjustLoading, setDeleteLoading, setDeletePin, setDeletePinError, setEditJournalLoading, setEntryToDelete, setIsAdjustmentModalOpen, setIsDeletePinModalOpen, setIsEditJournalOpen, setIsPayModalOpen, setIsSalaryPayment, setPayAmount, setPayLoading, setPayNotes, setSelectedEditEntry, setSourceAccountId, setTargetAccountId, setTargetType, settings, sourceAccountId, targetAccountId, targetType, where, writeBatch } = dependencies;

  const handleEditJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJournalData.amountOriginal || isNaN(parseFloat(editJournalData.amountOriginal))) {
      return notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: isAr ? 'قيمة المبلغ غير صالحة' : 'Invalid Amount',
        type: 'error'
      });
    }

    setEditJournalLoading(true);
    try {
      const rawAmt = parseFloat(editJournalData.amountOriginal);
      const convertedAmt = financialAccountService.convertToDefaultCurrency(
        rawAmt,
        editJournalData.currencyOriginal,
        settings.currency || 'YER',
        dbRates
      );

      const parsedCreatedAt = editJournalData.createdAt ? new Date(editJournalData.createdAt).getTime() : Date.now();
      const batch = writeBatch(db);

      const affectedAccountIds = new Set<string>();

      {
        const txId = selectedEditEntry.id;
        const refNum = selectedEditEntry.refNumber;

        const txQuery = refNum
          ? query(collection(db, 'account_trans'), where('ref_number', '==', refNum))
          : query(collection(db, 'account_trans'), where('__name__', '==', txId));

        const txSnap = await getDocs(txQuery);
        const exchangeRates = dbRates;

        const newDebitAcc = editJournalData.debitAccountId ? postingFinancialAccounts.find(a => a.id === editJournalData.debitAccountId) : null;
        const newCreditAcc = editJournalData.creditAccountId ? postingFinancialAccounts.find(a => a.id === editJournalData.creditAccountId) : null;

        if (!txSnap.empty) {
          for (const txDoc of txSnap.docs) {
            const txData = txDoc.data();
            if (txData.accountId) affectedAccountIds.add(txData.accountId);

            const targetAcc = txData.type === 'Debit' ? newDebitAcc : newCreditAcc;
            const targetAccId = targetAcc ? targetAcc.id : txData.accountId;
            if (targetAccId) affectedAccountIds.add(targetAccId);

            const targetCurrency = targetAcc?.currency || txData.currency || 'YER';

            const legNewAmount = financialAccountService.convertToTargetCurrency(
              rawAmt,
              editJournalData.currencyOriginal,
              targetCurrency,
              exchangeRates
            );

            const updateData: any = {
              amount: legNewAmount,
              amountOriginal: rawAmt,
              currencyOriginal: editJournalData.currencyOriginal,
              description: editJournalData.notes,
              createdAt: parsedCreatedAt,
              updatedAt: Date.now()
            };

            if (targetAcc) {
              updateData.accountId = targetAcc.id;
              updateData.accountCode = targetAcc.accountCode;
              updateData.entityName = targetAcc.entityName;
              updateData.entityId = targetAcc.entityId;
              updateData.entityType = targetAcc.entityType;
              updateData.currency = targetAcc.currency;
            }

            batch.update(txDoc.ref, updateData);

          }
        }

        // Update master entry doc in main_entry if exists
        if (selectedEditEntry.journalEntryId) {
          const jvRef = doc(db, 'main_entry', selectedEditEntry.journalEntryId);
          batch.update(jvRef, {
            amount: rawAmt,
            currency: editJournalData.currencyOriginal,
            description: editJournalData.notes,
            debitAccountId: editJournalData.debitAccountId || selectedEditEntry.debitAccountId,
            creditAccountId: editJournalData.creditAccountId || selectedEditEntry.creditAccountId,
            createdAt: parsedCreatedAt,
            updatedAt: Date.now()
          });
        }
      }

      await batch.commit();

      // Recalculate & sync balances for all affected accounts
      affectedAccountIds.forEach(accId => {
        if (accId) {
          financialAccountService.recalculateAndSyncBalance(accId).catch(console.error);
        }
      });

      notificationService.notify({
        title: isAr ? 'تم الحفظ' : 'Saved',
        message: isAr ? 'تم تعديل القيد المالي وتحديث كافة الأرصدة المرتبطة.' : 'Financial entry updated and all associated balances recalculated.',
        type: 'success'
      });

      setIsEditJournalOpen(false);
      setSelectedEditEntry(null);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: isAr ? 'خطأ' : 'Error',
        message: err.message || 'Could not update entry',
        type: 'error'
      });
    } finally {
      setEditJournalLoading(false);
    }
  };

// Handle Delete Entry with User PIN confirmation
  const handleDeleteJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToDelete) return;
    setDeletePinError('');

    const trimmedPin = deletePin.trim();
    if (!trimmedPin) {
      setDeletePinError(isAr ? 'يرجى إدخال رمز PIN' : 'Please enter PIN code');
      return;
    }

    // Check PIN against employee systemPins or master fallback PINs ('1234', '0000')
    const isValidPin = employees.some(emp => emp.systemPin && emp.systemPin.trim() === trimmedPin) ||
      trimmedPin === '1234' || trimmedPin === '0000';

    if (!isValidPin) {
      setDeletePinError(isAr ? 'رمز PIN غير صحيح. يرجى التثبت من الرمز وتكرار المحاولة.' : 'Invalid PIN code. Access denied.');
      return;
    }

    setDeleteLoading(true);
    try {
      const affectedAccountIds = new Set<string>();
      if (entryToDelete.debitAccountId) affectedAccountIds.add(entryToDelete.debitAccountId);
      if (entryToDelete.creditAccountId) affectedAccountIds.add(entryToDelete.creditAccountId);

      const batch = writeBatch(db);

      // Find all transaction legs related to this voucher
      if (entryToDelete.allLegs && entryToDelete.allLegs.length > 0) {
        entryToDelete.allLegs.forEach((leg: any) => {
          if (leg.id) {
            batch.delete(doc(db, 'account_trans', leg.id));
          }
          if (leg.accountId) affectedAccountIds.add(leg.accountId);
        });
      } else if (entryToDelete.id && !entryToDelete.id.startsWith('EXP-UNLINKED-')) {
        const refNum = entryToDelete.refNumber;
        const qTx = refNum
          ? query(collection(db, 'account_trans'), where('ref_number', '==', refNum))
          : query(collection(db, 'account_trans'), where('__name__', '==', entryToDelete.id));
        const snap = await getDocs(qTx);
        snap.docs.forEach(d => {
          batch.delete(d.ref);
          const data = d.data();
          if (data.accountId) affectedAccountIds.add(data.accountId);
        });
      }

      // Delete master entry document from main_entry if present
      if (entryToDelete.journalEntryId) {
        batch.delete(doc(db, 'main_entry', entryToDelete.journalEntryId));
      }

      await batch.commit();

      // Recalculate & sync balances for all affected accounts in background
      affectedAccountIds.forEach(accId => {
        if (accId) {
          financialAccountService.recalculateAndSyncBalance(accId).catch(console.error);
        }
      });

      notificationService.notify({
        title: isAr ? 'تم الحذف' : 'Deleted',
        message: isAr ? 'تم حذف القيد المالي نهائياً وإلغاء كافة تأثيراته الحسابية.' : 'Financial entry permanently deleted and all ledger balances synced.',
        type: 'success'
      });

      setIsDeletePinModalOpen(false);
      setEntryToDelete(null);
      setDeletePin('');
    } catch (err: any) {
      console.error("Error deleting entry:", err);
      setDeletePinError(err.message || 'Failed to delete entry');
    } finally {
      setDeleteLoading(false);
    }
  };

// Handle addition of quick accounting adjustment voucher
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustLoading) return;
    if (!adjustData.amount || parseFloat(adjustData.amount) <= 0 || (!adjustData.title && !isSalaryPayment)) {
      notificationService.notify({
        title: isAr ? 'خطأ بالبيانات' : 'Invalid Entry',
        message: isAr ? 'يرجى ملء تفاصيل القيد والمبلغ المالي الصحيح.' : 'Provide precise title and positive currency amount.',
        type: 'error'
      });
      return;
    }

    if (!sourceAccountId || !targetAccountId) {
      notificationService.notify({
        title: isAr ? 'الحسابات غير محددة' : 'Accounts Required',
        message: isAr ? 'يجب تحديد الحساب المصدر (الدائن) والحساب المستهدف (المدين) لإجراء القيد المزدوج.' : 'Please select both source and target accounts to complete the transaction.',
        type: 'error'
      });
      return;
    }

    if (sourceAccountId === targetAccountId) {
      notificationService.notify({
        title: isAr ? 'تطابق الحسابات' : 'Identical Accounts',
        message: isAr ? 'لا يمكن أن يكون الحساب المصدر والحساب المستهدف متطابقين.' : 'Source and target accounts cannot be the same.',
        type: 'error'
      });
      return;
    }

    setAdjustLoading(true);
    try {
      const amountVal = parseFloat(adjustData.amount);
      const convertedAmt = financialAccountService.convertToDefaultCurrency(
        amountVal,
        adjustData.currency,
        settings.currency || 'YER',
        dbRates
      );

      const timestamp = Date.now();
      const randStr = Math.floor(1000 + Math.random() * 9000);

      const srcAccount = postingFinancialAccounts.find(a => a.id === sourceAccountId || a.entityId === sourceAccountId);
      const trgAccount = postingFinancialAccounts.find(a => a.id === targetAccountId || a.entityId === targetAccountId);

      if (!srcAccount || !trgAccount) {
        throw new Error(isAr ? 'أحد الحسابات المحددة غير موجود في الدفاتر.' : 'Selected accounts not found.');
      }

      const voucherCode = `ADJ-${new Date().getFullYear().toString().slice(-2)}-${randStr}`;

      // 1. If it is a Salary Payment, invoke the atomic recordSalaryPayment service
      if (isSalaryPayment && targetType === 'employee') {
        if (!adjustSalaryMonth) {
          notificationService.notify({
            title: isAr ? 'الشهر غير محدد' : 'Month Required',
            message: isAr ? 'يرجى تحديد شهر صرف الراتب.' : 'Please select the salary month.',
            type: 'error'
          });
          setAdjustLoading(false);
          return;
        }

        await financialAccountService.recordSalaryPayment({
          employeeId: trgAccount.entityId,
          employeeName: trgAccount.entityName,
          accountId: targetAccountId,
          accountCode: trgAccount.accountCode,
          amount: convertedAmt,
          currency: adjustData.currency,
          salaryMonth: adjustSalaryMonth,
          notes: adjustData.notes || (isAr ? `صرف راتب شهر ${adjustSalaryMonth}` : `Salary payment for ${adjustSalaryMonth}`),
          createdByUid: currentUser?.id || 'system',
          createdByName: currentUser?.email?.split('@')[0] || 'Finance Auditor'
        });
      }

      // 2. Perform double-entry transaction posting (Debit trgAccount, Credit srcAccount)
      await financialAccountService.recordDoubleEntryTransaction(
        targetAccountId,
        sourceAccountId,
        {
          accountId: targetAccountId,
          accountCode: trgAccount.accountCode,
          entityType: trgAccount.entityType,
          entityId: trgAccount.entityId,
          entityName: trgAccount.entityName,
          amount: convertedAmt,
          amountOriginal: amountVal,
          currencyOriginal: adjustData.currency,
          description: adjustData.title || (isAr ? `قيد تسوية مزدوج: ${voucherCode}` : `Double-entry adjustment: ${voucherCode}`),
          refNumber: voucherCode,
          module: 'adjustment',
          createdAt: timestamp,
          createdByUid: currentUser?.id || 'system',
          createdByName: currentUser?.email?.split('@')[0] || 'Finance Auditor'
        }
      );

      notificationService.notify({
        title: isAr ? 'تم تقييد القيد بنجاح' : 'Adjustment Logged',
        message: isAr ? 'تم حفظ القيد المزدوج ترحيله إلى اليومية المساعدة بنجاح.' : 'Double-entry journal voucher registered successfully.',
        type: 'success'
      });

      setIsAdjustmentModalOpen(false);
      setAdjustData({
        type: 'Debit',
        amount: '',
        currency: 'YER',
        title: '',
        recipientName: '',
        notes: ''
      });
      setTargetType('general');
      setSourceAccountId('');
      setTargetAccountId('');
      setIsSalaryPayment(false);
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'Error write-back',
        message: err.message || 'Failed to persist manual voucher entry.',
        type: 'error'
      });
    } finally {
      setAdjustLoading(false);
    }
  };

// FIFO Payment settlement for selected Customer outstanding debt
  const handleCustomerFIFOPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payLoading) return;
    const amountVal = parseFloat(payAmount);
    if (!customerLedgerDetails || isNaN(amountVal) || amountVal <= 0) {
      notificationService.notify({
        title: isAr ? 'مبلغ غير صالح' : 'Invalid Balance',
        message: isAr ? 'الرجاء إدخال مبلغ دفع إيجابي لتسويته.' : 'Please type a valid currency number.',
        type: 'error'
      });
      return;
    }

    setPayLoading(true);
    try {
      // Find customer orders with remaining debt
      const unpaidOrders = orders
        .filter(o => o.customerId === auditedCustomerId && parseFloat(o.amountRemaining || 0) > 0)
        .sort((a, b) => {
          const d1 = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
          const d2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
          return d1 - d2;
        });

      if (unpaidOrders.length === 0) {
        notificationService.notify({
          title: isAr ? 'الحساب خالص' : 'No Debts Outstanding',
          message: isAr ? 'لا توجد مديونيات معلقة مسجلة على هذا العميل.' : 'This customer already holds a 0 YER outstanding balance.',
          type: 'warning'
        });
        setIsPayModalOpen(false);
        return;
      }

      let remainingPayment = amountVal;
      const batch = writeBatch(db);

      // Settle unpaid chronological invoices using chronological FIFO queue
      for (const ord of unpaidOrders) {
        if (remainingPayment <= 0) break;

        const ordRemaining = parseFloat(ord.amountRemaining || 0);
        const ordPaid = parseFloat(ord.amountPaid || 0);
        const ordRef = doc(db, 'orders', ord.id);

        if (remainingPayment >= ordRemaining) {
          // Paying off this specific invoice fully
          batch.update(ordRef, {
            amountPaid: ordPaid + ordRemaining,
            amountRemaining: 0,
            paymentStatus: isAr ? 'خالص' : 'Fully Paid'
          });
          remainingPayment -= ordRemaining;
        } else {
          // Partial payment applied to this invoice
          batch.update(ordRef, {
            amountPaid: ordPaid + remainingPayment,
            amountRemaining: ordRemaining - remainingPayment,
            paymentStatus: isAr ? 'دفع جزئي' : 'Partially Paid'
          });
          remainingPayment = 0;
        }
      }

      // --- Register Credit in Customer's Financial Account ---
      const customerRecord = customerLedgerDetails.customer;
      const linkedAccountId = customerRecord.accountId;
      const linkedAccountCode = customerRecord.accountCode;

      // Record cash inflow directly as a new-model payment voucher.
      const randStr = Math.floor(1000 + Math.random() * 9000);
      const voucherNum = `RCV-${randStr}`;

      if (linkedAccountId) {
        const convertedPaid = financialAccountService.convertToDefaultCurrency(
          amountVal,
          'YER',
          settings.currency || 'YER',
          dbRates
        );

        const systemAccs = await financialAccountService.ensureSystemAccounts('YER');

        await financialAccountService.recordTransaction({
          date: Date.now(),
          description: isAr
            ? `دفعة نقدية مستلمة على الحساب كشف حساب: ${payNotes || ''}`
            : `Cash payment received on account statement: ${payNotes || ''}`,
          module: 'payment',
          refNumber: voucherNum,
          amount: convertedPaid,
          currency: 'YER',
          debitAccount: { id: systemAccs['sys_cash_account'], code: '1111-0' },
          creditAccount: { id: linkedAccountId, code: linkedAccountCode || '1130' },
          createdByUid: currentUser?.id || 'system',
          createdByName: 'Finance Auditor'
        });
      }

      await batch.commit();

      notificationService.notify({
        title: isAr ? 'تم استلام وتوريد المبلغ' : 'Payment Deposited',
        message: isAr
          ? `تم استلام وتحصيل ${amountVal.toLocaleString()} YER وتطبيقها على أقدم الفواتير المستحقة.`
          : `FIFO accounting applied: Applied ${amountVal.toLocaleString()} YER to chronological outstanding invoices.`,
        type: 'success'
      });

      setIsPayModalOpen(false);
      setPayAmount('');
      setPayNotes('');
    } catch (err: any) {
      console.error(err);
      notificationService.notify({
        title: 'FIFO writeback error',
        message: err.message || 'Error executing balance clearance.',
        type: 'error'
      });
    } finally {
      setPayLoading(false);
    }
  };

  return { handleEditJournalSubmit, handleDeleteJournalSubmit, handleAddAdjustment, handleCustomerFIFOPayment };
}
