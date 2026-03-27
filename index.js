S// Abattoir Extension — companion to the Abattoir preset
// No ES module imports. SillyTavern.getContext() global only.

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

// ── Settings ──────────────────────────────────────────────────────────────────
function abtLoad() {
    return {
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
    L.push("dignity: [what remains · what is gone]");
    L.push("location: [specific place]");
    L.push("weather: [sky · temp · wind]");
    L.push("bundles: [active bundle names or none]");
    if (s.ibChars) L.push('characters: [{"name":"...","attire":"...","mood":"...","thought":"..."}] for each NPC present');
    L.push("char_affection: [int -100 to 100, delta:±N]");
    L.push("char_fear: [int -100 to 100, delta:±N]");
    L.push("char_obsession: [int 0 to 100, delta:±N]");
    L.push("char_trust: [int -100 to 100, delta:±N]");
    if (s.ibLust) L.push("char_lust: [int 0 to 100, delta:±N]");
    L.push("</infoblock>");
    L.push("");
    L.push("Use char_* prefixes exactly. Track only the character's feelings toward {{user}}.");

    const themes = Object.entries(s.content).filter(([,v])=>v).map(([k])=>ABT_CTX_LABELS[k]||k);
    L.push("");
    L.push("Violence Level: " + (ABT_VIO_LABELS[s.violenceLevel]||s.violenceLevel));
    if (themes.length) L.push("Enabled Themes: " + themes.join(", "));

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
        // Handle both raw JSON and text fallback
        const jsonMatch = val.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch(e) {}
    return [];
}

// ── Phase config ──────────────────────────────────────────────────────────────
const PHASE_CFG = {
    ERASURE: { color:"#8b0000", glow:"rgba(139,0,0,0.6)",    sigil:"⛧",  sub:"unmapping you"           },
    BRAND:   { color:"#7a1a1a", glow:"rgba(122,26,26,0.5)",  sigil:"☉",  sub:"naming you a thing"       },
    SCORN:   { color:"#7a3030", glow:"rgba(122,48,48,0.45)", sigil:"✕",   sub:"contempt is personal"     },
    NOTHING: { color:"#555",    glow:"rgba(100,100,100,0.3)",sigil:"·",   sub:"you don't register"       },
    TEETH:   { color:"#8b6914", glow:"rgba(139,105,20,0.45)",sigil:"⚔",  sub:"assessment begins"        },
    GRIP:    { color:"#5c2e8b", glow:"rgba(92,46,139,0.5)",  sigil:"♆",  sub:"pattern locked"           },
    CRACK:   { color:"#1a5c8b", glow:"rgba(26,92,139,0.45)", sigil:"⚡",  sub:"something broke"          },
    TANGLE:  { color:"#8b2e5c", glow:"rgba(139,46,92,0.55)", sigil:"∞",   sub:"mutual damage"            },
};

const CONDITION_COLORS = {
    intact:"#4a7a4a", marked:"#8b8b20", injured:"#8b4a20", critical:"#8b2020", dying:"#6b0000", dead:"#333"
};
const INTENSITY_COLORS = {
    ember:"#8b5a20", fever:"#8b7020", wildfire:"#8b2a10", ash:"#5a5a6a", terminal:"#6b0010"
};

// ── Ritual pentagram chart ──────────────────────────────────────────────────
// Pentagram with 5 axes: Affection(top), Fear(top-right), Obsession(bottom-right), Trust(bottom-left), Lust(top-left if enabled)
// Only char metrics shown — user tracking removed
function abtRenderChart(fields, showLust) {
    const W=340, H=340, cx=170, cy=168, r=85;
    const outerR=r+22, innerR=r+12;

    function pm(val) {
        if (!val) return {value:0,delta:0};
        const n=String(val).match(/-?\d+/), d=String(val).match(/delta:\s*([+-]?\d+)/i);
        return {value:n?Math.max(-100,Math.min(100,parseInt(n[0]))):0, delta:d?parseInt(d[1]):0};
    }
    const MIN=0.09;
    function nd(v){const n=v/100;return n>=0?Math.max(MIN,n):Math.min(-MIN,n);}
    function nu(v){return Math.max(MIN,v/100);}

    const cAff=pm(fields.char_affection||fields.affection);
    const cFear=pm(fields.char_fear||fields.fear);
    const cObs=pm(fields.char_obsession||fields.obsession);
    const cTru=pm(fields.char_trust||fields.trust);
    const cLust=showLust?pm(fields.char_lust||fields.lust):null;

    // Pentagram: 5 axes evenly spaced at 72° intervals
    // If no lust: 4 axes as diamond (0,90,180,270)
    const axes = showLust ? [
        {deg:270, name:"AFF",  m:cAff,  bidir:true},
        {deg:342, name:"FEAR", m:cFear, bidir:true},
        {deg:54,  name:"OBS",  m:cObs,  bidir:false},
        {deg:126, name:"TRST", m:cTru,  bidir:true},
        {deg:198, name:"LUST", m:cLust, bidir:false},
    ] : [
        {deg:0,   name:"AFF",  m:cAff,  bidir:true},
        {deg:90,  name:"FEAR", m:cFear, bidir:true},
        {deg:180, name:"OBS",  m:cObs,  bidir:false},
        {deg:270, name:"TRST", m:cTru,  bidir:true},
    ];
    const N=axes.length;

    function toRad(deg){return (deg-90)*Math.PI/180;}
    function ptAt(deg,dist){const rad=toRad(deg);return {x:cx+dist*Math.cos(rad),y:cy+dist*Math.sin(rad)};}

    // Data shape points
    const dataPts = axes.map(a=>{
        const norm = a.bidir ? nd(a.m.value) : nu(a.m.value);
        return ptAt(a.deg, r*norm);
    });

    // Color based on dominant emotion
    const cIsHate=cAff.value<-20;
    const cStroke=cIsHate?"rgba(215,58,58,0.88)":cAff.value>40?"rgba(185,98,160,0.78)":"rgba(135,88,155,0.68)";
    const cFill=cIsHate?"rgba(155,22,22,0.22)":cAff.value>40?"rgba(145,68,118,0.18)":"rgba(88,58,108,0.15)";

    // Grid shapes (polygon at 33%, 66%, 100%)
    function gridPoly(f){
        const rr=r*f;
        return axes.map(a=>ptAt(a.deg,rr)).map((p,i)=>((i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1))).join("")+"Z";
    }

    // Pentagram star (connect every-other vertex for 5 axes, or X for 4)
    let starLines="";
    if(N===5){
        const sp=axes.map(a=>ptAt(a.deg,outerR-4));
        starLines=[0,1,2,3,4].map(i=>{
            const j=(i+2)%5;
            return `<line x1="${sp[i].x.toFixed(1)}" y1="${sp[i].y.toFixed(1)}" x2="${sp[j].x.toFixed(1)}" y2="${sp[j].y.toFixed(1)}" stroke="rgba(175,48,48,0.18)" stroke-width="0.6"/>`;
        }).join("");
    } else {
        // Diamond cross-lines
        starLines=`
            <line x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${cy+r}" stroke="rgba(175,48,48,0.18)" stroke-width="0.5"/>
            <line x1="${cx-r}" y1="${cy}" x2="${cx+r}" y2="${cy}" stroke="rgba(175,48,48,0.18)" stroke-width="0.5"/>
            <line x1="${(cx-r*0.707).toFixed(1)}" y1="${(cy-r*0.707).toFixed(1)}" x2="${(cx+r*0.707).toFixed(1)}" y2="${(cy+r*0.707).toFixed(1)}" stroke="rgba(175,48,48,0.1)" stroke-width="0.5"/>
            <line x1="${(cx+r*0.707).toFixed(1)}" y1="${(cy-r*0.707).toFixed(1)}" x2="${(cx-r*0.707).toFixed(1)}" y2="${(cy+r*0.707).toFixed(1)}" stroke="rgba(175,48,48,0.1)" stroke-width="0.5"/>`;
    }

    // Axis lines from center to outer ring
    const axisLines=axes.map(a=>{
        const p=ptAt(a.deg,outerR);
        return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(175,48,48,0.15)" stroke-width="0.5" stroke-dasharray="2 3"/>`;
    }).join("");

    // Outer ring ticks (24 evenly spaced)
    const ticks=Array.from({length:24},(_,i)=>{
        const deg=i*15, rad=toRad(deg);
        const isMajor=axes.some(a=>Math.abs(((a.deg-deg+360)%360))<3);
        const r1=outerR+(isMajor?0:-1),r2=outerR+(isMajor?8:3);
        const x1=cx+r1*Math.cos(rad),y1=cy+r1*Math.sin(rad);
        const x2=cx+r2*Math.cos(rad),y2=cy+r2*Math.sin(rad);
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${isMajor?"rgba(205,62,62,0.6)":"rgba(178,52,52,0.25)"}" stroke-width="${isMajor?"1":"0.5"}"/>`;
    }).join("");

    // Sigils at 8 compass points
    const sigilDeg=[0,45,90,135,180,225,270,315];
    const sigilG=["⛧","◬","☉","◬","⛧","◬","♆","◬"];
    const sigilS=[10,5,8,5,10,5,8,5];
    const sigils=sigilDeg.map((d,i)=>{
        const p=ptAt(d,outerR+14);
        return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="rgba(200,58,58,${i%2===0?"0.45":"0.18"})" font-size="${sigilS[i]}" font-family="serif">${sigilG[i]}</text>`;
    }).join("");

    // Lust orbit at center
    const lustSVG=cLust?(()=>{
        const lR=15,lAng=(cLust.value/100)*360-90;
        const lx=cx+lR*Math.cos(lAng*Math.PI/180),ly=cy+lR*Math.sin(lAng*Math.PI/180);
        const op=(0.3+(cLust.value/100)*0.62).toFixed(2);
        return `<circle cx="${cx}" cy="${cy}" r="${lR}" fill="none" stroke="rgba(188,78,118,0.22)" stroke-width="0.5" stroke-dasharray="2 2"/>
        <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.5" fill="rgba(218,88,138,${op})"/>`;
    })():"";

    // Phase label inside circle
    const phase=(fields.phase||"NOTHING").toUpperCase().replace(/[^A-Z]/g,"");
    const phColors={ERASURE:"rgba(205,42,42,0.62)",BRAND:"rgba(175,42,42,0.52)",SCORN:"rgba(155,58,58,0.52)",NOTHING:"rgba(125,105,125,0.48)",TEETH:"rgba(165,135,52,0.52)",GRIP:"rgba(125,62,175,0.58)",CRACK:"rgba(52,115,165,0.52)",TANGLE:"rgba(165,58,115,0.58)"};
    const phColor=phColors[phase]||"rgba(125,105,125,0.48)";

    // Axis labels with values — positioned well outside the ring
    const axisLabels = axes.map(a=>{
        const labelR=outerR+32;
        const p=ptAt(a.deg, labelR);
        const cSign=a.bidir&&a.m.value>0?"+":"";
        const cColor=a.bidir?(a.m.value<-40?"rgba(228,82,82,1)":a.m.value<0?"rgba(208,118,118,0.95)":a.m.value>40?"rgba(102,218,142,0.95)":"rgba(188,168,188,0.85)"):(a.m.value>50?"rgba(188,118,238,1)":"rgba(168,138,208,0.9)");
        const dStr=a.m.delta!==0?(a.m.delta>0?`+${a.m.delta}`:`${a.m.delta}`):"";
        const dColor=a.m.delta>0?"rgba(92,185,102,0.85)":"rgba(185,78,78,0.85)";

        // Smart anchoring based on position
        let anchor="middle", dx=0, dy=0;
        const normDeg=(a.deg+360)%360;
        if(normDeg>45&&normDeg<135){anchor="start";dx=4;}
        else if(normDeg>225&&normDeg<315){anchor="end";dx=-4;}
        if(normDeg<45||normDeg>315){dy=-6;}
        else if(normDeg>135&&normDeg<225){dy=8;}

        const nx=p.x+dx, ny=p.y+dy;
        return `<text x="${nx.toFixed(1)}" y="${(ny-6).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="rgba(225,182,195,0.65)" font-size="7.5" font-family="sans-serif" letter-spacing="1.8">${a.name}</text>
        <text x="${nx.toFixed(1)}" y="${(ny+7).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${cColor}" font-size="12" font-family="monospace" font-weight="700">${cSign}${a.m.value}${dStr?` <tspan fill="${dColor}" font-size="9">${dStr}</tspan>`:""}</text>`;
    }).join("");

    // Data shape path
    const dataPath=dataPts.map((p,i)=>((i===0?"M":"L")+p.x.toFixed(1)+","+p.y.toFixed(1))).join("")+"Z";

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;height:auto;display:block;margin:0 auto;">
        <defs><filter id="ag"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>

        <!-- Outer rings -->
        <circle cx="${cx}" cy="${cy}" r="${outerR+3}" fill="none" stroke="rgba(162,42,42,0.08)" stroke-width="0.5"/>
        <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="rgba(178,48,48,0.28)" stroke-width="0.7"/>

        <!-- Pentagram star -->
        ${starLines}

        <!-- Tick marks -->
        ${ticks}

        <!-- Sigils -->
        ${sigils}

        <!-- Inner ring -->
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="rgba(172,48,48,0.18)" stroke-width="0.5"/>

        <!-- Grid polygons -->
        <path d="${gridPoly(0.33)}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
        <path d="${gridPoly(0.66)}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
        <path d="${gridPoly(1)}"    fill="none" stroke="rgba(178,48,48,0.25)"   stroke-width="0.7"/>

        <!-- Axis lines -->
        ${axisLines}

        <!-- Center -->
        <circle cx="${cx}" cy="${cy}" r="2" fill="rgba(188,52,52,0.5)"/>
        ${lustSVG}

        <!-- Data shape -->
        <path d="${dataPath}" fill="${cFill}" stroke="${cStroke}" stroke-width="1.4" filter="url(#ag)"/>
        ${dataPts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${cStroke}" opacity="0.94"/>`).join("")}

        <!-- Phase inside circle -->
        <text x="${cx}" y="${cy+r-12}" text-anchor="middle" dominant-baseline="middle" fill="${phColor}" font-size="8" font-family="sans-serif" letter-spacing="3">${phase}</text>

        <!-- Axis labels with values -->
        ${axisLabels}
    </svg>`;
}

// ── Vertical metric bars ─────────────────────────────────────────────────────
function abtVertBars(fields, showLust) {
    function pm(val){
        if(!val)return{value:0,delta:0};
        const n=String(val).match(/-?\d+/),d=String(val).match(/delta:\s*([+-]?\d+)/i);
        return{value:n?Math.max(-100,Math.min(100,parseInt(n[0]))):0,delta:d?parseInt(d[1]):0};
    }

    const cAff=pm(fields.char_affection||fields.affection);
    const cFear=pm(fields.char_fear||fields.fear);
    const cObs=pm(fields.char_obsession||fields.obsession);
    const cTru=pm(fields.char_trust||fields.trust);
    const cLust=showLust?pm(fields.char_lust||fields.lust):null;

    const rows=[
        {icon:"♡", label:"AFF",  bidir:true,  c:cAff},
        {icon:"△", label:"FEAR", bidir:true,  c:cFear},
        {icon:"⚸", label:"OBS",  bidir:false, c:cObs},
        {icon:"☿", label:"TRST", bidir:true,  c:cTru},
    ];
    if(cLust) rows.push({icon:"☽", label:"LUST", bidir:false, c:cLust});

    function barColor(v,bidir){
        if(!bidir)return v>60?"#b060d8":v>30?"#8040a0":"#503070";
        if(v<-60)return"#c03030";
        if(v<-20)return"#a04444";
        if(v>60)return"#3a9a6a";
        if(v>20)return"#4a7a5a";
        return"#555566";
    }

    const colsHtml = rows.map(row=>{
        const v=row.c.value, d=row.c.delta;
        const col=barColor(v,row.bidir);
        const dStr=d!==0?(d>0?`+${d}`:`${d}`):"";
        const dColor=d>0?"rgba(92,185,102,0.85)":d<0?"rgba(185,78,78,0.85)":"transparent";
        const sign=row.bidir&&v>0?"+":"";
        const glowCol=col+"88";

        let fillHtml="";
        if(row.bidir){
            const pct=(Math.abs(v)/100*50).toFixed(1);
            const isNeg=v<0;
            fillHtml=`<div style="position:absolute;left:0;right:0;${isNeg?`top:50%;border-radius:0 0 4px 4px`:`bottom:50%;border-radius:4px 4px 0 0`};height:${pct}%;background:${col};box-shadow:0 0 7px ${glowCol};"></div><div style="position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,0.15);"></div>`;
        } else {
            const pct=Math.max(2,v).toFixed(1);
            fillHtml=`<div style="position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:${col};border-radius:4px;box-shadow:0 0 7px ${glowCol};"></div>`;
        }

        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:0;">
            <div style="font-size:0.82em;font-family:monospace;font-weight:700;color:${col};text-shadow:0 0 8px ${glowCol};line-height:1.2;">${sign}${v}</div>
            <div style="font-size:0.62em;min-height:13px;color:${dStr?dColor:"transparent"};line-height:1;">${dStr||""}</div>
            <div style="position:relative;width:10px;height:60px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;">${fillHtml}</div>
            <div style="font-size:0.82em;color:rgba(225,182,195,0.7);margin-top:3px;line-height:1;">${row.icon}</div>
            <div style="font-size:0.54em;letter-spacing:1.5px;text-transform:uppercase;color:rgba(218,178,192,0.48);font-family:sans-serif;">${row.label}</div>
        </div>`;
    }).join("");

    return `<div style="display:flex;gap:4px;padding:8px 16px 12px;justify-content:space-around;">
        ${colsHtml}
    </div>`;
}

