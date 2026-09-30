import type { AutomaticVoucherEntities } from './financialAccountTypes';

export function resolveAutomaticVoucherAccount(
  accountConfig: any,
  systemAccounts: Record<string, string>,
  order: any,
  entities: AutomaticVoucherEntities,
): { id: string; code: string } {
  if (!accountConfig?.id) {
    throw new Error('Automatic voucher account configuration is incomplete.');
  }

  const linkedAccount = (entity: any) => {
    if (!entity || typeof entity !== 'object') return null;
    const id = entity.financialAccountId || entity.accountId || entity.linkedAccountId || entity.account_id;
    if (!id) return null;
    return {
      id: String(id),
      code: String(entity.financialAccountCode || entity.accountCode || entity.linkedAccountCode || accountConfig.code || ''),
    };
  };

  const sourceKey = String(order?.sourcing_cost || order?.sourcsystemAccountsingCostSource || '').trim().toLowerCase();
  const costOnCourier = Boolean(order?.deductSourcingCostFromCourier)
    || ['courier', 'delivery_courier', 'courier_linked', 'مندوب'].includes(sourceKey);
  const defaultKey = String(accountConfig.defaultKey || accountConfig.id || '').trim();
  const fallbackOrderCost = () => ({
    id: String(systemAccounts.sys_orders_cost || systemAccounts.sys_sourcing_cost || 'sys_orders_cost'),
    code: String(accountConfig.code || ''),
  });

  let candidate: { id: string; code: string } | null = null;
  switch (accountConfig.id) {
    case 'customer_linked':
      candidate = linkedAccount(entities.orderParty || entities.customer);
      break;
    case 'delivery_courier_linked':
      candidate = linkedAccount(entities.deliveryCourier || entities.courier);
      break;
    case 'shipping_courier_linked':
      candidate = linkedAccount(entities.shippingCourier || entities.courier);
      break;
    case 'courier_linked':
      candidate = linkedAccount(entities.courier || entities.deliveryCourier || entities.shippingCourier);
      break;
    case 'purchase_source_linked':
      candidate = linkedAccount(entities.purchaseSource);
      break;
    case 'shipping_company_linked':
      candidate = linkedAccount(entities.shippingCompany);
      break;
    case 'payment_account_linked':
    case 'payment_account_dynamic':
    case 'selected_payment_account':
      candidate = linkedAccount((entities as any).paymentAccount)
        || (entities.debitAccountOverride?.id ? { id: String(entities.debitAccountOverride.id), code: String(entities.debitAccountOverride.code || '') } : null)
        || (order?.cashAccountId ? { id: String(order.cashAccountId), code: String(order.cashAccountCode || '') } : null)
        || (order?.bankAccountId ? { id: String(order.bankAccountId), code: String(order.bankAccountCode || '') } : null)
        || (order?.receivingAccountId ? { id: String(order.receivingAccountId), code: '' } : null)
        || (order?.paymentDetails?.[0]?.accountId ? { id: String(order.paymentDetails[0].accountId), code: '' } : null)
        || (order?.cash_account_id ? { id: String(order.cash_account_id), code: '' } : null)
        || (order?.bank_account_id ? { id: String(order.bank_account_id), code: '' } : null);
      break;
    case 'product_cost_source':
    case 'sourcing_cost':
      candidate = costOnCourier
        ? linkedAccount(entities.courier || entities.deliveryCourier || entities.shippingCourier || entities.sourcing_cost)
        : linkedAccount(entities.sourcing_cost);
      return candidate || fallbackOrderCost();
    case 'order_cost_account':
      return fallbackOrderCost();
    default:
      return {
        id: String(systemAccounts[defaultKey] || systemAccounts[accountConfig.id] || accountConfig.id),
        code: String(accountConfig.code || ''),
      };
  }

  if (!candidate?.id) {
    throw new Error(`Unable to resolve linked account for automatic voucher target: ${accountConfig.id}`);
  }
  return candidate;
}
