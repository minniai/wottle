/* =========================================================
   Player profile — modal or full screen
   ========================================================= */
function PlayerProfile({ player, onClose, onChallenge }) {
  const p = player || CURRENT_USER;
  const isSelf = !player;
  const slot = p.handle && p.handle.length % 2 === 0 ? "p1" : "p2";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ position: "absolute", top: 14, right: 14 }}>Close ✕</button>

        <div className="row" style={{ gap: 18, marginBottom: 20 }}>
          <Avatar name={p.name} slot={slot} size={84} />
          <div>
            <div className="eyebrow">{isSelf ? "Your profile" : "Player profile"}</div>
            <div className="display" style={{ fontSize: 36, marginTop: 4, fontStyle: "italic" }}>{p.name}</div>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 2 }}>@{p.handle || "player"} · member since 2025</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, borderTop: "1px solid var(--hair)", borderBottom: "1px solid var(--hair)", padding: "18px 0" }}>
          <Stat label="Rating" value={p.elo || 1728} emphasis />
          <Stat label="Wins" value={p.wins || 146} />
          <Stat label="Losses" value={p.losses || 112} />
          <Stat label="Best word" value={isSelf ? "SKÓGURINN" : "FISKUR"} small />
        </div>

        {/* Rating sparkline */}
        <div style={{ margin: "22px 0" }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Last 30 days</div>
          <div className="spark">
            {RATING_HISTORY.map((v, i) => {
              const min = Math.min(...RATING_HISTORY), max = Math.max(...RATING_HISTORY);
              const h = 8 + ((v - min) / (max - min)) * 46;
              return <div key={i} className="spark-bar" style={{ height: h, background: i === RATING_HISTORY.length - 1 ? "var(--ochre-deep)" : "var(--p2)" }} />;
            })}
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: "space-between", fontSize: 11, color: "var(--ink-soft)" }} className="mono">
            <span>1,500</span><span>peak 1,735</span><span>now {p.elo || 1728}</span>
          </div>
        </div>

        {/* Recent form */}
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Form</div>
          <div className="row" style={{ gap: 4 }}>
            {["W","W","L","W","W","D","L","W","W","W"].map((r, i) => (
              <span key={i} style={{
                width: 22, height: 22, borderRadius: 4,
                display: "grid", placeItems: "center",
                fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500,
                background: r === "W" ? "color-mix(in oklab, var(--good) 25%, var(--paper))" : r === "L" ? "color-mix(in oklab, var(--bad) 22%, var(--paper))" : "var(--paper-3)",
                color: r === "W" ? "color-mix(in oklab, var(--good) 85%, var(--ink))" : r === "L" ? "var(--bad)" : "var(--ink-3)",
              }}>{r}</span>
            ))}
          </div>
        </div>

        {!isSelf && (
          <div className="row" style={{ marginTop: 24, gap: 10 }}>
            <button className="btn btn-primary" onClick={() => { onChallenge && onChallenge(p); onClose(); }}>
              Challenge {p.name.split(" ")[0]} →
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Later</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis, small }) {
  return (
    <div>
      <div className="mono muted" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</div>
      <div style={{
        fontFamily: "var(--display)", fontStyle: "italic", fontWeight: 500,
        fontSize: small ? 18 : emphasis ? 36 : 28,
        color: emphasis ? "var(--ochre-deep)" : "var(--ink)",
        marginTop: 4,
        letterSpacing: small ? "0.02em" : "-0.01em",
      }}>{value}</div>
    </div>
  );
}

/* Invite sent & received dialogs */
function InviteDialog({ opponent, mode = "sent", onClose, onAccept, onDecline }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          {mode === "sent" ? "Invitation sent" : "Invitation received"}
        </div>
        <div className="display" style={{ fontSize: 28, fontStyle: "italic", marginBottom: 18 }}>
          {mode === "sent" ? "Waiting on their reply…" : "Care for a match?"}
        </div>

        <div className="row" style={{ gap: 18, padding: "18px 0", borderTop: "1px solid var(--hair)", borderBottom: "1px solid var(--hair)" }}>
          <Avatar name={opponent.name} slot="p2" size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{opponent.name}</div>
            <div className="mono muted" style={{ fontSize: 12 }}>@{opponent.handle} · {opponent.elo}</div>
          </div>
          <div className="spacer" />
          <Pill>Ranked · 5+0</Pill>
        </div>

        {mode === "sent" && (
          <div style={{ marginTop: 22, fontSize: 13, color: "var(--ink-3)" }}>
            Expires in <b className="mono" style={{ color: "var(--ink)" }}>00:24</b> · you can cancel any time.
          </div>
        )}
        {mode === "received" && (
          <div style={{ marginTop: 22, fontSize: 13, color: "var(--ink-3)" }}>
            {opponent.name.split(" ")[0]} invited you to a ranked match. Accept now to start.
          </div>
        )}

        <div className="row" style={{ marginTop: 24, gap: 10 }}>
          {mode === "sent" && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cancel invite</button>
              <div className="spacer" />
              <span className="mono muted" style={{ fontSize: 11 }}>● ● ●</span>
            </>
          )}
          {mode === "received" && (
            <>
              <button className="btn btn-ghost" onClick={onDecline}>Decline</button>
              <div className="spacer" />
              <button className="btn btn-primary" onClick={onAccept}>Accept · start match</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PlayerProfile, InviteDialog, Stat });