// ── Characters block ──────────────────────────────────────────────────────────
function abtRenderChars(charsVal) {
    const chars = parseChars(charsVal);
    if (!chars.length) return "";
    return `<div style="padding:8px 14px 12px;border-top:0.5px solid rgba(255,255,255,0.05);">
        <div style="font-size:0.58em;letter-spacing:3px;text-transform:uppercase;color:rgba(210,165,180,0.7);font-family:sans-serif;margin-bottom:8px;">▸ present</div>
        ${chars.map(c => `<div style="margin-bottom:7px;padding:7px 10px;background:rgba(255,255,255,0.025);border-left:1px solid rgba(180,50,50,0.3);border-radius:0 3px 3px 0;">
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px;">
                <span style="font-size:0.8em;font-weight:600;color:rgba(240,210,218,0.97);">${abtEsc(c.name||"")}</span>
                <span style="font-size:0.68em;color:rgba(205,170,178,0.88);font-style:italic;">${abtEsc(c.mood||"")}</span>
            </div>
            ${c.attire ? `<div style="font-size:0.7em;color:rgba(190,158,166,0.82);margin-bottom:3px;">${abtEsc(c.attire)}</div>` : ""}
            ${c.thought ? `<div style="font-size:0.72em;color:rgba(225,185,195,0.92);font-style:italic;border-top:0.5px solid rgba(255,255,255,0.05);padding-top:4px;line-height:1.55;">"${abtEsc(c.thought)}"</div>` : ""}
        </div>`).join("")}
    </div>`;
}

