import { describe, expect, it } from 'vitest';
import {
  mapActivityLogRowToDto,
  mapCustomersRowToDto,
  mapFinanceEntryRowToDto,
  mapJobRequestRowToDto,
  mapNotificationsRowToDto,
  mapOrdersRowToDto,
  mapPortalTicketRowToDto,
  mapProductCategoryRowToDto,
  mapShipmentsRowToDto,
} from './mappers/feature.mappers';
import type {
  CustomerDetailsDatabaseRow,
  CustomersDatabaseRow,
  PortalUserDatabaseRow,
} from './customers.dto';
import type { FinanceEntryDatabaseRow } from './finance-entries.dto';
import type { ActivityLogDatabaseRow, NotificationsDatabaseRow } from './notifications.dto';
import type { OrdersDatabaseRow } from './orders.dto';
import type { ProductCategoryDatabaseRow } from './products.dto';
import type { ShipmentDatabaseRow } from './shipments.dto';
import type { JobRequestDatabaseRow, PortalTicketDatabaseRow } from './site-management.dto';

const timestamp = '2026-09-28T00:00:00.000Z';
const asRow = <T>(value: object) => value as unknown as T;

describe('legacy feature field projections', () => {
  it('preserves the complete customer profile and portal-account fields while excluding the password', () => {
    const customer = asRow<CustomersDatabaseRow>({
      customer_id: 'customer-1',
      full_name: 'Legacy Customer',
      is_active: true,
      data: { fullName: 'Legacy Customer', phone: '+967700000001', email: 'client@example.test' },
      created_at: timestamp,
    });
    const details = asRow<CustomerDetailsDatabaseRow>({
      cust_detail_id: 'detail-1',
      user_uid: 'portal-1',
      customer_id: 'customer-1',
      onboarding_completed: true,
      data: { city: 'Sanaa', country: 'YE', lat: '15.3694', lng: '44.1910', companyName: 'Client Co', idNumber: 'ID-77', maxDebt: '2500' },
    });
    const portal = asRow<PortalUserDatabaseRow>({
      portal_user_id: 'portal-1',
      username: 'client',
      email: 'client@example.test',
      linked_customer_id: 'customer-1',
      data: { password: 'must-not-leak', phone: '+967700000001', customerId: 'customer-1' },
    });

    const dto = mapCustomersRowToDto(customer, details, null, portal);

    expect(dto.profile).toMatchObject({ city: 'Sanaa', country: 'YE', lat: 15.3694, lng: 44.191, companyName: 'Client Co', idNumber: 'ID-77', maxDebt: 2500 });
    expect(dto.customerDetails).toMatchObject({ custDetailId: 'detail-1', userUid: 'portal-1', onboardingCompleted: true });
    expect(dto.portalAccount).toMatchObject({ phone: '+967700000001', customerId: 'customer-1', hasPassword: true });
    expect(dto.portalAccount).not.toHaveProperty('password');
  });

  it('retains operational, payment, fee, and recipient values stored in orders.data', () => {
    const dto = mapOrdersRowToDto(asRow<OrdersDatabaseRow>({
      order_id: 'order-1',
      order_number: 'ORD-1',
      order_party_type: 'customer',
      is_staff_order: false,
      created_at: timestamp,
      data: {
        recipientName: 'Recipient', customerPhone: '+967711111111', deliveryCity: 'Aden',
        totalPrice: '150.50', paidCurrency: 'SAR', amountPaid: '100', amountRemaining: '50.50',
        paymentMethod: 'split', cashAccountId: 'cash-1', bankAccountId: 'bank-1', bankReference: 'REF-1',
        homeDeliveryEnabled: true, shippingCompany: 'Carrier', externalOrderNumber: 'EXT-1', firedTriggers: ['fee-rule'],
      },
    }));

    expect(dto).toMatchObject({ recipientName: 'Recipient', customerPhone: '+967711111111', deliveryCity: 'Aden', totalPrice: 150.5 });
    expect(dto.orderData).toMatchObject({ paidCurrency: 'SAR', amountPaid: 100, amountRemaining: 50.5, paymentMethod: 'split', cashAccountId: 'cash-1', bankAccountId: 'bank-1', bankReference: 'REF-1', homeDeliveryEnabled: true, shippingCompany: 'Carrier', externalOrderNumber: 'EXT-1', firedTriggers: ['fee-rule'] });
  });

  it('projects every legacy shipment.data field exposed by the shipment form', () => {
    const dto = mapShipmentsRowToDto(asRow<ShipmentDatabaseRow>({
      shipment_id: 'shipment-1', order_id: 'order-1', created_at: timestamp,
      data: { shippingType: 'air', shippingSource: 'China', shippingDestination: 'Yemen', packagingFees: '12', shippingDate: '2026-09-20', shippingDuration: '14 days', expectedArrival: '2026-10-04', deliveryDate: '2026-10-05', notes: 'Fragile', shippingCategoryName: 'Express', shippingCategoryPrice: '30' },
    }));

    expect(dto.shipmentData).toEqual({ shippingType: 'air', shippingSource: 'China', shippingDestination: 'Yemen', packagingFees: 12, shippingDate: '2026-09-20', shippingDuration: '14 days', expectedArrival: '2026-10-04', deliveryDate: '2026-10-05', notes: 'Fragile', shippingCategoryName: 'Express', shippingCategoryPrice: 30 });
  });

  it('preserves category details used by the legacy product-category editor', () => {
    const dto = mapProductCategoryRowToDto(asRow<ProductCategoryDatabaseRow>({
      items_category_id: 'category-1', details: { packageType: 'carton', requiresPhoto: true, notes: 'special handling' },
    }));
    expect(dto.details).toEqual({ packageType: 'carton', requiresPhoto: true, notes: 'special handling' });
  });

  it('keeps all allowlisted notification payload values and associated users', () => {
    const dto = mapNotificationsRowToDto(asRow<NotificationsDatabaseRow>({
      notification_id: 'notification-1', created_at: timestamp, is_public: false, read: false,
      data: { title: 'Order update', message: 'Ready', link: '/orders/1', orderId: 'order-1', userId: 'user-1', associatedUserIds: ['user-2', 'user-3'], category: 'order', type: 'info', creatorId: 'user-1', creatorName: 'Operator' },
    }));
    expect(dto).toMatchObject({ title: 'Order update', message: 'Ready', link: '/orders/1', orderId: 'order-1', associatedUserIds: ['user-2', 'user-3'], creatorId: 'user-1', creatorName: 'Operator' });
  });

  it('retains job-application fields from job_requests.data', () => {
    const dto = mapJobRequestRowToDto(asRow<JobRequestDatabaseRow>({
      jobs_req_id: 'job-1', status: 'pending', created_at: timestamp,
      data: { fullName: 'Applicant', email: 'applicant@example.test', phone: '+967722222222', jobPosition: 'Courier', experienceYears: '3', idNumber: 'ID-3', qualification: 'Diploma', city: 'Taiz', address: 'Street 1', notes: 'Call evenings', refCode: 'REF-3' },
    }));
    expect(dto.application).toMatchObject({ fullName: 'Applicant', email: 'applicant@example.test', phone: '+967722222222', jobPosition: 'Courier', experienceYears: 3, idNumber: 'ID-3', qualification: 'Diploma', city: 'Taiz', address: 'Street 1', notes: 'Call evenings', refCode: 'REF-3' });
  });

  it('retains ticket replies from portal_tickets.data', () => {
    const dto = mapPortalTicketRowToDto(asRow<PortalTicketDatabaseRow>({
      portal_ticket_id: 'ticket-1', status: 'open', created_at: timestamp,
      data: { subject: 'Help', userName: 'Client', userEmail: 'client@example.test', message: 'Need support', replies: [{ id: 'reply-1', sender: 'staff', message: 'We are looking', createdAt: timestamp }] },
    }));
    expect(dto.ticket).toMatchObject({ subject: 'Help', userName: 'Client', userEmail: 'client@example.test', message: 'Need support', replies: [{ id: 'reply-1', sender: 'staff', message: 'We are looking', createdAt: timestamp }] });
  });

  it('retains the user-defined details in activity-log data', () => {
    const dto = mapActivityLogRowToDto(asRow<ActivityLogDatabaseRow>({
      activity_log_id: 'activity-1', created_at: timestamp,
      data: { userName: 'Operator', userRole: 'admin', timestamp, details: { orderId: 'order-1', amount: 42 } },
    }));
    expect(dto).toMatchObject({ userName: 'Operator', userRole: 'admin', details: { orderId: 'order-1', amount: 42 }, eventAt: timestamp });
  });

  it('preserves attachments associated with finance entries without dropping notes', () => {
    const dto = mapFinanceEntryRowToDto(asRow<FinanceEntryDatabaseRow>({
      main_entry_id: 'entry-1', created_at: timestamp, is_automatic: false,
      attachments: ['customer-proof.pdf', 'receipt.jpg'], notes: 'Customer documents',
    }));
    expect(dto.attachments).toEqual(['customer-proof.pdf', 'receipt.jpg']);
    expect(dto.notes).toBe('Customer documents');
  });
});
