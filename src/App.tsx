/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Tracking from './pages/Tracking';
import Customers from './pages/Customers';
import Users from './pages/Users';
import UserManagement from './pages/UserManagement';
import Couriers from './pages/Couriers';
import Roles from './pages/Roles';
import Sources from './pages/Sources';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Expenses from './pages/Expenses';
import SalaryHistory from './pages/SalaryHistory';

import { SettingsProvider } from './context/SettingsContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded border-2 border-cyan-500/20 border-t-cyan-500 shadow-[0_0_15px_rgba(8,145,178,0.2)]"></div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          {!user && <Route path="/tracking" element={<Tracking />} />}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          
          <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="tracking" element={<Tracking />} />
            <Route path="customers" element={<Customers />} />
            <Route path="sources" element={<Sources />} />
            <Route path="users" element={<Users />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="couriers" element={<Couriers />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="roles" element={<Roles />} />
            <Route path="settings" element={<Settings />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="salary-history" element={<SalaryHistory />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}

