/**
 * ReturnedProductsTab.tsx
 * تبويبة إدارة المنتجات المرتجعة من العملاء
 * Tab for managing returned products from customers
 */

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { asyncState, runMutation, type AsyncState } from '../../shared/contracts/ui.contracts';
import { useRole } from '../../hooks/useRole';
import { calculateReturnStats } from '../../services/returnedProductService';
import type { ReturnedProduct, ReturnStatus } from '../../services/returnedProductService';
import {
  createEmptyReturnForm,
  returnedProductsGateway,
  validateReturnForm,
  useReturnedProductsData,
  ReturnedProductsSummary,
  ReturnedProductsFilters,
  ReturnedProductsTable,
  ReturnedProductFormDialog,
  ReturnedProductsDeleteDialog,
} from '../../features/orders/pages/subcomponents/returned-products';
import type { ReturnedProductsTabProps } from '../../features/orders/pages/subcomponents/returned-products';
import type { ReturnOrder, ReturnOrderItem } from '../../features/orders/pages/subcomponents/returned-products/types';

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return undefined;
}

export default function ReturnedProductsTab({
  isAr,
  canManage,
  orderCurrency = 'YER',
  orders = [],
  customers = [],
  masterProducts = [],
  orderItems: propOrderItems = [],
}: ReturnedProductsTabProps) {
  const { role, hasPermission, profile } = useRole();

  // ────────── State: البيانات - Data ──────────
  const { returns, loading, allOrders, allOrderItems } = useReturnedProductsData({
    orders,
    propOrderItems,
  });

  // ────────── State: الفلاتر والبحث - Filters & Search ──────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount'>('newest');

  // ────────── State: النوافذ - Modals ──────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<ReturnedProduct | null>(null);
  const [deletingReturn, setDeletingReturn] = useState<ReturnedProduct | null>(null);
  const [quickStatusItem, setQuickStatusItem] = useState<ReturnedProduct | null>(null);
  const [quickStatusValue, setQuickStatusValue] = useState<ReturnStatus>('معلق');

  // ────────── State: اختيار الطلب والمنتج في نموذج الإرجاع ──────────
  // Mandatory order and product selection state in return modal
  const [selectedOrder, setSelectedOrder] = useState<ReturnOrder | null>(null);
  const [selectedOrderItem, setSelectedOrderItem] = useState<ReturnOrderItem | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // قائمة الطلبات المفلترة داخل نافذة إضافة المرتجع
  const modalFilteredOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) {
      return allOrders.slice(0, 40);
    }
    const q = orderSearchQuery.toLowerCase().trim();
    return allOrders.filter((o) => {
      const num = String(o.orderNumber || o.order_number || o.id || '').toLowerCase();
      const cust = String(o.customerName || o.customer_name || '').toLowerCase();
      const phone = String(o.customerPhone || o.customer_phone || o.phone || '').toLowerCase();
      return num.includes(q) || cust.includes(q) || phone.includes(q);
    });
  }, [allOrders, orderSearchQuery]);

  // قائمة منتجات الطلب المختار تلقائياً
  const selectedOrderProducts = useMemo(() => {
    if (!selectedOrder) return [];
    const ordId = selectedOrder.id;
    const ordNum = selectedOrder.orderNumber || selectedOrder.order_number;

    const directItems = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const matchedItems = allOrderItems.filter((it) => {
      return (ordId && it.order_id === ordId) || (ordNum && it.order_id === ordNum);
    });

    const map = new Map<string, ReturnOrderItem>();
    directItems.forEach((it, idx) => {
      const key = it.items_id || it.id || `direct_${idx}`;
      map.set(key, it);
    });
    matchedItems.forEach((it) => {
      const key = it.items_id || it.id;
      if (key) map.set(key, it);
    });

    return Array.from(map.values());
  }, [selectedOrder, allOrderItems]);

  // اختيار طلب من القائمة
  const handleSelectOrder = (order: ReturnOrder) => {
    setSelectedOrder(order);
    setSelectedOrderItem(null);
    const ordNo = order.orderNumber || order.order_number || order.id || '';
    const custId = order.customerId || order.customer_id || '';
    const custName = order.customerName || order.customer_name || order.customer || 'عميل';
    const cur = order.currency || orderCurrency || 'YER';

    setFormData(f => ({
      ...f,
      order_id: ordNo,
      customer_id: custId,
      customer_name: custName,
      refund_currency: cur,
      // تفريغ المنتج السابق
      order_item_id: '',
      product_id: '',
      product_name: '',
      product_url: '',
      quantity: 1,
      refund_amount: 0,
      is_insured: false,
      insurance_refund: 0,
    }));
  };

  // اختيار منتج من منتجات الطلب
  const handleSelectOrderItem = (item: ReturnOrderItem) => {
    setSelectedOrderItem(item);
    const pName = item.product_cooler || item.product_name || item.productName || 'منتج';
    const pUrl = item.product_url || item.productUrl || '';
    const pId = item.product_id || item.productId || '';
    const itemId = item.items_id || item.id || '';
    const isInsured = Boolean(item.is_insured);
    const insFee = Number(item.insurance_fee || 0);
    const qty = Math.max(1, Number(item.quantity) || 1);
    const totalPrice = Number(item.total_price || (item.product_price ? item.product_price * qty : 0));

    setFormData(f => ({
      ...f,
      order_item_id: itemId,
      product_id: pId,
      product_name: pName,
      product_url: pUrl,
      quantity: 1,
      refund_amount: totalPrice,
      is_insured: isInsured,
      insurance_refund: insFee,
    }));
  };

  // ────────── State: النموذج - Form ──────────
  const [formData, setFormData] = useState(createEmptyReturnForm());
  const [mutationState, setMutationState] = useState<AsyncState<unknown>>(asyncState.idle());
  const submitting = mutationState.status === 'submitting';

  // ────────── الصلاحيات - Permissions ──────────
  const can_view = role === 'Admin' || hasPermission('view_returned_products') || canManage;
  const can_add = role === 'Admin' || hasPermission('add_returned_products') || canManage;
  const can_edit = role === 'Admin' || hasPermission('edit_returned_products') || canManage;
  const can_delete = role === 'Admin' || hasPermission('delete_returned_products') || canManage;

  // ────────── فلترة البيانات - Data Filtering ──────────
  const filteredReturns = useMemo(() => {
    let result = [...returns];

    // فلتر البحث - Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.product_name || '').toLowerCase().includes(q) ||
        (r.order_id || '').toLowerCase().includes(q) ||
        (r.return_reason || '').toLowerCase().includes(q)
      );
    }

    // فلتر الحالة - Status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.return_status === statusFilter);
    }

    // فلتر النوع - Type filter
    if (typeFilter !== 'all') {
      result = result.filter(r => r.return_type === typeFilter);
    }

    // فلتر الحالة الفيزيائية - Condition filter
    if (conditionFilter !== 'all') {
      result = result.filter(r => r.return_condition === conditionFilter);
    }

    // فلتر التاريخ - Date filter
    if (dateFrom) {
      result = result.filter(r => (r.returned_at || '') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(r => (r.returned_at || '') <= dateTo + 'T23:59:59');
    }

    // الترتيب - Sorting
    result.sort((a, b) => {
      if (sortBy === 'amount') {
        const amtA = (Number(a.refund_amount) || 0) + (Number(a.insurance_refund) || 0);
        const amtB = (Number(b.refund_amount) || 0) + (Number(b.insurance_refund) || 0);
        return amtB - amtA;
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      // newest (default)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return result;
  }, [returns, searchQuery, statusFilter, typeFilter, conditionFilter, dateFrom, dateTo, sortBy]);

  /** إحصائيات المرتجعات - Returns statistics */
  const stats = useMemo(() => calculateReturnStats(filteredReturns), [filteredReturns]);

  // ────────── فتح نموذج الإضافة - Open Add Form ──────────
  const openAddForm = () => {
    setEditingReturn(null);
    setSelectedOrder(null);
    setSelectedOrderItem(null);
    setOrderSearchQuery('');
    setFormData(createEmptyReturnForm());
    setIsFormOpen(true);
  };

  // ────────── فتح نموذج التعديل - Open Edit Form ──────────
  const openEditForm = (ret: ReturnedProduct) => {
    setEditingReturn(ret);
    // البحث عن الطلب المرتبط
    const matched = allOrders.find(
      (o) => o.id === ret.order_id || o.orderNumber === ret.order_id || o.order_number === ret.order_id
    );
    setSelectedOrder(matched || null);

    // البحث عن بند الطلب المرتبط
    const matchedItem = allOrderItems.find(
      (it) => ret.order_item_id && (it.items_id === ret.order_item_id || it.id === ret.order_item_id)
    );
    setSelectedOrderItem(matchedItem || null);
    setOrderSearchQuery('');

    setFormData({
      order_id: ret.order_id || '',
      order_item_id: ret.order_item_id || '',
      product_id: ret.product_id || '',
      customer_id: ret.customer_id || '',
      customer_name: ret.customer_name || '',
      product_name: ret.product_name || '',
      product_url: ret.product_url || '',
      quantity: ret.quantity || 1,
      return_reason: ret.return_reason || '',
      return_type: ret.return_type || 'استرداد',
      return_status: ret.return_status || 'معلق',
      return_condition: ret.return_condition || 'مستخدم',
      refund_amount: ret.refund_amount || 0,
      refund_currency: ret.refund_currency || 'YER',
      is_insured: Boolean(ret.is_insured),
      insurance_refund: ret.insurance_refund || 0,
      notes: ret.notes || '',
      returned_at: ret.returned_at ? String(ret.returned_at).split('T')[0] : new Date().toISOString().split('T')[0],
      processed_by: ret.processed_by || '',
      processed_at: ret.processed_at || '',
    });
    setIsFormOpen(true);
  };

  // ────────── حفظ المرتجع - Save Return ──────────
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateReturnForm(formData);
    if (validationError === 'order') {
      toast.error(isAr ? 'يجب اختيار الطلب من قائمة الطلبات أولاً (إجباري)' : 'Please select an order first (mandatory)');
      return;
    }
    if (validationError === 'product') {
      toast.error(isAr ? 'يجب اختيار المنتج المرتجع من قائمة منتجات الطلب (إجباري)' : 'Please select a returned product from the order items (mandatory)');
      return;
    }
    if (validationError === 'reason') {
      toast.error(isAr ? 'سبب الإرجاع إجباري' : 'Return reason is required');
      return;
    }

    const result = await runMutation(async () => {
      const currentUser = profile?.displayName || profile?.email || 'system';
      const nowIso = new Date().toISOString();
      const returnedAtIso = formData.returned_at?.trim()
        ? (formData.returned_at.includes('T') ? formData.returned_at : new Date(formData.returned_at).toISOString())
        : nowIso;
      const processedAtIso = formData.processed_at?.trim()
        ? (formData.processed_at.includes('T') ? formData.processed_at : new Date(formData.processed_at).toISOString())
        : null;
      const commonPayload = {
        ...formData,
        order_id: formData.order_id?.trim() || null,
        order_item_id: formData.order_item_id?.trim() || null,
        product_id: formData.product_id?.trim() || null,
        customer_id: formData.customer_id?.trim() || null,
        processed_by: formData.processed_by?.trim() || null,
        processed_at: processedAtIso,
        returned_at: returnedAtIso,
        quantity: Math.max(1, Number(formData.quantity) || 1),
        refund_amount: Math.max(0, Number(formData.refund_amount) || 0),
        insurance_refund: formData.is_insured ? Math.max(0, Number(formData.insurance_refund) || 0) : 0,
        is_insured: Boolean(formData.is_insured),
      };

      if (editingReturn) {
        await returnedProductsGateway.updateReturn(editingReturn.return_id, {
          ...commonPayload, updated_at: nowIso, updated_by: currentUser,
        });
        return 'updated' as const;
      }

      const return_id = 'ret_' + Math.random().toString(36).substring(2, 11);
      await returnedProductsGateway.createReturn(return_id, {
        return_id, ...commonPayload,
        return_status: formData.return_status || 'معلق',
        return_type: formData.return_type || 'استرداد',
        return_condition: formData.return_condition || 'مستخدم',
        created_at: nowIso, created_by: currentUser, updated_at: nowIso, updated_by: currentUser,
      });
      if (formData.order_item_id) {
        try {
          await returnedProductsGateway.updateOrderItem(formData.order_item_id, {
            items_status: 'مرتجع', updated_at: nowIso,
          });
        } catch (itemError) {
          console.warn('Could not update order_items status:', itemError);
        }
      }
      return 'created' as const;
    }, setMutationState);

    if (result.status === 'error') {
      toast.error(result.error.message || (isAr ? 'تعذر حفظ المرتجع' : 'Could not save return'));
      return;
    }
    const mutationData = result.status === 'success' || result.status === 'success-after-mutation'
      ? result.data
      : undefined;
    toast.success(mutationData === 'updated'
      ? (isAr ? 'تم تحديث المرتجع بنجاح' : 'Return updated successfully')
      : (isAr ? 'تم إضافة المرتجع بنجاح وتحديث السجلات' : 'Return added successfully'));
    setIsFormOpen(false);
  };
  // ────────── تحديث الحالة السريع - Quick Status Update ──────────
  const handleQuickStatusSave = async () => {
    if (!quickStatusItem) return;
    const currentUser = profile?.displayName || profile?.email || 'system';
    const now = new Date().toISOString();
    const result = await runMutation(() => returnedProductsGateway.updateReturn(quickStatusItem.return_id, {
        return_status: quickStatusValue,
        processed_by: quickStatusValue !== 'معلق' ? currentUser : null,
        processed_at: quickStatusValue !== 'معلق' ? now : null,
        updated_at: now,
        updated_by: currentUser,
      }), setMutationState);
    if (result.status !== 'error') {
      toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      setQuickStatusItem(null);
    } else {
      toast.error(result.error.message || (isAr ? 'تعذر تحديث الحالة' : 'Update failed'));
    }
  };

  // ────────── حذف المرتجع - Delete Return ──────────
  const handleDelete = async () => {
    if (!deletingReturn) return;
    const result = await runMutation(
      () => returnedProductsGateway.deleteReturn(deletingReturn.return_id),
      setMutationState,
    );
    if (result.status !== 'error') {
      toast.success(isAr ? 'تم حذف المرتجع' : 'Return deleted');
      setDeletingReturn(null);
      setIsDeleteConfirmOpen(false);
    } else {
      toast.error(result.error.message || (isAr ? 'تعذر الحذف' : 'Delete failed'));
    }
  };

  /** مسح جميع الفلاتر - Clear all filters */
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setConditionFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all' ||
    conditionFilter !== 'all' || dateFrom || dateTo;

  const money = (amount: unknown, currency?: string) =>
    `${Number(amount || 0).toLocaleString()} ${currency || orderCurrency}`;

  // ════════════════ PAGE SHELL ════════════════
  return (
    <div className="space-y-5 text-start animate-fade-in" data-testid="returned-products-tab">
      <ReturnedProductsSummary isAr={isAr} stats={stats} money={money} />
      <ReturnedProductsFilters
        isAr={isAr}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        conditionFilter={conditionFilter}
        setConditionFilter={setConditionFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        setSortBy={setSortBy}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        canManage={canManage}
        canAdd={can_add}
        openAddForm={openAddForm}
        filteredCount={filteredReturns.length}
        totalCount={returns.length}
      />
      <ReturnedProductsTable
        isAr={isAr}
        loading={loading}
        filteredReturns={filteredReturns}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        money={money}
        quickStatusItem={quickStatusItem}
        quickStatusValue={quickStatusValue}
        setQuickStatusItem={setQuickStatusItem}
        setQuickStatusValue={setQuickStatusValue}
        handleQuickStatusSave={handleQuickStatusSave}
        canEdit={can_edit}
        canManage={canManage}
        canDelete={can_delete}
        openEditForm={openEditForm}
        setDeletingReturn={setDeletingReturn}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
      />
      <ReturnedProductFormDialog
        isOpen={isFormOpen}
        isAr={isAr}
        orderCurrency={orderCurrency}
        editingReturn={editingReturn}
        selectedOrder={selectedOrder}
        selectedOrderProducts={selectedOrderProducts}
        selectedOrderItem={selectedOrderItem}
        setSelectedOrder={setSelectedOrder}
        setSelectedOrderItem={setSelectedOrderItem}
        setIsFormOpen={setIsFormOpen}
        handleSaveReturn={handleSaveReturn}
        modalFilteredOrders={modalFilteredOrders}
        orderSearchQuery={orderSearchQuery}
        setOrderSearchQuery={setOrderSearchQuery}
        handleSelectOrder={handleSelectOrder}
        formData={formData}
        setFormData={setFormData}
        handleSelectOrderItem={handleSelectOrderItem}
        submitting={submitting}
      />
      <ReturnedProductsDeleteDialog
        isAr={isAr}
        isOpen={isDeleteConfirmOpen}
        deletingReturn={deletingReturn}
        onClose={() => { setIsDeleteConfirmOpen(false); setDeletingReturn(null); }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
