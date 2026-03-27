import {
    saveSettingsDebounced,
    setExtensionPrompt,
    extension_prompt_types,
    eventSource,
    event_types,
} from '../../../script.js';
import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';

// ── Constants ───────────────────────────────────────────────────────────────

const EXT_NAME = 'abattoir';
const PROMPT_KEY = 'abattoir_prefs';
const PROMPT_POSITION = extension_prompt_types.AFTER_PROMPT;
const PROMPT_DEPTH = 4; // inject 4 messages from the end when using IN_CHAT

// ── Default settings ─────────────────────────────────────────────────────────

const DEFAULTS = {
    enabled: true,

    // ── Random Events ──────────────────────────────────────────────────────
    events: {
        enabled: false,
        frequency: 'occasional',   // 'rare' | 'occasional' | 'frequent'
        types: {
            physicalHarm:     true,
            death:            false,
            bodyHorror:       false,
            environmental:    true,
            social:           true,
            disease:          false,
            propertyDamage:   false,
            betrayal:         true,
        },
    },

    // ── Infoblocks ─────────────────────────────────────────────────────────
    infoblocks: {
        style: 'standard',   // 'none' | 'minimal' | 'standard' | 'detailed' | 'fancy' | 'clinical'
        show: {
            status:    true,
            injuries:  true,
            conditions: true,
            stats:     false,
            inventory: false,
        },
    },

    // ── Content Preferences ────────────────────────────────────────────────
    content: {
        violenceLevel: 'moderate',   // 'mild' | 'moderate' | 'graphic' | 'extreme'
        // Dark Themes
        psychologicalHorror: true,
        torture:             false,
        suffering:           true,
        // Power Dynamics
        dominanceSubmission: false,
        captivity:           false,
        controlManipulation: false,
        // Intimacy
        romance:             true,
        explicitSexual:      false,
        // Creature / Monster
        monsterRomance:      false,
        nonhumanEntities:    false,
    },
};

// ── Settings helpers ──────────────────────────────────────────────────────────

function getSettings() {
    extension_settings[EXT_NAME] ??= structuredClone(DEFAULTS);
    // Migrate missing keys from future DEFAULTS updates
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (extension_settings[EXT_NAME][k] === undefined) {
            extension_settings[EXT_NAME][k] = structuredClone(v);
        }
    }
    return extension_settings[EXT_NAME];
}

function save() {
    saveSettingsDebounced();
    buildAndInject();
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(s) {
    if (!s.enabled) {
        setExtensionPrompt(PROMPT_KEY, '', PROMPT_POSITION, PROMPT_DEPTH);
        return;
    }

    const lines = ['[Abattoir Preferences]'];

    // Events block
    if (s.events.enabled) {
        const activeTypes = Object.entries(s.events.types)
            .filter(([, on]) => on)
            .map(([k]) => EVENT_TYPE_LABELS[k] ?? k);

        lines.push(`Random Events: ENABLED (${FREQ_LABELS[s.events.frequency] ?? s.events.frequency})`);
        if (activeTypes.length) lines.push(`  Active event types: ${activeTypes.join(', ')}`);
    } else {
        lines.push('Random Events: DISABLED');
    }

    // Infoblock block
    if (s.infoblocks.style !== 'none') {
        const shown = Object.entries(s.infoblocks.show)
            .filter(([, on]) => on)
            .map(([k]) => INFOBLOCK_SHOW_LABELS[k] ?? k);
        lines.push(`Infoblock Style: ${INFOBLOCK_STYLE_LABELS[s.infoblocks.style] ?? s.infoblocks.style}`);
        if (shown.length) lines.push(`  Infoblock fields: ${shown.join(', ')}`);
    } else {
        lines.push('Infoblocks: DISABLED');
    }

    // Content block
    const activeContent = [];
    activeContent.push(`Violence: ${VIOLENCE_LABELS[s.content.violenceLevel] ?? s.content.violenceLevel}`);
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
    const enabledContent = contentFlags.filter(([k]) => s.content[k]).map(([, label]) => label);
    if (enabledContent.length) activeContent.push(`Enabled themes: ${enabledContent.join(', ')}`);
    lines.push('Content Preferences:');
    activeContent.forEach(l => lines.push(`  ${l}`));

    lines.push('[/Abattoir Preferences]');

    setExtensionPrompt(PROMPT_KEY, lines.join('\n'), PROMPT_POSITION, PROMPT_DEPTH);
}

function buildAndInject() {
    buildPrompt(getSettings());
}

// ── Label maps ────────────────────────────────────────────────────────────────

const FREQ_LABELS = {
    rare:       'Rare',
    occasional: 'Occasional',
    frequent:   'Frequent',
};

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
    none:     'None',
    minimal:  'Minimal',
    standard: 'Standard',
    detailed: 'Detailed',
    fancy:    'Fancy',
    clinical: 'Clinical',
};

