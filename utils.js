export const parseDateValue = (value) => {
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const dayKey = (value = new Date()) => {
  const d = parseDateValue(value);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

export const today = () => dayKey(new Date());

export const startOfDayIso = (value = new Date()) => {
  const d = parseDateValue(value);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const startOfMonthKey = (value = new Date()) => {
  const d = parseDateValue(value);
  d.setHours(12, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
