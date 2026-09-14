/* =========================================================
   Full-page profile (own profile landing)
   ========================================================= */
function ProfilePage({ goTo, onChallenge }) {
  const p = CURRENT_USER;
  return (
    <div className="screen">
      <div className="profile-page">
        <aside className="profile-sidebar">
          <div className="profile-avatar-xl">{initials(p.name)}</div>
          <div className="eyebrow">Your profile</div>
          <h1 className="display" style={{ fontSize: 42, fontStyle: "italic", fontWeight: 400, margin: "6px 0 4px", paddingLeft: "0.12em", lineHeight: 1.05 }}>
            {p.name}
          </h1>
          <div className="mono muted" style={{ fontSize: 12, paddingLeft: "0.2em" }}>@asta_k · member since Mar 2025</div>

          <div style={{ marginTop: 24, padding: 14, background: "var(--paper-2)", border: "1px solid var(--hair)", borderRadius: 10 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Rating</div>
            <div className="display" style={{ fontSize: 46, fontStyle: "italic", color: "var(--ochre-deep)", lineHeight: 1 }}>1,728</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--good)", marginTop: 4, letterSpacing: "0.08em" }}>▲ +24 TODAY</div>
          </div>

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => goTo("matchmaking")}>◆ Play now</button>
            <button className="btn btn-ghost">Edit profile</button>
          </div>
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Stats grid */}
          <section>
            <div className="eyebrow">At a glance</div>
            <div className="profile-stats-grid" style={{ marginTop: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className="profile-stat"><div className="v">272</div><div className="k">Matches</div></div>
              <div className="profile-stat"><div className="v">146–112–14</div><div className="k">W · L · D</div></div>
              <div className="profile-stat"><div className="v">54%</div><div className="k">Win rate</div></div>
              <div className="profile-stat"><div className="v">1,735</div><div className="k">Peak rating</div></div>
            </div>
          </section>

          {/* Rating chart */}
          <section className="card">
            <div className="panel-head">
              <h3>Rating · last 30 days</h3>
              <span className="mono muted" style={{ fontSize: 11 }}>+24 this week</span>
            </div>
            <div className="rating-chart">
              <svg viewBox="0 0 600 180" width="100%" height="180" preserveAspectRatio="none" style={{ display: "block" }}>
                {[40, 80, 120, 160].map(y => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 4" />
                ))}
                {(() => {
                  const pts = RATING_HISTORY;
                  const min = Math.min(...pts), max = Math.max(...pts);
                  const coords = pts.map((v, i) => [
                    (i / (pts.length - 1)) * 600,
                    170 - ((v - min) / (max - min)) * 140
                  ]);
                  const path = coords.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
                  const area = path + ` L600,180 L0,180 Z`;
                  return (
                    <g>
                      <path d={area} fill="var(--ochre-tint)" opacity="0.7" />
                      <path d={path} stroke="var(--ochre-deep)" strokeWidth="2" fill="none" />
                      {coords.map(([x, y], i) => i === coords.length - 1 && (
                        <circle key={i} cx={x} cy={y} r="5" fill="var(--ochre-deep)" stroke="var(--paper)" strokeWidth="2" />
                      ))}
                    </g>
                  );
                })()}
              </svg>
            </div>
          </section>

          {/* Word cloud — best words */}
          <section className="card">
            <div className="panel-head">
              <h3>Best words</h3>
              <span className="mono muted" style={{ fontSize: 11 }}>All-time</span>
            </div>
            <div className="word-cloud">
              {[
                ["SKÓGURINN", 44], ["MAÐURINN", 38], ["FISKAR", 28],
                ["VATN", 22], ["HESTUR", 22], ["BARNIÐ", 20], ["STEINN", 19],
                ["AKUR", 17], ["HÚS", 14], ["RÖK", 12], ["ÁR", 10]
              ].map(([w, pts], i) => (
                <span key={i} className="w" style={{ fontSize: 16 + pts * 0.5, color: i < 3 ? "var(--ochre-deep)" : "var(--ink)" }}>
                  {w}<sub className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", marginLeft: 3 }}>+{pts}</sub>
                </span>
              ))}
            </div>
          </section>

          {/* Match history */}
          <section className="card">
            <div className="panel-head">
              <h3>Recent matches</h3>
              <span className="mono muted" style={{ fontSize: 11 }}>Last 7 days</span>
            </div>
            <div>
              {RECENT_GAMES.concat(RECENT_GAMES).slice(0, 10).map((g, i) => (
                <div className="hist-row" key={i}>
                  <span className={`hist-result ${g.result}`}>{g.result === "win" ? "W" : g.result === "loss" ? "L" : "D"}</span>
                  <span>vs <b>@{g.opp}</b></span>
                  <span className="mono muted">{g.score}</span>
                  <span className="mono muted">{g.words} words</span>
                  <span className="mono muted">{g.d}</span>
                  <a className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-soft)", cursor: "pointer" }}>Replay →</a>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

window.ProfilePage = ProfilePage;