const INFOBLOCK_SHOW_LABELS = {
    status:     'Status Effects',
    injuries:   'Injuries',
    conditions: 'Conditions',
    stats:      'Stats',
    inventory:  'Inventory',
};

const VIOLENCE_LABELS = {
    mild:     'Mild',
    moderate: 'Moderate',
    graphic:  'Graphic',
    extreme:  'Extreme',
};

// ── UI wiring ─────────────────────────────────────────────────────────────────

function wireUI() {
    const s = getSettings();

    // Master toggle
    const masterToggle = document.getElementById('abattoir-enabled');
    if (masterToggle) {
        masterToggle.checked = s.enabled;
        masterToggle.addEventListener('change', () => {
            s.enabled = masterToggle.checked;
            document.getElementById('abattoir-body')?.classList.toggle('abattoir-disabled', !s.enabled);
            save();
        });
        document.getElementById('abattoir-body')?.classList.toggle('abattoir-disabled', !s.enabled);
    }

    // ── Events ──────────────────────────────────────────────────────────────
    const eventsToggle = document.getElementById('abattoir-events-enabled');
    if (eventsToggle) {
        eventsToggle.checked = s.events.enabled;
        eventsToggle.addEventListener('change', () => {
            s.events.enabled = eventsToggle.checked;
            document.getElementById('abattoir-events-options')?.classList.toggle('abattoir-hidden', !s.events.enabled);
            save();
        });
        document.getElementById('abattoir-events-options')?.classList.toggle('abattoir-hidden', !s.events.enabled);
    }

    const freqSelect = document.getElementById('abattoir-events-frequency');
    if (freqSelect) {
        freqSelect.value = s.events.frequency;
        freqSelect.addEventListener('change', () => {
            s.events.frequency = freqSelect.value;
            save();
        });
    }

    for (const key of Object.keys(s.events.types)) {
        const cb = document.getElementById(`abattoir-event-${key}`);
        if (!cb) continue;
        cb.checked = s.events.types[key];
        cb.addEventListener('change', () => {
            s.events.types[key] = cb.checked;
            save();
        });
    }

    // ── Infoblocks ───────────────────────────────────────────────────────────
    const styleSelect = document.getElementById('abattoir-infoblock-style');
    if (styleSelect) {
        styleSelect.value = s.infoblocks.style;
        styleSelect.addEventListener('change', () => {
            s.infoblocks.style = styleSelect.value;
            document.getElementById('abattoir-infoblock-fields')?.classList.toggle('abattoir-hidden', s.infoblocks.style === 'none');
            save();
        });
        document.getElementById('abattoir-infoblock-fields')?.classList.toggle('abattoir-hidden', s.infoblocks.style === 'none');
    }

    for (const key of Object.keys(s.infoblocks.show)) {
        const cb = document.getElementById(`abattoir-infoblock-show-${key}`);
        if (!cb) continue;
        cb.checked = s.infoblocks.show[key];
        cb.addEventListener('change', () => {
            s.infoblocks.show[key] = cb.checked;
            save();
        });
    }

    // ── Content preferences ──────────────────────────────────────────────────
    const violenceSelect = document.getElementById('abattoir-violence-level');
    if (violenceSelect) {
        violenceSelect.value = s.content.violenceLevel;
        violenceSelect.addEventListener('change', () => {
            s.content.violenceLevel = violenceSelect.value;
            save();
        });
    }

    const contentKeys = [
        'psychologicalHorror', 'torture', 'suffering',
        'dominanceSubmission', 'captivity', 'controlManipulation',
        'romance', 'explicitSexual',
        'monsterRomance', 'nonhumanEntities',
    ];
    for (const key of contentKeys) {
        const cb = document.getElementById(`abattoir-content-${key}`);
        if (!cb) continue;
        cb.checked = s.content[key];
        cb.addEventListener('change', () => {
            s.content[key] = cb.checked;
            save();
        });
    }
}

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
    // Ensure settings exist
    getSettings();

    // Load HTML template into the Extensions panel drawer
    const html = await renderExtensionTemplateAsync(EXT_NAME, 'settings');
    document.getElementById('extensions_settings').insertAdjacentHTML('beforeend', html);

    wireUI();

    // Re-inject on every new generation so settings stay current
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, buildAndInject);

    // Initial inject (covers non-streaming / text completion backends)
    buildAndInject();

    console.log('[Abattoir] Extension loaded.');
}

jQuery(async () => {
    await init();
});
