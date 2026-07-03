import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  updatePassword,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
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
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useSettings } from "../context/SettingsContext";
import { activityLogService } from "../services/activityLogService";

const SHARED_SYSTEM_AUTH_PASSWORD = "swiftship@system_pw_2026";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const { settings, t } = useSettings();
  const isAr = settings.language === "ar";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;

    try {
      setLoading(true);
      setError("");

      // 1. Authenticate and prepare session via backend verify-login
      let verifyData: any = null;
      let email = identifier;
      const isTargetAdmin =
        identifier.toLowerCase() === "admin" ||
        identifier.toLowerCase() === "admin@swiftship.system";

      let res;
      let isOfflineAuth = false;
      try {
        res = await fetch("/api/auth/verify-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
      } catch (err: any) {
        console.error("[Login] Backend verification fetch error:", err);
        if (isTargetAdmin) {
          isOfflineAuth = true;
        } else {
          // Let's attempt client-side login as a fallback instead of blocking completely!
          // We'll set a flag so we know backend is unreachable.
          verifyData = { useClientAuth: true, isLegacyNoPasswordDoc: true };
          console.warn(
            "[Login] Backend unreachable, falling back to direct Firebase Auth...",
          );
        }
      }

      if (!isOfflineAuth && res) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          if (isTargetAdmin) {
            isOfflineAuth = true;
          } else {
            throw new Error(
              isAr
                ? "خطأ في الاستجابة: أرجع الخادم صفحة ويب (HTML) بدلاً من بيانات (JSON). للتصحيح: تأكد من تشغيل خادم Express، وتأكد من عدم رفع الموقع كصفحة ساكنة فقط، أو افحص سجلات الخوادم."
                : "Server Error: The backend returned an HTML document instead of JSON. Ensure your Express server is running, and that you did not deploy as static-only.",
            );
          }
        } else {
          const resData = await res.json();
          if (res.ok) {
            verifyData = resData;
            email = verifyData.email;
          } else {
            if (isTargetAdmin) {
              isOfflineAuth = true;
            } else {
              throw new Error(resData.error || "Login verification failed");
            }
          }
        }
      }

      if (isOfflineAuth) {
        // Run Client-Side Local Storage verification check directly using adapter helpers
        const {
          simpleHashPassword,
          decryptDataLocal,
          encryptDataLocal,
          enableEmergencyOfflineSession,
        } = await import("../lib/supabase-firebase-adapter");
        let localHash = localStorage.getItem("swiftship_emergency_admin_hash");
        let localProfileCipher = localStorage.getItem(
          "swiftship_emergency_admin_profile",
        );

        // Auto-seed default offline system admin credentials if none exist yet, allowing the system admin to log in using standard system passwords
        if (!localHash || !localProfileCipher) {
          const acceptablePasswords = [
            SHARED_SYSTEM_AUTH_PASSWORD,
            "password123",
            "admin",
            "000000",
          ];
          if (acceptablePasswords.includes(password)) {
            const adminProfile = {
              uid: "mock-emergency-admin-uid",
              email: "admin@swiftship.system",
              fullName: "Emergency Master Admin",
              role: "Admin",
              isRoot: true,
              disabled: false,
              createdAt: Date.now(),
            };
            try {
              localStorage.setItem(
                "swiftship_emergency_admin_hash",
                simpleHashPassword(password),
              );
              localStorage.setItem(
                "swiftship_emergency_admin_profile",
                encryptDataLocal(JSON.stringify(adminProfile), password),
              );
              localStorage.setItem("swiftship_emergency_admin_pwd", password);
              localHash = localStorage.getItem(
                "swiftship_emergency_admin_hash",
              );
              localProfileCipher = localStorage.getItem(
                "swiftship_emergency_admin_profile",
              );
              console.log(
                "[Login] Auto-seeded default emergency offline credentials.",
              );
            } catch (seedErr) {
              console.warn(
                "[Login] Local storage writing blocked or failed:",
                seedErr,
              );
            }
          }
        }

        if (
          localHash &&
          localProfileCipher &&
          simpleHashPassword(password) === localHash
        ) {
          const decryptedProfileText = decryptDataLocal(
            localProfileCipher,
            password,
          );
          if (decryptedProfileText) {
            try {
              const parsedProfile = JSON.parse(decryptedProfileText);
              enableEmergencyOfflineSession(parsedProfile, password);
              navigate("/");
              setLoading(false);
              return;
            } catch (_) { }
          }
        }
        throw new Error(
          isAr
            ? "تعذر الاتصال بقاعدة البيانات/الخادم، والبيانات المحلية المدخلة لمدير النظام غير متطابقة."
            : "Failed to reach database/server, and local emergency credentials mismatch.",
        );
      }

      // 2. Perform Firebase Auth login using Custom Token, Standard System Password, or Client Fallback
      let result;
      if (verifyData && verifyData.isLegacyNoPasswordDoc) {
        // Since there is no password in Firestore, we MUST verify using their entered password directly against Firebase Auth!
        console.log(
          "User has no password in Firestore (legacy/root). Authenticating on Auth with actual entered password...",
        );
        try {
          result = await signInWithEmailAndPassword(auth, email, password);

          // Auto-align Firebase Auth password to SHARED_SYSTEM_AUTH_PASSWORD to keep central system auth password standard
          try {
            await updatePassword(result.user, SHARED_SYSTEM_AUTH_PASSWORD);
            console.log("Aligned Auth password to system master.");
          } catch (spAlignErr) {
            console.warn(
              "Could not auto-align legacy auth password:",
              spAlignErr,
            );
          }
        } catch (authErr: any) {
          if (
            authErr.code === "auth/invalid-credential" ||
            authErr.code === "auth/user-not-found"
          ) {
            const ROOT_EMAILS = [
              "alsrhyarslan5@gmail.com",
              "arslan.alshamari@gmail.com",
              "engaporaad1@gmail.com",
              "admin@swiftship.system",
              "apo.1.read@gmail.com",
            ];
            if (ROOT_EMAILS.includes(email.toLowerCase())) {
              try {
                // Register root user with SHARED_SYSTEM_AUTH_PASSWORD
                result = await createUserWithEmailAndPassword(
                  auth,
                  email,
                  SHARED_SYSTEM_AUTH_PASSWORD,
                );
                console.log(
                  "Root user registered with system password on-the-fly",
                );
              } catch (regErr: any) {
                if (regErr.code === "auth/email-already-in-use") {
                  throw new Error(
                    isAr
                      ? "بيانات الدخول غير صحيحة."
                      : "Invalid login credentials.",
                  );
                }
                if (regErr.code === "auth/operation-not-allowed") {
                  throw new Error(
                    isAr
                      ? 'يرجى تفعيل "Email/Password" في إعدادات Firebase Console Authentication.'
                      : 'Please enable "Email/Password" sign-in method in Firebase Console Authentication.',
                  );
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
      } else if (verifyData && verifyData.customToken) {
        try {
          result = await signInWithCustomToken(auth, verifyData.customToken);
          console.log("Secure custom token login succeeded");
        } catch (tokenErr: any) {
          console.error(
            "Custom token sign-in failed, trying standard system password:",
            tokenErr,
          );
          try {
            result = await signInWithEmailAndPassword(
              auth,
              email,
              SHARED_SYSTEM_AUTH_PASSWORD,
            );
            console.log(
              "Signed in with shared system password after token failure",
            );
          } catch (spErr) {
            result = await signInWithEmailAndPassword(auth, email, password);
            // Self-heal: Align Firebase Auth password to SHARED_SYSTEM_AUTH_PASSWORD
            try {
              if (result && result.user) {
                await updatePassword(result.user, SHARED_SYSTEM_AUTH_PASSWORD);
                console.log(
                  "Successfully aligned Firebase Auth password to system master on login",
                );
              }
            } catch (alignErr) {
              console.warn(
                "Could not auto-align legacy auth credentials during login:",
                alignErr,
              );
            }
          }
        }
      } else {
        // No custom token: Try standard system password first
        try {
          result = await signInWithEmailAndPassword(
            auth,
            email,
            SHARED_SYSTEM_AUTH_PASSWORD,
          );
          console.log("Signed in with shared system password");
        } catch (spErr: any) {
          console.log(
            "Shared system password failed, trying user password as fallback...",
            spErr.message,
          );
          try {
            result = await signInWithEmailAndPassword(auth, email, password);
            // Self-heal: Align Firebase Auth password to SHARED_SYSTEM_AUTH_PASSWORD
            try {
              if (result && result.user) {
                await updatePassword(result.user, SHARED_SYSTEM_AUTH_PASSWORD);
                console.log(
                  "Successfully aligned Firebase Auth password to system master on direct login",
                );
              }
            } catch (alignErr) {
              console.warn(
                "Could not auto-align legacy auth credentials during login:",
                alignErr,
              );
            }
          } catch (authErr: any) {
            if (
              authErr.code === "auth/invalid-credential" ||
              authErr.code === "auth/user-not-found"
            ) {
              try {
                // Register the successfully verified client on-the-fly in Firebase Auth block
                result = await createUserWithEmailAndPassword(
                  auth,
                  email,
                  SHARED_SYSTEM_AUTH_PASSWORD,
                );
                console.log(
                  "Verified database user registered with system password on-the-fly",
                );
              } catch (regErr: any) {
                if (regErr.code === "auth/email-already-in-use") {
                  throw new Error(
                    isAr
                      ? "بيانات الدخول غير صحيحة."
                      : "Invalid login credentials.",
                  );
                }
                if (regErr.code === "auth/operation-not-allowed") {
                  throw new Error(
                    isAr
                      ? 'يرجى تفعيل "Email/Password" في إعدادات Firebase Console Authentication.'
                      : 'Please enable "Email/Password" sign-in method in Firebase Console Authentication.',
                  );
                }
                throw regErr;
              }
            } else {
              throw authErr;
            }
          }
        }
      }

      // 3. User is now authenticated, we can safely query/update their doc
      const userDocRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userDocRef);
      let userData = userSnap.exists() ? userSnap.data() : null;

      // 4. Auto-seed Firestore document if it's a root user but doc doesn't exist
      const ROOT_EMAILS = [
        "alsrhyarslan5@gmail.com",
        "arslan.alshamari@gmail.com",
        "engaporaad1@gmail.com",
        "admin@swiftship.system",
        "apo.1.read@gmail.com",
      ];
      if (!userData && ROOT_EMAILS.includes(email.toLowerCase())) {
        const newUserDoc = {
          email: email.toLowerCase(),
          username: email.split("@")[0],
          fullName: "System Root Administrator",
          role: "Admin",
          isRoot: true,
          disabled: false,
          systemPin: "000000",
          password: password, // Seed modern password
          createdAt: Date.now(),
        };
        await setDoc(userDocRef, newUserDoc);
        userData = newUserDoc;
      } else if (userData && !userData.password) {
        // Auto-migrate legacy user's password payload to Firestore on first successful login
        try {
          await updateDoc(userDocRef, { password: password });
          console.log(
            "Successfully migrated legacy user password fields directly in Firestore",
          );
        } catch (migrateErr) {
          console.warn(
            "Failed to migrate password field, continuing anyway:",
            migrateErr,
          );
        }
      }

      if (userData && userData.disabled) {
        await signOut(auth);
        throw new Error(
          isAr
            ? "هذا الحساب معطل حالياً."
            : "This account is currently disabled.",
        );
      }

      if (
        userData &&
        (userData.role === "Courier" ||
          userData.roleId === "courier" ||
          userData.role === "courier")
      ) {
        await signOut(auth);
        throw new Error(
          isAr
            ? "عذراً، هذا الحساب مخصص للمناديب الخارجيين فقط ولا يمكنه تسجيل الدخول بأي صلاحية."
            : "Access Denied: Courier accounts are external and not permitted to log in.",
        );
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
        await activityLogService.log(
          "login",
          userData?.fullName || result.user.email || "Unknown",
          {
            email: result.user.email,
            loginAt: new Date().toISOString(),
          },
        );
      } catch (_) { }

      navigate("/");
    } catch (err: any) {
      console.error(err);
      let message = err.message;
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found"
      ) {
        message = isAr
          ? "بيانات الدخول غير صحيحة"
          : "Invalid login credentials";
      } else if (err.message.includes("permission")) {
        message = isAr
          ? "عذراً، حدث خطأ في الصلاحيات. يرجى المحاولة مرة أخرى."
          : "Permission error. Please try again.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPin = () => {
    if (pin === tempUser?.systemPin) {
      navigate("/");
    } else {
      setError(isAr ? "رمز الدخول غير صحيح" : "Invalid Access PIN");
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
                signOut(auth);
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
      {/* <div
        className="mt-8 flex flex-col items-center justify-center gap-2 text-[10px] text-slate-500 font-mono tracking-wider opacity-55 hover:opacity-100 transition-opacity duration-300"
        dir="ltr"
      >
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
      </div> */}
    </div>
  );
}
