import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface WhatsAppConfig {
  enabled: boolean;
  provider: 'ultramsg' | 'twilio' | 'custom';
  config: {
    token: string;
    instanceId: string;
    accountSid: string;
    sender: string;
    customUrl: string;
    customMethod: string;
    customHeaders: string;
    customBody: string;
  };
  triggers: {
    onOrderCreated: boolean;
    onOrderStatusChanged: boolean;
    onPaymentReceived: boolean;
  };
  templates: {
    onOrderCreated: string;
    onOrderStatusChanged: string;
    onPaymentReceived: string;
  };
}

export const defaultWhatsAppConfig: WhatsAppConfig = {
  enabled: false,
  provider: 'ultramsg',
  config: {
    token: '',
    instanceId: '',
    accountSid: '',
    sender: '',
    customUrl: 'https://api.example.com/send?phone={phone}&text={message}',
    customMethod: 'POST',
    customHeaders: 'Content-Type: application/json',
    customBody: '{\n  "to": "{phone}",\n  "message": "{message}"\n}'
  },
  triggers: {
    onOrderCreated: true,
    onOrderStatusChanged: true,
    onPaymentReceived: true
  },
  templates: {
    onOrderCreated: 'مرحباً {customerName}،\nتم تسجيل طلبك رقم {orderNumber} بنجاح.\nالقيمة الإجمالية: {totalCost} YER\nالمدفوع: {amountPaid} YER\nالمتبقي: {amountRemaining} YER.\nقناة الشحن: {shippingCompany}\nتتبع الرقم الموحد: {trackingNumber}\nشكراً لاختيارك لنا!',
    onOrderStatusChanged: 'تحديث لوجيستي لشحنتك {orderNumber} 🚚:\nالحالة الحالية: {orderStatus}\nالموقع الحالي: {locationYemen}\nقناة الشحن: {shippingCompany}\nالمبلغ المتبقي: {amountRemaining} YER.',
    onPaymentReceived: 'سند قبض مالي إلكتروني 🧾:\nعزيزنا العميل {customerName}،\nتم استلام دفعة مالية بقيمة {amountPaid} YER لطلبك رقم {orderNumber}.\nالمقدار الكلي المدفوع حتى الآن: {totalCostSaved} YER\nالمديونية المتبقية: {amountRemaining} YER.\nشكراً لتعاملكم معنا.'
  }
};

export const whatsappService = {
  // Fetch active settings
  async getConfig(): Promise<WhatsAppConfig> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'whatsapp'));
      if (snap.exists()) {
        const data = snap.data() as Partial<WhatsAppConfig>;
        return {
          enabled: data.enabled ?? defaultWhatsAppConfig.enabled,
          provider: data.provider ?? defaultWhatsAppConfig.provider,
          config: { ...defaultWhatsAppConfig.config, ...data.config },
          triggers: { ...defaultWhatsAppConfig.triggers, ...data.triggers },
          templates: { ...defaultWhatsAppConfig.templates, ...data.templates }
        };
      }
      return defaultWhatsAppConfig;
    } catch (e) {
      console.error('Error fetching WhatsApp configuration:', e);
      return defaultWhatsAppConfig;
    }
  },

  // Save config
  async saveConfig(newConfig: WhatsAppConfig): Promise<void> {
    await setDoc(doc(db, 'settings', 'whatsapp'), newConfig);
  },

  // Interpolate order fields into templates
  interpolate(template: string, order: any, additional: Record<string, any> = {}): string {
    let result = template;
    
    // Base order variables mappings
    const mappings: Record<string, string> = {
      '{customerName}': order.customerName || '',
      '{orderNumber}': order.orderNumber || order.id || '',
      '{trackingNumber}': order.trackingNumber || 'قيد الرفع',
      '{shippingCompany}': order.shippingCompany || '',
      '{orderStatus}': order.orderStatus || '',
      '{locationYemen}': order.locationYemen || '',
      '{totalCost}': ((parseFloat(order.amountPaid) || 0) + (parseFloat(order.amountRemaining) || 0)).toLocaleString(),
      '{amountPaid}': parseFloat(order.amountPaid || 0).toLocaleString(),
      '{amountRemaining}': parseFloat(order.amountRemaining || 0).toLocaleString(),
      ...additional
    };

    Object.entries(mappings).forEach(([tag, value]) => {
      // Use case-insensitive replacing
      const regex = new RegExp(tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      result = result.replace(regex, value);
    });

    return result;
  },

  // Directly hit the backend to send a WhatsApp message
  async sendDirect(phone: string, message: string, orderId?: string, eventType: string = 'manual'): Promise<{ success: boolean; status: string; errorMsg?: string }> {
    try {
      // Normalize phone number (Yemen phone numbers or generic formatting)
      let cleanPhone = phone.trim().replace(/[\s\-\+\(\)]/g, '');
      if (cleanPhone.startsWith('00')) {
        cleanPhone = cleanPhone.substring(2);
      }
      // If it's a local 9-digit Yemen number starting with 7, prefix with international country code '967'
      if (cleanPhone.length === 9 && cleanPhone.startsWith('7')) {
        cleanPhone = `967${cleanPhone}`;
      }
      
      const response = await fetch('/api/notifications/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          message,
          orderId: orderId || null,
          eventType
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, status: 'Failed', errorMsg: `HTTP ${response.status}: ${errorText}` };
      }
      
      return await response.json();
    } catch (e: any) {
      console.error('Error sending WhatsApp direct:', e);
      return { success: false, status: 'Failed', errorMsg: e.message };
    }
  },

  // Test credentials connection to the endpoint
  async testConnection(provider: string, config: any): Promise<{ success: boolean; message: string; isWarning?: boolean }> {
    try {
      const response = await fetch('/api/notifications/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP Error ${response.status}`);
      }

      return await response.json();
    } catch (e: any) {
      console.error('Test Connection Error:', e);
      throw e;
    }
  },

  // Interface to dispatch automatically on events
  async triggerNotification(eventType: 'onOrderCreated' | 'onOrderStatusChanged' | 'onPaymentReceived', order: any, additional: Record<string, any> = {}): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return;
      
      // Check if trigger is turned on
      if (!config.triggers[eventType]) return;
      
      const template = config.templates[eventType];
      if (!template) return;
      
      const finalMessage = this.interpolate(template, order, additional);
      const phone = order.customerPhone;
      
      if (!phone) {
        console.warn('Cannot send WhatsApp notification, customerPhone is empty for order:', order.orderNumber);
        return;
      }
      
      await this.sendDirect(phone, finalMessage, order.orderNumber || order.id, eventType);
    } catch (err) {
      console.error('Failed to trigger automatic WhatsApp notification:', err);
    }
  }
};
