// Abattoir Extension — companion to the Abattoir preset
// No ES module imports. Uses SillyTavern.getContext() global only.
// Architecture mirrors SillyTavern-Infoboard by KanonMama.

const ABT_INJECTION_ID = "Abattoir_Prefs";

// ── localStorage keys ─────────────────────────────────────────────────────────

const ABT = {
    enabled:   "ABT_enabled",
    evtOn:     "ABT_evtOn",
    evtFreq:   "ABT_evtFreq",
    evtTypes:  "ABT_evtTypes",
    ibStyle:   "ABT_ibStyle",
    ibShow:    "ABT_ibShow",
    violence:  "ABT_violence",
    content:   "ABT_content",
};

// ── Settings ──────────────────────────────────────────────────────────────────

function abtLoad() {
    return {
        enabled:       localStorage.getItem(ABT.enabled) === "true",
        evtEnabled:    localStorage.getItem(ABT.evtOn)   === "true",
        evtFreq:       localStorage.getItem(ABT.evtFreq) || "occasional",
        evtTypes:      JSON.parse(localStorage.getItem(ABT.evtTypes) || "null") || { physicalHarm:true, death:false, bodyHorror:false, environmental:true, social:true, disease:false, propertyDamage:false, betrayal:true },
        ibStyle:       localStorage.getItem(ABT.ibStyle) || "standard",
        ibShow:        JSON.parse(localStorage.getItem(ABT.ibShow)   || "null") || { status:true, injuries:true, conditions:true, stats:false, inventory:false },
        violenceLevel: localStorage.getItem(ABT.violence)|| "moderate",
        content:       JSON.parse(localStorage.getItem(ABT.content)  || "null") || { psychologicalHorror:true, torture:false, suffering:true, dominanceSubmission:false, captivity:false, controlManipulation:false, romance:true, explicitSexual:false, monsterRomance:false, nonhumanEntities:false },
    };
}

function abtSave(s) {
    localStorage.setItem(ABT.enabled,  String(s.enabled));
    localStorage.setItem(ABT.evtOn,    String(s.evtEnabled));
    localStorage.setItem(ABT.evtFreq,  s.evtFreq);
    localStorage.setItem(ABT.evtTypes, JSON.stringify(s.evtTypes));
    localStorage.setItem(ABT.ibStyle,  s.ibStyle);
    localStorage.setItem(ABT.ibShow,   JSON.stringify(s.ibShow));
    localStorage.setItem(ABT.violence, s.violenceLevel);
    localStorage.setItem(ABT.content,  JSON.stringify(s.content));
}

// ── Prompt builder ────────────────────────────────────────────────────────────

const ABT_EVT_LABELS  = { physicalHarm:"Physical Harm", death:"Death", bodyHorror:"Body Horror", environmental:"Environmental Hazards", social:"Social / Political", disease:"Disease / Illness", propertyDamage:"Property Damage", betrayal:"Betrayal" };
const ABT_IB_FIELDS   = { status:"status", injuries:"injuries", conditions:"conditions", stats:"stats", inventory:"inventory" };
const ABT_CTX_LABELS  = { psychologicalHorror:"Psychological Horror", torture:"Torture", suffering:"Suffering / Despair", dominanceSubmission:"Dominance & Submission", captivity:"Captivity / Confinement", controlManipulation:"Control & Manipulation", romance:"Romance", explicitSexual:"Explicit Sexual Content", monsterRomance:"Monster Romance", nonhumanEntities:"Non-human Entities" };
const ABT_FREQ_LABELS = { rare:"Rare", occasional:"Occasional", frequent:"Frequent" };
const ABT_VIO_LABELS  = { mild:"Mild", moderate:"Moderate", graphic:"Graphic", extreme:"Extreme" };
const ABT_IB_LABELS   = { none:"None", minimal:"Minimal", standard:"Standard", detailed:"Detailed", fancy:"Fancy", clinical:"Clinical" };

