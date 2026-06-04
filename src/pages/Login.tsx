import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn, User, Eye, EyeOff, Mail, Crown } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';
import { activityLogService } from '../services/activityLogService';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [pin, setPin] = useState('');
  const navigate = useNavigate();
  const { settings, t } = useSettings();
  const isAr = settings.language === 'ar';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;

    try {
      setLoading(true);
      setError('');

      // 1. Resolve identifier to email via backend
      let email = identifier;
      
      try {
        const res = await fetch('/api/auth/resolve-identifier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier })
        });
        
        if (res.ok) {
          const data = await res.json();
          email = data.email;
        } else if (res.status === 404) {
          // If not found in DB, check if it's a hardcoded root email or 'admin'
          const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
          const lowerId = identifier.toLowerCase();
          
          if (lowerId === 'admin') {
            email = 'admin@swiftship.system';
          } else if (ROOT_EMAILS.includes(lowerId)) {
            email = lowerId;
          } else {
            throw new Error(isAr ? 'المستخدم غير مسجل في النظام. يرجى التواصل مع المسؤول.' : 'User not found in system. Please contact admin.');
          }
        }
      } catch (fetchErr: any) {
        console.warn('Backend resolution failed, attempting direct login:', fetchErr);
      }

      // 2. Perform Firebase Auth login
      let result;
      try {
        result = await signInWithEmailAndPassword(auth, email, password);
      } catch (authErr: any) {
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found') {
          const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
          if (ROOT_EMAILS.includes(email.toLowerCase())) {
            try {
              result = await createUserWithEmailAndPassword(auth, email, password);
              console.log('Root user created on-the-fly');
            } catch (regErr: any) {
              if (regErr.code === 'auth/email-already-in-use') {
                throw new Error(isAr ? 'بيانات الدخول غير صحيحة.' : 'Invalid login credentials.');
              }
              if (regErr.code === 'auth/operation-not-allowed') {
                throw new Error(isAr 
                  ? 'يرجى تفعيل "Email/Password" في إعدادات Firebase Console Authentication.' 
                  : 'Please enable "Email/Password" sign-in method in Firebase Console Authentication.');
              }
              throw regErr;
            }
          } else {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }
      
      // 3. User is now authenticated, we can safely query their doc
      const userDocRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userDocRef);
      let userData = userSnap.exists() ? userSnap.data() : null;

      // 4. Auto-seed Firestore document if it's a root user but doc doesn't exist
      const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
      if (!userData && ROOT_EMAILS.includes(email.toLowerCase())) {
        const newUserDoc = {
          email: email.toLowerCase(),
          username: email.split('@')[0],
          fullName: 'System Root Administrator',
          role: 'Admin',
          isRoot: true,
          disabled: false,
          systemPin: '000000',
          createdAt: Date.now(),
        };
        await setDoc(userDocRef, newUserDoc);
        userData = newUserDoc;
      }

      if (userData && userData.disabled) {
        await signOut(auth);
        throw new Error(isAr ? 'هذا الحساب معطل حالياً.' : 'This account is currently disabled.');
      }

      if (userData && (userData.role === 'Courier' || userData.roleId === 'courier' || userData.role === 'courier')) {
        await signOut(auth);
        throw new Error(isAr 
          ? 'عذراً، هذا الحساب مخصص للمناديب الخارجيين فقط ولا يمكنه تسجيل الدخول بأي صلاحية.' 
          : 'Access Denied: Courier accounts are external and not permitted to log in.');
      }

      // 5. Check for System PIN
      if (userData?.systemPin) {
        setPinRequired(true);
        setTempUser(userData);
        setLoading(false);
        return;
      }

      // Log login event
      try {
        await activityLogService.log('login', userData?.fullName || result.user.email || 'Unknown', {
          email: result.user.email,
          loginAt: new Date().toISOString(),
        });
      } catch (_) {}

      navigate('/');
    } catch (err: any) {
      console.error(err);
      let message = err.message;
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        message = isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid login credentials';
      } else if (err.message.includes('permission')) {
        message = isAr ? 'عذراً، حدث خطأ في الصلاحيات. يرجى المحاولة مرة أخرى.' : 'Permission error. Please try again.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPin = () => {
    if (pin === tempUser?.systemPin) {
      navigate('/');
    } else {
      setError(isAr ? 'رمز الدخول غير صحيح' : 'Invalid Access PIN');
    }
  };

  if (pinRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-luxury-black py-12 px-4 sm:px-6 lg:px-8 font-sans select-none text-right" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full space-y-8 bg-gradient-to-b from-[#121215] to-[#08080a] p-8 sm:p-12 rounded-2xl border border-[#d4af37]/20 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>
          
          <div className="w-16 h-16 bg-[#d4af37]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/25 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Lock className="h-8 w-8 text-[#d4af37]" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">
            {isAr ? 'رمز الأمان للنظام' : 'Access PIN Verification'}
          </h2>
          <p className="mt-2 text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em]">
            {isAr ? 'مدير النظام • يرجى إدخال رمز الأمان الشخصي' : 'Identity proofing required'}
          </p>

          {error && (
            <div className="bg-rose-950/20 text-rose-400 p-3 rounded-xl text-[11px] border border-rose-900/40 font-bold mb-6 font-mono text-center">
              [SYSTEM_ALERT]: {error}
            </div>
          )}

          <div className="space-y-6 mt-8">
            <input
              type="password"
              value={pin}
              autoFocus
              onChange={(e) => setPin(e.target.value)}
              className="block w-full px-4 py-4 rounded-xl border border-slate-900 bg-black text-white focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/60 outline-none transition-all font-mono text-3xl tracking-[1em] text-center"
              placeholder="••••••"
            />
            
            <button
              onClick={verifyPin}
              className="w-full flex justify-center py-4 px-4 rounded-xl shadow-md text-xs font-black text-black bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] focus:outline-none transition-all active:scale-95 gap-2 items-center uppercase tracking-widest cursor-pointer shadow-yellow-950/20"
            >
              <LogIn className="w-4 h-4" />
              {isAr ? 'تحقق ومتابعة' : 'Verify & Execute'}
            </button>

            <button
              onClick={() => {
                setPinRequired(false);
                setPin('');
                signOut(auth);
              }}
              className="text-[10px] font-black text-slate-500 hover:text-slate-350 uppercase tracking-widest cursor-pointer"
            >
              {isAr ? 'إلغاء وتغيير الحساب' : 'Abort Session'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-luxury-black py-12 px-4 sm:px-6 lg:px-8 font-sans select-none text-right" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full space-y-8 bg-gradient-to-b from-[#121215] to-[#08080a] p-8 sm:p-12 rounded-2xl border border-[#d4af37]/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>
        
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-b from-[#d4af37]/10 to-yellow-950/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)] relative group">
            {settings.systemLogo ? (
              <img
                src={settings.systemLogo}
                alt={settings.systemName || 'Logo'}
                className="w-14 h-14 object-contain transition-all duration-500 transform group-hover:scale-105"
              />
            ) : (
              <svg className="w-12 h-10 text-[#d4af37] transition-transform duration-500 group-hover:scale-105" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 5 L75 55 L50 43 L25 55 Z" stroke="currentColor" strokeWidth="2.5" fill="rgba(212,175,55,0.08)" />
                <path d="M50 5 L50 43" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
                <circle cx="50" cy="5" r="3" fill="#fff" className="animate-ping" />
              </svg>
            )}
            <span className="absolute -top-1 right-2 bg-[#d4af37] text-black rounded-full p-0.5 shadow-sm shadow-yellow-950">
              <Crown className="w-2.5 h-2.5" />
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-widest uppercase mb-1">
            {settings.systemName || settings.companyName || 'SwiftShip'}
          </h2>
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.3em] inline-block border-y border-slate-900 py-1.5 px-4 mt-1">
            {t('systemAdminPanel')}
          </p>
        </div>
        
        {error && (
          <div className="bg-rose-950/20 text-rose-400 p-3 rounded-xl text-[11px] border border-rose-900/40 font-bold text-center">
            [ACCESS_DENIED]: {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5 pt-3">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 focus-within:text-[#d4af37]" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="block w-full pl-10 pr-4 py-3 rounded-xl border border-slate-900 bg-black text-white placeholder-slate-600 focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/60 outline-none transition-all text-xs font-bold text-start"
                placeholder={isAr ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email'}
                dir="ltr"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="block w-full pl-10 pr-12 py-3 rounded-xl border border-slate-900 bg-black text-white placeholder-slate-600 focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/60 outline-none transition-all text-xs font-bold text-start"
                placeholder={isAr ? 'كلمة المرور' : 'Password'}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-[#d4af37] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3.5 px-4 rounded-xl text-xs font-black text-black bg-gradient-to-r from-[#d4af37] to-yellow-600 hover:from-yellow-600 hover:to-[#d4af37] transition-all active:scale-[0.98] disabled:opacity-50 gap-2 items-center uppercase tracking-widest shadow-lg shadow-yellow-950/20 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isAr ? 'تسـجيـل الـدخـول' : 'Initialize Session'}
          </button>
        </form>

        <div className="text-center pt-6 border-t border-slate-900">
          <p className="text-[9px] text-[#d4af37] font-extrabold uppercase tracking-[0.1em] leading-relaxed mb-3">
            {isAr 
              ? 'يجب أن يكون حسابك مسجلاً مسبقاً من قبل الإدارة الفنية للمتابعة.' 
              : 'Restricted system. Access attempts logged natively.'}
          </p>
        </div>
      </div>
    </div>
  );
}
