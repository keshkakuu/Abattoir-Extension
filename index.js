// Abattoir Extension — companion to the Abattoir preset
// No ES module imports. SillyTavern.getContext() global only.
// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE REWRITE — same visuals, dramatically faster
//   1. Content-hash caching: skip reprocessing if message unchanged
//   2. innerHTML strip-once: track which messages have been cleaned
//   3. Viewport-lazy rendering: IntersectionObserver defers off-screen charts
//   4. Throttled reprocessAll: debounced, max once per 300ms
//   5. MutationObserver guard: paused during our own DOM writes
//   6. Shared SVG filter defs: one <svg> with filters, all charts reference it
//   7. Settings change: only invalidate + re-render visible messages
// ═══════════════════════════════════════════════════════════════════════════════

const ABT_INJECTION_ID = "Abattoir_Prefs";

// ── localStorage keys ─────────────────────────────────────────────────────────
const ABT = {
    enabled:    "ABT_enabled",
    evtOn:      "ABT_evtOn",
    evtFreq:    "ABT_evtFreq",
    evtTypes:   "ABT_evtTypes",
    violence:   "ABT_violence",
    content:    "ABT_content",
    ibShow:     "ABT_ibShow2",
    ibChart:    "ABT_ibChart",
    ibWorld:    "ABT_ibWorld",
    ibInjuries: "ABT_ibInjuries",
    ibBundles:  "ABT_ibBundles",
    ibChars:    "ABT_ibChars",
    ibLust:     "ABT_ibLust",
};

// ── Performance caches ───────────────────────────────────────────────────────
const _abtCache = new Map();       // msgIndex → { hash, fields }
const _abtStripped = new Set();    // msgIndex set — innerHTML already cleaned
let _abtMutationPaused = false;    // guard: true while we mutate DOM
let _abtReprocessTimer = null;     // debounce timer for reprocessAll
let _abtSettingsVer = 0;           // bumped on settings change to invalidate display cache
let _abtObserver = null;           // IntersectionObserver for lazy chart rendering
const _abtVisible = new Set();     // set of currently-visible mesids
let _abtSettingsCache = null;      // cached settings object, invalidated on change

// ── Settings ──────────────────────────────────────────────────────────────────
function abtLoad() {
    if (_abtSettingsCache) return _abtSettingsCache;
    _abtSettingsCache = {
        enabled:       localStorage.getItem(ABT.enabled)  === "true",
        evtEnabled:    localStorage.getItem(ABT.evtOn)    === "true",
        evtFreq:       localStorage.getItem(ABT.evtFreq)  || "occasional",
        evtTypes:      JSON.parse(localStorage.getItem(ABT.evtTypes) || "null") || { physicalHarm:true, death:false, bodyHorror:false, environmental:true, social:true, disease:false, propertyDamage:false, betrayal:true },
        violenceLevel: localStorage.getItem(ABT.violence) || "moderate",
        content:       JSON.parse(localStorage.getItem(ABT.content)  || "null") || { psychologicalHorror:true, torture:false, suffering:true, dominanceSubmission:false, captivity:false, controlManipulation:false, romance:true, explicitSexual:false, monsterRomance:false, nonhumanEntities:false },
        ibShow:        localStorage.getItem(ABT.ibShow)     !== "false",
        ibChart:       localStorage.getItem(ABT.ibChart)    !== "false",
        ibWorld:       localStorage.getItem(ABT.ibWorld)    !== "false",
        ibInjuries:    localStorage.getItem(ABT.ibInjuries) !== "false",
        ibBundles:     localStorage.getItem(ABT.ibBundles)  !== "false",
        ibChars:       localStorage.getItem(ABT.ibChars)    !== "false",
        ibLust:        localStorage.getItem(ABT.ibLust)     !== "false",
    };
    return _abtSettingsCache;
}

function abtSave(s) {
    localStorage.setItem(ABT.enabled,    String(s.enabled));
    localStorage.setItem(ABT.evtOn,      String(s.evtEnabled));
    localStorage.setItem(ABT.evtFreq,    s.evtFreq);
    localStorage.setItem(ABT.evtTypes,   JSON.stringify(s.evtTypes));
    localStorage.setItem(ABT.violence,   s.violenceLevel);
    localStorage.setItem(ABT.content,    JSON.stringify(s.content));
    localStorage.setItem(ABT.ibShow,     String(s.ibShow));
    localStorage.setItem(ABT.ibChart,    String(s.ibChart));
    localStorage.setItem(ABT.ibWorld,    String(s.ibWorld));
    localStorage.setItem(ABT.ibInjuries, String(s.ibInjuries));
    localStorage.setItem(ABT.ibBundles,  String(s.ibBundles));
    localStorage.setItem(ABT.ibChars,    String(s.ibChars));
    localStorage.setItem(ABT.ibLust,     String(s.ibLust));
    _abtSettingsCache = null; // invalidate
}

// ── Label maps ────────────────────────────────────────────────────────────────
const ABT_EVT_LABELS = { physicalHarm:"Physical Harm", death:"Death", bodyHorror:"Body Horror", environmental:"Environmental Hazards", social:"Social / Political", disease:"Disease / Illness", propertyDamage:"Property Damage", betrayal:"Betrayal" };
const ABT_CTX_LABELS = { psychologicalHorror:"Psychological Horror", torture:"Torture", suffering:"Suffering / Despair", dominanceSubmission:"Dominance & Submission", captivity:"Captivity / Confinement", controlManipulation:"Control & Manipulation", romance:"Romance", explicitSexual:"Explicit Sexual Content", monsterRomance:"Monster Romance", nonhumanEntities:"Non-human Entities" };
const ABT_FREQ_LABELS = { rare:"Rare", occasional:"Occasional", frequent:"Frequent" };
const ABT_VIO_LABELS  = { mild:"Mild", moderate:"Moderate", graphic:"Graphic", extreme:"Extreme" };