function abtBuildPrompt(s) {
    if (!s.enabled) return "";
    const L = [];
    L.push("[Abattoir Extension — Active Preferences]");

    // Events
    if (s.evtEnabled) {
        const types = Object.entries(s.evtTypes).filter(([,v])=>v).map(([k])=>ABT_EVT_LABELS[k]||k);
        L.push("Random Events: ENABLED — Frequency: " + (ABT_FREQ_LABELS[s.evtFreq]||s.evtFreq));
        if (types.length) L.push("  Types: " + types.join(", "));
    } else {
        L.push("Random Events: DISABLED");
    }

    // Infoblocks
    if (s.ibStyle !== "none") {
        const fields = Object.entries(s.ibShow).filter(([,v])=>v).map(([k])=>ABT_IB_FIELDS[k]);
        L.push("");
        L.push("INFOBLOCK RULE — MANDATORY:");
        L.push("End EVERY response with this exact block. The XML tags are required. No exceptions.");
        L.push("");
        L.push("<infoblock>");
        for (const f of fields) L.push(f + ": [value]");
        L.push("</infoblock>");
        L.push("");
        L.push("Place after all prose and OOC. One concise line per field. Never skip.");
        L.push("Style: " + (ABT_IB_LABELS[s.ibStyle]||s.ibStyle));
    } else {
        L.push("Infoblocks: DISABLED — do NOT output <infoblock> tags.");
    }

    // Content
    const themes = Object.entries(s.content).filter(([,v])=>v).map(([k])=>ABT_CTX_LABELS[k]||k);
    L.push("");
    L.push("Violence Level: " + (ABT_VIO_LABELS[s.violenceLevel]||s.violenceLevel));
    if (themes.length) L.push("Enabled Themes: " + themes.join(", "));

    L.push("[/Abattoir Extension]");
    return L.join("\n");
}

// ── Infoblock parser ──────────────────────────────────────────────────────────

