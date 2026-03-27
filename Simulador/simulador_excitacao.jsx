import { useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";

// ── Constantes ────────────────────────────────────────────────────────────────
const DT = 0.005;          // passo de integração (5 ms)
const T_SIM = 30;          // duração total (s)
const T_STEP = 2;          // instante do degrau (s)
const N = T_SIM / DT;
const DEC = 10;            // decimação → ~600 pontos no gráfico

// ── Tipos de máquina ──────────────────────────────────────────────────────────
const MAQUINAS = {
  hidraulico:  { label:"Hidráulico",        Tdo:8.0, Kag:1.05, desc:"Tdo'=8s, gerador hídrico" },
  vapor:       { label:"Turbo-Vapor",       Tdo:5.0, Kag:1.00, desc:"Tdo'=5s, ciclo Rankine"   },
  gas:         { label:"Turbo-Gás",         Tdo:6.0, Kag:1.02, desc:"Tdo'=6s, ciclo Brayton"   },
  compensador: { label:"Comp. Síncrono",    Tdo:7.5, Kag:1.00, desc:"Tdo'=7,5s, só reativo"    },
  diesel:      { label:"Gerador Diesel",    Tdo:4.5, Kag:0.98, desc:"Tdo'=4,5s, emergência"    },
};

// ── Auxiliares ────────────────────────────────────────────────────────────────
const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const safe = (v, eps=1e-6) => Math.abs(v) < eps ? eps : v;

function rk4(f, t, x, dt) {
  const k1 = f(t, x);
  const k2 = f(t+dt/2, x.map((v,i)=>v+dt/2*k1[i]));
  const k3 = f(t+dt/2, x.map((v,i)=>v+dt/2*k2[i]));
  const k4 = f(t+dt,   x.map((v,i)=>v+dt*k3[i]));
  return x.map((v,i)=>v+dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMULAÇÃO AVR — Estados: [xI, xD, xLL, xA, xIf]
// Modelo: PID → Lead-Lag → Amplificador → Campo (Tdo') → Vt
// Norma IEEE 421.5 (ST1A simplificado com PID)
// ══════════════════════════════════════════════════════════════════════════════
function simAVR({ KP,KI,KD,Tfd,TC,TB,KA,TA,VRmax,VRmin,Tdo,Kag,Vt0,dVref }) {
  const Efd0  = Vt0 / Kag;
  const KIs   = safe(KI); const TAs = safe(TA,1e-4);
  const TBs   = safe(TB,1e-4); const Tfds = safe(Tfd,1e-4);
  const useLL = TB > 1e-3;

  // Condição inicial em regime permanente
  const xI0  = Math.abs(KI) > 1e-6 ? Efd0/(KA*KIs) : 0;
  const xLL0 = Efd0 / KA;
  let x = [xI0, 0, xLL0, Efd0, Efd0];

  const out = [];
  for (let k = 0; k < N; k++) {
    const t    = k * DT;
    const Vref = Vt0 + (t >= T_STEP ? dVref : 0);

    if (k % DEC === 0) {
      const [,,, xa, xif] = x;
      const Vt  = Kag * xif;
      const Efd = clip(xa, VRmin, VRmax);
      out.push({ t:+t.toFixed(3), Vt:+Vt.toFixed(5), If:+xif.toFixed(5),
        Efd:+Efd.toFixed(5), Vref:+Vref.toFixed(4),
        erro:+((Vref-Vt)*100).toFixed(4) });
    }

    const deriv = (_t, xs) => {
      const [xi, xd, xll, xa, xif] = xs;
      const Vt   = Kag * xif;
      const e    = Vref - Vt;
      const uD   = KD * (e - xd) / Tfds;
      const uPID = KP*e + KI*xi + uD;
      const uLL  = useLL ? (TC/TBs)*uPID + (1-TC/TBs)*xll : uPID;
      const Efd  = clip(xa, VRmin, VRmax);
      return [
        e,
        (e - xd) / Tfds,
        useLL ? (uPID - xll)/TBs : 0,
        (KA*uLL - xa) / TAs,
        (Efd - xif) / Tdo,
      ];
    };
    x = rk4(deriv, t, x, DT);
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMULAÇÃO FCR — Estados: [xI, xA, xIf]
// Modelo: PI → Amplificador → Campo (Tdo')
// ══════════════════════════════════════════════════════════════════════════════
function simFCR({ KP,KI,TA,VRmax,VRmin,Tdo,Kag,If0,dIf }) {
  const TAs = safe(TA, 1e-4);
  let x = [0, If0, If0];
  const out = [];

  for (let k = 0; k < N; k++) {
    const t      = k * DT;
    const If_ref = If0 + (t >= T_STEP ? dIf : 0);

    if (k % DEC === 0) {
      const [, xa, xif] = x;
      const Efd = clip(xa, VRmin, VRmax);
      out.push({ t:+t.toFixed(3), If:+xif.toFixed(5), Vt:+(Kag*xif).toFixed(5),
        Efd:+Efd.toFixed(5), Vref:+If_ref.toFixed(4),
        erro:+((If_ref-xif)*100).toFixed(4) });
    }

    const deriv = (_t, xs) => {
      const [xi, xa, xif] = xs;
      const e = If_ref - xif;
      return [
        e,
        (KP*e + KI*xi - xa) / TAs,
        (clip(xa,VRmin,VRmax) - xif) / Tdo,
      ];
    };
    x = rk4(deriv, t, x, DT);
  }
  return out;
}

// ── Métricas de desempenho ────────────────────────────────────────────────────
function calcMetrics(data, key, ref0, delta, VRmax) {
  if (!data.length || Math.abs(delta) < 1e-9) return {};
  const post  = data.filter(d => d.t >= T_STEP);
  const final = ref0 + delta;
  const sign  = delta > 0 ? 1 : -1;
  const band  = 0.02 * Math.abs(delta);

  const extreme = post.reduce((a,d) => sign>0 ? Math.max(a,d[key]) : Math.min(a,d[key]), post[0][key]);
  const OS = ((extreme - final) / Math.abs(delta)) * 100 * sign;

  const lo = ref0 + 0.1*delta, hi = ref0 + 0.9*delta;
  let t10=null, t90=null;
  for (const d of post) {
    if (!t10 && sign*d[key] >= sign*lo) t10=d.t;
    if (!t90 && sign*d[key] >= sign*hi) t90=d.t;
    if (t10&&t90) break;
  }
  const tr = t10&&t90 ? t90-t10 : null;

  let ts = 0;
  for (let i=post.length-1; i>=0; i--) {
    if (Math.abs(post[i][key]-final) > band) {
      ts = post[Math.min(i+1,post.length-1)].t - T_STEP; break;
    }
  }
  const Ess = ((final - post[post.length-1][key]) / Math.abs(delta)) * 100;
  const peakEfd = Math.max(...data.map(d=>Math.abs(d.Efd)));

  // ERF ≈ ΔEfd / 0,5s (IEEE 421.2 simplificado)
  const Efd0pt  = data.find(d=>d.t>=T_STEP)?.Efd||0;
  const Efd05pt = data.find(d=>d.t>=T_STEP+0.5)?.Efd||0;
  const ERF = Math.abs(Efd05pt - Efd0pt) / 0.5;

  return {
    OS: OS.toFixed(1), tr: tr!=null?tr.toFixed(2):"—",
    ts: ts.toFixed(1), Ess: Math.abs(Ess).toFixed(2),
    peakEfd: peakEfd.toFixed(3), ERF: ERF.toFixed(2),
  };
}

// ── Componentes UI ────────────────────────────────────────────────────────────
function Inp({ label, value, onChange, unit="", step=0.01, min, max, mono=true }) {
  return (
    <div style={{ marginBottom:5, display:"flex", alignItems:"center", gap:6 }}>
      <label style={{ fontSize:11, color:"#475569", width:96, flexShrink:0 }}>{label}</label>
      <input type="number" step={step} min={min} max={max} value={value}
        onChange={e=>onChange(parseFloat(e.target.value)||0)}
        style={{ width:78, padding:"3px 6px", fontSize:11, border:"1px solid #cbd5e1",
          borderRadius:4, textAlign:"right", color:"#1e3a5f",
          fontFamily: mono?"monospace":"inherit" }} />
      {unit && <span style={{ fontSize:10, color:"#94a3b8", minWidth:22 }}>{unit}</span>}
    </div>
  );
}

function Sec({ title, color="#1e3a5f", children }) {
  return (
    <div style={{ marginBottom:10, borderRadius:7, border:"1px solid #e2e8f0", overflow:"hidden" }}>
      <div style={{ background:color, color:"#fff", padding:"5px 10px", fontSize:11, fontWeight:700 }}>{title}</div>
      <div style={{ padding:"8px 10px", background:"#f8fafc" }}>{children}</div>
    </div>
  );
}

function MetricCard({ label, value, criterion, ok }) {
  const color = ok===null ? "#374151" : ok ? "#16a34a" : "#dc2626";
  return (
    <div style={{ flex:1, textAlign:"center", padding:"4px 6px", borderRight:"1px solid #f1f5f9", minWidth:0 }}>
      <div style={{ fontSize:9, color:"#64748b", marginBottom:2, whiteSpace:"nowrap" }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{value}</div>
      <div style={{ fontSize:9, color:"#94a3b8" }}>{criterion}</div>
      <div style={{ fontSize:11, marginTop:1 }}>{ok===null?"—":ok?"✅":"❌"}</div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SimExcitacao() {
  const [mode, setMode]     = useState("AVR");
  const [maqKey, setMaqKey] = useState("hidraulico");

  // Máquina (informativos)
  const [Vn,  setVn]  = useState(13.8);
  const [Sn,  setSn]  = useState(100);
  const [fn,  setFn]  = useState(60);
  const [RPM, setRPM] = useState(1800);

  // Ponto de operação
  const [Vt0, setVt0] = useState(1.0);
  const [If0, setIf0] = useState(1.0);

  // PID / AVR
  const [KP_a, setKPa] = useState(5.0);
  const [KI_a, setKIa] = useState(20.0);
  const [KD_a, setKDa] = useState(0.1);
  const [Tfd,  setTfd] = useState(0.01);
  const [TC,   setTC]  = useState(0.10);
  const [TB,   setTB]  = useState(0.50);

  // PI / FCR
  const [KP_f, setKPf] = useState(2.0);
  const [KI_f, setKIf] = useState(5.0);

  // Excitador (compartilhado)
  const [KA,   setKA]    = useState(200);
  const [TA,   setTA]    = useState(0.02);
  const [VRmax,setVRmax] = useState(6.0);
  const [VRmin,setVRmin] = useState(-6.0);

  // Degrau
  const [dVref, setDVref] = useState(0.05);
  const [dIf,   setDIf]   = useState(0.05);

  const [data,    setData]    = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [busy,    setBusy]    = useState(false);

  const maq = MAQUINAS[maqKey];

  const simulate = useCallback(() => {
    setBusy(true);
    setTimeout(() => {
      try {
        let d, m;
        if (mode === "AVR") {
          d = simAVR({ KP:KP_a, KI:KI_a, KD:KD_a, Tfd, TC, TB, KA, TA,
            VRmax, VRmin, Tdo:maq.Tdo, Kag:maq.Kag, Vt0, dVref });
          m = calcMetrics(d, "Vt", Vt0, dVref, VRmax);
        } else {
          d = simFCR({ KP:KP_f, KI:KI_f, TA, VRmax, VRmin,
            Tdo:maq.Tdo, Kag:maq.Kag, If0, dIf });
          m = calcMetrics(d, "If", If0, dIf, VRmax);
        }
        setData(d); setMetrics(m);
      } catch(e) { console.error(e); }
      setBusy(false);
    }, 20);
  }, [mode,maqKey,KP_a,KI_a,KD_a,Tfd,TC,TB,KA,TA,VRmax,VRmin,KP_f,KI_f,Vt0,dVref,If0,dIf,maq]);

  const reset = () => { setData([]); setMetrics(null); };

  // Critérios IEEE 421.2
  const ok = metrics ? {
    OS:  parseFloat(metrics.OS)      <= 15,
    tr:  metrics.tr!=="—" ? parseFloat(metrics.tr) <= 2.0 : null,
    ts:  parseFloat(metrics.ts)      <= 10,
    Ess: parseFloat(metrics.Ess)     <= 1,
    pEfd:parseFloat(metrics.peakEfd) <= VRmax,
    ERF: parseFloat(metrics.ERF)     >= 2.0,
  } : {};

  const domVt  = data.length ? [Math.min(...data.map(d=>d.Vt))*0.995, Math.max(...data.map(d=>d.Vt))*1.005] : [0.9,1.15];
  const domIf  = data.length ? [Math.min(...data.map(d=>d.If))*0.99,  Math.max(...data.map(d=>d.If))*1.01]  : [0.8,1.5];
  const domEfd = data.length ? [Math.min(VRmin, Math.min(...data.map(d=>d.Efd)))-0.2, Math.max(VRmax, Math.max(...data.map(d=>d.Efd)))+0.2] : [-1,7];
  const domErr = data.length ? [Math.min(...data.map(d=>d.erro))*1.1, Math.max(...data.map(d=>d.erro))*1.1]  : [-10,10];

  const CH = 155; // altura de cada gráfico

  return (
    <div style={{ fontFamily:"Arial,sans-serif", background:"#f0f4f8", minHeight:"100vh", display:"flex", flexDirection:"column" }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#1e3a5f 0%,#2e75b6 100%)",
        color:"#fff", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, letterSpacing:0.5 }}>
            ⚡ SIMULADOR DE DEGRAU — SISTEMA DE EXCITAÇÃO
          </div>
          <div style={{ fontSize:10, opacity:0.75, marginTop:2 }}>
            IEEE 421.5 · IEC 60034-16 · ONS Submódulo 2.6 &nbsp;|&nbsp; Integração RK4 · Δt={DT*1000}ms · T={T_SIM}s
          </div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {["AVR","FCR"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);reset();}} style={{
              padding:"5px 16px", borderRadius:6, border:"none", cursor:"pointer",
              fontSize:12, fontWeight:700,
              background: mode===m?"#fff":"rgba(255,255,255,0.18)",
              color: mode===m?"#1e3a5f":"#fff",
              boxShadow: mode===m?"0 2px 6px rgba(0,0,0,0.2)":"none",
            }}>{m}</button>
          ))}
          <button onClick={simulate} disabled={busy} style={{
            padding:"5px 20px", borderRadius:6, border:"none", cursor:"pointer",
            fontSize:12, fontWeight:700, marginLeft:6,
            background: busy?"#64748b":"#22c55e", color:"#fff",
            boxShadow:"0 2px 6px rgba(0,0,0,0.25)",
          }}>
            {busy?"⏳ Calculando...":"▶ SIMULAR"}
          </button>
          <button onClick={reset} style={{
            padding:"5px 12px", borderRadius:6, border:"none", cursor:"pointer",
            fontSize:12, background:"rgba(255,255,255,0.18)", color:"#fff",
          }}>↺</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display:"flex", flex:1, gap:10, padding:10, minHeight:0, overflow:"hidden" }}>

        {/* ── Painel de parâmetros ── */}
        <div style={{ width:262, flexShrink:0, overflowY:"auto", background:"#fff",
          borderRadius:10, padding:10, boxShadow:"0 1px 4px rgba(0,0,0,0.1)" }}>

          <Sec title="🔧 MÁQUINA" color="#1e3a5f">
            <div style={{ marginBottom:7 }}>
              <label style={{ fontSize:11, color:"#475569" }}>Tipo de Máquina</label>
              <select value={maqKey} onChange={e=>setMaqKey(e.target.value)} style={{
                width:"100%", marginTop:3, padding:"4px 6px", fontSize:11,
                border:"1px solid #cbd5e1", borderRadius:4, color:"#1e3a5f" }}>
                {Object.entries(MAQUINAS).map(([k,v])=>(
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div style={{ fontSize:10, color:"#94a3b8", marginTop:3 }}>
                {maq.desc}
              </div>
            </div>
            <Inp label="Vn nominal"  value={Vn}  onChange={setVn}  unit="kV"  step={0.1} />
            <Inp label="Sn nominal"  value={Sn}  onChange={setSn}  unit="MVA" step={1}   />
            <Inp label="Frequência"  value={fn}  onChange={setFn}  unit="Hz"  step={1}   />
            <Inp label="Velocidade"  value={RPM} onChange={setRPM} unit="rpm" step={60}  />
          </Sec>

          <Sec title="📍 PONTO DE OPERAÇÃO" color="#375623">
            <Inp label="Vt0 inicial" value={Vt0} onChange={setVt0} unit="pu" step={0.01} />
            <Inp label="If0 inicial" value={If0} onChange={setIf0} unit="pu" step={0.01} />
            <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>
              Efd0 ≈ {(Vt0/maq.Kag).toFixed(3)} pu &nbsp;|&nbsp; Kag = {maq.Kag}
            </div>
          </Sec>

          {mode==="AVR" ? (
            <Sec title="🎛️ CONTROLADOR AVR — PID" color="#2e75b6">
              <Inp label="KP (prop.)"   value={KP_a} onChange={setKPa} step={0.1}   />
              <Inp label="KI (integ.)"  value={KI_a} onChange={setKIa} step={0.5}   />
              <Inp label="KD (deriv.)"  value={KD_a} onChange={setKDa} step={0.01}  />
              <Inp label="Tfd filtro"   value={Tfd}  onChange={setTfd} unit="s" step={0.001}/>
              <div style={{ borderTop:"1px solid #e2e8f0", margin:"7px 0 5px", paddingTop:6 }}>
                <div style={{ fontSize:10, color:"#64748b", marginBottom:5, fontWeight:700 }}>
                  Lead-Lag: (1+TC·s)/(1+TB·s)
                </div>
                <Inp label="TC (zero)"   value={TC} onChange={setTC} unit="s" step={0.01}/>
                <Inp label="TB (polo)"   value={TB} onChange={setTB} unit="s" step={0.01}/>
              </div>
            </Sec>
          ) : (
            <Sec title="🎛️ CONTROLADOR FCR — PI" color="#7030a0">
              <Inp label="KP (prop.)"  value={KP_f} onChange={setKPf} step={0.1} />
              <Inp label="KI (integ.)" value={KI_f} onChange={setKIf} step={0.5} />
              <div style={{ fontSize:10, color:"#94a3b8", marginTop:5 }}>
                Controla If diretamente · sem malha de Vt
              </div>
            </Sec>
          )}

          <Sec title="⚡ EXCITADOR / AMPLIFICADOR" color="#c55a11">
            <Inp label="KA (ganho)"  value={KA}    onChange={setKA}    step={10}   />
            <Inp label="TA (τ)"      value={TA}    onChange={setTA}    unit="s" step={0.001}/>
            <Inp label="VRmax"       value={VRmax} onChange={setVRmax} step={0.5}  />
            <Inp label="VRmin"       value={VRmin} onChange={setVRmin} step={0.5}  />
            <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>
              G_exc(s) = KA/(1+s·TA) &nbsp;|&nbsp; Efd = clip(·,VRmin,VRmax)
            </div>
          </Sec>

          <Sec title="📈 DEGRAU" color="#b91c1c">
            {mode==="AVR"
              ? <Inp label="ΔVref" value={dVref} onChange={setDVref} unit="pu" step={0.01}/>
              : <Inp label="ΔIf"   value={dIf}   onChange={setDIf}   unit="pu" step={0.01}/>}
            <div style={{ fontSize:10, color:"#94a3b8", marginTop:5 }}>
              Degrau em t={T_STEP}s &nbsp;·&nbsp; Obs. até t={T_SIM}s
            </div>
            <div style={{ fontSize:10, color:"#475569", marginTop:4, fontWeight:700 }}>
              {mode==="AVR"
                ? `Novo setpoint: ${(Vt0+dVref).toFixed(3)} pu (${(dVref*100).toFixed(1)}%)`
                : `Novo If_ref: ${(If0+dIf).toFixed(3)} pu`}
            </div>
          </Sec>

          {/* Bloco de função de transferência resumida */}
          <div style={{ background:"#1e3a5f", borderRadius:7, padding:"8px 10px", fontSize:10, color:"#93c5fd", lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:"#fff", marginBottom:4 }}>
              {mode==="AVR" ? "G_malha aberta (AVR):" : "G_malha aberta (FCR):"}
            </div>
            {mode==="AVR" ? <>
              <div>G_PID(s) = KP + KI/s + KD·s/(1+Tfd·s)</div>
              <div>G_LL(s)  = (1+TC·s)/(1+TB·s)</div>
              <div>G_exc(s) = KA/(1+TA·s)</div>
              <div>G_gen(s) = Kag/(1+Tdo'·s)</div>
            </> : <>
              <div>G_PI(s)  = KP + KI/s</div>
              <div>G_exc(s) = 1/(1+TA·s)</div>
              <div>G_field(s)= 1/(1+Tdo'·s)</div>
            </>}
          </div>
        </div>

        {/* ── Área de gráficos e métricas ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, minWidth:0 }}>

          {data.length === 0 ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
              background:"#fff", borderRadius:10, flexDirection:"column", gap:12,
              color:"#94a3b8", boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize:48 }}>⚡</div>
              <div style={{ fontSize:14, color:"#475569" }}>
                Configure os parâmetros e clique em <strong>▶ SIMULAR</strong>
              </div>
              <div style={{ fontSize:11, color:"#cbd5e1", textAlign:"center", lineHeight:1.8 }}>
                Modo <strong>{mode}</strong> &nbsp;·&nbsp;
                Máquina: <strong>{maq.label}</strong> (Tdo'={maq.Tdo}s)<br/>
                Degrau em t={T_STEP}s &nbsp;·&nbsp; Integração RK4 @{1/DT}Hz
              </div>
            </div>
          ) : (
            <>
              {/* Grid 2×2 de gráficos */}
              <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr",
                gridTemplateRows:"1fr 1fr", gap:8, minHeight:0 }}>

                {/* Vt */}
                <div style={{ background:"#fff", borderRadius:8, padding:"8px 4px 2px",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#1e3a5f", paddingLeft:8, marginBottom:2 }}>
                    Tensão Terminal Vt [pu]
                  </div>
                  <ResponsiveContainer width="100%" height={CH}>
                    <LineChart data={data} margin={{top:2,right:14,left:-14,bottom:2}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="t" tick={{fontSize:9}} domain={[0,T_SIM]}
                        label={{value:"t (s)",position:"insideBottomRight",fontSize:9,offset:-4}}/>
                      <YAxis tick={{fontSize:9}} domain={domVt} tickFormatter={v=>v.toFixed(3)}/>
                      <Tooltip formatter={(v,n)=>[v.toFixed(5),n]} labelFormatter={t=>`t=${t}s`}
                        contentStyle={{fontSize:10}}/>
                      <Legend wrapperStyle={{fontSize:10,paddingTop:0}}/>
                      <ReferenceLine x={T_STEP} stroke="#94a3b8" strokeDasharray="4 2"/>
                      <Line dataKey="Vref" stroke="#94a3b8" dot={false} strokeDasharray="6 3" strokeWidth={1} name="Vref"/>
                      <Line dataKey="Vt"   stroke="#2563eb" dot={false} strokeWidth={2} name="Vt"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* If */}
                <div style={{ background:"#fff", borderRadius:8, padding:"8px 4px 2px",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#1e3a5f", paddingLeft:8, marginBottom:2 }}>
                    Corrente de Campo If [pu]
                  </div>
                  <ResponsiveContainer width="100%" height={CH}>
                    <LineChart data={data} margin={{top:2,right:14,left:-14,bottom:2}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="t" tick={{fontSize:9}} domain={[0,T_SIM]}/>
                      <YAxis tick={{fontSize:9}} domain={domIf} tickFormatter={v=>v.toFixed(3)}/>
                      <Tooltip formatter={(v,n)=>[v.toFixed(5),n]} labelFormatter={t=>`t=${t}s`}
                        contentStyle={{fontSize:10}}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x={T_STEP} stroke="#94a3b8" strokeDasharray="4 2"/>
                      {mode==="FCR" && <Line dataKey="Vref" stroke="#94a3b8" dot={false} strokeDasharray="6 3" strokeWidth={1} name="If_ref"/>}
                      <Line dataKey="If" stroke="#16a34a" dot={false} strokeWidth={2} name="If"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Efd */}
                <div style={{ background:"#fff", borderRadius:8, padding:"8px 4px 2px",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#1e3a5f", paddingLeft:8, marginBottom:2 }}>
                    Tensão de Campo Efd / Vf [pu]
                  </div>
                  <ResponsiveContainer width="100%" height={CH}>
                    <LineChart data={data} margin={{top:2,right:14,left:-14,bottom:2}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="t" tick={{fontSize:9}} domain={[0,T_SIM]}/>
                      <YAxis tick={{fontSize:9}} domain={domEfd} tickFormatter={v=>v.toFixed(2)}/>
                      <Tooltip formatter={(v,n)=>[v.toFixed(4),n]} labelFormatter={t=>`t=${t}s`}
                        contentStyle={{fontSize:10}}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x={T_STEP} stroke="#94a3b8" strokeDasharray="4 2"/>
                      <ReferenceLine y={VRmax} stroke="#dc2626" strokeDasharray="3 2"
                        label={{value:`VRmax=${VRmax}`,fontSize:9,fill:"#dc2626",position:"insideTopRight"}}/>
                      <ReferenceLine y={VRmin} stroke="#2563eb" strokeDasharray="3 2"
                        label={{value:`VRmin=${VRmin}`,fontSize:9,fill:"#2563eb",position:"insideBottomRight"}}/>
                      <Line dataKey="Efd" stroke="#dc2626" dot={false} strokeWidth={2} name="Efd"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Erro */}
                <div style={{ background:"#fff", borderRadius:8, padding:"8px 4px 2px",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#1e3a5f", paddingLeft:8, marginBottom:2 }}>
                    Erro de Controle e(t) [%]
                  </div>
                  <ResponsiveContainer width="100%" height={CH}>
                    <LineChart data={data} margin={{top:2,right:14,left:-14,bottom:2}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="t" tick={{fontSize:9}} domain={[0,T_SIM]}/>
                      <YAxis tick={{fontSize:9}} domain={domErr} tickFormatter={v=>v.toFixed(1)}/>
                      <Tooltip formatter={(v,n)=>[v.toFixed(3)+"%",n]} labelFormatter={t=>`t=${t}s`}
                        contentStyle={{fontSize:10}}/>
                      <Legend wrapperStyle={{fontSize:10}}/>
                      <ReferenceLine x={T_STEP} stroke="#94a3b8" strokeDasharray="4 2"/>
                      <ReferenceLine y={0}  stroke="#374151" strokeWidth={1}/>
                      <ReferenceLine y={2}  stroke="#fbbf24" strokeDasharray="3 2"
                        label={{value:"±2%",fontSize:9,fill:"#f59e0b",position:"insideTopRight"}}/>
                      <ReferenceLine y={-2} stroke="#fbbf24" strokeDasharray="3 2"/>
                      <Line dataKey="erro" stroke="#f97316" dot={false} strokeWidth={2} name="Erro (%)"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Métricas ── */}
              {metrics && (
                <div style={{ background:"#fff", borderRadius:8, padding:"8px 14px",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)", display:"flex", alignItems:"stretch", gap:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#1e3a5f", width:132,
                    flexShrink:0, paddingRight:12, borderRight:"1px solid #e2e8f0",
                    display:"flex", flexDirection:"column", justifyContent:"center" }}>
                    <div>📊 MÉTRICAS</div>
                    <div style={{ fontSize:9, color:"#94a3b8", marginTop:3, fontWeight:400 }}>IEEE 421.2 / ONS</div>
                    <div style={{ fontSize:9, color:"#64748b", marginTop:4 }}>
                      Modo: <b>{mode}</b><br/>
                      Maq.: <b>{maq.label}</b>
                    </div>
                  </div>
                  <MetricCard label="Sobressinal OS"    value={metrics.OS+"%"}       criterion="≤ 15%"    ok={ok.OS}  />
                  <MetricCard label="Tempo subida tr"   value={metrics.tr+"s"}        criterion="≤ 2 s"    ok={ok.tr}  />
                  <MetricCard label="Tempo acomod. ts"  value={metrics.ts+"s"}        criterion="≤ 10 s"   ok={ok.ts}  />
                  <MetricCard label="Erro est. Ess"     value={metrics.Ess+"%"}       criterion="≤ 1%"     ok={ok.Ess} />
                  <MetricCard label="Pico Efd"          value={metrics.peakEfd+" pu"} criterion={`≤ ${VRmax} pu`} ok={ok.pEfd}/>
                  <MetricCard label="ERF (IEEE 421.2)"  value={metrics.ERF+" pu/s"}   criterion="≥ 2 pu/s" ok={ok.ERF} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
