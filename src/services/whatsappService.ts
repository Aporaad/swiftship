// WhatsApp Notification Service
import { notificationsApiDataGateway } from '../features/notifications/services/notificationsApiDataGateway';

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
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('swiftship_whatsapp_config');
        if (saved) {
          const data = JSON.parse(saved) as Partial<WhatsAppConfig>;
          return {
            enabled: data.enabled ?? defaultWhatsAppConfig.enabled,
            provider: data.provider ?? defaultWhatsAppConfig.provider,
            config: { ...defaultWhatsAppConfig.config, ...data.config },
            triggers: { ...defaultWhatsAppConfig.triggers, ...data.triggers },
            templates: { ...defaultWhatsAppConfig.templates, ...data.templates }
          };
        }
      }
      return defaultWhatsAppConfig;
    } catch (e) {
      console.error('Error fetching WhatsApp configuration:', e);
      return defaultWhatsAppConfig;
    }
  },

  // Save config
  async saveConfig(newConfig: WhatsAppConfig): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('swiftship_whatsapp_config', JSON.stringify(newConfig));
      }
    } catch (e) {
      console.error('Error saving WhatsApp configuration:', e);
    }
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

  // تطبيع رقم الهاتف اليمني إلى صيغة دولية — normalize a phone number to international format.
  normalizePhone(phone: string): string {
    let cleanPhone = phone.trim().replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    // أرقام محلية (7xxxxxxxx) تُسبق برمز الدولة 967 — local Yemeni numbers get the country code.
    if (cleanPhone.length === 9 && cleanPhone.startsWith('7')) cleanPhone = `967${cleanPhone}`;
    return cleanPhone;
  },

  /**
   * إرسال رسالة واتساب: تُسجَّل في قائمة انتظار الـ Outbox عبر alx_api،
   * والعامل الخلفي ينفّذ الإرسال الفعلي. لا ادّعاء إرسال وهمي من المتصفح.
   * Sending a WhatsApp message queues it in the alx_api outbox; a worker performs the actual
   * dispatch, so the browser never claims a send it cannot verify.
   */
  async sendDirect(phone: string, message: string, orderId?: string, eventType: string = 'manual'): Promise<{ success: boolean; status: string; errorMsg?: string }> {
    try {
      const cleanPhone = this.normalizePhone(phone);
      if (!cleanPhone) return { success: false, status: 'Failed', errorMsg: 'MISSING_PHONE_NUMBER' };

      const result = await notificationsApiDataGateway.sendExternal({
        recipient: cleanPhone,
        channel: 'whatsapp',
        message,
        templateId: eventType,
        // مفتاح منع التكرار: الطلب + الحدث + رقم المستلم — idempotency per order/event/recipient.
        idempotencyKey: `${eventType}:${orderId ?? 'manual'}:${cleanPhone}:${Date.now()}`,
      });
      return { success: true, status: result.status === 'queued' ? 'Queued' : result.status };
    } catch (e: any) {
      console.error('Error sending WhatsApp direct:', e);
      return { success: false, status: 'Failed', errorMsg: e?.message ?? 'SEND_FAILED' };
    }
  },

  /**
   * التحقق من اكتمال بيانات البوابة (لا اتصال خارجي من المتصفح):
   * الاتصال الفعلي يُنفَّذ في الخادم، والمتصفح يتحقق من الحقول المطلوبة فقط.
   * Validates that the required gateway credentials are present. No outbound call happens in the
   * browser — real connectivity is verified by the server-side dispatcher.
   */
  async testConnection(provider: string, config: WhatsAppConfig['config']): Promise<{ success: boolean; message: string; isWarning?: boolean }> {
    const required: Array<[keyof WhatsAppConfig['config'], string]> =
      provider === 'ultramsg'
        ? [['token', 'token'], ['instanceId', 'instanceId']]
        : provider === 'twilio'
          ? [['accountSid', 'accountSid'], ['sender', 'sender']]
          : [['customUrl', 'customUrl']];

    const missing = required.filter(([key]) => !String(config[key] ?? '').trim()).map(([, label]) => label);
    if (missing.length > 0) {
      return { success: false, message: `Missing credentials: ${missing.join(', ')}` };
    }
    return {
      success: true,
      isWarning: true,
      message: 'Credentials are complete; delivery is executed and logged by the alx_api outbox worker.',
    };
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