function abtParseInfoblock(text) {
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

// ── Infoblock renderer ────────────────────────────────────────────────────────

const ABT_THEMES = {
    minimal:  { wrap:"margin:10px 0;padding:8px 12px;background:var(--SmartThemeBlurTintColor,rgba(12,8,10,0.9));border-left:2px solid rgba(150,50,50,0.4);font-family:monospace;font-size:0.78em;color:var(--SmartThemeBodyColor,rgba(255,255,255,0.65));line-height:1.7;", label:null, key:"color:rgba(180,80,80,0.7);margin-right:6px;", val:"" },
    standard: { wrap:"margin:12px 0;padding:10px 16px;background:var(--SmartThemeBlurTintColor,rgba(12,8,10,0.95));border:0.5px solid var(--SmartThemeBorderColor,rgba(100,45,45,0.3));border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,0.4);font-family:'Courier New',monospace;font-size:0.8em;color:var(--SmartThemeBodyColor,rgba(255,255,255,0.7));line-height:1.8;", label:"display:block;font-size:0.65em;letter-spacing:3px;text-transform:uppercase;color:rgba(180,80,80,0.6);margin-bottom:6px;font-family:sans-serif;", key:"color:rgba(200,100,100,0.7);margin-right:8px;font-weight:600;", val:"" },
    detailed: { wrap:"margin:14px 0;padding:14px 18px;background:var(--SmartThemeBlurTintColor,rgba(10,6,8,0.97));border:0.5px solid var(--SmartThemeBorderColor,rgba(120,50,50,0.35));border-top:1px solid rgba(160,60,60,0.4);border-radius:4px;box-shadow:0 3px 14px rgba(0,0,0,0.5);font-family:'Courier New',monospace;font-size:0.82em;color:var(--SmartThemeBodyColor,rgba(255,255,255,0.75));line-height:1.9;", label:"display:block;font-size:0.7em;letter-spacing:3px;text-transform:uppercase;color:rgba(190,90,90,0.7);margin-bottom:8px;font-family:sans-serif;border-bottom:0.5px solid rgba(120,50,50,0.2);padding-bottom:4px;", key:"color:rgba(200,100,100,0.75);margin-right:8px;font-weight:600;min-width:80px;display:inline-block;", val:"" },
    fancy:    { wrap:"margin:16px 0;padding:14px 18px;background:linear-gradient(135deg,rgba(15,8,10,0.97) 0%,rgba(20,10,14,0.95) 100%);border:0.5px solid rgba(160,60,80,0.25);border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,0.6),inset 0 0 40px rgba(100,20,30,0.05);font-family:'Palatino Linotype',Georgia,serif;font-size:0.82em;color:rgba(220,200,210,0.8);line-height:1.9;", label:"display:block;font-size:0.65em;letter-spacing:4px;text-transform:uppercase;color:rgba(200,100,110,0.6);margin-bottom:8px;font-family:sans-serif;", key:"color:rgba(210,130,140,0.7);margin-right:8px;font-style:italic;", val:"font-style:italic;" },
    clinical: { wrap:"margin:10px 0;padding:10px 14px;background:rgba(8,12,14,0.97);border:1px solid rgba(60,120,140,0.2);border-radius:2px;font-family:'Courier New',monospace;font-size:0.78em;color:rgba(140,190,200,0.75);line-height:1.75;", label:"display:block;font-size:0.65em;letter-spacing:3px;text-transform:uppercase;color:rgba(80,160,180,0.5);margin-bottom:5px;font-family:sans-serif;", key:"color:rgba(80,160,180,0.6);margin-right:8px;", val:"" },
};

function abtEsc(s) { return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function abtRender(fields, style) {
    const t = ABT_THEMES[style] || ABT_THEMES.standard;
    const rows = Object.entries(fields).map(([k,v]) =>
        `<div style="margin:3px 0"><span style="${t.key}">${abtEsc(k)}:</span><span style="${t.val}">${abtEsc(v)}</span></div>`
    ).join("");
    const lbl = t.label ? `<span style="${t.label}">꒰ᐢ. .ᐢ꒱ status</span>` : "";
    return `<div class="abt-block" style="${t.wrap}">${lbl}${rows}</div>`;
}

// ── Core functions ────────────────────────────────────────────────────────────

function abtInject() {
    try {
        const ctx = SillyTavern.getContext();
        const s   = abtLoad();
        ctx.setExtensionPrompt(ABT_INJECTION_ID, abtBuildPrompt(s), 1, 0);
    } catch(e) { console.error("[Abattoir] inject failed:", e); }
}

function abtProcess(msgDiv, msgIndex) {
    try {
        const s   = abtLoad();
        if (!s.enabled) return;

        const ctx = SillyTavern.getContext();
        const msg = ctx.chat[msgIndex];
        if (!msg || msg.is_user) return;

        const fields = abtParseInfoblock(msg.mes || "");
        if (!fields) return;

        const mesTextEl = msgDiv.querySelector(".mes_text");
        if (!mesTextEl) return;

        // Remove old card
        mesTextEl.querySelectorAll(".abt-block").forEach(el => el.remove());

        // Strip raw XML from visible text
        mesTextEl.innerHTML = mesTextEl.innerHTML
            .replace(/&lt;infoblock&gt;[\s\S]*?&lt;\/infoblock&gt;/gi, "")
            .replace(/<infoblock>[\s\S]*?<\/infoblock>/gi, "")
            .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>")
            .replace(/<p>\s*<\/p>/gi, "");

        // Append rendered card
        const wrap = document.createElement("div");
        wrap.innerHTML = abtRender(fields, s.ibStyle);
        const card = wrap.firstElementChild;
        if (card) mesTextEl.appendChild(card);
    } catch(e) { console.error("[Abattoir] process failed:", e); }
}

function abtReprocessAll() {
    document.querySelectorAll(".mes").forEach(node => {
        const id = Number(node.getAttribute("mesid"));
        if (!isNaN(id)) abtProcess(node, id);
    });
}

// ── Settings HTML ─────────────────────────────────────────────────────────────

const ABT_HTML = `
<div id="abt-panel" class="abattoir-panel">
  <div class="abattoir-header">
    <span class="abattoir-title">꒰ᐢ. .ᐢ꒱ Abattoir</span>
    <label class="abattoir-toggle">
      <input type="checkbox" id="abt-enabled">
      <span class="abattoir-slider"></span>
    </label>
  </div>
  <div id="abt-body">
    <details class="abattoir-section" open>
      <summary class="abattoir-section-title">
        Random Bad Events
        <label class="abattoir-inline-toggle">
          <input type="checkbox" id="abt-evt-on">
          <span class="abattoir-slider abattoir-slider-sm"></span>
        </label>
      </summary>
      <div id="abt-evt-opts" class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label">Frequency</label>
          <select id="abt-evt-freq" class="abattoir-select">
            <option value="rare">Rare</option>
            <option value="occasional">Occasional</option>
            <option value="frequent">Frequent</option>
          </select>
        </div>
        <div class="abattoir-sub-label">Event Types</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-physicalHarm"><span>Physical Harm</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-death"><span>Death</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-bodyHorror"><span>Body Horror</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-environmental"><span>Environmental</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-social"><span>Social / Political</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-disease"><span>Disease / Illness</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-betrayal"><span>Betrayal</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-et-propertyDamage"><span>Property Damage</span></label>
        </div>
      </div>
    </details>

    <details class="abattoir-section">
      <summary class="abattoir-section-title">Infoblock Style</summary>
      <div class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label">Style</label>
          <select id="abt-ib-style" class="abattoir-select">
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
            <option value="fancy">Fancy</option>
            <option value="clinical">Clinical</option>
          </select>
        </div>
        <div id="abt-ib-fields">
          <div class="abattoir-sub-label">Include in Infoblocks</div>
          <div class="abattoir-checkbox-grid">
            <label class="abattoir-check-label"><input type="checkbox" id="abt-ib-status"><span>Status Effects</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abt-ib-injuries"><span>Injuries</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abt-ib-conditions"><span>Conditions</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abt-ib-stats"><span>Stats</span></label>
            <label class="abattoir-check-label"><input type="checkbox" id="abt-ib-inventory"><span>Inventory</span></label>
          </div>
        </div>
      </div>
    </details>

    <details class="abattoir-section">
      <summary class="abattoir-section-title">Content Preferences</summary>
      <div class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label">Violence</label>
          <select id="abt-violence" class="abattoir-select">
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="graphic">Graphic</option>
            <option value="extreme">Extreme</option>
          </select>
        </div>
        <div class="abattoir-sub-label">Dark Themes</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-psychologicalHorror"><span>Psych. Horror</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-torture"><span>Torture</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-suffering"><span>Suffering</span></label>
        </div>
        <div class="abattoir-sub-label">Power Dynamics</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-dominanceSubmission"><span>Dom / Sub</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-captivity"><span>Captivity</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-controlManipulation"><span>Control &amp; Manip.</span></label>
        </div>
        <div class="abattoir-sub-label">Intimacy</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-romance"><span>Romance</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-explicitSexual"><span>Explicit Sexual</span></label>
        </div>
        <div class="abattoir-sub-label">Creature &amp; Monster</div>
        <div class="abattoir-checkbox-grid">
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-monsterRomance"><span>Monster Romance</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-nonhumanEntities"><span>Non-human Entities</span></label>
        </div>
      </div>
    </details>
  </div>
</div>`;

// ── Init ──────────────────────────────────────────────────────────────────────

jQuery(async () => {
    const ctx = SillyTavern.getContext();

    $("#extensions_settings").append(ABT_HTML);

    // Restore UI state from localStorage
    const s = abtLoad();
    $("#abt-enabled").prop("checked", s.enabled);
    $("#abt-body").toggleClass("abattoir-disabled", !s.enabled);
    $("#abt-evt-on").prop("checked", s.evtEnabled);
    $("#abt-evt-opts").toggleClass("abattoir-hidden", !s.evtEnabled);
    $("#abt-evt-freq").val(s.evtFreq);
    for (const k of Object.keys(s.evtTypes))  $(`#abt-et-${k}`).prop("checked", s.evtTypes[k]);
    $("#abt-ib-style").val(s.ibStyle);
    $("#abt-ib-fields").toggleClass("abattoir-hidden", s.ibStyle === "none");
    for (const k of Object.keys(s.ibShow))    $(`#abt-ib-${k}`).prop("checked", s.ibShow[k]);
    $("#abt-violence").val(s.violenceLevel);
    for (const k of Object.keys(s.content))   $(`#abt-c-${k}`).prop("checked", s.content[k]);

    // Single change handler for all inputs
    $("#abt-panel").on("change", "input, select", function() {
        const cur = abtLoad();
        cur.enabled       = $("#abt-enabled").is(":checked");
        cur.evtEnabled    = $("#abt-evt-on").is(":checked");
        cur.evtFreq       = $("#abt-evt-freq").val();
        cur.ibStyle       = $("#abt-ib-style").val();
        cur.violenceLevel = $("#abt-violence").val();
        for (const k of Object.keys(cur.evtTypes)) cur.evtTypes[k] = $(`#abt-et-${k}`).is(":checked");
        for (const k of Object.keys(cur.ibShow))   cur.ibShow[k]   = $(`#abt-ib-${k}`).is(":checked");
        for (const k of Object.keys(cur.content))  cur.content[k]  = $(`#abt-c-${k}`).is(":checked");
        abtSave(cur);
        $("#abt-body").toggleClass("abattoir-disabled", !cur.enabled);
        $("#abt-evt-opts").toggleClass("abattoir-hidden", !cur.evtEnabled);
        $("#abt-ib-fields").toggleClass("abattoir-hidden", cur.ibStyle === "none");
        abtInject();
        abtReprocessAll();
    });

    // Events
    if (ctx.eventTypes?.GENERATION_STARTED)  ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED,  abtInject);
    if (ctx.eventTypes?.CHAT_CHANGED)        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => setTimeout(abtReprocessAll, 150));
    if (ctx.eventTypes?.MESSAGE_RECEIVED)    ctx.eventSource.on(ctx.eventTypes.MESSAGE_RECEIVED,  idx => setTimeout(() => { const el = document.querySelector(`.mes[mesid="${idx}"]`); if (el) abtProcess(el, idx); }, 150));
    if (ctx.eventTypes?.MESSAGE_EDITED)      ctx.eventSource.on(ctx.eventTypes.MESSAGE_EDITED,    idx => setTimeout(() => { const el = document.querySelector(`.mes[mesid="${idx}"]`); if (el) abtProcess(el, idx); }, 300));
    if (ctx.eventTypes?.MESSAGE_SWIPED)      ctx.eventSource.on(ctx.eventTypes.MESSAGE_SWIPED,    idx => setTimeout(() => { const el = document.querySelector(`.mes[mesid="${idx}"]`); if (el) abtProcess(el, idx); }, 150));

    // MutationObserver for streaming
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
            for (const m of muts) {
                if (m.type !== "childList") continue;
                const tgt = m.target instanceof HTMLElement ? m.target : null;
                if (tgt?.closest?.(".abt-block")) continue;
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement) || node.closest?.(".abt-block")) continue;
                    if (node.classList.contains("mes")) { schedule(node); continue; }
                    const mes = node.closest?.(".mes") || tgt?.closest?.(".mes");
                    if (mes && (node.classList.contains("mes_text") || tgt?.classList.contains("mes_text") || node.querySelector?.(".mes_text"))) schedule(mes);
                }
            }
        }).observe(chat, { childList:true, subtree:true });
    }

    // Process existing messages
    document.querySelectorAll(".mes").forEach(node => {
        const id = Number(node.getAttribute("mesid"));
        if (!isNaN(id)) abtProcess(node, id);
    });

    abtInject();
    console.log("[Abattoir] loaded");
});
