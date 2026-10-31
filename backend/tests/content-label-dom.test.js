// DOM-level check of the Content-page status labels, using the markup copied
// verbatim from the live page. Guards the locator logic in
// checkExistingScheduledTime, which the pure unit tests cannot reach.
//
// Offline: page.setContent() only -- no network, no TikTok, no browser profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { looksLikeScheduledLabel, isScheduledStatusLabel } from '../schedule-utils.js';
const ALARM_SVG = '<svg viewBox="0 0 24 24" width="1em" height="1em" data-icon="alarm" fill="currentColor"><path d="M8 2a1 1 0 1 0 0 2"></path></svg>';

// --- exactly as pasted from the live page ---
const PUBLISHED_OLD = `<div font-size="12px" color="var(--ui-text-3)" data-tt="components_PublishStageLabel_FlexCenter" class="css-18mgxim edss2sz8"><span class="TUXText TUXText--tiktok-sans" data-tt="components_PublishStageLabel_TUXText" style="color: inherit; font-size: inherit;">Nov 1, 12:25 AM</span></div>`;

const SCHEDULED_OLD = `<span class="TUXText TUXText--tiktok-sans" data-tt="components_PublishStageLabel_TUXText" style="color: var(--ui-text-info-display); font-size: inherit;"><div class="icon-label css-16jnhcs edss2sz8" font-size="12px" height="24px" width="max-content" data-tt="components_PublishStageLabel_FlexCenter"><span role="img" class="px-icon " data-icon="Alarm" data-testid="Alarm">${ALARM_SVG}</span><span class="TUXText TUXText--tiktok-sans TUXText--weight-medium" data-tt="components_PublishStageLabel_TUXText" style="color: inherit; font-size: inherit;">Nov 1, 12:50 AM (GMT+7) Saigon</span></div></span>`;

// Old UI as the user remembers it: Alarm icon, but NO timezone in the text.
const SCHEDULED_OLD_NO_TZ = SCHEDULED_OLD.replace('Nov 1, 12:50 AM (GMT+7) Saigon', 'Nov 1, 12:50 AM');

// Newer UI: timezone in the text, no Alarm icon at all.
const SCHEDULED_NEW_NO_ALARM = `<div font-size="12px" data-tt="components_PublishStageLabel_FlexCenter" class="css-18mgxim edss2sz8"><span class="TUXText TUXText--tiktok-sans" data-tt="components_PublishStageLabel_TUXText" style="color: inherit;">Oct 30, 10:10 PM (GMT+7) Saigon</span></div>`;

const CASES = [
    { name: 'OLD UI  published',              html: PUBLISHED_OLD,           expect: false, expectText: 'Nov 1, 12:25 AM' },
    { name: 'OLD UI  scheduled (alarm+tz)',   html: SCHEDULED_OLD,           expect: true,  expectText: 'Nov 1, 12:50 AM (GMT+7) Saigon' },
    { name: 'OLD UI  scheduled (alarm, NO tz)', html: SCHEDULED_OLD_NO_TZ,   expect: true,  expectText: 'Nov 1, 12:50 AM' },
    { name: 'NEW UI  scheduled (tz, no alarm)', html: SCHEDULED_NEW_NO_ALARM, expect: true, expectText: 'Oct 30, 10:10 PM (GMT+7) Saigon' }
];


test('Content-page labels are classified correctly in both UI variants', async (t) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    t.after(async () => { await browser.close(); });

    for (const c of CASES) {
        await page.setContent(`<html><body><div id="list">${c.html}</div></body></html>`);

        // --- identical to checkExistingScheduledTime ---
        const flexCenterLabel = page.locator('[data-tt="components_PublishStageLabel_FlexCenter"]').first();
        const tuxTextLabel = page.locator('[data-tt="components_PublishStageLabel_TUXText"]').first();
        const flexCenterCount = await flexCenterLabel.count().catch(() => 0);
        const tuxTextCount = await tuxTextLabel.count().catch(() => 0);

        const timeEl = flexCenterCount > 0
            ? flexCenterLabel.locator('[data-tt="components_PublishStageLabel_TUXText"]').first()
            : tuxTextLabel;
        const timeText = ((await timeEl.textContent().catch(() => '')) || '').trim();

        const hasAlarm = flexCenterCount > 0
            && (await flexCenterLabel.locator('[data-testid="Alarm"]').count().catch(() => 0)) > 0;
        // ---------------------------------------------

        assert.ok(flexCenterCount + tuxTextCount > 0, `${c.name}: no status label found`);
        assert.equal(timeText, c.expectText, `${c.name}: extracted time text`);
        assert.equal(isScheduledStatusLabel({ hasAlarmIcon: hasAlarm, labelText: timeText }), c.expect,
            `${c.name}: scheduled verdict (alarm=${hasAlarm}, tz=${looksLikeScheduledLabel(timeText)})`);
    }
});
