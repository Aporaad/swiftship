import React, { useState } from "react";
import { db } from "../data/legacy/legacy-compat.ts";
import { useAuthSession } from "../features/auth/AuthSessionProvider";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  LogIn,
  User,
  Eye,
  EyeOff,
  Mail,
  Crown,
  Send,
  MessageCircle,
  Phone,
} from "lucide-react";
import { collection, doc, getDocs, getDoc, query, setDoc, where } from "../data/legacy/legacy-compat.ts";
import { useSettings } from "../context/SettingsContext";
import { activityLogService } from "../services/activityLogService";


export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const { settings, t } = useSettings();
  const isAr = settings.language === "ar";
  const { authenticate, completeSignIn, cancelPendingSignIn } = useAuthSession();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    try {
      setLoading(true);
      setError("");

      let email = identifier.trim().toLowerCase();
      if (!email.includes("@") && email !== "admin") {
        const usernameSnap = await getDocs(query(collection(db, "users"), where("username", "==", email),));
        const usernameProfile = usernameSnap.docs[0]?.data() as any;
        if (!usernameProfile?.email) throw new Error(isAr ? "اسم المستخدم غير موجود" : "Username was not found");
        email = usernameProfile.email;
      }

      const result = await authenticate(email, password);
      if (!result.id) throw new Error(isAr ? "تعذر التحقق من بيانات الدخول" : "Credentials could not be verified");

      const userDocRef = doc(db, "users", result.id);
      const userSnap = await getDoc(userDocRef);
      let userData: any = userSnap.exists() ? userSnap.data() : null;
      const rootEmails = [
        "alsrhyarslan5@gmail.com",
        "arslan.alshamari@gmail.com",
        "engaporaad1@gmail.com",
        "admin@swiftship.system",
        "apo.1.read@gmail.com",
      ];

      if (!userData && rootEmails.includes((result.email || email).toLowerCase())) {
        userData = {
          email: result.email || email,
          username: (result.email || email).split("@")[0],
          fullName: "System Root Administrator",
          role: "Admin",
          isRoot: true,
          disabled: false,
          createdAt: Date.now(),
        };
        await setDoc(userDocRef, userData);
      }

      if (userData?.disabled) {
        cancelPendingSignIn();
        throw new Error(isAr ? "هذا الحساب معطل حالياً." : "This account is currently disabled.");
      }

      if (userData && ["Courier", "courier"].includes(userData.role) || userData?.roleId === "courier") {
        cancelPendingSignIn();
        throw new Error(isAr ? "حساب المندوب الخارجي لا يملك صلاحية دخول النظام." : "Courier accounts cannot access the staff system.");
      }

      if (userData?.systemPin) {
        setPinRequired(true);
        setTempUser({ ...userData, email: userData.email || result.email });
        setPendingUserId(result.id);
        return;
      }

      completeSignIn(result.id);
      await activityLogService.log("login", userData?.fullName || result.email || "Unknown", {
        email: result.email,
        loginAt: new Date().toISOString(),
      });
      navigate("/");
    } catch (err: any) {
      cancelPendingSignIn();
      console.error("[Login] Supabase authentication failed:", err);
      const code = String(err?.code || "");
      setError(code.includes("invalid") || code.includes("credentials")
        ? (isAr ? "بيانات الدخول غير صحيحة" : "Invalid login credentials")
        : (err?.message || (isAr ? "تعذر تسجيل الدخول" : "Unable to sign in")));
    } finally {
      setLoading(false);
    }
  };

  const verifyPin = async () => {
    if (pin !== tempUser?.systemPin) {
      setError(isAr ? "رمز الدخول غير صحيح" : "Invalid Access PIN");
      return;
    }
    if (!pendingUserId) {
      cancelPendingSignIn();
      setError(isAr ? "تعذر استكمال جلسة الدخول" : "Unable to complete sign-in");
      return;
    }
    try {
      completeSignIn(pendingUserId);
      await activityLogService.log("login", tempUser?.fullName || tempUser?.email || "Unknown", {
        email: tempUser?.email,
        loginAt: new Date().toISOString(),
      });
      setPinRequired(false);
      setPin("");
      setTempUser(null);
      setPendingUserId(null);
      navigate("/");
    } catch (err: any) {
      setError(err?.message || (isAr ? "تعذر استكمال تسجيل الدخول" : "Unable to complete sign-in"));
    }
  };

  if (pinRequired) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-luxury-black py-12 px-4 sm:px-6 lg:px-8 font-sans select-none text-right"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="max-w-md w-full space-y-8 bg-gradient-to-b from-[#121215] to-[#08080a] p-8 sm:p-12 rounded-2xl border border-[#d4af37]/20 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent"></div>

          <div className="w-16 h-16 bg-[#d4af37]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/25 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Lock className="h-8 w-8 text-[#d4af37]" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">
            {isAr ? "رمز الأمان للنظام" : "Access PIN Verification"}
          </h2>
          <p className="mt-2 text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.2em]">
            {isAr
              ? "مدير النظام • يرجى إدخال رمز الأمان الشخصي"
              : "Identity proofing required"}
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
              {isAr ? "تحقق ومتابعة" : "Verify & Execute"}
            </button>

            <button
              onClick={() => {
                setPinRequired(false);
                setPin("");
                setTempUser(null);
                setPendingUserId(null);
                cancelPendingSignIn();
              }}
              className="text-[10px] font-black text-slate-500 hover:text-slate-350 uppercase tracking-widest cursor-pointer"
            >
              {isAr ? "إلغاء وتغيير الحساب" : "Abort Session"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-luxury-black py-8 px-4 sm:px-6 lg:px-8 font-sans overflow-y-auto select-none text-right"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="max-w-md w-full space-y-8 bg-gradient-to-b from-[#121215] to-[#08080a] p-8 sm:p-12 rounded-2xl border border-[#d4af37]/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent"></div>

        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-b from-[#d4af37]/10 to-yellow-950/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#d4af37]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)] relative group">
            {settings.systemLogo ? (
              <img
                src={settings.systemLogo}
                alt={settings.systemName || "Logo"}
                className="w-14 h-14 object-contain transition-all duration-500 transform group-hover:scale-105"
              />
            ) : (
              <svg
                className="w-12 h-10 text-[#d4af37] transition-transform duration-500 group-hover:scale-105"
                viewBox="0 0 100 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M50 5 L75 55 L50 43 L25 55 Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="rgba(212,175,55,0.08)"
                />
                <path
                  d="M50 5 L50 43"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx="50"
                  cy="5"
                  r="3"
                  fill="#fff"
                  className="animate-ping"
                />
              </svg>
            )}
            <span className="absolute -top-1 right-2 bg-[#d4af37] text-black rounded-full p-0.5 shadow-sm shadow-yellow-950">
              <Crown className="w-2.5 h-2.5" />
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-widest uppercase mb-1">
            {settings.systemName || settings.companyName || "alx"}
          </h2>
          <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-[0.3em] inline-block border-y border-slate-900 py-1.5 px-4 mt-1">
            {t("systemAdminPanel")}
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
                placeholder={
                  isAr
                    ? "اسم المستخدم أو البريد الإلكتروني"
                    : "Username or Email"
                }
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
                placeholder={isAr ? "كلمة المرور" : "Password"}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-[#d4af37] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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
            {isAr ? "تسـجيـل الـدخـول" : "Initialize Session"}
          </button>
        </form>

        <div className="text-center pt-6 border-t border-slate-900/60">
          <p className="text-[8px] text-[#62748E] font-medium leading-relaxed mb-4">
            {isAr
              ? "يجب أن يكون حسابك مسجلاً مسبقاً من قبل الإدارة الفنية للمتابعة."
              : "Restricted system. Access attempts logged natively."}
          </p>

          {/* Company Inquiry and Support Card */}
          <div
            className="bg-transparent border border-slate-900 p-4 rounded-xl text-center relative"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="flex flex-col items-center justify-center pb-2 border-b border-slate-900/40 mb-3">
              <span className="text-[12px] font-black text-[#D4AF37] tracking-wider uppercase">
                {isAr ? "للتواصل والاستفسار" : "Inquiries & Support"}
              </span>
            </div>

            <div className="flex items-center justify-center gap-6 py-1">
              {/* Phone item */}
              <a
                href="tel:785557070"
                className="p-3 bg-[#d4af37]/5 text-[#d4af37] hover:bg-[#d4af37]/15 hover:text-white border border-[#d4af37]/20 hover:border-[#d4af37]/45 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
                title={isAr ? "رقم الهاتف: 785557070" : "Phone: 785557070"}
              >
                <Phone className="w-5 h-5" />
              </a>

              {/* Email item */}
              <a
                href="mailto:alxdelivery777@gmail.com"
                className="p-3 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 hover:text-white border border-blue-500/20 hover:border-blue-500/45 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
                title={
                  isAr
                    ? "البريد الإلكتروني: alxdelivery777@gmail.com"
                    : "Email: alxdelivery777@gmail.com"
                }
              >
                <Mail className="w-5 h-5" />
              </a>

              {/* WhatsApp item */}
              <a
                href="https://wa.me/967785557070"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-green-500/5 text-green-400 hover:bg-green-500/15 hover:text-white border border-green-500/20 hover:border-green-500/45 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
                title={isAr ? "الدردشة على واتساب" : "WhatsApp Chat"}
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Subtly crafted tech-themed developer badge */}
      {/*<div>  
        className="mt-8 flex flex-col items-center justify-center gap-2 text-[10px] text-slate-500 font-mono tracking-wider opacity-55 hover:opacity-100 transition-opacity duration-300"
        dir="ltr"
      &gt;
        <div className="flex items-center gap-2">
          <span className="text-slate-700 font-bold">&lt;/&gt;</span>
          <span className="text-[10px] font-black tracking-wide text-slate-400 hover:text-[#d4af37] transition-colors">
            {isAr ? "المطور: ارسلان الشماري" : "Developer: Arslan Al-Shamari"}
          </span>
          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="https://wa.me/967776422777"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 px-1.5 text-slate-500 hover:text-[#25D366] hover:bg-[#25D366]/5 rounded-md transition-all"
            title={isAr ? "واتساب المطور" : "WhatsApp Developer"}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://t.me/Arslan_ALShamari"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 px-1.5 text-slate-500 hover:text-[#2CA5E0] hover:bg-[#2CA5E0]/5 rounded-md transition-all"
            title={isAr ? "تلجرام المطور" : "Telegram Developer"}
          >
            <Send className="w-3.5 h-3.5" />
          </a>
          <a
            href="mailto:arslan.alshamari@gmail.com"
            className="p-1 px-1.5 text-slate-500 hover:text-[#EA4335] hover:bg-[#EA4335]/5 rounded-md transition-all"
            title={isAr ? "إيميل المطور" : "Email Developer"}
          >
            <Mail className="w-3.5 h-3.5" />
          </a>
          <a
            href="tel:+967776422777"
            className="p-1 px-1.5 text-slate-500 hover:text-[#05C46B] hover:bg-[#05C46B]/5 rounded-md transition-all"
            title={isAr ? "اتصال بالمطور" : "Call Developer"}
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>*/}
    </div>
  );
}
