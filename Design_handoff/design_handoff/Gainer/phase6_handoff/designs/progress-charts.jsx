/* GAINER — Progress chart primitives (SVG, light theme).
   LineChart, Sparkline, ActivityCalendar, Segmented toggle, DeltaPill. */

const { useState: useStateC } = React;

// ── line chart with soft area fill, dots, y-ticks, x-labels ──
function LineChart({ points, suffix = '', height = 150, accent = '#7C3AED', highlightLast = true }) {
  const vals = points.map((p) => p.value);
  if (vals.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: HG.faint, fontSize: 13, fontWeight: 600 }}>Log more to draw the trend.</div>;
  }
  const W = 300, H = height, padL = 38, padR = 10, padT = 12, padB = 22;
  const min = Math.min(...vals), max = Math.max(...vals);
  const spread = Math.max(max - min, 0.001);
  // nice-ish ticks (4 lines)
  const ticks = [0, 1, 2, 3].map((i) => min + (spread * i) / 3);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (i) => padL + (i / (vals.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - min) / spread) * plotH;
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${padL},${padT + plotH} ${line} ${x(vals.length - 1)},${padT + plotH}`;
  // x labels: first, middle, last (dedup)
  const idxs = [...new Set([0, Math.floor((vals.length - 1) / 2), vals.length - 1])];
  const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, ''));
  const gid = 'ga-' + accent.replace('#', '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.20" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.slice().reverse().map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#ECE7F6" strokeWidth="1" />
          <text x={padL - 7} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fontWeight="700" fill={HG.faint} fontFamily="Manrope, sans-serif">{fmt(t)}</text>
        </g>
      ))}
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={accent} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {highlightLast && (
        <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" fill={accent} stroke="#fff" strokeWidth="2.5" />
      )}
      {idxs.map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === vals.length - 1 ? 'end' : 'middle'} fontSize="9.5" fontWeight="700" fill={HG.faint} fontFamily="Manrope, sans-serif">{points[i].label}</text>
      ))}
    </svg>
  );
}

// ── tiny inline sparkline ──
function Sparkline({ points, color = '#7C3AED', w = 66, h = 30 }) {
  const vals = points.map((p) => p.value || p);
  const min = Math.min(...vals), max = Math.max(...vals);
  const spread = Math.max(max - min, 0.001);
  const x = (i) => (i / (vals.length - 1)) * (w - 4) + 2;
  const y = (v) => h - 3 - ((v - min) / spread) * (h - 6);
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}

// ── activity calendar (month grid) ──
function ActivityCalendar({ cal }) {
  const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {dows.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: HG.faint }}>{d}</div>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cal.weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {week.map((c, ci) => {
              if (!c) return <div key={ci}></div>;
              const base = { aspectRatio: '1', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700 };
              if (c.active) return <div key={ci} style={{ ...base, background: HG.purple, color: '#fff' }}>{c.day}</div>;
              if (c.today) return <div key={ci} style={{ ...base, background: HG.purpleLight, color: HG.purpleDark, border: `1.5px dashed ${HG.purple}` }}>{c.day}</div>;
              return <div key={ci} style={{ ...base, background: '#F1ECFB', color: HG.faint }}>{c.day}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── segmented toggle ──
function Segmented({ options, value, onChange, small }) {
  return (
    <div style={{ display: 'inline-flex', background: '#EEE8FA', borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <div key={o.key} onClick={() => onChange(o.key)} style={{
            padding: small ? '5px 11px' : '7px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: small ? 12 : 13, fontWeight: 800, whiteSpace: 'nowrap',
            color: on ? HG.purpleDark : HG.muted, background: on ? '#fff' : 'transparent',
            boxShadow: on ? '0 1px 4px rgba(80,40,160,0.14)' : 'none', transition: 'all 160ms ease',
          }}>{o.label}</div>
        );
      })}
    </div>
  );
}

// ── delta pill (▲ +2.6 kg) ──
function DeltaPill({ delta, unit, goodWhenUp = true }) {
  const up = delta > 0;
  const good = goodWhenUp ? up : !up;
  const col = good ? '#157A3A' : '#9A5B16';
  const bg = good ? '#E7F6EC' : '#FBEFDD';
  const arrow = up ? 'M6 3l4 5H2z' : 'M6 9L2 4h8z';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color: col, fontSize: 11.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>
      <svg viewBox="0 0 12 12" style={{ width: 9, height: 9, fill: col }}><path d={arrow} /></svg>
      {up ? '+' : ''}{delta}{unit ? ` ${unit}` : ''}
    </span>
  );
}

Object.assign(window, { LineChart, Sparkline, ActivityCalendar, Segmented, DeltaPill });
