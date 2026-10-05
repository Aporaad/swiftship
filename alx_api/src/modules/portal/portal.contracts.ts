/**
 * portal.contracts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * عقود ومواصفات بوابة الموقع الإلكتروني للعملاء (Public Portal Contracts).
 * Defines Public Tracking & Announcements DTOs and repository contract.
 */

export interface PublicTrackingEvent {
  status: string;
  occurredAt: number | null;
  location?: string | null;
}

export interface PublicTrackingDto {
  trackingToken: string;
  status: string;
  updatedAt: number | null;
  events: PublicTrackingEvent[];
}

export interface PortalAnnouncementDto {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'high' | 'urgent';
  createdAt: number;
}

export interface PortalRepository {
  getPublicTracking(trackingToken: string): Promise<PublicTrackingDto | null>;
  getAnnouncements(): Promise<PortalAnnouncementDto[]>;
}
