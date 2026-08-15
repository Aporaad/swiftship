// Date utility functions for consistent date formatting
export const formatDateTime = (date: Date | string | number = new Date()): string => {
  const d = new Date(date);
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

export const formatDate = (date: Date | string | number = new Date()): string => {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

export const formatTime = (date: Date | string | number = new Date()): string => {
  const d = new Date(date);
  return d.toISOString().slice(11, 16);
};

export const toISOStringWithTimezone = (date: Date | string | number = new Date()): string => {
  const d = new Date(date);
  return d.toISOString();
};

export const now = (): string => {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
};