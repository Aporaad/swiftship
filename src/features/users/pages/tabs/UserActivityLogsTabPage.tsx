/**
 * UserActivityLogsTabPage.tsx
 * صفحة/تبويب سجل نشاطات ومراجعة المستخدمين
 * User Activity & Audit Logs page tab wrapper
 */

import React from 'react';
import { UserActivityLogsTab } from '../../components/UserActivityLogsTab';

export const UserActivityLogsTabPage: React.FC<any> = (props) => {
  return <UserActivityLogsTab {...props} />;
};

export default UserActivityLogsTabPage;
