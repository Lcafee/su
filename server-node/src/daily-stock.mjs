import { ApiError } from './http.mjs';

export function validateDailyStock(metadata) {
  if (metadata.dailyRemaining != null && (!Number.isInteger(metadata.dailyRemaining) || metadata.dailyRemaining < 0 || metadata.dailyRemaining > 10)) {
    throw new ApiError(422, 'validation_error', 'موجودی باید عدد صحیح بین ۰ و ۱۰ باشد.');
  }
  if (metadata.dailyDate != null) {
    const value = metadata.dailyDate;
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) {
      throw new ApiError(422, 'validation_error', 'تاریخ موجودی معتبر نیست.');
    }
  }
  if (metadata.marbleBrownie != null && typeof metadata.marbleBrownie !== 'boolean') {
    throw new ApiError(422, 'validation_error', 'تنظیم ماربل براونی معتبر نیست.');
  }
}

export function stockComparableMetadata(metadata, seasonal) {
  return seasonal ? Object.fromEntries(Object.entries(metadata).filter(([key]) => !['dailyRemaining','dailyDate','marbleBrownie'].includes(key))) : metadata;
}
