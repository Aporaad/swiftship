/**
 * أدوات فحص صحة وتعقيد كلمة المرور ومطابقتها
 * Password Validation & Complexity Utilities
 *
 * يوفر هذا الملف دوال للتحقق من قوة ومطابقة كلمات المرور
 * Provides functions for password strength checking and confirmation matching
 */

/** نتيجة التحقق من كلمة المرور | Password validation result */
export interface PasswordValidationResult {
  /** هل كلمة المرور صحيحة؟ | Is the password valid? */
  isValid: boolean;
  /** رسالة الخطأ إن وجدت | Error message if any */
  errorMessage: string;
  /** درجة القوة من 0 إلى 100 | Strength score from 0 to 100 */
  strengthScore: number;
  /** تسمية مستوى القوة | Strength label text */
  strengthLabel: string;
  /** لون مؤشر القوة (Tailwind class) | Strength color class */
  strengthColor: string;
}

/**
 * يتحقق من صحة كلمة المرور وتأكيدها وحساب مستوى قوتها
 * Validates a password and optionally its confirmation, returning strength metrics
 *
 * @param password - كلمة المرور الأصلية | The main password
 * @param confirmPassword - تأكيد كلمة المرور (اختياري) | Confirmation password (optional)
 * @param isAr - هل الواجهة عربية؟ | Is the interface in Arabic?
 * @param isRequired - هل كلمة المرور مطلوبة؟ | Is the password required?
 */
export function validatePasswordFields(
  password: string,
  confirmPassword?: string,
  isAr: boolean = true,
  isRequired: boolean = true
): PasswordValidationResult {
  // حالة عدم وجود كلمة مرور | Empty password case
  if (!password) {
    if (!isRequired) {
      return {
        isValid: true,
        errorMessage: '',
        strengthScore: 0,
        strengthLabel: '',
        strengthColor: ''
      };
    }
    return {
      isValid: false,
      errorMessage: isAr ? 'يرجى إدخال كلمة المرور' : 'Password is required',
      strengthScore: 0,
      strengthLabel: isAr ? 'غير محددة' : 'Not set',
      strengthColor: 'text-slate-500'
    };
  }

  // التحقق من الحد الأدنى للطول | Minimum length check
  if (password.length < 6) {
    return {
      isValid: false,
      errorMessage: isAr
        ? 'كلمة المرور قصيرة جداً (يجب أن لا تقل عن 6 أحرف أو أرقام)'
        : 'Password too short (minimum 6 characters)',
      strengthScore: 25,
      strengthLabel: isAr ? 'ضعيفة جداً 🔴' : 'Very Weak 🔴',
      strengthColor: 'text-rose-500'
    };
  }

  // التحقق من تطابق كلمتي المرور | Password match check
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {
      isValid: false,
      errorMessage: isAr
        ? 'كلمتا المرور غير متطابقتين، يرجى إعادة كتابتها لتأكيدها'
        : 'Passwords do not match',
      strengthScore: 50,
      strengthLabel: isAr ? 'غير متطابقة ⚠️' : 'Mismatch ⚠️',
      strengthColor: 'text-amber-500'
    };
  }

  // حساب درجة التعقيد | Complexity score calculation
  let score = 30;
  if (password.length >= 8) score += 25;
  if (/[0-9]/.test(password)) score += 20;
  if (/[a-zA-Z]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  let label = isAr ? 'ضعيفة ⚠️' : 'Weak ⚠️';
  let color = 'text-amber-400';

  if (score >= 80) {
    label = isAr ? 'قوية جداً 🟢' : 'Strong 🟢';
    color = 'text-emerald-400';
  } else if (score >= 60) {
    label = isAr ? 'متوسطة 🟡' : 'Medium 🟡';
    color = 'text-yellow-400';
  }

  return {
    isValid: true,
    errorMessage: '',
    strengthScore: score,
    strengthLabel: label,
    strengthColor: color
  };
}
