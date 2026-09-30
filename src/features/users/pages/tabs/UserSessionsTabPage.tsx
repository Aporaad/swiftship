/**
 * UserSessionsTabPage.tsx
 * صفحة/تبويب الجلسات الحية والأجهزة النشطة
 * Active User Sessions & Devices page tab wrapper
 */

import React from 'react';
import { UserSessionsTab } from '../../components/UserSessionsTab';

export const UserSessionsTabPage: React.FC<any> = (props) => {
  return <UserSessionsTab {...props} />;
};

export default UserSessionsTabPage;
