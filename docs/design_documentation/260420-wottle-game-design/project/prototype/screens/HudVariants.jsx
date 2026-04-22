/* =========================================================
   HUD variants for Match screen
   ========================================================= */

function HudChessClock({ yourMs, oppMs, submitted, goTo }) {
  return (
    <div>
      <div className="hud-chess">
        <div className="hud-card opp">
          <div className="hud-row">
            <Avatar name="Sigríður P." slot="p2" size={36} />
            <div>
              <div className="hud-name">Sigríður Pálsdóttir</div>
              <div className="hud-meta">Black · 1,842</div>
            </div>
            <span className="hud-score-inline" style={{ marginLeft: "auto", color: "var(--p2-deep)" }}>176</span>
          </div>
          <div className={`hud-clock-xl ${submitted ? "active" : "inactive"} ${oppMs < 60_000 ? "low" : ""}`}>
            {formatClock(oppMs)}
          </div>
        </div>
        <div className="hud-card you">
          <div className="hud-row">
            <Avatar name={CURRENT_USER.name} slot="p1" size={36} />
            <div>
              <div className="hud-name">Ásta Kristín</div>
              <div className="hud-meta">White · 1,728</div>
            </div>
            <span className="hud-score-inline" style={{ marginLeft: "auto", color: "var(--p1-deep)" }}>198</span>
          </div>
          <div className={`hud-clock-xl ${!submitted ? "active" : "inactive"} ${yourMs < 60_000 ? "low" : ""}`}>
            {formatClock(yourMs)}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--paper-2)", border: "1px solid var(--hair)", borderRadius: 8 }}>
        <div className="eyebrow">Round 7 / 10</div>
        <RoundBar current={7} total={10} />
        <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {submitted ? "WAITING" : "YOUR MOVE"}
        </div>
      </div>
    </div>
  );
}

function HudTopBottom({ yourMs, oppMs, submitted }) {
  return (
    <div className="hud-topbottom">
      <div className="hud-strip opp">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar name="Sigríður P." slot="p2" size={36} />
          <div>
            <div className="name">Sigríður Pálsdóttir</div>
            <div className="meta-mono">1,842 · 6 matches</div>
          </div>
        </div>
        <Clock ms={oppMs} active={submitted} low={oppMs < 60_000} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, justifySelf: "end" }}>
          <span className="meta-mono">Score</span>
          <span className="score-big" style={{ color: "var(--p2-deep)" }}>176</span>
        </div>
      </div>

      <div className="round-inline">
        <div className="eyebrow">Round 7 / 10</div>
        <RoundBar current={7} total={10} />
        <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {submitted ? "WAITING FOR OPPONENT" : "YOUR MOVE · SWAP TWO TILES"}
        </div>
      </div>

      <div className="hud-strip you">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar name={CURRENT_USER.name} slot="p1" size={36} />
          <div>
            <div className="name">Ásta Kristín · you</div>
            <div className="meta-mono">1,728 · 6 matches</div>
          </div>
        </div>
        <Clock ms={yourMs} active={!submitted} low={yourMs < 60_000} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, justifySelf: "end" }}>
          <span className="meta-mono">Score</span>
          <span className="score-big" style={{ color: "var(--p1-deep)" }}>198</span>
        </div>
      </div>
    </div>
  );
}

function formatClock(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(1, "0")}:${String(s).padStart(2, "0")}`;
}

Object.assign(window, { HudChessClock, HudTopBottom });
