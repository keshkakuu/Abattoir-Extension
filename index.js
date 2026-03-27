import { extension_settings } from '../../../extensions.js';
import { promptManager } from '../../../scripts/openai.js';

// ── Constants ────────────────────────────────────────────────────────────────

const EXT_NAME   = 'abattoir';
const PROMPT_KEY = 'abattoir_prefs';

// ── Default settings ──────────────────────────────────────────────────────────

const DEFAULTS = {
    enabled: true,

    events: {
        enabled:   false,
        frequency: 'occasional',
        types: {
            physicalHarm:   true,
            death:          false,
            bodyHorror:     false,
            environmental:  true,
            social:         true,
            disease:        false,
            propertyDamage: false,
            betrayal:       true,
        },
    },

    infoblocks: {
        style: 'standard',
        show: {
            status:     true,
            injuries:   true,
            conditions: true,
            stats:      false,
            inventory:  false,
        },
    },

    content: {
        violenceLevel:       'moderate',
        psychologicalHorror: true,
        torture:             false,
        suffering:           true,
        dominanceSubmission: false,
        captivity:           false,
        controlManipulation: false,
        romance:             true,
        explicitSexual:      false,
        monsterRomance:      false,
        nonhumanEntities:    false,
    },
};

// ── Runtime ST function handles ───────────────────────────────────────────────
// Populated during init() so a missing export never crashes the module load.

let saveSettingsDebounced = () => {};
let eventSource           = null;
let event_types           = null;

async function resolveSTAPIs() {
    try {
        const mod = await import('../../../script.js');
        saveSettingsDebounced = mod.saveSettingsDebounced ?? saveSettingsDebounced;
        eventSource           = mod.eventSource           ?? null;
        event_types           = mod.event_types           ?? null;
    } catch (err) {
        console.warn('[Abattoir] Dynamic import of script.js failed:', err);
    }

    try {
        const ctx = window.SillyTavern?.getContext?.() ?? {};
        saveSettingsDebounced = saveSettingsDebounced || ctx.saveSettingsDebounced || saveSettingsDebounced;
        eventSource           = eventSource           || ctx.eventSource           || null;
        event_types           = event_types           || ctx.event_types           || null;
    } catch (err) {
        console.warn('[Abattoir] getContext() fallback failed:', err);
    }

    console.log('[Abattoir] API resolution — eventSource:', !!eventSource);
}

// ── Settings helpers ──────────────────────────────────────────────────────────

function getSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = JSON.parse(JSON.stringify(DEFAULTS));
    }
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (extension_settings[EXT_NAME][k] === undefined) {
            extension_settings[EXT_NAME][k] = JSON.parse(JSON.stringify(v));
        }
    }
    return extension_settings[EXT_NAME];
}

function save() {
    saveSettingsDebounced();
    buildAndInject();
}

// ── Label maps ────────────────────────────────────────────────────────────────

const FREQ_LABELS = { rare: 'Rare', occasional: 'Occasional', frequent: 'Frequent' };

const EVENT_TYPE_LABELS = {
    physicalHarm:   'Physical Harm',
    death:          'Death',
    bodyHorror:     'Body Horror',
    environmental:  'Environmental Hazards',
    social:         'Social / Political',
    disease:        'Disease / Illness',
    propertyDamage: 'Property Damage',
    betrayal:       'Betrayal',
};

const INFOBLOCK_STYLE_LABELS = {
    none: 'None', minimal: 'Minimal', standard: 'Standard',
    detailed: 'Detailed', fancy: 'Fancy', clinical: 'Clinical',
};

const INFOBLOCK_SHOW_LABELS = {
    status: 'Status Effects', injuries: 'Injuries', conditions: 'Conditions',
    stats: 'Stats', inventory: 'Inventory',
};