// ── Full card renderer ────────────────────────────────────────────────────────
function abtEsc(s) { return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function abtRenderCard(fields, s) {
    if (!s) s = abtLoad();
    if (!s.ibShow) return '<div class="abt-block" style="display:none"></div>';

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
    const bundles  = fields.bundles  && !/^none/i.test(fields.bundles)  ? fields.bundles  : null;

    return `<div class="abt-block" style="margin:14px 0;background:linear-gradient(160deg,rgba(8,5,7,0.99) 0%,rgba(13,8,11,0.97) 100%);border:0.5px solid rgba(150,45,45,0.18);border-top:1px solid ${pCfg.color}55;border-radius:6px;box-shadow:0 6px 28px rgba(0,0,0,0.65);overflow:hidden;font-family:inherit;">

        <!-- Header -->
        <div style="padding:9px 14px 9px;background:rgba(0,0,0,0.38);border-bottom:0.5px solid rgba(150,45,45,0.12);position:relative;overflow:hidden;">
            <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:2.8em;opacity:0.06;color:${pCfg.color};line-height:1;pointer-events:none;">${pCfg.sigil}</div>
            <!-- Intensity + condition chips — most important at top -->
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px;">
                ${intensity ? `<span style="font-size:0.62em;letter-spacing:2px;text-transform:uppercase;padding:3px 9px;border:0.5px solid ${iColor}88;border-radius:10px;color:${iColor};font-family:sans-serif;font-weight:600;text-shadow:0 0 10px ${iColor}66;">${abtEsc(fields.intensity)}</span>` : ""}
                <span style="font-size:0.62em;letter-spacing:2px;text-transform:uppercase;padding:3px 9px;border:0.5px solid ${cColor}88;border-radius:10px;color:${cColor};font-family:sans-serif;font-weight:600;text-shadow:0 0 10px ${cColor}55;">${abtEsc(condition)}</span>
            </div>
            <!-- Phase badge + subtitle -->
            <div style="font-size:0.5em;letter-spacing:3px;text-transform:uppercase;color:rgba(200,155,170,0.38);font-family:sans-serif;margin-bottom:4px;">☿ relationship phase</div>
            <div style="display:flex;align-items:baseline;gap:8px;">
                <span style="font-size:0.62em;letter-spacing:4px;text-transform:uppercase;padding:2px 8px;border:0.5px solid ${pCfg.color}55;border-radius:3px;color:${pCfg.color};font-family:sans-serif;text-shadow:0 0 10px ${pCfg.glow},0 0 22px ${pCfg.glow};">${phase}</span>
                <span style="font-size:0.68em;color:rgba(222,188,200,0.78);font-style:italic;text-shadow:0 0 12px rgba(180,80,100,0.3);">${pCfg.sub}</span>
            </div>
        </div>

        <!-- World state -->
        ${s.ibWorld && (location||weather) ? `<div style="padding:5px 14px;border-bottom:0.5px solid rgba(255,255,255,0.04);display:flex;gap:12px;flex-wrap:wrap;">
            ${location ? `<span style="font-size:0.71em;color:rgba(215,185,195,0.9);font-style:italic;">◬ ${abtEsc(location)}</span>` : ""}
            ${weather  ? `<span style="font-size:0.71em;color:rgba(210,180,190,0.82);font-style:italic;">☽ ${abtEsc(weather)}</span>` : ""}
        </div>` : ""}

        <!-- Chart full-width, then horizontal bars below -->
        ${s.ibChart ? `<div style="padding:6px 0 0;">${abtRenderChart(fields, s.ibLust)}</div>` : ""}
        ${abtVertBars(fields, s.ibLust)}

        <!-- Injuries + Dignity -->
        ${s.ibInjuries && (injuries||dignity) ? `<div style="padding:0 14px 10px;border-top:0.5px solid rgba(255,255,255,0.04);margin-top:2px;">
            ${injuries ? `<div style="margin-top:7px;font-size:0.73em;color:rgba(225,135,110,0.95);font-style:italic;text-shadow:0 0 10px rgba(200,80,50,0.4);">ᛉ ${abtEsc(injuries)}</div>` : ""}
            ${dignity  ? `<div style="margin-top:3px;font-size:0.71em;color:rgba(195,165,178,0.9);font-style:italic;">⚸ ${abtEsc(dignity)}</div>`  : ""}
        </div>` : ""}

        <!-- Active bundles -->
        ${s.ibBundles && bundles ? `<div style="padding:0 14px 9px;">
            <span style="font-size:0.6em;letter-spacing:2px;text-transform:uppercase;color:rgba(200,160,175,0.65);font-family:sans-serif;">bundles · </span>
            <span style="font-size:0.7em;color:rgba(205,160,175,0.85);font-style:italic;">${abtEsc(bundles)}</span>
        </div>` : ""}

        <!-- Characters -->
        ${s.ibChars && fields.characters ? abtRenderChars(fields.characters) : ""}

        <!-- Footer -->
        <div style="padding:3px 14px 4px;border-top:0.5px solid rgba(255,255,255,0.025);display:flex;justify-content:space-between;">
            <span style="font-size:0.52em;color:rgba(180,50,50,0.4);text-shadow:0 0 8px rgba(180,50,50,0.3);">⛧ · ☽ · ⛧</span>
            <span style="font-size:0.52em;color:rgba(200,155,170,0.3);letter-spacing:2px;">Λ𝔅Λ𝕋𝕋𝕆ℝ</span>
        </div>
    </div>`;
}

// ── Core ──────────────────────────────────────────────────────────────────────
function abtInject() {
    try {
        const ctx = SillyTavern.getContext();
        ctx.setExtensionPrompt(ABT_INJECTION_ID, abtBuildPrompt(abtLoad()), 1, 0);
    } catch(e) { console.error("[Abattoir] inject failed:", e); }
}

function abtProcess(msgDiv, msgIndex) {
    try {
        const s = abtLoad();
        if (!s.enabled) return;
        const ctx = SillyTavern.getContext();
        const msg = ctx.chat[msgIndex];
        if (!msg || msg.is_user) return;
        const fields = abtParse(msg.mes || "");
        if (!fields) return;
        const mesTextEl = msgDiv.querySelector(".mes_text");
        if (!mesTextEl) return;
        mesTextEl.querySelectorAll(".abt-block").forEach(el => el.remove());
        mesTextEl.innerHTML = mesTextEl.innerHTML
            .replace(/&lt;infoblock&gt;[\s\S]*?&lt;\/infoblock&gt;/gi, "")
            .replace(/<infoblock>[\s\S]*?<\/infoblock>/gi, "")
            .replace(/&lt;notes&gt;[\s\S]*?&lt;\/notes&gt;/gi, "")
            .replace(/<notes>[\s\S]*?<\/notes>/gi, "")
            .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>")
            .replace(/<p>\s*<\/p>/gi, "");
        const wrap = document.createElement("div");
        wrap.innerHTML = abtRenderCard(fields, s);
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
      <summary class="abattoir-section-title">Infoblock</summary>
      <div class="abattoir-section-body">
        <div class="abattoir-row">
          <label class="abattoir-label">Show Card</label>
          <select id="abt-ib-show" class="abattoir-select">
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div class="abattoir-row">
          <label class="abattoir-label">Ritual Chart</label>
          <select id="abt-ib-chart" class="abattoir-select">
            <option value="on">Show</option>
            <option value="off">Hide</option>
          </select>
        </div>
        <div class="abattoir-row">
          <label class="abattoir-label">Lust Metric</label>
          <select id="abt-ib-lust" class="abattoir-select">
            <option value="on">Show</option>
            <option value="off">Hide</option>
          </select>
        </div>
        <div class="abattoir-row">
          <label class="abattoir-label">World State</label>
          <select id="abt-ib-world" class="abattoir-select">
            <option value="on">Show</option>
            <option value="off">Hide</option>
          </select>
        </div>
        <div class="abattoir-row">
          <label class="abattoir-label">Characters</label>
          <select id="abt-ib-chars" class="abattoir-select">
            <option value="on">Show thoughts + attire</option>
            <option value="off">Hide</option>
          </select>
        </div>
        <div class="abattoir-row">
          <label class="abattoir-label">Injuries</label>
          <select id="abt-ib-injuries" class="abattoir-select">
            <option value="on">Show</option>
            <option value="off">Hide</option>
          </select>
        </div>
        <div class="abattoir-row">
          <label class="abattoir-label">Bundles</label>
          <select id="abt-ib-bundles" class="abattoir-select">
            <option value="on">Show</option>
            <option value="off">Hide</option>
          </select>
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
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-dominanceSubmission"><span>Dom / Sub</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-captivity"><span>Captivity</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-controlManipulation"><span>Control &amp; Manip.</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-romance"><span>Romance</span></label>
          <label class="abattoir-check-label"><input type="checkbox" id="abt-c-explicitSexual"><span>Explicit Sexual</span></label>
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

    const s = abtLoad();
    $("#abt-enabled").prop("checked", s.enabled);
    $("#abt-body").toggleClass("abattoir-disabled", !s.enabled);
    $("#abt-evt-on").prop("checked", s.evtEnabled);
    $("#abt-evt-opts").toggleClass("abattoir-hidden", !s.evtEnabled);
    $("#abt-evt-freq").val(s.evtFreq);
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

    $("#abt-panel").on("change", "input, select", function() {
        const cur = abtLoad();
        cur.enabled       = $("#abt-enabled").is(":checked");
        cur.evtEnabled    = $("#abt-evt-on").is(":checked");
        cur.evtFreq       = $("#abt-evt-freq").val();
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
        $("#abt-body").toggleClass("abattoir-disabled", !cur.enabled);
        $("#abt-evt-opts").toggleClass("abattoir-hidden", !cur.evtEnabled);
        abtInject();
        abtReprocessAll();
    });

    if (ctx.eventTypes?.GENERATION_STARTED)  ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED, abtInject);
    if (ctx.eventTypes?.CHAT_CHANGED)        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => setTimeout(abtReprocessAll, 150));
    if (ctx.eventTypes?.MESSAGE_RECEIVED)    ctx.eventSource.on(ctx.eventTypes.MESSAGE_RECEIVED,  idx => setTimeout(() => { const el = document.querySelector(`.mes[mesid="${idx}"]`); if (el) abtProcess(el, idx); }, 150));
    if (ctx.eventTypes?.MESSAGE_EDITED)      ctx.eventSource.on(ctx.eventTypes.MESSAGE_EDITED,    idx => setTimeout(() => { const el = document.querySelector(`.mes[mesid="${idx}"]`); if (el) abtProcess(el, idx); }, 300));
    if (ctx.eventTypes?.MESSAGE_SWIPED)      ctx.eventSource.on(ctx.eventTypes.MESSAGE_SWIPED,    idx => setTimeout(() => { const el = document.querySelector(`.mes[mesid="${idx}"]`); if (el) abtProcess(el, idx); }, 150));

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

    document.querySelectorAll(".mes").forEach(node => {
        const id = Number(node.getAttribute("mesid"));
        if (!isNaN(id)) abtProcess(node, id);
    });

    abtInject();
    console.log("[Abattoir] loaded");
});
