/**
 * UserRolesTabPage.tsx
 * صفحة/تبويب الأدوار والصلاحيات
 * User Roles & Permissions page tab wrapper
 */

import React from 'react';
import { UserRolesTab } from '../../components/UserRolesTab';

export const UserRolesTabPage: React.FC<any> = (props) => {
  return <UserRolesTab {...props} />;
};

export default UserRolesTabPage;