const VIOLENCE_LABELS = { mild: 'Mild', moderate: 'Moderate', graphic: 'Graphic', extreme: 'Extreme' };

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildAndInject() {
    const s = getSettings();

    const prompt = promptManager?.serviceSettings?.prompts?.find?.(
        p => p.identifier === PROMPT_KEY || p.name === 'Abattoir Preferences',
    );

    if (!s.enabled) {
        if (prompt) promptManager.setPromptEnabled(prompt, false);
        return;
    }

    if (prompt) promptManager.setPromptEnabled(prompt, true);

    const lines = ['[Abattoir Preferences]'];

    if (s.events.enabled) {
        const active = Object.entries(s.events.types)
            .filter(([, on]) => on)
            .map(([k]) => EVENT_TYPE_LABELS[k] ?? k);
        lines.push(`Random Events: ENABLED (${FREQ_LABELS[s.events.frequency] ?? s.events.frequency})`);
        if (active.length) lines.push(`  Event types: ${active.join(', ')}`);
    } else {
        lines.push('Random Events: DISABLED');
    }

    if (s.infoblocks.style !== 'none') {
        const shown = Object.entries(s.infoblocks.show)
            .filter(([, on]) => on)
            .map(([k]) => INFOBLOCK_SHOW_LABELS[k] ?? k);
        lines.push(`Infoblock Style: ${INFOBLOCK_STYLE_LABELS[s.infoblocks.style] ?? s.infoblocks.style}`);
        if (shown.length) lines.push(`  Fields: ${shown.join(', ')}`);
    } else {
        lines.push('Infoblocks: DISABLED');
    }

    const contentFlags = [
        ['psychologicalHorror', 'Psychological Horror'],
        ['torture',             'Torture'],
        ['suffering',           'Suffering / Despair'],
        ['dominanceSubmission', 'Dominance & Submission'],
        ['captivity',           'Captivity / Confinement'],
        ['controlManipulation', 'Control & Manipulation'],
        ['romance',             'Romance'],
        ['explicitSexual',      'Explicit Sexual Content'],
        ['monsterRomance',      'Monster Romance'],
        ['nonhumanEntities',    'Non-human Entities'],
    ];
    const enabledContent = contentFlags.filter(([k]) => s.content[k]).map(([, l]) => l);
    lines.push(`Content — Violence: ${VIOLENCE_LABELS[s.content.violenceLevel] ?? s.content.violenceLevel}`);
    if (enabledContent.length) lines.push(`  Themes: ${enabledContent.join(', ')}`);

    lines.push('[/Abattoir Preferences]');

    if (prompt) {
        prompt.content = lines.join('\n');
        promptManager.setPromptEnabled(prompt, true);
    }
}

// ── Inline HTML template ──────────────────────────────────────────────────────

const SETTINGS_HTML = `
<div id="abattoir-extension" class="abattoir-panel">

  <div class="abattoir-header">
    <span class="abattoir-title">&#x1F52A; Abattoir</span>
    <label class="abattoir-master-toggle" title="Enable / disable the extension">
      <input type="checkbox" id="abattoir-enabled">
      <span class="abattoir-slider"></span>
    </label>
  </div>

  <div id="abattoir-body">

    <details class="abattoir-section" open>
      <summary class="abattoir-section-title">
        Random Bad Events
        <label class="abattoir-inline-toggle" title="Toggle random events">
          <input type="checkbox" id="abattoir-events-enabled">
          <span class="abattoir-slider abattoir-slider-sm"></span>
        </label>
      </summary>
      <div id="abattoir-events-options" class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label" for="abattoir-events-frequency">Frequency</label>
          <select id="abattoir-events-frequency" class="abattoir-select">
            <option value="rare">Rare</option>
            <option value="occasional">Occasional</option>
            <option value="frequent">Frequent</option>
          </select>
        </div>
        <div class="abattoir-sub-label">Event Types</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-physicalHarm"><span>Physical Harm</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-death"><span>Death</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-bodyHorror"><span>Body Horror</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-environmental"><span>Environmental</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-social"><span>Social / Political</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-disease"><span>Disease / Illness</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-betrayal"><span>Betrayal</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-event-propertyDamage"><span>Property Damage</span></label>
        </div>
      </div>
    </details>

    <details class="abattoir-section">
      <summary class="abattoir-section-title">Infoblock Style</summary>
      <div class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label" for="abattoir-infoblock-style">Style</label>
          <select id="abattoir-infoblock-style" class="abattoir-select">
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
            <option value="fancy">Fancy</option>
            <option value="clinical">Clinical</option>
          </select>
        </div>
        <div id="abattoir-infoblock-fields">
          <div class="abattoir-sub-label">Include in Infoblocks</div>
          <div class="abattoir-checkbox-grid">
            <label class="abattoir-check-label"><input type="checkbox" id="abattoir-infoblock-show-status"><span>Status Effects</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abattoir-infoblock-show-injuries"><span>Injuries</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abattoir-infoblock-show-conditions"><span>Conditions</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abattoir-infoblock-show-stats"><span>Stats</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abattoir-infoblock-show-inventory"><span>Inventory</span></label>
          </div>
        </div>
      </div>
    </details>

    <details class="abattoir-section">
      <summary class="abattoir-section-title">Content Preferences</summary>
      <div class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label" for="abattoir-violence-level">Violence</label>
          <select id="abattoir-violence-level" class="abattoir-select">
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="graphic">Graphic</option>
            <option value="extreme">Extreme</option>
          </select>
        </div>
        <div class="abattoir-sub-label">Dark Themes</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-psychologicalHorror"><span>Psych. Horror</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-torture"><span>Torture</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-suffering"><span>Suffering</span></label>
        </div>
        <div class="abattoir-sub-label">Power Dynamics</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-dominanceSubmission"><span>Dom / Sub</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-captivity"><span>Captivity</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-controlManipulation"><span>Control &amp; Manipulation</span></label>
        </div>
        <div class="abattoir-sub-label">Intimacy</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-romance"><span>Romance</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-explicitSexual"><span>Explicit Sexual</span></label>
        </div>
        <div class="abattoir-sub-label">Creature &amp; Monster</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-monsterRomance"><span>Monster Romance</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abattoir-content-nonhumanEntities"><span>Non-human Entities</span></label>
        </div>
      </div>
    </details>

  </div>
</div>
`;

