/* =========================================================
   Landing screen — first-run entry to the game
   ========================================================= */
function LandingScreen({ onSubmit, goTo }) {
  const [name, setName] = React.useState("");
  return (
    <div className="screen" style={{ minHeight: "calc(100vh - 58px)", display: "grid", placeItems: "center", padding: 48 }}>
      <div style={{ maxWidth: 720, textAlign: "center" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>A real-time word duel · Icelandic · English · Norwegian</div>
        <h1 className="display display-xl" style={{ margin: 0, lineHeight: 1.15 }}>
          Play with <em style={{ color: "var(--ochre-deep)", fontStyle: "normal", display: "inline-block", lineHeight: 1, paddingBottom: "0.22em" }}>letters.</em>
        </h1>
        <p style={{ fontSize: 17, color: "var(--ink-3)", maxWidth: 52 + "ch", margin: "56px auto 0", lineHeight: 1.6 }}>
          Two players. Ten rounds. A ten‑by‑ten grid. Swap any two tiles to forge words in any direction — and claim the letters as territory. Best score wins.
        </p>
        <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 34 }}>
          <div style={{ position: "relative" }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Choose a username"
              style={{
                width: 280, padding: "14px 18px",
                border: "1px solid var(--hair-strong)", borderRadius: 999,
                fontSize: 15, fontFamily: "var(--sans)", background: "var(--paper)", color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => goTo("lobby")}>
            Enter lobby →
          </button>
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 18, marginTop: 24, fontSize: 12, color: "var(--ink-soft)" }}>
          <span>3–24 characters · letters, numbers, dashes</span>
          <span>·</span>
          <span>Magic link after first game</span>
        </div>

        {/* Decorative tile vignette */}
        <div style={{ marginTop: 64, display: "flex", justifyContent: "center", gap: 4, opacity: 0.9 }}>
          {["W","O","T","T","L","E"].map((c, i) => (
            <Tile key={i} ch={c} size={56} />
          ))}
        </div>
        <div className="mono" style={{ marginTop: 14, fontSize: 10, letterSpacing: "0.18em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
          WO-rd · ba-TTLE
        </div>
      </div>
    </div>
  );
}

window.LandingScreen = LandingScreen;
