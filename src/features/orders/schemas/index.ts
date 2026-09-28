import type { OrderCreateInput, OrderUpdateInput } from '../../../data/dtos/orders.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const orderRules = { orderNumber: 'nonEmptyString', trackingNumber: 'string', customerId: 'string', orderStatusId: 'string', orderSourceId: 'string', orderSourceType: 'string', deliveryCourierId: 'string', shippingCourierId: 'string', orderPartyId: 'string', orderPartyType: 'nonEmptyString', isStaffOrder: 'boolean', employeeId: 'string', courierId: 'string', orderPartyAccountId: 'string', totalAmount: 'number', totalPrice: 'number', currency: 'string', notes: 'string', paymentStatus: 'string', status: 'string', orderDate: 'string', recipientName: 'string', deliveryCity: 'string', orderData: 'object' } as const;
export const ordersCreateSchema = makeObjectSchema<OrderCreateInput>(['orderNumber', 'orderPartyType'], orderRules);
export const ordersUpdateSchema = makeObjectSchema<OrderUpdateInput>([], orderRules);
