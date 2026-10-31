import test from 'node:test';
import assert from 'node:assert/strict';

import {
    computeNextScheduledTime,
    computeAutoIncrementTime,
    inferScheduleFieldKind,
    formatScheduleValue,
    sortScheduleInputs,
    parseTikTokContentTimeText,
    parseScheduleValue,
    displayedDateMatches,
    displayedTimeMatches,
    parseScheduleDateValue,
    isValidScheduleDateParts,
    looksLikeScheduledLabel
} from '../schedule-utils.js';

test('computeNextScheduledTime starts at +20 minutes and rounds up to 5-minute mark', () => {
    const now = new Date('2026-04-12T09:16:33.336Z');

    const scheduled = computeNextScheduledTime({
        index: 3,
        lastScheduledTime: null,
        now
    });

    assert.equal(scheduled.toISOString(), '2026-04-12T09:40:00.000Z');
});

test('computeNextScheduledTime increments from previous scheduled slot by 10 minutes', () => {
    const previous = new Date('2026-04-12T09:40:00.000Z');

    const scheduled = computeNextScheduledTime({
        index: 4,
        lastScheduledTime: previous,
        now: new Date('2026-04-12T09:18:25.755Z')
    });

    assert.equal(scheduled.toISOString(), '2026-04-12T09:50:00.000Z');
});

test('computeAutoIncrementTime increments from previous scheduled slot by 5 minutes', () => {
    const previous = new Date('2026-04-12T09:40:00.000Z');

    const scheduled = computeAutoIncrementTime({
        lastScheduledTime: previous,
        intervalMinutes: 5,
        now: new Date('2026-04-12T09:18:25.755Z')
    });

    assert.equal(scheduled.toISOString(), '2026-04-12T09:45:00.000Z');
});

test('computeAutoIncrementTime increments from previous scheduled slot by 10 minutes when selected', () => {
    const previous = new Date('2026-04-12T09:40:00.000Z');

    const scheduled = computeAutoIncrementTime({
        lastScheduledTime: previous,
        intervalMinutes: 10,
        now: new Date('2026-04-12T09:18:25.755Z')
    });

    assert.equal(scheduled.toISOString(), '2026-04-12T09:50:00.000Z');
});

test('parseTikTokContentTimeText normalizes year to current year instead of 2001', () => {
    const parsedEng = parseTikTokContentTimeText('Sep 6, 02:30');
    assert.equal(parsedEng.getFullYear(), new Date().getFullYear());
    assert.equal(parsedEng.getMonth(), 8); // September (0-indexed 8)
    assert.equal(parsedEng.getDate(), 6);
    assert.equal(parsedEng.getHours(), 2);
    assert.equal(parsedEng.getMinutes(), 30);

    const parsedVn = parseTikTokContentTimeText('6 thg 9, 02:30');
    assert.equal(parsedVn.getFullYear(), new Date().getFullYear());
    assert.equal(parsedVn.getMonth(), 8);
    assert.equal(parsedVn.getDate(), 6);

    const parsedNewUi = parseTikTokContentTimeText('Oct 30, 10:10 PM (GMT+7) Saigon');
    assert.equal(parsedNewUi.getFullYear(), new Date().getFullYear());
    assert.equal(parsedNewUi.getMonth(), 9);
    assert.equal(parsedNewUi.getDate(), 30);
    assert.equal(parsedNewUi.getHours(), 22);
    assert.equal(parsedNewUi.getMinutes(), 10);

    const parsedNum = parseTikTokContentTimeText('09/06 02:30');
    assert.equal(parsedNum.getFullYear(), new Date().getFullYear());
    assert.equal(parsedNum.getMonth(), 8);
    assert.equal(parsedNum.getDate(), 6);
});

test('parseScheduleValue correctly handles date and time strings without defaulting to 2001', () => {
    const parsed = parseScheduleValue('2026-09-05', '10:30 PM');
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 8);
    assert.equal(parsed.getDate(), 5);
    assert.equal(parsed.getHours(), 22);
    assert.equal(parsed.getMinutes(), 30);
});

test('inferScheduleFieldKind detects date and time from input hints', () => {
    assert.equal(inferScheduleFieldKind({ placeholder: 'Select date' }), 'date');
    assert.equal(inferScheduleFieldKind({ ariaLabel: 'Time' }), 'time');
    assert.equal(inferScheduleFieldKind({ value: '04/12/2026' }), 'date');
    assert.equal(inferScheduleFieldKind({ value: '4:45 PM' }), 'time');
});

test('formatScheduleValue adapts to date and time field hints', () => {
    const date = new Date('2026-04-12T16:45:00');

    assert.equal(formatScheduleValue(date, 'date', { placeholder: 'YYYY-MM-DD' }), '2026-04-12');
    assert.equal(formatScheduleValue(date, 'date', { placeholder: 'MM/DD/YYYY' }), '04/12/2026');
    assert.equal(formatScheduleValue(date, 'time', { placeholder: 'HH:mm' }), '16:45');
    assert.equal(formatScheduleValue(date, 'time', { placeholder: 'hh:mm AM/PM' }), '4:45 PM');
});

test('sortScheduleInputs keeps fields ordered top-to-bottom then left-to-right', () => {
    const inputs = [
        { index: 2, top: 100, left: 300 },
        { index: 1, top: 80, left: 500 },
        { index: 0, top: 80, left: 200 }
    ];

    assert.deepEqual(
        sortScheduleInputs(inputs).map((input) => input.index),
        [0, 1, 2]
    );
});

