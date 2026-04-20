/* =========================================================
   In-match screen — HUD + Board + round panel
   ========================================================= */
function MatchScreen({ goTo, hudVariant = "classic", tileStyle = "letterpress", showDisconnect = false, t }) {
  // Demo selection / live move state
  const [selected, setSelected] = React.useState([]);
  const [submitted, setSubmitted] = React.useState(false);
  const [scored, setScored] = React.useState([]);
  const [showDelta, setShowDelta] = React.useState(false);
  const [discOpen, setDiscOpen] = React.useState(showDisconnect);

  React.useEffect(() => { setDiscOpen(showDisconnect); }, [showDisconnect]);

  // Mock clocks
  const [yourMs, setYourMs] = React.useState(287_000);
  const [oppMs, setOppMs] = React.useState(241_000);

  React.useEffect(() => {
    const t = setInterval(() => {
      if (!submitted) setYourMs(v => Math.max(0, v - 1000));
      setOppMs(v => Math.max(0, v - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [submitted]);

  function handleTile(x, y) {
    if (submitted) return;
    if (FROZEN[`${x},${y}`]) return;
    setSelected(prev => {
      if (prev.length === 0) return [[x, y]];
      if (prev.length === 1) {
        const [[px, py]] = prev;
        if (px === x && py === y) return [];
        // submit the swap
        setSubmitted(true);
        // after "reveal", glow scored tiles
        setTimeout(() => {
          setScored([[x, y], [px, py], [x - 1, y], [x + 1, y]].filter(([cx, cy]) => cx >= 0 && cx < 10 && cy >= 0 && cy < 10));
          setShowDelta(true);
        }, 900);
        setTimeout(() => { setShowDelta(false); setScored([]); setSelected([]); setSubmitted(false); }, 4800);
        return [[px, py], [x, y]];
      }
      return [[x, y]];
    });
  }

  return (
    <div className={`screen tiles-${tileStyle}`} style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18, position: "relative" }}>
      {/* Top HUD — variants */}
      {hudVariant === "chess" && <HudChessClock yourMs={yourMs} oppMs={oppMs} submitted={submitted} goTo={goTo} />}
      {hudVariant === "topbottom" && <HudTopBottom yourMs={yourMs} oppMs={oppMs} submitted={submitted} />}
      {hudVariant === "classic" && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 18, alignItems: "center" }}>
        <div className="hud-card opp">
          <Avatar name="Sigríður P." slot="p2" />
          <div>
            <div className="hud-name">Sigríður Pálsdóttir</div>
            <div className="hud-meta">Black · 1,842 · M 6</div>
          </div>
          <div className="spacer" />
          <Clock ms={oppMs} active={!submitted && false} low={oppMs < 60_000} />
          <div className="hud-score">176</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div className="eyebrow">Round 7 / 10</div>
          <RoundBar current={7} total={10} />
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.14em" }}>
            {submitted ? "WAITING FOR OPPONENT" : "YOUR MOVE · SWAP TWO TILES"}
          </div>
        </div>

        <div className="hud-card you">
          <div className="hud-score" style={{ marginLeft: 0, marginRight: "auto" }}>198</div>
          <Clock ms={yourMs} active={!submitted} low={yourMs < 60_000} />
          <div style={{ textAlign: "right" }}>
            <div className="hud-name">Ásta Kristín</div>
            <div className="hud-meta">White · 1,728 · M 6</div>
          </div>
          <Avatar name={CURRENT_USER.name} slot="p1" />
        </div>
      </div>
      )}

      {/* Board + panels */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 24, alignItems: "start" }}>

        {/* Left rail — instructions + submitted move */}
        <div className="col">
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>How to play</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.7 }}>
              <li>Tap any unfrozen tile.</li>
              <li>Tap a second tile to swap.</li>
              <li>New 3+ letter words in any direction score.</li>
              <li>Claimed letters freeze in your color.</li>
            </ol>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Legend</div>
            <div className="col" style={{ gap: 10, fontSize: 13 }}>
              <div className="row"><span className="tile frozen-p1" style={{ width: 22, height: 22, fontSize: 11 }}>A<span className="val">1</span></span><span>Your territory</span></div>
              <div className="row"><span className="tile frozen-p2" style={{ width: 22, height: 22, fontSize: 11 }}>B<span className="val">6</span></span><span>Opponent's territory</span></div>
              <div className="row"><span className="tile frozen-both" style={{ width: 22, height: 22, fontSize: 11 }}>Ö<span className="val">7</span></span><span>Shared letter</span></div>
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Your move</div>
            {!submitted && selected.length === 0 && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Select your first tile.</div>}
            {!submitted && selected.length === 1 && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Picked <b className="mono">{"ABCDEFGHIJ"[selected[0][0]]}{selected[0][1]+1}</b>. Pick a second.</div>}
            {submitted && (
              <div style={{ fontSize: 13 }}>
                <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Submitted</div>
                <div className="mono" style={{ color: "var(--ink)" }}>
                  {selected.map(([x,y]) => `${"ABCDEFGHIJ"[x]}${y+1}`).join(" ↔ ")}
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Hidden from opponent until both submit.</div>
              </div>
            )}
          </div>
        </div>

        {/* Center — board */}
        <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
          <Board
            grid={SAMPLE_BOARD}
            frozen={FROZEN}
            selected={selected}
            scored={scored}
            size={52}
            onTileClick={handleTile}
          />
          {showDelta && (
            <div className="score-pop" style={{ top: 12, right: 12 }}>
              <b>+ 28</b>
              <div className="mono">MAÐUR · base 15 · length 10 · combo 3</div>
            </div>
          )}
        </div>

        {/* Right rail — round history + scoreboard */}
        <div className="col">
          <div className="card">
            <div className="panel-head"><h3>Round log</h3><span className="mono muted" style={{ fontSize: 11 }}>live</span></div>
            <div style={{ maxHeight: 360, overflow: "auto" }}>
              {ROUND_HISTORY.map((r, i) => (
                <div key={i} className={`word-row ${r.player}`}>
                  <span className="mono muted" style={{ width: 20 }}>R{r.r}</span>
                  <div>
                    {r.words.map((w, j) => <div key={j} className="w">{w}</div>)}
                  </div>
                  <span className="pts">+{r.pts}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Tiles claimed</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="mono muted" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>You</div>
                <div className="display" style={{ fontSize: 32, color: "var(--p1-deep)" }}>14</div>
              </div>
              <div>
                <div className="mono muted" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Opponent</div>
                <div className="display" style={{ fontSize: 32, color: "var(--p2-deep)" }}>11</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 4, height: 6, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ flex: 14, background: "var(--p1)" }} />
              <div style={{ flex: 11, background: "var(--p2)" }} />
              <div style={{ flex: 75, background: "var(--paper-3)" }} />
            </div>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => goTo("postgame")} style={{ alignSelf: "flex-end" }}>
            Skip to post-game →
          </button>
        </div>
      </div>

      {discOpen && (
        <DisconnectionOverlay
          opponentName="Sigríður P."
          onCancel={() => setDiscOpen(false)}
        />
      )}
    </div>
  );
}

window.MatchScreen = MatchScreen;
