import type { JobRequestCreateInput, PortalTicketCreateInput, SiteManagementCreateInput, SiteManagementUpdateInput } from '../../../data/dtos/site-management.dto';
import { makeObjectSchema } from '../../../data/dtos/common.dto';

const siteRules = { title: 'nonEmptyString', content: 'object', isActive: 'boolean', priority: 'string' } as const;
export const siteManagementCreateSchema = makeObjectSchema<SiteManagementCreateInput>(['title'], siteRules);
export const siteManagementUpdateSchema = makeObjectSchema<SiteManagementUpdateInput>([], siteRules);

export const jobRequestCreateSchema = makeObjectSchema<JobRequestCreateInput>(['application'], {
  email: 'string', phone: 'string', status: 'string', category: 'string', referenceCode: 'string', application: 'object',
});
export const jobRequestUpdateSchema = makeObjectSchema<Partial<JobRequestCreateInput>>([], {
  email: 'string', phone: 'string', status: 'string', category: 'string', referenceCode: 'string', application: 'object',
});

export const portalTicketCreateSchema = makeObjectSchema<PortalTicketCreateInput>(['type', 'ticket'], {
  type: 'nonEmptyString', status: 'string', portalUserId: 'string', ticket: 'object',
});
export const portalTicketUpdateSchema = makeObjectSchema<Partial<PortalTicketCreateInput>>([], {
  type: 'string', status: 'string', portalUserId: 'string', ticket: 'object',
});