// ── UI wiring ─────────────────────────────────────────────────────────────────

function wireUI() {
    const s = getSettings();

    $('#abattoir-enabled')
        .prop('checked', s.enabled)
        .on('change', function () {
            s.enabled = this.checked;
            $('#abattoir-body').toggleClass('abattoir-disabled', !s.enabled);
            save();
        });
    $('#abattoir-body').toggleClass('abattoir-disabled', !s.enabled);

    $('#abattoir-events-enabled')
        .prop('checked', s.events.enabled)
        .on('change', function () {
            s.events.enabled = this.checked;
            $('#abattoir-events-options').toggleClass('abattoir-hidden', !s.events.enabled);
            save();
        });
    $('#abattoir-events-options').toggleClass('abattoir-hidden', !s.events.enabled);

    $('#abattoir-events-frequency')
        .val(s.events.frequency)
        .on('change', function () { s.events.frequency = this.value; save(); });

    for (const key of Object.keys(s.events.types)) {
        $(`#abattoir-event-${key}`)
            .prop('checked', s.events.types[key])
            .on('change', function () { s.events.types[key] = this.checked; save(); });
    }

    $('#abattoir-infoblock-style')
        .val(s.infoblocks.style)
        .on('change', function () {
            s.infoblocks.style = this.value;
            $('#abattoir-infoblock-fields').toggleClass('abattoir-hidden', this.value === 'none');
            save();
        });
    $('#abattoir-infoblock-fields').toggleClass('abattoir-hidden', s.infoblocks.style === 'none');

    for (const key of Object.keys(s.infoblocks.show)) {
        $(`#abattoir-infoblock-show-${key}`)
            .prop('checked', s.infoblocks.show[key])
            .on('change', function () { s.infoblocks.show[key] = this.checked; save(); });
    }

    $('#abattoir-violence-level')
        .val(s.content.violenceLevel)
        .on('change', function () { s.content.violenceLevel = this.value; save(); });

    const contentKeys = [
        'psychologicalHorror', 'torture', 'suffering',
        'dominanceSubmission', 'captivity', 'controlManipulation',
        'romance', 'explicitSexual', 'monsterRomance', 'nonhumanEntities',
    ];
    for (const key of contentKeys) {
        $(`#abattoir-content-${key}`)
            .prop('checked', s.content[key])
            .on('change', function () { s.content[key] = this.checked; save(); });
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

jQuery(async () => {
    await resolveSTAPIs();

    getSettings();

    $('#extensions_settings').append(SETTINGS_HTML);

    wireUI();

    if (eventSource && event_types) {
        if (event_types.CHAT_COMPLETION_SETTINGS_READY) {
            eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, buildAndInject);
        }
        if (event_types.MESSAGE_SENT) {
            eventSource.on(event_types.MESSAGE_SENT, buildAndInject);
        }
    }

    buildAndInject();

    console.log('[Abattoir] Extension loaded.');
});