// ── Prompt builder ────────────────────────────────────────────────────────────
function abtBuildPrompt(s) {
    if (!s.enabled) return "";
    const L = ["[Abattoir Extension — Active Preferences]"];

    if (s.evtEnabled) {
        const types = Object.entries(s.evtTypes).filter(([,v])=>v).map(([k])=>ABT_EVT_LABELS[k]||k);
        L.push("Random Events: ENABLED — Frequency: " + (ABT_FREQ_LABELS[s.evtFreq]||s.evtFreq));
        if (types.length) L.push("  Types: " + types.join(", "));
        L.push("");
        L.push("[Dice Protocol — Lilith's Dice]");
        L.push("For EACH active bundle, roll 1d6 for occurrence inside <think>. Keep it compact:");
        L.push("  Weather: 1 silence, 2-3 distant, 4-5 present, 6 intrusion → if fires: pick category from bundle");
        L.push("  Teeth: 1-2 no event, 3-5 fires, 6 fires+interrupts → pick target → pick sub-type from bundle");
        L.push("  Knock: 1-3 no threat, 4-5 advances, 6 detonates → pick vector from bundle");
        L.push("  Rust: 1-3 seed only, 4-5 fires, 6 fires+forces response → pick domain from bundle");
        L.push("Log results as ONE line per bundle in <think>. Do NOT restate dice tables or explain roll logic.");
        L.push("Events summary goes in the infoblock 'bundles' field.");
    } else {
        L.push("Random Events: DISABLED");
    }

    L.push("");
    L.push("INFOBLOCK RULE — MANDATORY:");
    L.push("The <infoblock> is the very last thing in your response. After prose. After OOC. After <notes>.");
    L.push("Use this exact format:");
    L.push("");
    L.push("<infoblock>");
    L.push("phase: [ERASURE/BRAND/SCORN/NOTHING/TEETH/GRIP/CRACK/TANGLE]");
    L.push("intensity: [Ember/Fever/Wildfire/Ash/Terminal]");
    L.push("condition: [intact/marked/injured/critical/dying/dead]");
    L.push("injuries: [cumulative or none]");
    L.push("dignity: [concrete items: clothing left · agency state · identity state]");
    L.push("user_attire: [item-by-item what {{user}} is wearing RIGHT NOW, top to bottom — note displaced/open/removed items]");
    L.push("user_pose: [{{user}}'s position: standing/sitting/kneeling/lying/restrained — posture and spatial relation to {{char}}]");
    L.push("date: [DD.MM.YYYY, Day — HH:MM]");
    L.push("location: [specific place]");
    L.push("weather: [sky · temp · wind]");
    if (s.evtEnabled) L.push("bundles: [active bundle names or none]");
    if (s.ibChars) L.push('characters: [{"name":"...","attire":"specific items on body","pose":"position + spatial relation to {{user}}","mood":"...","thought":"..."}] for {{char}} AND each NPC present');
    L.push("char_affection: [int -100 to 100, delta:±N]");
    L.push("char_fear: [int -100 to 100, delta:±N]");
    L.push("char_obsession: [int 0 to 100, delta:±N]");
    L.push("char_trust: [int -100 to 100, delta:±N]");
    if (s.ibLust) L.push("char_lust: [int 0 to 100, delta:±N]");
    L.push("</infoblock>");
    L.push("");
    L.push("Use char_* prefixes exactly. Track only {{char}}'s feelings toward {{user}}. Do NOT include user_affection, user_fear, user_obsession, user_trust — those fields do not exist. Do NOT track or infer {{user}}'s emotions in COT or infoblock. Only the character's perspective matters.");
    L.push("Track date consistently — advance time realistically between turns. If no date established, derive one from context on first turn and commit.");

    // ── Violence Level — behavioral rules ──
    const vioRules = {
        mild: [
            "[Violence: Mild]",
            "Violence is implied, off-screen, or minimal. Bruises and scrapes at most. Threats carry weight through atmosphere, not action. Pain is referenced, not described in detail. No gore, no graphic injury descriptions. Tension does the work."
        ],
        moderate: [
            "[Violence: Moderate]",
            "Violence is present and described but not lingered on. Injuries are real — cuts, blood, impact — written with enough specificity to feel it, not enough to dwell. Aftermath matters more than the act. The body reacts realistically. No gratuitous escalation."
        ],
        graphic: [
            "[Violence: Graphic]",
            "Violence is rendered with forensic specificity. Sound of impact, the way tissue responds, what blood looks like on specific surfaces. Injuries are described anatomically. Pain is visceral and sustained. The body is a physical object subject to physics. Nothing is implied — everything lands on the page."
        ],
        extreme: [
            "[Violence: Extreme]",
            "No limits on violence depiction. Write what happens to bodies when force is applied without restraint. Bone, nerve, organ. The sounds the body makes. What dying looks like up close. Injuries are cumulative, permanent, and described with clinical precision. The prose does not flinch, does not cut away, does not soften."
        ]
    };
    const vr = vioRules[s.violenceLevel] || vioRules.moderate;
    L.push("");
    vr.forEach(line => L.push(line));

    // ── Dark Themes ──
    const themeRules = {
        psychologicalHorror: "Psychological Horror: Gaslighting, paranoia, unreliable perception, dread without visible source. The mind turning against itself. What characters believe may not be real. Write the doubt.",
        torture: "Torture: Deliberate, sustained infliction of pain as tool — for information, for punishment, for control, or for its own sake. Write the method, the patience of the one inflicting, the deterioration of the one enduring. Torture has rhythm.",
        suffering: "Suffering: Prolonged distress — physical, emotional, existential. Characters endure. Relief is withheld or conditional. The prose sits with pain rather than resolving it. Suffering changes people; write the change.",
        dominanceSubmission: "Dominance & Submission: Power exchange is explicit and embodied. Who kneels, who commands, who breaks eye contact first. D/s dynamics permeate gesture, posture, speech patterns, spatial positioning. It's in how someone hands over a glass of water.",
        captivity: "Captivity: Confinement shapes everything — space, time, routine, identity. The confined person's world shrinks to what the captor permits. Write the architecture of captivity: locks, schedules, the sound of footsteps that mean something is about to happen. Freedom is theoretical.",
        controlManipulation: "Control & Manipulation: Subtle rewriting of reality. The manipulator rewrites history, reframes cruelty as care, makes the target doubt their own memory. Isolation as strategy. Kindness as currency. Write the mechanism, not just the effect.",
        romance: "Romance: Genuine feeling exists alongside everything else. Tenderness is not safety — it's another kind of exposure. Attachment forms in hostile conditions and is more dangerous for it. Love and damage coexist without one negating the other.",
        explicitSexual: "Explicit Sexual Content: Sex is rendered with anatomical frankness. Write the mechanics — what goes where, what it feels like, what the body does involuntarily. Fluids, sounds, the gracelessness of real bodies. Sex serves character and power dynamics, never just titillation.",
        monsterRomance: "Monster Romance: The non-human partner's body is written with specificity — texture, temperature, proportion, what's different and what that difference means during intimacy. The alien quality is the point. Attraction and revulsion share space.",
        nonhumanEntities: "Non-human Entities: Creatures, spirits, constructs, or beings that do not think like humans. Their logic is their own. Write their alienness through behavior, not exposition. They may not understand human distress. They may understand it differently."
    };
    const activeThemes = Object.entries(s.content).filter(([,v])=>v);
    if (activeThemes.length) {
        L.push("");
        L.push("[Content Permissions — Active Themes]");
        L.push("The following themes are ENABLED. Write them when the scene calls for them. Do not sanitize, fade to black, or hedge.");
        activeThemes.forEach(([k]) => {
            if (themeRules[k]) L.push(themeRules[k]);
        });
    }
    const inactiveThemes = Object.entries(s.content).filter(([,v])=>!v);
    if (inactiveThemes.length) {
        const offNames = inactiveThemes.map(([k])=>ABT_CTX_LABELS[k]||k);
        L.push("");
        L.push("[Content Boundaries] These themes are DISABLED — do not introduce: " + offNames.join(", ") + ".");
    }

    L.push("[/Abattoir Extension]");
    return L.join("\n");
}

// ── Parser ────────────────────────────────────────────────────────────────────
function abtParse(text) {
    const m = text.match(/<infoblock>([\s\S]*?)<\/infoblock>/i);
    if (!m) return null;
    const fields = {};
    for (const line of m[1].trim().split("\n")) {
        const i = line.indexOf(":");
        if (i === -1) continue;
        const k = line.slice(0, i).trim().toLowerCase();
        const v = line.slice(i + 1).trim();
        if (k && v) fields[k] = v;
    }
    return Object.keys(fields).length ? fields : null;
}

// ── Fast content hash ────────────────────────────────────────────────────────
// djb2-style hash for quick string fingerprinting
function abtHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) & 0xFFFFFFFF;
    }
    return h;
}

function parseMetric(val) {
    if (!val) return { value: 0, delta: 0 };
    const numMatch   = String(val).match(/-?\d+/);
    const deltaMatch = String(val).match(/delta:\s*([+-]?\d+)/i);
    return {
        value: numMatch   ? Math.max(-100, Math.min(100, parseInt(numMatch[0]))) : 0,
        delta: deltaMatch ? parseInt(deltaMatch[1]) : 0,
    };
}

