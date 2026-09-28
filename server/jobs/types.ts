/**
 * عقود وأنواع الوظائف الخلفية — Phase 8
 * Background Job Contracts and Types — Phase 8
 *
 * يُعرّف هذا الملف العناصر الأربعة عشر المعتمدة لكل عملية خلفية:
 * Input, Trigger, Preconditions, Transaction boundary, Idempotency key, Retry policy, Audit event, Failure behavior.
 */

export type JobTriggerType = 'cron' | 'event' | 'manual' | 'realtime_listener';

export interface BackgroundJobContext {
  /** اسم الوظيفة / Job name */
  jobName: string;
  /** نوع المحفز / Trigger source */
  trigger: JobTriggerType;
  /** مفتاح التكرار الفريد / Idempotency key to prevent duplicate execution */
  idempotencyKey: string;
  /** معرف الفاعل أو المستخدم الإداري / Actor or admin user ID */
  actorId?: string;
}

export interface JobRetryPolicy {
  /** الحد الأقصى للمحاولات / Maximum retry attempts */
  maxRetries: number;
  /** التأخير الابتدائي بالملي ثانية / Initial delay in milliseconds */
  initialDelayMs: number;
  /** معامل التضاعف / Backoff multiplier */
  backoffFactor: number;
}

export interface JobOptions {
  /** سياسة إعادة المحاولة / Retry policy */
  retryPolicy?: JobRetryPolicy;
  /** تسجيل سجل تدقيق عند النجاح/الفشل / Record activity audit log */
  audit?: boolean;
}

export interface JobExecutionResult<TOutput = any> {
  /** هل نجحت العملية / Whether job succeeded */
  success: boolean;
  /** ناتج العملية عند النجاح / Output data if successful */
  data?: TOutput;
  /** تفاصيل الخطأ عند الفشل / Error details if failed */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** عدد المحاولات المنفذة / Number of execution attempts */
  attempts: number;
  /** زمن التنفيذ بالملي ثانية / Execution duration in milliseconds */
  durationMs: number;
  /** مفتاح التكرار المستخدم / Idempotency key processed */
  idempotencyKey: string;
}

export interface BackgroundJobDefinition<TInput = any, TOutput = any> {
  /** اسم الوظيفة / Unique job name */
  name: string;
  /** التثبت من الشروط المسبقة / Verify preconditions before execution */
  preconditions: (input: TInput, context: BackgroundJobContext) => Promise<{ valid: boolean; reason?: string }>;
  /** التنفيذ الفعلي داخل الحد المعاملي / Core execution inside transactional boundary */
  execute: (input: TInput, context: BackgroundJobContext) => Promise<TOutput>;
  /** خيارات التشغيل الافتراضية / Default job options */
  defaultOptions?: JobOptions;
}
