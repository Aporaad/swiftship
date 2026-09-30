/**
 * LiveTrackingPageTab.tsx
 * تبويب/صفحة التتبع المباشر للطلبات
 * Live Order Tracking Page Tab
 */

import React from 'react';
import Tracking from '../../../shipments/pages/TrackingPage';

export const LiveTrackingPageTab: React.FC = () => {
  return (
    <div className="bg-[#121215] border border-slate-850 p-2 sm:p-6 rounded-3xl shadow-xl">
      <Tracking />
    </div>
  );
};

export default LiveTrackingPageTab;
