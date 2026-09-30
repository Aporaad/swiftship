/**
 * UserListTabPage.tsx
 * صفحة/تبويب قائمة المستخدمين والموظفين
 * User List & Staff directory page tab wrapper
 */

import React from 'react';
import { UserListTab } from '../../components/UserListTab';

export const UserListTabPage: React.FC<any> = (props) => {
  return <UserListTab {...props} />;
};

export default UserListTabPage;
