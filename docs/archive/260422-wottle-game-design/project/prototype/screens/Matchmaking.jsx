/* =========================================================
   Matchmaking screen — search + found state
   ========================================================= */
function MatchmakingScreen({ goTo }) {
  const [elapsed, setElapsed] = React.useState(0);
  const [phase, setPhase] = React.useState("searching"); // searching | found | starting
  const [opponent, setOpponent] = React.useState(null);

  React.useEffect(() => {
    let t;
    if (phase === "searching") {
      t = setInterval(() => setElapsed(e => {
        const n = e + 1;
        if (n >= 4) {
          setOpponent(LOBBY_PLAYERS[0]);
          setPhase("found");
          clearInterval(t);
        }
        return n;
      }), 1000);
    } else if (phase === "found") {
      t = setTimeout(() => setPhase("starting"), 2200);
    } else if (phase === "starting") {
      t = setTimeout(() => goTo("match"), 1400);
    }
    return () => { clearInterval(t); clearTimeout(t); };
  }, [phase]);

  return (
    <div className="screen" style={{ minHeight: "calc(100vh - 58px)", display: "grid", placeItems: "center", padding: 48 }}>
      <div style={{ textAlign: "center", maxWidth: 600 }}>
        {phase === "searching" && (
          <>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Ranked · 5+0 · Icelandic nouns</div>
            <div className="display display-lg" style={{ marginBottom: 40, fontStyle: "italic" }}>
              Finding an opponent within <em style={{ color: "var(--ochre-deep)", fontStyle: "normal" }}>±{200 + elapsed * 50}</em> rating
            </div>
            <div style={{ display: "grid", placeItems: "center", gap: 22 }}>
              <div className="match-ring">
                <Avatar name={CURRENT_USER.name} slot="p1" size={96} />
              </div>
              <div className="mono" style={{ fontSize: 12, letterSpacing: "0.14em", color: "var(--ink-soft)", textTransform: "uppercase" }}>
                Elapsed · {elapsed}s
              </div>
              <button className="btn btn-ghost" onClick={() => goTo("lobby")}>Cancel search</button>
            </div>
          </>
        )}

        {(phase === "found" || phase === "starting") && opponent && (
          <>
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              {phase === "found" ? "Opponent found" : "Starting match…"}
            </div>
            <div className="display display-lg" style={{ marginBottom: 36 }}>
              <em style={{ color: "var(--p1-deep)", fontStyle: "normal" }}>{CURRENT_USER.name}</em><br/>
              <span style={{ fontFamily: "var(--mono)", fontStyle: "normal", fontSize: 18, color: "var(--ink-soft)", letterSpacing: "0.2em" }}>— vs —</span><br/>
              <em style={{ color: "var(--p2-deep)", fontStyle: "normal" }}>{opponent.name}</em>
            </div>
            <div className="row" style={{ justifyContent: "center", gap: 48 }}>
              <div style={{ textAlign: "center" }}>
                <Avatar name={CURRENT_USER.name} slot="p1" size={80} />
                <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--ink-soft)" }}>{CURRENT_USER.elo}</div>
              </div>
              <div style={{ alignSelf: "center", fontFamily: "var(--display)", fontStyle: "italic", fontSize: 28, color: "var(--ink-soft)" }}>×</div>
              <div style={{ textAlign: "center" }}>
                <Avatar name={opponent.name} slot="p2" size={80} />
                <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--ink-soft)" }}>{opponent.elo}</div>
              </div>
            </div>
            <div style={{ marginTop: 32, fontSize: 13, color: "var(--ink-3)" }}>
              {phase === "starting" ? "Assigning roles · generating board…" : "Both players ready."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

window.MatchmakingScreen = MatchmakingScreen;
