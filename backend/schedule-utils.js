const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
const TWENTY_MINUTES_IN_MS = 20 * 60 * 1000;

const pad = (value) => String(value).padStart(2, '0');

export function computeNextScheduledTime({ index, lastScheduledTime, now = new Date() }) {
    if (index < 3) return null;

    const baseTime = index === 3 || !lastScheduledTime
        ? new Date(now.getTime() + TWENTY_MINUTES_IN_MS)
        : new Date(lastScheduledTime.getTime() + FIVE_MINUTES_IN_MS);

    return new Date(Math.ceil(baseTime.getTime() / FIVE_MINUTES_IN_MS) * FIVE_MINUTES_IN_MS);
}

export function getScheduleHintText(meta = {}) {
    return [
        meta.placeholder,
        meta.ariaLabel,
        meta.label,
        meta.name,
        meta.id,
        meta.value
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function inferScheduleFieldKind(meta = {}) {
    const hint = getScheduleHintText(meta);
    if (!hint) return 'unknown';

    if (/\b(date|day|ngay)\b/.test(hint)) return 'date';
    if (/\b(time|hour|minute|gio)\b/.test(hint)) return 'time';
    if (/\b(am|pm)\b/.test(hint) || hint.includes(':')) return 'time';
    if (hint.includes('/') || hint.includes('-') || hint.includes('.')) return 'date';

    return 'unknown';
}

export function formatScheduleValue(date, kind, meta = {}) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error('Invalid schedule date');
    }

    const hint = getScheduleHintText(meta);
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = date.getHours();
    const minutes = pad(date.getMinutes());

    if (kind === 'time') {
        if (/\b(am|pm)\b/.test(hint)) {
            const hour12 = hours % 12 || 12;
            const meridiem = hours >= 12 ? 'PM' : 'AM';
            return `${hour12}:${minutes} ${meridiem}`;
        }

        return `${pad(hours)}:${minutes}`;
    }

    if (kind === 'date') {
        if (/dd\s*\/\s*mm/.test(hint)) return `${day}/${month}/${year}`;
        if (/mm\s*\/\s*dd/.test(hint) || hint.includes('/')) return `${month}/${day}/${year}`;
        if (hint.includes('.')) return `${year}.${month}.${day}`;
        return `${year}-${month}-${day}`;
    }

    throw new Error(`Unsupported schedule field kind: ${kind}`);
}

export function sortScheduleInputs(inputs = []) {
    return [...inputs].sort((a, b) => {
        if ((a.top ?? 0) !== (b.top ?? 0)) return (a.top ?? 0) - (b.top ?? 0);
        return (a.left ?? 0) - (b.left ?? 0);
    });
}
