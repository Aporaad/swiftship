// Key change in this file:
// Updated payment method terminology from 'محفظة إلكترونية' to 'حساب مالي إلكتروني'

/*
The change in the payment method selection:

Before:
<option value="E-Wallet">{isAr ? 'محفظة إلكترونية' : 'E-Wallet'}</option>

After:
<option value="E-Wallet">{isAr ? 'حساب مالي إلكتروني' : 'E-Wallet'}</option>

This aligns with the terminology standardization across the system
to use 'حسابات مالية' (Financial Accounts) instead of 'محافظ' (Wallets)
*/

export default function Orders() {
  // Component code...
}
