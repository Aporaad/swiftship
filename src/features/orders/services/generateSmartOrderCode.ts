import type { OrderFeatureRecord } from "../types";

export interface SmartOrderCodeDependencies {
  findOrdersByNumberPrefix: (prefix: string) => Promise<readonly OrderFeatureRecord[]>;
  settings: {
    orderPrefix?: string;
    orderStartNumber?: number;
  };
  now?: () => Date;
  random?: () => number;
}

export function createSmartOrderCodeGenerator({
  findOrdersByNumberPrefix,
  settings,
  now = () => new Date(),
  random = Math.random,
}: SmartOrderCodeDependencies) {
  return async (): Promise<string> => {
    const currentDate = now();
    const year = String(currentDate.getFullYear()).slice(-2);
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const prefix = `${settings.orderPrefix || "ALX"}-${year}${month}`;
    const startNumber = settings.orderStartNumber || 1001;

    try {
      const ordersWithPrefix = await findOrdersByNumberPrefix(prefix);
      let maxNumber = 0;

      ordersWithPrefix.forEach(order => {
        const orderNumber = order.orderNumber;
        if (!orderNumber) return;

        const parts = String(orderNumber).split("-");
        const suffix = parts[parts.length - 1];
        const number = parseInt(suffix, 10);
        if (!isNaN(number) && number > maxNumber) maxNumber = number;
      });

      const nextNumber =
        maxNumber > 0 ? Math.max(startNumber, maxNumber + 1) : startNumber;
      return `${prefix}-${nextNumber}`;
    } catch (error) {
      console.warn(
        "Exception getting order count, using random placeholder:",
        error
      );
      return `${prefix}-${Math.floor(startNumber + random() * 9000)}`;
    }
  };
}
