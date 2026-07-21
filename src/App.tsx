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
import Accounting from './pages/Accounting';
import SalaryHistory from './pages/SalaryHistory';
import Reports from './pages/Reports';

import { SettingsProvider } from './context/SettingsContext';
import { financialAccountService } from './services/financialAccountService';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('swiftship_persisted_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          return {
            ...parsed,
            getIdToken: async () => 'session_token'
          } as unknown as User;
        }
      }
    } catch (_) {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('swiftship_persisted_user');
    }
    return true;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      try {
        if (currentUser) {
          localStorage.setItem('swiftship_persisted_user', JSON.stringify({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            emailVerified: currentUser.emailVerified
          }));
        } else {
          localStorage.removeItem('swiftship_persisted_user');
        }
      } catch (_) {}
    });
    return unsubscribe;
  }, []);

  // ── Automatic full balance recalculation & periodic sync on system startup ──
  useEffect(() => {
    if (!user) return;

    // Trigger immediately on app startup / user login
    financialAccountService.recalculateAllBalances().catch(err => {
      console.warn("Auto recalculation on app launch failed:", err);
    });

    // Setup background periodic synchronization every 10 minutes
    const interval = setInterval(() => {
      console.log("[App] Periodic background balance verification running...");
      financialAccountService.recalculateAllBalances().catch(err => {
        console.warn("Periodic background recalculation failed:", err);
      });
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-100 overflow-hidden relative">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-700/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="z-10 flex flex-col items-center p-8 max-w-sm text-center">
          {/* Animated Premium Ring Loader */}
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            {/* Outer pulsating glow ring */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/10 animate-pulse"></div>
            
            {/* Third outer slow spinning ring */}
            <div className="absolute inset-1.5 rounded-full border border-dashed border-indigo-500/20 animate-[spin_20s_linear_infinite]"></div>
            
            {/* Second spinning ring */}
            <div className="absolute inset-3 rounded-full border-2 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent animate-[spin_1.2s_cubic-bezier(0.5,0.1,0.4,0.9)_infinite]"></div>
            
            {/* Counter-spinning third ring */}
            <div className="absolute inset-5 rounded-full border border-t-transparent border-r-indigo-400 border-b-indigo-400 border-l-transparent animate-[spin_1.8s_ease-in-out_infinite] opacity-80"></div>
            
            {/* Core glowing dot with impulse pulse */}
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
          </div>

          {/* Core Brand / Identity Label */}
          <h2 className="text-xl font-bold tracking-widest text-[#d4af37] drop-shadow-md mb-2 font-sans select-none animate-[pulse_2s_infinite]">
            SWIFTSHIP
          </h2>

          {/* Loading state labels in Arabic & English */}
          <div className="space-y-1.5 mt-2 select-none">
            <p className="text-sm font-medium text-slate-300 animate-[pulse_2s_infinite]">
              جاري التحقق من الجلسة وتأمين النظام...
            </p>
            <p className="text-xs text-slate-500 font-mono tracking-wider">
              Verifying session &amp; securing connection...
            </p>
          </div>

          {/* Progress hint indicator */}
          <div className="w-28 h-[3px] bg-slate-800 rounded-full overflow-hidden mt-6">
            <div className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500 animate-[loading-bar_1.5s_infinite] w-1/2 rounded-full"></div>
          </div>
        </div>

        {/* CSS custom keyframes for the progress bar directly injected */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}} />
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
            <Route path="accounting" element={<Accounting />} />
            <Route path="reports" element={<Reports />} />
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

