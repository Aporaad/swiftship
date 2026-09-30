import React from 'react';
import ConfirmModal from '../../../../../components/ConfirmModal';
import type { ReturnedProduct } from '../../../../../services/returnedProductService';

export interface ReturnedProductsDeleteDialogProps {
  isAr: boolean; isOpen: boolean; deletingReturn: ReturnedProduct | null;
  onClose: () => void; onConfirm: () => void;
}

export function ReturnedProductsDeleteDialog({ isAr, isOpen, deletingReturn, onClose, onConfirm }: ReturnedProductsDeleteDialogProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={isAr ? 'حذف المرتجع' : 'Delete Return'}
      message={isAr
        ? `هل أنت متأكد من حذف سجل المرتجع للمنتج "${deletingReturn?.product_name || ''}" من العميل "${deletingReturn?.customer_name || ''}"؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Are you sure you want to delete the return record for "${deletingReturn?.product_name || ''}" from "${deletingReturn?.customer_name || ''}"? This action cannot be undone.`}
      confirmText={isAr ? 'حذف نهائي' : 'Delete'}
      type="danger"
    />
  );
}
