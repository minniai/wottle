/* =========================================================
   Post-match summary
   ========================================================= */
function PostGameScreen({ goTo }) {
  const youWon = true;
  return (
    <div className="screen" style={{ padding: "40px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36, alignItems: "start" }}>

        {/* Left — verdict */}
        <div>
          <div className="eyebrow">Match complete · 10 rounds · 9m 12s</div>
          <div className={`verdict ${youWon ? "win" : "loss"}`} style={{ marginTop: 12 }}>
            Victory.
          </div>
          <div className="display" style={{ fontSize: 24, color: "var(--ink-3)", marginTop: 8, fontStyle: "italic" }}>
            You out‑read Sigríður by 34 points.
          </div>

          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                <Avatar name={CURRENT_USER.name} slot="p1" />
                <div>
                  <div className="hud-name">Ásta Kristín</div>
                  <div className="hud-meta">White · +18 rating</div>
                </div>
              </div>
              <div className="display" style={{ fontSize: 56, color: "var(--p1-deep)", lineHeight: 1 }}>312</div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "var(--ink-3)" }}>
                <span>18 words</span><span>14 frozen</span><span>best <b>HESTUR</b></span>
              </div>
            </div>
            <div className="card" style={{ padding: 20, opacity: 0.85 }}>
              <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                <Avatar name="Sigríður P." slot="p2" />
                <div>
                  <div className="hud-name">Sigríður Pálsdóttir</div>
                  <div className="hud-meta">Black · −18 rating</div>
                </div>
              </div>
              <div className="display" style={{ fontSize: 56, color: "var(--p2-deep)", lineHeight: 1 }}>278</div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "var(--ink-3)" }}>
                <span>15 words</span><span>11 frozen</span><span>best <b>FISKUR</b></span>
              </div>
            </div>
          </div>

          {/* Round-by-round strip */}
          <div style={{ marginTop: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Round by round</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6, height: 120, alignItems: "end" }}>
              {[22, 9, 12, 28, 17, 34, 41, 15, 28, 19].map((v, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                  <div style={{ width: "100%", height: v * 2.2, background: "var(--p1)", borderRadius: "3px 3px 0 0" }} />
                  <div style={{ width: "100%", height: [15, 28, 7, 12, 22, 19, 24, 33, 11, 28][i] * 2.2, background: "var(--p2)", borderRadius: "0 0 3px 3px", opacity: 0.7 }} />
                  <div className="mono muted" style={{ fontSize: 10 }}>R{i + 1}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="row" style={{ marginTop: 36, gap: 12 }}>
            <button className="btn btn-primary" onClick={() => goTo("matchmaking")}>↺ Rematch</button>
            <button className="btn btn-ghost" onClick={() => goTo("lobby")}>Back to lobby</button>
            <div className="spacer" />
            <span className="mono muted" style={{ fontSize: 11 }}>Share · Export PGN · Analyze</span>
          </div>
        </div>

        {/* Right — final board + word list */}
        <div className="col">
          <div style={{ transform: "scale(0.75)", transformOrigin: "top right" }}>
            <Board grid={SAMPLE_BOARD} frozen={FROZEN} size={36} showCoords={false} />
          </div>
          <div className="card">
            <div className="panel-head"><h3>Words of the match</h3><span className="mono muted" style={{ fontSize: 11 }}>33 found</span></div>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {[
                { p: "p1", w: "HESTUR", r: 4, pts: 22 },
                { p: "p1", w: "MAÐUR", r: 7, pts: 28 },
                { p: "p1", w: "AKUR", r: 7, pts: 10 },
                { p: "p2", w: "FISKUR", r: 6, pts: 19 },
                { p: "p2", w: "STEINN", r: 5, pts: 24 },
                { p: "p2", w: "ALL", r: 5, pts: 10 },
                { p: "p1", w: "HÚS", r: 6, pts: 7 },
                { p: "p1", w: "BARN", r: 2, pts: 11 },
                { p: "p1", w: "LAND", r: 2, pts: 5 },
                { p: "p2", w: "VATN", r: 1, pts: 8 },
                { p: "p2", w: "ÁR", r: 3, pts: 5 },
              ].map((r, i) => (
                <div key={i} className={`word-row ${r.p}`}>
                  <span className="w">{r.w}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>R{r.r}</span>
                  <span className="pts">+{r.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PostGameScreen = PostGameScreen;