function parseChars(val) {
    if (!val) return [];
    try {
        const jsonMatch = val.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch(e) {}
    return [];
}

// ── Phase config ──────────────────────────────────────────────────────────────
const PHASE_CFG = {
    ERASURE: { color:"#8b0000", glow:"rgba(139,0,0,0.6)",    sigil:"⛧",  sub:"unmapping you"           },
    BRAND:   { color:"#7a1a1a", glow:"rgba(122,26,26,0.5)",  sigil:"✦",  sub:"naming you a thing"       },
    SCORN:   { color:"#7a3030", glow:"rgba(122,48,48,0.45)", sigil:"✕",   sub:"contempt is personal"     },
    NOTHING: { color:"#555",    glow:"rgba(100,100,100,0.3)",sigil:"·",   sub:"you don't register"       },
    TEETH:   { color:"#8b6914", glow:"rgba(139,105,20,0.45)",sigil:"⚔",  sub:"assessment begins"        },
    GRIP:    { color:"#5c2e8b", glow:"rgba(92,46,139,0.5)",  sigil:"✦",  sub:"pattern locked"           },
    CRACK:   { color:"#1a5c8b", glow:"rgba(26,92,139,0.45)", sigil:"⚡",  sub:"something broke"          },
    TANGLE:  { color:"#8b2e5c", glow:"rgba(139,46,92,0.55)", sigil:"∞",   sub:"mutual damage"            },
};

const CONDITION_COLORS = {
    intact:"#4a7a4a", marked:"#8b8b20", injured:"#8b4a20", critical:"#8b2020", dying:"#6b0000", dead:"#333"
};
const INTENSITY_COLORS = {
    ember:"#8b5a20", fever:"#8b7020", wildfire:"#8b2a10", ash:"#5a5a6a", terminal:"#6b0010"
};

// ── Infoblock Color Schemes ──────────────────────────────────────────────────
const ABT_SCHEMES = {
    blood: {
        name: "Blood Ritual",
        bg: "linear-gradient(160deg,rgba(8,5,7,0.99) 0%,rgba(13,8,11,0.97) 100%)",
        border: "rgba(150,45,45,0.18)", headerBg: "rgba(0,0,0,0.38)",
        accent: "150,45,45", text: "rgba(220,190,200,0.92)", textDim: "rgba(200,160,175,0.45)",
        sigils: "rgba(200,58,58,", footer: "rgba(180,50,50,0.35)",
        barTrack: "rgba(255,255,255,0.06)", charBorder: "rgba(180,50,50,0.3)",
        gridStroke: "rgba(178,48,48,", circleGlow: "rgba(162,42,42,",
        labelColor: "rgba(225,182,195,0.6)", footerText: "Λ𝔅Λ𝕋𝕋𝕆ℝ",
    },
    void: {
        name: "Void",
        bg: "linear-gradient(160deg,rgba(5,5,10,0.99) 0%,rgba(8,6,14,0.97) 100%)",
        border: "rgba(60,45,120,0.2)", headerBg: "rgba(0,0,0,0.4)",
        accent: "80,50,160", text: "rgba(195,185,220,0.92)", textDim: "rgba(160,145,200,0.45)",
        sigils: "rgba(120,70,200,", footer: "rgba(100,60,180,0.35)",
        barTrack: "rgba(255,255,255,0.05)", charBorder: "rgba(120,60,180,0.3)",
        gridStroke: "rgba(100,55,180,", circleGlow: "rgba(80,40,150,",
        labelColor: "rgba(195,180,225,0.6)", footerText: "⸸ 𝕍𝕆𝕀𝔻 ⸸",
    },
    bone: {
        name: "Bone & Ash",
        bg: "linear-gradient(160deg,rgba(12,11,10,0.99) 0%,rgba(16,14,12,0.97) 100%)",
        border: "rgba(140,120,90,0.18)", headerBg: "rgba(0,0,0,0.35)",
        accent: "140,115,75", text: "rgba(220,210,190,0.92)", textDim: "rgba(180,165,140,0.45)",
        sigils: "rgba(180,150,100,", footer: "rgba(150,130,90,0.35)",
        barTrack: "rgba(255,255,255,0.05)", charBorder: "rgba(160,130,80,0.3)",
        gridStroke: "rgba(160,130,80,", circleGlow: "rgba(140,110,60,",
        labelColor: "rgba(220,205,180,0.6)", footerText: "☽ ᴀsʜ ☽",
    },
    frost: {
        name: "Frost",
        bg: "linear-gradient(160deg,rgba(5,8,12,0.99) 0%,rgba(8,11,16,0.97) 100%)",
        border: "rgba(60,100,140,0.18)", headerBg: "rgba(0,0,0,0.38)",
        accent: "60,110,150", text: "rgba(190,210,225,0.92)", textDim: "rgba(140,170,200,0.45)",
        sigils: "rgba(80,140,200,", footer: "rgba(60,120,180,0.35)",
        barTrack: "rgba(255,255,255,0.05)", charBorder: "rgba(70,130,180,0.3)",
        gridStroke: "rgba(60,120,180,", circleGlow: "rgba(40,100,160,",
        labelColor: "rgba(185,210,230,0.6)", footerText: "❄ 𝔣𝔯𝔬𝔰𝔱 ❄",
    },
    moss: {
        name: "Moss & Decay",
        bg: "linear-gradient(160deg,rgba(6,9,6,0.99) 0%,rgba(10,13,8,0.97) 100%)",
        border: "rgba(60,100,50,0.18)", headerBg: "rgba(0,0,0,0.38)",
        accent: "70,110,55", text: "rgba(195,215,185,0.92)", textDim: "rgba(150,180,130,0.45)",
        sigils: "rgba(90,150,60,", footer: "rgba(70,120,50,0.35)",
        barTrack: "rgba(255,255,255,0.05)", charBorder: "rgba(80,130,55,0.3)",
        gridStroke: "rgba(70,120,50,", circleGlow: "rgba(55,100,40,",
        labelColor: "rgba(190,215,175,0.6)", footerText: "⌇ ᴅᴇᴄᴀʏ ⌇",
    },
};

function abtScheme() {
    return ABT_SCHEMES[localStorage.getItem("ABT_scheme") || "blood"] || ABT_SCHEMES.blood;
}

// ── Shared SVG filter defs ───────────────────────────────────────────────────
// Instead of creating unique filter IDs per chart, inject ONE hidden SVG
// with shared filter defs. All charts reference these.
const ABT_FILTER_ID  = "abt-glow";
const ABT_FILTER_ID2 = "abt-glow2";

function abtEnsureFilters() {
    if (document.getElementById("abt-shared-filters")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "abt-shared-filters";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.style.pointerEvents = "none";
    svg.innerHTML = '<defs>'
        +'<filter id="'+ABT_FILTER_ID+'"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        +'<filter id="'+ABT_FILTER_ID2+'"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        +'</defs>';
    document.body.appendChild(svg);
}


// ── Ritual pentagram chart — full size with axis labels ──────────────────────
function abtRenderChart(fields, showLust) {
    const W=300, H=300, cx=150, cy=150, r=78;
    const outerR=r+20, innerR=r+10;

    function pm(val) {
        if (!val) return {value:0,delta:0};
        const n=String(val).match(/-?\d+/), d=String(val).match(/delta:\s*([+-]?\d+)/i);
        return {value:n?Math.max(-100,Math.min(100,parseInt(n[0]))):0, delta:d?parseInt(d[1]):0};
    }
    const MIN=0.09;
    function normalizeMetric(v, bidir) {
        if (bidir) return Math.max(MIN, Math.abs(v) / 100);
        return Math.max(MIN, v / 100);
    }

    const cAff=pm(fields.char_affection||fields.affection);
    const cFear=pm(fields.char_fear||fields.fear);
    const cObs=pm(fields.char_obsession||fields.obsession);
    const cTru=pm(fields.char_trust||fields.trust);
    const cLust=showLust?pm(fields.char_lust||fields.lust):null;

    const axes = showLust ? [
        {deg:270, name:"AFF",  m:cAff,  bidir:true,  sigil:"♡"},
        {deg:342, name:"FEAR", m:cFear, bidir:true,  sigil:"◬"},
        {deg:54,  name:"OBS",  m:cObs,  bidir:false, sigil:"☉"},
        {deg:126, name:"TRST", m:cTru,  bidir:true,  sigil:"◈"},
        {deg:198, name:"LUST", m:cLust, bidir:false, sigil:"☾"},
    ] : [
        {deg:0,   name:"AFF",  m:cAff,  bidir:true,  sigil:"♡"},
        {deg:90,  name:"FEAR", m:cFear, bidir:true,  sigil:"◬"},
        {deg:180, name:"OBS",  m:cObs,  bidir:false, sigil:"☉"},
        {deg:270, name:"TRST", m:cTru,  bidir:true,  sigil:"◈"},
    ];
    const N=axes.length;

    function toRad(deg){return (deg-90)*Math.PI/180;}
    function ptAt(deg,dist){const rad=toRad(deg);return {x:cx+dist*Math.cos(rad),y:cy+dist*Math.sin(rad)};}

    const dataPts = axes.map(a=>{
        const norm = normalizeMetric(a.m.value, a.bidir);
        return ptAt(a.deg, r*norm);
    });

    const cIsHate=cAff.value<-20;
    const cStroke=cIsHate?"rgba(215,58,58,0.88)":cAff.value>40?"rgba(185,98,160,0.78)":"rgba(135,88,155,0.68)";
    const cFill=cIsHate?"rgba(155,22,22,0.22)":cAff.value>40?"rgba(145,68,118,0.18)":"rgba(88,58,108,0.15)";

    function dotColor(a) {
        if (!a.bidir) return a.m.value > 50 ? "rgba(188,118,238,0.9)" : "rgba(148,108,198,0.75)";
        if (a.m.value > 0) return "rgba(92,195,112,0.9)";
        if (a.m.value < 0) return "rgba(215,68,68,0.9)";
        return "rgba(150,150,160,0.6)";
    }

    function gridPoly(f){
        const rr=r*f;
        return axes.map(a=>ptAt(a.deg,rr)).map((p,i)=>((i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1))).join("")+"Z";
    }

    let starSVG="";
    if(N===5){
        const sp=axes.map(a=>ptAt(a.deg,outerR-3));
        starSVG=[0,1,2,3,4].map(i=>{
            const j=(i+2)%5;
            return '<line x1="'+sp[i].x.toFixed(1)+'" y1="'+sp[i].y.toFixed(1)+'" x2="'+sp[j].x.toFixed(1)+'" y2="'+sp[j].y.toFixed(1)+'" stroke="rgba(180,45,45,0.2)" stroke-width="0.6"/>';
        }).join("");
    } else {
        const dp=axes.map(a=>ptAt(a.deg,outerR-3));
        starSVG='<line x1="'+dp[0].x.toFixed(1)+'" y1="'+dp[0].y.toFixed(1)+'" x2="'+dp[2].x.toFixed(1)+'" y2="'+dp[2].y.toFixed(1)+'" stroke="rgba(180,45,45,0.18)" stroke-width="0.5"/>';
        starSVG+='<line x1="'+dp[1].x.toFixed(1)+'" y1="'+dp[1].y.toFixed(1)+'" x2="'+dp[3].x.toFixed(1)+'" y2="'+dp[3].y.toFixed(1)+'" stroke="rgba(180,45,45,0.18)" stroke-width="0.5"/>';
        const d45=[45,135,225,315].map(d=>ptAt(d,outerR-3));
        starSVG+='<line x1="'+d45[0].x.toFixed(1)+'" y1="'+d45[0].y.toFixed(1)+'" x2="'+d45[2].x.toFixed(1)+'" y2="'+d45[2].y.toFixed(1)+'" stroke="rgba(180,45,45,0.1)" stroke-width="0.5"/>';
        starSVG+='<line x1="'+d45[1].x.toFixed(1)+'" y1="'+d45[1].y.toFixed(1)+'" x2="'+d45[3].x.toFixed(1)+'" y2="'+d45[3].y.toFixed(1)+'" stroke="rgba(180,45,45,0.1)" stroke-width="0.5"/>';
    }

    const axisLines=axes.map(a=>{
        const p=ptAt(a.deg,outerR);
        return '<line x1="'+cx+'" y1="'+cy+'" x2="'+p.x.toFixed(1)+'" y2="'+p.y.toFixed(1)+'" stroke="rgba(175,48,48,0.13)" stroke-width="0.5" stroke-dasharray="2 3"/>';
    }).join("");

    const occultSymbols=[
        {deg:0,   glyph:"⛧", size:13, op:0.4},
        {deg:45,  glyph:"☽", size:12, op:0.28},
        {deg:90,  glyph:"✠", size:12, op:0.35},
        {deg:135, glyph:"☆", size:11, op:0.28},
        {deg:180, glyph:"⛧", size:13, op:0.4},
        {deg:225, glyph:"☿", size:12, op:0.28},
        {deg:270, glyph:"✠", size:12, op:0.35},
        {deg:315, glyph:"◬", size:11, op:0.28},
    ];
    const sigils=occultSymbols.map(s=>{
        const p=ptAt(s.deg,outerR+14);
        return '<text x="'+p.x.toFixed(1)+'" y="'+p.y.toFixed(1)+'" text-anchor="middle" dominant-baseline="middle" fill="rgba(200,58,58,'+s.op+')" font-size="'+s.size+'" font-family="serif">'+s.glyph+'</text>';
    }).join("");

    const lustSVG=cLust?(function(){
        var lR=14,lAng=(cLust.value/100)*360-90;
        var lx=cx+lR*Math.cos(lAng*Math.PI/180),ly=cy+lR*Math.sin(lAng*Math.PI/180);
        var op=(0.3+(cLust.value/100)*0.62).toFixed(2);
        return '<circle cx="'+cx+'" cy="'+cy+'" r="'+lR+'" fill="none" stroke="rgba(188,78,118,0.2)" stroke-width="0.5" stroke-dasharray="2 2"/><circle cx="'+lx.toFixed(1)+'" cy="'+ly.toFixed(1)+'" r="2.5" fill="rgba(218,88,138,'+op+')"/>';
    })():"";

    const phase=(fields.phase||"NOTHING").toUpperCase().replace(/[^A-Z]/g,"");
    const phColors={ERASURE:"rgba(205,42,42,0.62)",BRAND:"rgba(175,42,42,0.52)",SCORN:"rgba(155,58,58,0.52)",NOTHING:"rgba(125,105,125,0.48)",TEETH:"rgba(165,135,52,0.52)",GRIP:"rgba(125,62,175,0.58)",CRACK:"rgba(52,115,165,0.52)",TANGLE:"rgba(165,58,115,0.58)"};
    const phColor=phColors[phase]||"rgba(125,105,125,0.48)";

    // Axis labels with improved delta: value then (±N) in parens
    const axisLabels = axes.map(a=>{
        const labelR=outerR+30;
        const p=ptAt(a.deg, labelR);
        const cSign=a.bidir&&a.m.value>0?"+":"";
        const cColor=a.bidir?(a.m.value<-40?"rgba(228,82,82,1)":a.m.value<0?"rgba(208,118,118,0.95)":a.m.value>40?"rgba(102,218,142,0.95)":"rgba(188,168,188,0.85)"):(a.m.value>50?"rgba(188,118,238,1)":"rgba(168,138,208,0.9)");
        // Delta as separate text below value, not inline tspan
        const dColor = a.m.delta>0?"rgba(92,185,102,0.85)":"rgba(185,78,78,0.85)";
        const dText = a.m.delta!==0 ? "("+(a.m.delta>0?"+":"")+a.m.delta+")" : "";

        let anchor="middle", dx=0, dy=0;
        const normDeg=(a.deg+360)%360;
        if(normDeg>45&&normDeg<135){anchor="start";dx=4;}
        else if(normDeg>225&&normDeg<315){anchor="end";dx=-4;}
        if(normDeg<45||normDeg>315){dy=-5;}
        else if(normDeg>135&&normDeg<225){dy=7;}

        const nx=p.x+dx, ny=p.y+dy;
        return '<text x="'+nx.toFixed(1)+'" y="'+(ny-6).toFixed(1)+'" text-anchor="'+anchor+'" dominant-baseline="middle" fill="rgba(225,182,195,0.6)" font-size="7" font-family="sans-serif" letter-spacing="1.5">'+a.name+'</text>'
            +'<text x="'+nx.toFixed(1)+'" y="'+(ny+7).toFixed(1)+'" text-anchor="'+anchor+'" dominant-baseline="middle" fill="'+cColor+'" font-size="12" font-family="monospace" font-weight="700">'+cSign+a.m.value+'</text>'
            +(dText ? '<text x="'+nx.toFixed(1)+'" y="'+(ny+17).toFixed(1)+'" text-anchor="'+anchor+'" dominant-baseline="middle" fill="'+dColor+'" font-size="8" font-family="sans-serif">'+dText+'</text>' : "");
    }).join("");

    const dataPath=dataPts.map((p,i)=>((i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1))).join("")+"Z";

    // Use shared filter IDs
    const f = ABT_FILTER_ID;
    const fg = ABT_FILTER_ID2;

    return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:'+W+'px;height:auto;display:block;margin:0 auto;">'
        +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(outerR+4)+'" fill="none" stroke="rgba(162,42,42,0.06)" stroke-width="1" filter="url(#'+fg+')"/>'
        +'<circle cx="'+cx+'" cy="'+cy+'" r="'+outerR+'" fill="none" stroke="rgba(178,48,48,0.3)" stroke-width="0.8" filter="url(#'+fg+')"/>'
        +starSVG+sigils
        +'<circle cx="'+cx+'" cy="'+cy+'" r="'+innerR+'" fill="none" stroke="rgba(172,48,48,0.18)" stroke-width="0.5"/>'
        +'<path d="'+gridPoly(0.33)+'" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>'
        +'<path d="'+gridPoly(0.66)+'" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>'
        +'<path d="'+gridPoly(1)+'" fill="none" stroke="rgba(178,48,48,0.22)" stroke-width="0.7"/>'
        +axisLines
        +'<circle cx="'+cx+'" cy="'+cy+'" r="4" fill="rgba(188,52,52,0.15)" filter="url(#'+fg+')"/>'
        +'<circle cx="'+cx+'" cy="'+cy+'" r="2" fill="rgba(188,52,52,0.5)"/>'
        +lustSVG
        +'<path d="'+dataPath+'" fill="'+cFill+'" stroke="'+cStroke+'" stroke-width="1.4" filter="url(#'+f+')"/>'
        +dataPts.map(function(p,i){return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="2.5" fill="'+dotColor(axes[i])+'" opacity="0.9"/>';}).join("")
        +'<text x="'+cx+'" y="'+(cy+r-14)+'" text-anchor="middle" dominant-baseline="middle" fill="'+phColor+'" font-size="7.5" font-family="sans-serif" letter-spacing="3" filter="url(#'+fg+')">'+phase+'</text>'
        +axisLabels
        +'</svg>';
}

// ── Compact vertical metric bars — clearer delta ────────────────────────────
function abtVertBars(fields, showLust) {
    function pm(val){
        if(!val)return{value:0,delta:0};
        var n=String(val).match(/-?\d+/),d=String(val).match(/delta:\s*([+-]?\d+)/i);
        return{value:n?Math.max(-100,Math.min(100,parseInt(n[0]))):0,delta:d?parseInt(d[1]):0};
    }

    var cAff=pm(fields.char_affection||fields.affection);
    var cFear=pm(fields.char_fear||fields.fear);
    var cObs=pm(fields.char_obsession||fields.obsession);
    var cTru=pm(fields.char_trust||fields.trust);
    var cLust=showLust?pm(fields.char_lust||fields.lust):null;

    var cols=[
        {label:"AFF",  bidir:true,  c:cAff},
        {label:"FEAR", bidir:true,  c:cFear},
        {label:"OBS",  bidir:false, c:cObs},
        {label:"TRST", bidir:true,  c:cTru},
    ];
    if(cLust) cols.push({label:"LUST",bidir:false,c:cLust});

    function barColor(v,bidir){
        if(!bidir)return v>60?"#b060d8":v>30?"#8040a0":"#503070";
        if(v<-60)return"#c03030";if(v<-20)return"#a04444";
        if(v>60)return"#3a9a6a";if(v>20)return"#4a7a5a";
        return"#555566";
    }

    var barH=50;
    var colsHtml=cols.map(function(col){
        var v=col.c.value, d=col.c.delta;
        var color=barColor(v,col.bidir);
        var sign=col.bidir&&v>0?"+":"";

        // Delta: show as (±N) only when non-zero
        var deltaHtml='<div style="height:12px;"></div>'; // spacer when no delta
        if(d!==0){
            var dSign=d>0?"+":"";
            var dColor=d>0?"rgba(92,185,102,0.85)":"rgba(185,78,78,0.85)";
            deltaHtml='<div style="font-size:9px;color:'+dColor+';line-height:12px;text-align:center;">('+dSign+d+')</div>';
        }

        var fillStyle="";
        if(col.bidir){
            var pct=Math.abs(v)/100*50;
            if(v>=0){
                fillStyle="bottom:50%;height:"+pct.toFixed(1)+"%;max-height:50%;";
            } else {
                fillStyle="top:50%;height:"+pct.toFixed(1)+"%;max-height:50%;";
            }
        } else {
            var pct2=Math.max(2,v);
            fillStyle="bottom:0;height:"+pct2+"%;";
        }

        var midLine=col.bidir?'<div style="position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,0.1);"></div>':"";

        return '<div style="display:flex;flex-direction:column;align-items:center;min-width:32px;width:0;flex:1;">'
            +'<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:rgba(218,178,192,0.5);font-family:sans-serif;white-space:nowrap;margin-bottom:2px;">'+col.label+'</div>'
            +'<div style="font-size:13px;font-family:monospace;font-weight:700;color:'+color+';line-height:1;white-space:nowrap;">'+sign+v+'</div>'
            +deltaHtml
            +'<div style="position:relative;width:8px;height:'+barH+'px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin:3px 0;">'
            +midLine
            +'<div style="position:absolute;left:0;right:0;'+fillStyle+'background:'+color+';border-radius:4px;transition:height 0.3s ease;"></div>'
            +'</div>'
            +'</div>';
    }).join("");

    return '<div style="display:flex;justify-content:space-around;padding:8px 4px 10px;max-width:100%;box-sizing:border-box;">'+colsHtml+'</div>';
}

// ── Characters block ──────────────────────────────────────────────────────────
function abtRenderChars(charsVal) {
    const chars = parseChars(charsVal);
    if (!chars.length) return "";
    const cs = abtScheme();
    return '<div style="padding:8px 14px 12px;border-top:0.5px solid rgba(255,255,255,0.05);">'
        +'<div style="font-size:0.58em;letter-spacing:3px;text-transform:uppercase;color:'+cs.textDim+';font-family:sans-serif;margin-bottom:8px;">▸ present</div>'
        +chars.map(function(c){return '<div style="margin-bottom:7px;padding:7px 10px;background:rgba(255,255,255,0.025);border-left:1px solid '+cs.charBorder+';border-radius:0 3px 3px 0;">'
            +'<div style="margin-bottom:4px;">'
            +'<div style="font-size:0.8em;font-weight:600;color:'+cs.text+';line-height:1.3;">'+abtEsc(c.name||"")+'</div>'
            +(c.mood ? '<div style="font-size:0.66em;color:'+cs.text+';opacity:0.7;font-style:italic;line-height:1.4;margin-top:2px;">'+abtEsc(c.mood)+'</div>' : "")
            +'</div>'
            +(c.attire ? '<div style="font-size:0.7em;color:'+cs.text+';opacity:0.75;margin-bottom:3px;">'+abtEsc(c.attire)+'</div>' : "")
            +(c.pose ? '<div style="font-size:0.66em;color:'+cs.text+';opacity:0.6;margin-bottom:3px;font-style:italic;">⤷ '+abtEsc(c.pose)+'</div>' : "")
            +(c.thought ? '<div style="font-size:0.72em;color:'+cs.text+';font-style:italic;border-top:0.5px solid rgba(255,255,255,0.05);padding-top:4px;line-height:1.55;">"'+abtEsc(c.thought)+'"</div>' : "")
            +'</div>';}).join("")
        +'</div>';
}

// ── User state block (attire + pose) ─────────────────────────────────────────
function abtRenderUserState(fields) {
    var attire = fields.user_attire;
    var pose = fields.user_pose;
    if (!attire && !pose) return "";
    var cs = abtScheme();
    return '<div style="padding:6px 14px 10px;border-top:0.5px solid rgba(255,255,255,0.04);">'
        +'<div style="font-size:0.58em;letter-spacing:3px;text-transform:uppercase;color:'+cs.textDim+';font-family:sans-serif;margin-bottom:6px;">◇ {{user}}</div>'
        +'<div style="padding:5px 10px;background:rgba(255,255,255,0.02);border-left:1px solid rgba(180,140,160,0.2);border-radius:0 3px 3px 0;">'
        +(attire ? '<div style="font-size:0.7em;color:'+cs.text+';opacity:0.75;margin-bottom:3px;">'+abtEsc(attire)+'</div>' : "")
        +(pose ? '<div style="font-size:0.66em;color:'+cs.text+';opacity:0.6;font-style:italic;">⤷ '+abtEsc(pose)+'</div>' : "")
        +'</div></div>';
}

// ── Full card renderer ────────────────────────────────────────────────────────
function abtEsc(s) { return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function abtRenderCard(fields, s) {
    if (!s) s = abtLoad();
    if (!s.ibShow) return '<div class="abt-block" style="display:none"></div>';

    const cs = abtScheme();
    const phase    = (fields.phase||"NOTHING").toUpperCase().replace(/[^A-Z]/g,"");
    const pCfg     = PHASE_CFG[phase] || PHASE_CFG["NOTHING"];
    const intensity = (fields.intensity||"").toLowerCase().trim();
    const condition = (fields.condition||"intact").toLowerCase().trim();
    const iColor   = INTENSITY_COLORS[intensity] || "#5a4a6a";
    const cColor   = CONDITION_COLORS[condition]  || CONDITION_COLORS.intact;

    const injuries = fields.injuries && !/^none/i.test(fields.injuries) ? fields.injuries : null;
    const dignity  = fields.dignity  && !/^none/i.test(fields.dignity)  ? fields.dignity  : null;
    const location = fields.location || null;
    const weather  = fields.weather  || null;
    const date     = fields.date     || null;
    const bundles  = fields.bundles  && !/^none/i.test(fields.bundles)  ? fields.bundles  : null;

    // ── Header: subtle tags with tiny labels for clarity ──
    const headerHtml = '<div style="padding:8px 14px 7px;background:'+cs.headerBg+';border-bottom:0.5px solid rgba('+cs.accent+',0.1);position:relative;overflow:hidden;">'
        +'<div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:2.2em;opacity:0.04;color:'+pCfg.color+';line-height:1;pointer-events:none;">'+pCfg.sigil+'</div>'
        +'<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">'
            +'<span style="font-size:0.42em;letter-spacing:1px;text-transform:uppercase;color:'+cs.textDim+';font-family:sans-serif;">phase</span>'
            +'<span style="font-size:0.6em;letter-spacing:3px;text-transform:uppercase;color:'+pCfg.color+';font-family:sans-serif;font-weight:600;text-shadow:0 0 8px '+pCfg.glow+';">'+phase+'</span>'
            +'<span style="font-size:0.58em;color:'+cs.text+';font-style:italic;opacity:0.55;">'+pCfg.sub+'</span>'
            +'<span style="font-size:0.55em;color:'+cs.textDim+';font-family:sans-serif;margin-left:auto;">·</span>'
            +(intensity ? '<span style="font-size:0.42em;letter-spacing:1px;text-transform:uppercase;color:'+cs.textDim+';font-family:sans-serif;">depth</span><span style="font-size:0.55em;letter-spacing:1px;text-transform:uppercase;color:'+iColor+';font-family:sans-serif;opacity:0.85;">'+abtEsc(fields.intensity)+'</span><span style="font-size:0.55em;color:'+cs.textDim+';">·</span>' : "")
            +'<span style="font-size:0.42em;letter-spacing:1px;text-transform:uppercase;color:'+cs.textDim+';font-family:sans-serif;">cond</span>'
            +'<span style="font-size:0.55em;letter-spacing:1px;text-transform:uppercase;color:'+cColor+';font-family:sans-serif;opacity:0.85;">'+abtEsc(condition)+'</span>'
        +'</div>'
    +'</div>';

    // ── World state row ──
    const worldHtml = (s.ibWorld && (date||location||weather))
        ? '<div style="padding:4px 14px;border-bottom:0.5px solid rgba(255,255,255,0.03);display:flex;gap:10px;flex-wrap:wrap;">'
            +(date     ? '<span style="font-size:0.68em;color:'+cs.text+';font-style:italic;opacity:0.85;">☽ '+abtEsc(date)+'</span>' : "")
            +(location ? '<span style="font-size:0.68em;color:'+cs.text+';font-style:italic;opacity:0.8;">📍 '+abtEsc(location)+'</span>' : "")
            +(weather  ? '<span style="font-size:0.68em;color:'+cs.text+';font-style:italic;opacity:0.7;">☁ '+abtEsc(weather)+'</span>' : "")
            +'</div>'
        : "";

    // ── Chart + Bars: stacked layout (chart on top, bars below full-width) ──
    const chartSvg = s.ibChart ? abtRenderChart(fields, s.ibLust) : "";
    const barsHtml = abtVertBars(fields, s.ibLust);

    let metricsHtml = "";
    if (s.ibChart) {
        metricsHtml = '<div style="padding:4px 0 0;max-width:100%;overflow:hidden;">'+chartSvg+'</div>'
            +barsHtml;
    } else {
        metricsHtml = barsHtml;
    }

    return '<div class="abt-block" style="margin:14px 0;background:'+cs.bg+';border:0.5px solid '+cs.border+';border-top:1px solid '+pCfg.color+'44;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,0.55);overflow:hidden;font-family:inherit;max-width:100%;box-sizing:border-box;display:block !important;visibility:visible !important;opacity:1 !important;">'

        +headerHtml
        +worldHtml
        +metricsHtml

        // Injuries + Dignity
        +(s.ibInjuries && (injuries||dignity) ? '<div style="padding:0 14px 8px;border-top:0.5px solid rgba(255,255,255,0.03);margin-top:2px;">'
            +(injuries ? '<div style="margin-top:6px;font-size:0.7em;color:rgba(225,135,110,0.9);font-style:italic;">⚔ '+abtEsc(injuries)+'</div>' : "")
            +(dignity  ? '<div style="margin-top:2px;font-size:0.68em;color:'+cs.text+';font-style:italic;opacity:0.85;">◈ '+abtEsc(dignity)+'</div>'  : "")
            +'</div>' : "")

        // Bundles
        +(s.ibBundles && s.evtEnabled && bundles ? '<div style="padding:0 14px 7px;">'
            +'<span style="font-size:0.56em;letter-spacing:2px;text-transform:uppercase;color:'+cs.textDim+';font-family:sans-serif;">bundles · </span>'
            +'<span style="font-size:0.66em;color:'+cs.text+';font-style:italic;opacity:0.8;">'+abtEsc(bundles)+'</span>'
            +'</div>' : "")

        // Characters
        +(s.ibChars && fields.characters ? abtRenderChars(fields.characters) : "")

        // User state (attire + pose)
        +(s.ibChars ? abtRenderUserState(fields) : "")

        // Footer
        +'<div style="padding:2px 14px 3px;border-top:0.5px solid rgba(255,255,255,0.02);display:flex;justify-content:space-between;">'
            +'<span style="font-size:0.48em;color:'+cs.footer+';">⛧ · ✦ · ⛧</span>'
            +'<span style="font-size:0.48em;color:rgba('+cs.accent+',0.25);letter-spacing:2px;">'+cs.footerText+'</span>'
        +'</div>'
    +'</div>';
}

// ── Core ──────────────────────────────────────────────────────────────────────
function abtInject() {
    try {
        const ctx = SillyTavern.getContext();
        ctx.setExtensionPrompt(ABT_INJECTION_ID, abtBuildPrompt(abtLoad()), 1, 0);
    } catch(e) { console.error("[Abattoir] inject failed:", e); }
}

// ── Strip infoblock from rendered HTML — ONCE per message ────────────────────
function abtStripInfoblock(mesTextEl, msgIndex) {
    if (_abtStripped.has(msgIndex)) return;

    var html = mesTextEl.innerHTML;

    // Method 1: regex on escaped/raw tags (works when ST preserves them)
    var cleaned = html.replace(/&lt;infoblock&gt;[\s\S]*?&lt;\/infoblock&gt;/gi, "");
    cleaned = cleaned.replace(/<infoblock>[\s\S]*?<\/infoblock>/gi, "");

    if (cleaned !== html) {
        mesTextEl.innerHTML = cleaned;
        // Clean up excess line breaks
        mesTextEl.innerHTML = mesTextEl.innerHTML.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");
        _abtStripped.add(msgIndex);
        return;
    }

    // Method 2: DOM walk — find "phase:" text, then remove everything from there
    // to the last "char_*:" line. This handles any rendering ST does.
    var walker = document.createTreeWalker(mesTextEl, NodeFilter.SHOW_TEXT, null, false);
    var phaseNode = null;
    var lastCharNode = null;
    var nodesToCheck = [];

    while (walker.nextNode()) {
        var txt = walker.currentNode.textContent;
        nodesToCheck.push(walker.currentNode);
        if (/^\s*phase\s*:/i.test(txt)) phaseNode = walker.currentNode;
        if (/char_(?:lust|trust|obsession|fear|affection)\s*:/i.test(txt)) lastCharNode = walker.currentNode;
    }

    if (!phaseNode || !lastCharNode) {
        _abtStripped.add(msgIndex);
        return;
    }

    // Collect all nodes between phaseNode and lastCharNode (inclusive)
    // and their parent elements if they'd become empty
    var removing = false;
    var toRemove = [];
    for (var i = 0; i < nodesToCheck.length; i++) {
        if (nodesToCheck[i] === phaseNode) removing = true;
        if (removing) toRemove.push(nodesToCheck[i]);
        if (nodesToCheck[i] === lastCharNode) break;
    }

    // Remove the nodes and their parent elements if empty after removal
    for (var j = 0; j < toRemove.length; j++) {
        var node = toRemove[j];
        var parent = node.parentNode;
        if (parent) {
            parent.removeChild(node);
            // If parent is now empty (or just whitespace), remove it too
            // but only if it's not the mesTextEl itself
            while (parent && parent !== mesTextEl &&
                   parent.textContent.trim() === "" &&
                   parent.querySelectorAll("img,svg,canvas").length === 0) {
                var grandparent = parent.parentNode;
                if (grandparent) grandparent.removeChild(parent);
                parent = grandparent;
            }
        }
    }

    // Clean up excess <br> tags left behind
    mesTextEl.innerHTML = mesTextEl.innerHTML.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");
    _abtStripped.add(msgIndex);
}

// ── Process single message ───────────────────────────────────────────────────
function abtProcess(msgDiv, msgIndex, forceRedraw) {
    try {
        const s = abtLoad();
        if (!s.enabled) return;
        const ctx = SillyTavern.getContext();
        const msg = ctx.chat[msgIndex];
        if (!msg || msg.is_user) return;

        const rawText = msg.mes || "";
        const fields = abtParse(rawText);
        if (!fields) return;

        // ── Content hash check: skip if nothing changed ──
        const contentKey = rawText.match(/<infoblock>([\s\S]*?)<\/infoblock>/i);
        const hashInput = (contentKey ? contentKey[1] : "") + "|" + _abtSettingsVer;
        const hash = abtHash(hashInput);
        const cached = _abtCache.get(msgIndex);

        if (!forceRedraw && cached && cached.hash === hash) {
            // Content hasn't changed — check if card is still in DOM
            const mesTextEl = msgDiv.querySelector(".mes_text");
            if (mesTextEl && mesTextEl.querySelector(".abt-block")) return;
        }

        _abtCache.set(msgIndex, { hash, fields });

        const mesTextEl = msgDiv.querySelector(".mes_text");
        if (!mesTextEl) return;

        // Pause MutationObserver during our DOM writes
        _abtMutationPaused = true;

        // Remove existing blocks
        mesTextEl.querySelectorAll(".abt-block").forEach(el => el.remove());
        mesTextEl.querySelectorAll(".abt-notes-split").forEach(el => el.remove());

        // Strip infoblock text (only first time)
        abtStripInfoblock(mesTextEl, msgIndex);

        // DOM-level: extract notes from blockquotes
        mesTextEl.querySelectorAll("blockquote").forEach(function(bq) {
            var bqHtml = bq.innerHTML;

            var lastMarkerIdx = -1;
            var searchFrom = 0;
            while (true) {
                var idx = bqHtml.indexOf("\u26E7", searchFrom);
                if (idx === -1) break;
                var after = bqHtml.substring(idx, idx + 80);
                if (/Date:/i.test(after)) {
                    var walkBack = bqHtml.lastIndexOf("꒰ᐢ", idx);
                    if (walkBack !== -1 && idx - walkBack < 30) {
                        lastMarkerIdx = walkBack;
                    } else {
                        lastMarkerIdx = idx;
                    }
                    break;
                }
                searchFrom = idx + 1;
            }

            if (lastMarkerIdx === -1) {
                var datePatterns = [
                    /<b>Date:<\/b>/i,
                    /Date:\s*\d{1,2}\.\d{1,2}\.\d{4}/i,
                    /<b>꒰ᐢ[^<]*⛧<\/b>/i
                ];
                for (var dp of datePatterns) {
                    var dm = bqHtml.match(dp);
                    if (dm) {
                        lastMarkerIdx = bqHtml.indexOf(dm[0]);
                        var lookBack = bqHtml.lastIndexOf("꒰ᐢ", lastMarkerIdx);
                        if (lookBack !== -1 && lastMarkerIdx - lookBack < 100) {
                            lastMarkerIdx = lookBack;
                        }
                        while (lastMarkerIdx > 0 && /[\s]/.test(bqHtml[lastMarkerIdx-1])) lastMarkerIdx--;
                        var brBefore = bqHtml.lastIndexOf("<br", lastMarkerIdx);
                        if (brBefore !== -1 && lastMarkerIdx - brBefore < 10) {
                            lastMarkerIdx = brBefore;
                        }
                        break;
                    }
                }
            }

            if (lastMarkerIdx === -1) return;

            var oocPart = bqHtml.substring(0, lastMarkerIdx).replace(/(<br\s*\/?>|\s)+$/gi, "");
            var notesPart = bqHtml.substring(lastMarkerIdx);

            bq.innerHTML = oocPart;

            var notesDiv = document.createElement("div");
            notesDiv.className = "abt-notes-split";
            notesDiv.style.cssText = "margin:6px 0;";
            notesDiv.innerHTML = '<details style="background:rgba(255,255,255,0.015);border:0.5px solid rgba(150,45,45,0.12);border-radius:4px;">'
                +'<summary style="padding:4px 12px;cursor:pointer;font-size:0.58em;letter-spacing:2px;text-transform:uppercase;color:rgba(210,165,180,0.5);font-family:sans-serif;user-select:none;">'
                +'꒰ᐢ. .ᐢ꒱⛧ narration notes</summary>'
                +'<div style="padding:4px 12px 8px;font-size:0.82em;color:rgba(210,185,195,0.82);line-height:1.6;">'+notesPart+'</div>'
                +'</details>';
            bq.parentNode.insertBefore(notesDiv, bq.nextSibling);
        });

        // Append the infoblock card
        const wrap = document.createElement("div");
        wrap.innerHTML = abtRenderCard(fields, s);
        const card = wrap.firstElementChild;
        if (card) mesTextEl.appendChild(card);

        // Resume MutationObserver
        _abtMutationPaused = false;
    } catch(e) {
        _abtMutationPaused = false;
        console.error("[Abattoir] process failed:", e);
    }
}

// ── Throttled reprocessAll ───────────────────────────────────────────────────
function abtReprocessAll() {
    if (_abtReprocessTimer) return; // already scheduled
    _abtReprocessTimer = setTimeout(() => {
        _abtReprocessTimer = null;
        _abtReprocessAllNow();
    }, 300);
}

function _abtReprocessAllNow() {
    document.querySelectorAll(".mes").forEach(node => {
        const id = Number(node.getAttribute("mesid"));
        if (!isNaN(id)) abtProcess(node, id);
    });
}

// ── Settings change handler ──────────────────────────────────────────────────
function abtOnSettingsChange() {
    _abtSettingsVer++;
    _abtSettingsCache = null;
    // Force redraw only visible messages immediately, queue the rest
    document.querySelectorAll(".mes").forEach(node => {
        const id = Number(node.getAttribute("mesid"));
        if (!isNaN(id)) {
            // Invalidate cache for this message
            _abtCache.delete(id);
            _abtStripped.delete(id); // Need to re-strip if settings changed display
        }
    });
    abtReprocessAll();
}

// ── Settings HTML ─────────────────────────────────────────────────────────────
const ABT_HTML = `
<div id="abt-panel">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>꒰ᐢ. .ᐢ꒱⛧ Abattoir</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content" style="padding-left:8px;border-left:1px solid rgba(150,45,45,0.15);">

      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Random Bad Events</b>
          <label class="checkbox_label" style="margin-left:auto;margin-right:8px;" title="Toggle random events">
            <input type="checkbox" id="abt-evt-on">
          </label>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" id="abt-evt-opts">
          <div class="flex-container">
            <span>Frequency</span>
            <select id="abt-evt-freq" class="text_pole widthNatural">
              <option value="rare">Rare</option>
              <option value="occasional">Occasional</option>
              <option value="frequent">Frequent</option>
            </select>
          </div>
          <hr>
          <small>Event Types</small>
          <div class="flex-container flexFlowColumn">
            <label class="checkbox_label"><input type="checkbox" id="abt-et-physicalHarm"><span>Physical Harm</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-death"><span>Death</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-bodyHorror"><span>Body Horror</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-environmental"><span>Environmental</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-social"><span>Social / Political</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-disease"><span>Disease / Illness</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-betrayal"><span>Betrayal</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-et-propertyDamage"><span>Property Damage</span></label>
          </div>
        </div>
      </div>

      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Infoblock</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="flex-container">
            <span>Color Scheme</span>
            <select id="abt-ib-scheme" class="text_pole widthNatural">
              <option value="blood">Blood Ritual</option>
              <option value="void">Void</option>
              <option value="bone">Bone & Ash</option>
              <option value="frost">Frost</option>
              <option value="moss">Moss & Decay</option>
            </select>
          </div>
          <div class="flex-container">
            <span>Show Card</span>
            <select id="abt-ib-show" class="text_pole widthNatural">
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div class="flex-container">
            <span>Ritual Chart</span>
            <select id="abt-ib-chart" class="text_pole widthNatural">
              <option value="on">Show</option>
              <option value="off">Hide</option>
            </select>
          </div>
          <div class="flex-container">
            <span>Lust Metric</span>
            <select id="abt-ib-lust" class="text_pole widthNatural">
              <option value="on">Show</option>
              <option value="off">Hide</option>
            </select>
          </div>
          <div class="flex-container">
            <span>World State</span>
            <select id="abt-ib-world" class="text_pole widthNatural">
              <option value="on">Show</option>
              <option value="off">Hide</option>
            </select>
          </div>
          <div class="flex-container">
            <span>Characters</span>
            <select id="abt-ib-chars" class="text_pole widthNatural">
              <option value="on">Show thoughts + attire</option>
              <option value="off">Hide</option>
            </select>
          </div>
          <div class="flex-container">
            <span>Injuries</span>
            <select id="abt-ib-injuries" class="text_pole widthNatural">
              <option value="on">Show</option>
              <option value="off">Hide</option>
            </select>
          </div>
          <div class="flex-container">
            <span>Bundles</span>
            <select id="abt-ib-bundles" class="text_pole widthNatural">
              <option value="on">Show</option>
              <option value="off">Hide</option>
            </select>
          </div>
        </div>
      </div>

      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Content Preferences</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="flex-container">
            <span>Violence</span>
            <select id="abt-violence" class="text_pole widthNatural">
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="graphic">Graphic</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>
          <hr>
          <small>Dark Themes</small>
          <div class="flex-container flexFlowColumn">
            <label class="checkbox_label"><input type="checkbox" id="abt-c-psychologicalHorror"><span>Psych. Horror</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-torture"><span>Torture</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-suffering"><span>Suffering</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-dominanceSubmission"><span>Dom / Sub</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-captivity"><span>Captivity</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-controlManipulation"><span>Control &amp; Manip.</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-romance"><span>Romance</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-explicitSexual"><span>Explicit Sexual</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-monsterRomance"><span>Monster Romance</span></label>
            <label class="checkbox_label"><input type="checkbox" id="abt-c-nonhumanEntities"><span>Non-human Entities</span></label>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>`;

// ── Init ──────────────────────────────────────────────────────────────────────
jQuery(async () => {
    const ctx = SillyTavern.getContext();
    $("#extensions_settings").append(ABT_HTML);

    // Inject shared SVG filter definitions
    abtEnsureFilters();

    const s = abtLoad();
    s.enabled = true;
    abtSave(s);
    $("#abt-evt-on").prop("checked", s.evtEnabled);
    $("#abt-evt-freq").val(s.evtFreq);
    $("#abt-ib-scheme").val(localStorage.getItem("ABT_scheme") || "blood");
    for (const k of Object.keys(s.evtTypes)) $(`#abt-et-${k}`).prop("checked", s.evtTypes[k]);
    $("#abt-ib-show").val(s.ibShow     ? "on" : "off");
    $("#abt-ib-chart").val(s.ibChart   ? "on" : "off");
    $("#abt-ib-lust").val(s.ibLust     ? "on" : "off");
    $("#abt-ib-world").val(s.ibWorld   ? "on" : "off");
    $("#abt-ib-chars").val(s.ibChars   ? "on" : "off");
    $("#abt-ib-injuries").val(s.ibInjuries ? "on" : "off");
    $("#abt-ib-bundles").val(s.ibBundles   ? "on" : "off");
    $("#abt-violence").val(s.violenceLevel);
    for (const k of Object.keys(s.content)) $(`#abt-c-${k}`).prop("checked", s.content[k]);

    // ── Settings change: save, invalidate caches, throttled reprocess ──
    $("#abt-panel").on("change", "input, select", function() {
        const cur = abtLoad();
        _abtSettingsCache = null; // force reload
        cur.enabled       = true;
        cur.evtEnabled    = $("#abt-evt-on").is(":checked");
        cur.evtFreq       = $("#abt-evt-freq").val();
        localStorage.setItem("ABT_scheme", $("#abt-ib-scheme").val());
        cur.ibShow        = $("#abt-ib-show").val()     === "on";
        cur.ibChart       = $("#abt-ib-chart").val()    === "on";
        cur.ibLust        = $("#abt-ib-lust").val()     === "on";
        cur.ibWorld       = $("#abt-ib-world").val()    === "on";
        cur.ibChars       = $("#abt-ib-chars").val()    === "on";
        cur.ibInjuries    = $("#abt-ib-injuries").val() === "on";
        cur.ibBundles     = $("#abt-ib-bundles").val()  === "on";
        cur.violenceLevel = $("#abt-violence").val();
        for (const k of Object.keys(cur.evtTypes)) cur.evtTypes[k] = $(`#abt-et-${k}`).is(":checked");
        for (const k of Object.keys(cur.content))  cur.content[k]  = $(`#abt-c-${k}`).is(":checked");
        abtSave(cur);
        abtInject();
        abtOnSettingsChange(); // invalidate + throttled reprocess
    });

    // ── Event listeners — no duplicate processing ──
    if (ctx.eventTypes?.GENERATION_STARTED)  ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED, abtInject);
    if (ctx.eventTypes?.CHAT_CHANGED)        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
        // Chat switched — clear ALL caches, reprocess
        _abtCache.clear();
        _abtStripped.clear();
        _abtSettingsCache = null;
        setTimeout(abtReprocessAll, 150);
    });
    if (ctx.eventTypes?.MESSAGE_RECEIVED)    ctx.eventSource.on(ctx.eventTypes.MESSAGE_RECEIVED,  idx => {
        setTimeout(() => {
            const el = document.querySelector(`.mes[mesid="${idx}"]`);
            if (el) abtProcess(el, idx);
        }, 200);
        // Single retry for late renders, NOT the aggressive double-retry from before
        setTimeout(() => {
            const el = document.querySelector(`.mes[mesid="${idx}"]`);
            if (el && !el.querySelector(".abt-block")) abtProcess(el, idx);
        }, 800);
    });
    if (ctx.eventTypes?.MESSAGE_EDITED)      ctx.eventSource.on(ctx.eventTypes.MESSAGE_EDITED,    idx => {
        _abtCache.delete(idx);
        _abtStripped.delete(idx);
        setTimeout(() => {
            const el = document.querySelector(`.mes[mesid="${idx}"]`);
            if (el) abtProcess(el, idx, true);
        }, 300);
    });
    if (ctx.eventTypes?.MESSAGE_SWIPED)      ctx.eventSource.on(ctx.eventTypes.MESSAGE_SWIPED,    idx => {
        _abtCache.delete(idx);
        _abtStripped.delete(idx);
        setTimeout(() => {
            const el = document.querySelector(`.mes[mesid="${idx}"]`);
            if (el) abtProcess(el, idx, true);
        }, 200);
    });
    if (ctx.eventTypes?.MESSAGE_UPDATED)     ctx.eventSource.on(ctx.eventTypes.MESSAGE_UPDATED,   idx => {
        _abtCache.delete(idx);
        _abtStripped.delete(idx);
        setTimeout(() => {
            const el = document.querySelector(`.mes[mesid="${idx}"]`);
            if (el) abtProcess(el, idx, true);
        }, 300);
    });

    // ── MutationObserver — GUARDED, won't re-trigger during our writes ──
    const chat = document.getElementById("chat");
    if (chat) {
        const pending = new Set();
        const schedule = (el, delay=250) => {
            if (!el?.classList?.contains("mes")) return;
            const id = Number(el.getAttribute("mesid"));
            if (isNaN(id) || pending.has(id)) return;
            pending.add(id);
            setTimeout(() => {
                pending.delete(id);
                const cur = document.querySelector(`.mes[mesid="${id}"]`);
                if (cur && !cur.querySelector("textarea")) abtProcess(cur, id);
            }, delay);
        };
        new MutationObserver(muts => {
            // ── GUARD: skip if we're the ones mutating ──
            if (_abtMutationPaused) return;

            for (const m of muts) {
                if (m.type !== "childList") continue;
                const tgt = m.target instanceof HTMLElement ? m.target : null;
                if (tgt?.closest?.(".abt-block")) continue;
                if (tgt?.closest?.(".abt-notes-split")) continue;
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement) || node.closest?.(".abt-block") || node.closest?.(".abt-notes-split")) continue;
                    if (node.classList.contains("mes")) { schedule(node); continue; }
                    const mes = node.closest?.(".mes") || tgt?.closest?.(".mes");
                    if (mes && (node.classList.contains("mes_text") || tgt?.classList.contains("mes_text") || node.querySelector?.(".mes_text"))) schedule(mes);
                }
            }
        }).observe(chat, { childList:true, subtree:true });
    }

    // Initial process — single pass, no duplicates
    document.querySelectorAll(".mes").forEach(node => {
        const id = Number(node.getAttribute("mesid"));
        if (!isNaN(id)) abtProcess(node, id);
    });

    // Single delayed reprocess for mobile (reduced from two)
    setTimeout(abtReprocessAll, 800);

    abtInject();
    console.log("[Abattoir] loaded (performance rewrite)");
});
