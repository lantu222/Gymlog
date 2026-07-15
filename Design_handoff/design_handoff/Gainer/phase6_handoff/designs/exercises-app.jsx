/* GAINER — Exercises library screen (light theme), interactive.
   Reuses HG palette + StatusBar/BottomNav/HomeIndicator from home-shared.jsx,
   EX/CATS/CatIcon from exercises-data.jsx. */

const { useState, useMemo, useRef, useEffect } = React;

// ── one-time animation keyframes ──────────────────────────────
if (!document.getElementById('gainer-ex-anim')) {
  const s = document.createElement('style');
  s.id = 'gainer-ex-anim';
  s.textContent = `
    @keyframes exUp { from { transform: translateY(16px); } to { transform: translateY(0); } }
    @keyframes pop { 0% { transform: scale(1); } 45% { transform: scale(0.82); } 100% { transform: scale(1); } }
    @keyframes starPop { 0% { transform: scale(1); } 40% { transform: scale(1.35) rotate(-12deg); } 100% { transform: scale(1) rotate(0); } }
    @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes shimmer { 0% { background-position: -180px 0; } 100% { background-position: 180px 0; } }
    .ex-scroll::-webkit-scrollbar { display: none; }
    .ex-rail::-webkit-scrollbar { display: none; }
    .ex-anim { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: no-preference) {
      .ex-anim { animation: exUp 540ms cubic-bezier(.22,1,.36,1) both; }
    }
  `;
  document.head.appendChild(s);
}

// ── exercise photo with shimmer skeleton + graceful fallback ──
function Thumb({ src, alt, radius = 12 }) {
  const [state, setState] = useState('load'); // load | ok | err
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden', background: HG.surfaceSoft }}>
      {state !== 'ok' && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, ${HG.surfaceSoft} 30%, #FBF8FF 50%, ${HG.surfaceSoft} 70%)`, backgroundSize: '360px 100%', animation: state === 'load' ? 'shimmer 1.1s linear infinite' : 'none' }}>
          {state === 'err' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: HG.faint, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
            </div>
          )}
        </div>
      )}
      <img src={src} alt={alt} loading="lazy" onLoad={() => setState('ok')} onError={() => setState('err')}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: state === 'ok' ? 1 : 0, transition: 'opacity 260ms ease' }} />
    </div>
  );
}

function Star({ active, onClick }) {
  const ref = useRef(null);
  const handle = (e) => {
    e.stopPropagation();
    if (ref.current) { ref.current.style.animation = 'none'; void ref.current.offsetWidth; ref.current.style.animation = 'starPop 420ms ease'; }
    onClick();
  };
  return (
    <div onClick={handle} style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(20,10,40,0.18)' }}>
      <svg ref={ref} viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: active ? '#F4B740' : 'none', stroke: active ? '#F4B740' : HG.faint, strokeWidth: 2, strokeLinejoin: 'round' }}>
        <path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/>
      </svg>
    </div>
  );
}

function AddButton({ added, onClick }) {
  const ref = useRef(null);
  const handle = (e) => {
    e.stopPropagation();
    if (ref.current) { ref.current.style.animation = 'none'; void ref.current.offsetWidth; ref.current.style.animation = 'pop 360ms ease'; }
    onClick();
  };
  return (
    <div ref={ref} onClick={handle} style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      background: added ? HG.greenSoft : HG.green, border: added ? `1.5px solid ${HG.green}` : 'none',
      boxShadow: added ? 'none' : '0 4px 10px rgba(22,163,74,0.3)' }}>
      {added ? (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: HG.green, strokeWidth: 2.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 13l4 4L19 7"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: '#fff', strokeWidth: 2.8, fill: 'none', strokeLinecap: 'round' }}><path d="M12 5v14M5 12h14"/></svg>
      )}
    </div>
  );
}

