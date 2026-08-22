// Helper functions for converting numbers to formal text in Arabic and English

export const numberToWordsAr = (n: number): string => {
  if (n === 0) return 'صفر';
  if (n < 0) return 'سالب ' + numberToWordsAr(-n);

  const ones = [
    '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
    'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر',
    'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'
  ];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : ones[o] + ' و' + tens[t];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r === 0 ? hundreds[h] : hundreds[h] + ' و' + numberToWordsAr(r);
  }
  if (n < 1000000) {
    const k = Math.floor(n / 1000);
    const r = n % 1000;
    const ks = k === 1 ? 'ألف' : k === 2 ? 'ألفان' : k <= 10 ? numberToWordsAr(k) + ' آلاف' : numberToWordsAr(k) + ' ألف';
    return r === 0 ? ks : ks + ' و' + numberToWordsAr(r);
  }
  if (n < 1000000000) {
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    const ms = m === 1 ? 'مليون' : m === 2 ? 'مليونان' : m <= 10 ? numberToWordsAr(m) + ' ملايين' : numberToWordsAr(m) + ' مليون';
    return r === 0 ? ms : ms + ' و' + numberToWordsAr(r);
  }
  return n.toLocaleString('ar-YE');
};

export const numberToWordsEn = (n: number): string => {
  if (n === 0) return 'zero';
  if (n < 0) return 'negative ' + numberToWordsEn(-n);

  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberToWordsEn(n % 100) : '');
  if (n < 1000000) return numberToWordsEn(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberToWordsEn(n % 1000) : '');
  if (n < 1000000000) return numberToWordsEn(Math.floor(n / 1000000)) + ' million' + (n % 1000000 ? ' ' + numberToWordsEn(n % 1000000) : '');
  return n.toLocaleString('en-US');
};

export const currencyNameAr = (code: string): string => {
  switch (code) {
    case 'YER': return 'ريال يمني';
    case 'SAR': return 'ريال سعودي';
    case 'USD': return 'دولار أمريكي';
    default: return code;
  }
};

export const currencyNameEn = (code: string): string => {
  switch (code) {
    case 'YER': return 'Yemeni Rial';
    case 'SAR': return 'Saudi Riyal';
    case 'USD': return 'US Dollar';
    default: return code;
  }
};

export const amountInWords = (amount: number, currencyCode: string, lang: 'ar' | 'en'): string => {
  const whole = Math.ceil(amount);
  if (lang === 'ar') {
    return `✍️ فقط: ${numberToWordsAr(whole)} ${currencyNameAr(currencyCode)} لا غير`;
  }
  return `✍️ Say: ${numberToWordsEn(whole)} ${currencyNameEn(currencyCode)} only`;
};

export const paidAmountInWords = (amount: number, currencyCode: string, lang: 'ar' | 'en'): string => {
  const whole = Math.ceil(amount);
  if (lang === 'ar') {
    return `✍️ المبلغ المدفوع: ${numberToWordsAr(whole)} ${currencyNameAr(currencyCode)} نقداً`;
  }
  return `✍️ Paid: ${numberToWordsEn(whole)} ${currencyNameEn(currencyCode)} cash`;
};