// --- Older TikTok Studio schedule UI: "Oct 31, 2026" date field, Date-then-Time order ---

test('inferScheduleFieldKind detects the old UI month-name date field', () => {
    assert.equal(inferScheduleFieldKind({ value: 'Oct 31, 2026' }), 'date');
    assert.equal(inferScheduleFieldKind({ value: '31 Oct 2026' }), 'date');
    assert.equal(inferScheduleFieldKind({ value: 'November 1, 2026' }), 'date');
    // must not steal the time field
    assert.equal(inferScheduleFieldKind({ value: '22:40' }), 'time');
});

test('formatScheduleValue mirrors the old UI month-name date format', () => {
    const target = new Date(2026, 10, 1, 0, 0, 0, 0); // 1 Nov 2026 00:00
    assert.equal(formatScheduleValue(target, 'date', { value: 'Oct 31, 2026' }), 'Nov 1, 2026');
    // newer UI keeps ISO
    assert.equal(formatScheduleValue(target, 'date', { value: '2026-10-31' }), '2026-11-01');
});

test('displayedDateMatches compares meaning across both UI date formats', () => {
    const expected = { year: 2026, month: 11, day: 1 };
    for (const shown of ['Nov 1, 2026', '1 Nov 2026', 'November 1, 2026', '2026-11-01', '11/01/2026', '01/11/2026']) {
        assert.equal(displayedDateMatches(shown, expected), true, shown);
    }
    for (const shown of ['Oct 31, 2026', '2026-10-31', '12/01/2026', '', null]) {
        assert.equal(displayedDateMatches(shown, expected), false, String(shown));
    }
});

test('displayedTimeMatches accepts 24h and 12h renderings of the same instant', () => {
    assert.equal(displayedTimeMatches('00:00', { hour: 0, minute: 0 }), true);
    assert.equal(displayedTimeMatches('12:00 AM', { hour: 0, minute: 0 }), true);
    assert.equal(displayedTimeMatches('12:00 PM', { hour: 0, minute: 0 }), false);
    assert.equal(displayedTimeMatches('22:40', { hour: 22, minute: 40 }), true);
    assert.equal(displayedTimeMatches('10:40 PM', { hour: 22, minute: 40 }), true);
});

test('parseScheduleDateValue understands every format formatScheduleValue emits', () => {
    const expected = { year: 2026, month: 11, day: 1 };
    for (const shown of ['Nov 1, 2026', '1 Nov 2026', 'November 1, 2026',
                         '2026-11-01', '2026.11.01', '11/01/2026']) {
        assert.deepEqual(parseScheduleDateValue(shown), expected, shown);
        assert.equal(isValidScheduleDateParts(parseScheduleDateValue(shown)), true, shown);
    }
});

test('parseScheduleDateValue reports unparsable input instead of returning NaN parts', () => {
    // Regression: "Nov 1, 2026" used to yield {month: NaN}, which made the calendar
    // month arithmetic NaN; `diff > 0` was then false and the navigation loop clicked
    // "previous month" 24 times, landing on November 2024.
    for (const bad of ['rubbish', '', null, undefined, 'Nov 2026']) {
        assert.equal(isValidScheduleDateParts(parseScheduleDateValue(bad)), false, String(bad));
    }
});

test('inferScheduleFieldKind does not mistake the old UI timezone field for the time field', () => {
    assert.equal(inferScheduleFieldKind({ value: '(GMT+7) Local Time' }), 'timezone');
    assert.equal(inferScheduleFieldKind({ value: '(UTC-5) Local Time' }), 'timezone');
    assert.equal(inferScheduleFieldKind({ value: '00:20' }), 'time');
});

// --- Content page: telling a scheduled video apart from an already-published one ---

test('looksLikeScheduledLabel does not treat a published video as scheduled', () => {
    // Regression: the old test was /\d{1,2}:\d{2}/, and a published label
    // ("Nov 1, 12:25 AM") contains "12:25", so every published video was read as
    // scheduled and its publish time became the base for the next upload.
    assert.equal(looksLikeScheduledLabel('Nov 1, 12:25 AM'), false);
    assert.equal(looksLikeScheduledLabel('Oct 31, 9:05 PM'), false);
    assert.equal(looksLikeScheduledLabel('12:25'), false);
    assert.equal(looksLikeScheduledLabel(''), false);
    assert.equal(looksLikeScheduledLabel(null), false);
});

test('looksLikeScheduledLabel recognises the scheduled label by its timezone suffix', () => {
    assert.equal(looksLikeScheduledLabel('Nov 1, 12:50 AM (GMT+7) Saigon'), true);
    assert.equal(looksLikeScheduledLabel('Oct 31, 11:50 PM (GMT+7) Saigon'), true);
    assert.equal(looksLikeScheduledLabel('Oct 30, 10:10 PM (GMT+7) Saigon'), true);
    assert.equal(looksLikeScheduledLabel('Nov 1, 9:00 AM (UTC-5) New York'), true);
});

test('a scheduled label still parses to the right instant after the suffix check', () => {
    const d = parseTikTokContentTimeText('Nov 1, 12:50 AM (GMT+7) Saigon');
    assert.equal(d.getMonth(), 10); // November
    assert.equal(d.getDate(), 1);
    assert.equal(d.getHours(), 0);  // 12:50 AM -> 00:50
    assert.equal(d.getMinutes(), 50);
});