// horizontal card (Popular / Suggested)
function ExCard({ ex, fav, added, onFav, onAdd }) {
  return (
    <div style={{ width: 180, flexShrink: 0, background: HG.surface, borderRadius: 16, overflow: 'hidden', border: `1px solid ${HG.border}`, boxShadow: '0 6px 16px rgba(120,80,200,0.07)' }}>
      <div style={{ position: 'relative', height: 104 }}>
        <Thumb src={ex.image} alt={ex.name} radius={0} />
        <div style={{ position: 'absolute', top: 8, left: 8 }}><Star active={fav} onClick={onFav} /></div>
      </div>
      <div style={{ padding: '11px 12px 13px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: HG.ink, lineHeight: 1.25, height: 34, overflow: 'hidden' }}>{ex.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: HG.muted }}>{cap(ex.bodyPart)}</span>
          <AddButton added={added} onClick={onAdd} />
        </div>
      </div>
    </div>
  );
}

// vertical list row (All exercises)
function ExRow({ ex, fav, added, onFav, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '10px 12px', background: HG.surface, borderRadius: 14, border: `1px solid ${HG.border}` }}>
      <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
        <Thumb src={ex.image} alt={ex.name} radius={11} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: HG.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: HG.muted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{cap(ex.bodyPart)}</span><Dot /><span>{cap(ex.equipment)}</span><Dot /><span>{cap(ex.category)}</span>
        </div>
      </div>
      <div onClick={(e) => { e.stopPropagation(); onFav(); }} style={{ cursor: 'pointer', padding: 2 }}>
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: fav ? '#F4B740' : 'none', stroke: fav ? '#F4B740' : HG.faint, strokeWidth: 2, strokeLinejoin: 'round' }}>
          <path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/>
        </svg>
      </div>
      <AddButton added={added} onClick={onAdd} />
    </div>
  );
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: 999, background: HG.faint, display: 'inline-block' }}></span>;
}

function SectionHead({ label, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 2px 11px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint }}>{label}</span>
      {action && <span onClick={onAction} style={{ fontSize: 12.5, fontWeight: 800, color: HG.purple, cursor: 'pointer', whiteSpace: 'nowrap' }}>{action}</span>}
    </div>
  );
}

function ExercisesScreen() {
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState({});
  const [added, setAdded] = useState({});
  const [toast, setToast] = useState(null);
  const railRef = useRef(null);
  const toastTimer = useRef(null);

  const byId = useMemo(() => Object.fromEntries(EX.map((e) => [e.id, e])), []);

  const matchCat = (e) => {
    if (cat === 'All') return true;
    if (cat === 'Full body') return e.bodyPart === 'full body';
    return e.bodyPart === cat.toLowerCase();
  };
  const matchQ = (e) => !query || e.name.toLowerCase().includes(query.toLowerCase());

  const all = useMemo(() => EX.filter((e) => matchCat(e) && matchQ(e)), [cat, query]);
  const popular = POPULAR_IDS.map((id) => byId[id]).filter((e) => matchCat(e) && matchQ(e));
  const suggested = SUGGESTED_IDS.map((id) => byId[id]).filter((e) => matchCat(e) && matchQ(e));
  const favList = EX.filter((e) => favs[e.id]);
  const dashboard = cat === 'All' && !query;

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  };
  const toggleFav = (e) => {
    setFavs((f) => ({ ...f, [e.id]: !f[e.id] }));
    flash(favs[e.id] ? 'Removed from favorites' : `★ ${e.name.split('—')[0].trim()} favorited`);
  };
  const toggleAdd = (e) => {
    setAdded((a) => ({ ...a, [e.id]: !a[e.id] }));
    flash(added[e.id] ? 'Removed from workout' : `Added · ${e.name.split('—')[0].trim()}`);
  };
  const addedCount = Object.values(added).filter(Boolean).length;

  const cardProps = (e) => ({ ex: e, fav: !!favs[e.id], added: !!added[e.id], onFav: () => toggleFav(e), onAdd: () => toggleAdd(e) });

  return (
    <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, background: '#0C0A16', padding: 9, boxShadow: '0 30px 70px rgba(30,18,70,0.3)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: HG.bg, display: 'flex', flexDirection: 'column', fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <StatusBar />

        {/* sticky header block */}
        <div style={{ padding: '4px 20px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: HG.ink, letterSpacing: '-0.02em' }}>Exercises</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 2 }}>Find and add exercises to your workouts.</div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <IconBtn><svg viewBox="0 0 24 24" style={iconS}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></IconBtn>
              <IconBtn><svg viewBox="0 0 24 24" style={iconS}><path d="M3 6h18M6 12h12M10 18h4"/></svg></IconBtn>
            </div>
          </div>

          {/* search */}
          <div style={{ marginTop: 14, height: 46, borderRadius: 14, background: HG.surface, border: `1px solid ${HG.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: HG.faint, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, fontWeight: 600, color: HG.ink, fontFamily: 'inherit' }} />
            {query && <span onClick={() => setQuery('')} style={{ cursor: 'pointer', color: HG.faint, fontSize: 18, fontWeight: 700 }}>×</span>}
          </div>

          {/* category rail */}
          <div ref={railRef} className="ex-rail" style={{ marginTop: 12, marginLeft: -20, marginRight: -20, padding: '0 20px', display: 'flex', gap: 8, overflowX: 'auto' }}>
            {CATS.map((c) => {
              const on = c === cat;
              return (
                <div key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  background: on ? HG.purple : HG.surface, border: `1px solid ${on ? HG.purple : HG.border}`, transition: 'background 180ms ease' }}>
                  <CatIcon name={c} color={on ? '#fff' : HG.muted} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: on ? '#fff' : HG.ink, whiteSpace: 'nowrap' }}>{c}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* scroll body */}
        <div className="ex-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
          {dashboard && (
            <>
              <div className="ex-anim" style={{ animationDelay: '40ms' }}>
                <SectionHead label="POPULAR EXERCISES" action="View all" />
                <Rail>{popular.map((e) => <ExCard key={e.id} {...cardProps(e)} />)}</Rail>
              </div>

              <div className="ex-anim" style={{ marginTop: 26, animationDelay: '110ms' }}>
                <SectionHead label="FAVORITES" action={favList.length ? 'View all' : null} />
                {favList.length === 0 ? (
                  <div style={{ background: HG.surface, border: `1px solid ${HG.border}`, borderRadius: 16, padding: '18px 18px' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>No favorites yet</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: HG.muted, marginTop: 4 }}>Tap the star on any exercise to keep it here.</div>
                  </div>
                ) : (
                  <Rail>{favList.map((e) => <ExCard key={e.id} {...cardProps(e)} />)}</Rail>
                )}
              </div>

              <div className="ex-anim" style={{ marginTop: 26, animationDelay: '180ms' }}>
                <SectionHead label="SUGGESTED FOR YOUR PLAN" action="View all" />
                <Rail>{suggested.map((e) => <ExCard key={e.id} {...cardProps(e)} />)}</Rail>
              </div>

              <div style={{ marginTop: 28 }}></div>
            </>
          )}

          <div className="ex-anim" style={{ animationDelay: dashboard ? '240ms' : '0ms' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 2px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.09em', color: HG.faint }}>{dashboard ? 'ALL EXERCISES' : (cat === 'All' ? 'RESULTS' : cap(cat).toUpperCase())}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: HG.muted }}>{dashboard ? '873 exercises' : `${all.length} ${all.length === 1 ? 'exercise' : 'exercises'}`}</span>
            </div>

            {all.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '38px 10px', color: HG.muted }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: HG.ink }}>No matches</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Try a broader search or category.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {all.map((e) => <ExRow key={e.id} {...cardProps(e)} />)}
              </div>
            )}
          </div>
        </div>

        {/* added-to-workout pill (above nav) */}
        {addedCount > 0 && (
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 112, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: HG.ink, color: '#fff', borderRadius: 999, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 800, boxShadow: '0 10px 24px rgba(20,10,40,0.28)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: HG.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{addedCount}</span>
              {addedCount === 1 ? 'exercise added' : 'exercises added'}
              <span style={{ color: HG.purpleLight, opacity: 0.9 }}>·</span>
              <span style={{ color: '#C9B6FF' }}>Review</span>
            </div>
          </div>
        )}

        {/* toast */}
        {toast && (
          <div key={toast} style={{ position: 'absolute', left: '50%', bottom: 158, transform: 'translateX(-50%)', background: 'rgba(20,12,38,0.94)', color: '#fff', padding: '8px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', animation: 'toastIn 240ms ease both', boxShadow: '0 8px 20px rgba(20,10,40,0.3)' }}>{toast}</div>
        )}

        <BottomNav active="ex" />
        <HomeIndicator />
      </div>
    </div>
  );
}

const iconS = { width: 19, height: 19, stroke: HG.purpleDark, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
function IconBtn({ children }) {
  return <div style={{ width: 40, height: 40, borderRadius: 13, background: HG.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{children}</div>;
}
function Rail({ children }) {
  return <div className="ex-rail" style={{ display: 'flex', gap: 12, overflowX: 'auto', marginLeft: -20, marginRight: -20, padding: '4px 20px' }}>{children}</div>;
}

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#DAD5EC' }}>
      <ExercisesScreen />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
