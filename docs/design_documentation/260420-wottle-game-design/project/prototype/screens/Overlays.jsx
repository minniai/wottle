/* =========================================================
   Overlays — disconnection pause, invite toast, empty lobby
   ========================================================= */

function DisconnectionOverlay({ opponentName = "Sigríður P.", onCancel }) {
  const [sec, setSec] = React.useState(42);
  React.useEffect(() => {
    const t = setInterval(() => setSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="disc-overlay">
      <div className="disc-card">
        <div className="disc-pulse"><div className="disc-dot" /></div>
        <div>
          <div className="eyebrow" style={{ color: "var(--warn)", marginBottom: 6 }}>Connection lost</div>
          <h3 style={{ margin: 0, fontFamily: "var(--display)", fontStyle: "italic", fontWeight: 400, fontSize: 26, color: "var(--ink)" }}>
            {opponentName} dropped out.
          </h3>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, margin: 0, maxWidth: "30ch" }}>
          The match is paused. We'll wait up to 90 seconds for them to reconnect, or you can claim the win.
        </p>
        <div className="mono" style={{ fontSize: 28, color: "var(--ink)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
          0:{String(sec).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ flex: 1 }}>Keep waiting</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>Claim win</button>
        </div>
      </div>
    </div>
  );
}

function InviteToast({ player, onAccept, onDecline, onClose }) {
  return (
    <div className="invite-toast">
      <div className="toast-head">
        <Avatar name={player?.name || "Ragnar Þ."} slot="p2" size={34} />
        <div>
          <div className="toast-eyebrow">Challenge received</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}>
            {player?.name || "Ragnar Þórsson"}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11 }}
        >✕</button>
      </div>
      <div className="toast-body">
        <span className="toast-name">Ranked</span> · 10 rounds · your rating <b className="mono">1,728</b> vs <b className="mono">1,802</b>.
      </div>
      <div className="toast-actions">
        <button className="btn btn-ghost btn-sm" onClick={onDecline} style={{ flex: 1 }}>Decline</button>
        <button className="btn btn-primary btn-sm" onClick={onAccept} style={{ flex: 1 }}>Accept →</button>
      </div>
    </div>
  );
}

function EmptyLobbyState({ goTo }) {
  return (
    <div className="empty-state">
      <div className="empty-tile-cluster">
        {"QUIET".split("").map((c, i) => (
          <div key={i} className="tile" style={{ width: 40, height: 40, fontSize: 20 }}>{c}</div>
        ))}
      </div>
      <div className="eyebrow" style={{ marginTop: 4 }}>Nobody on the floor · 03:14 local</div>
      <h3>The library is empty tonight.</h3>
      <p>
        No challengers online right now. Join the matchmaking queue and we'll notify you the moment a rated player arrives.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={() => goTo("matchmaking")}>◆ Join the queue</button>
        <button className="btn btn-ghost">Play a bot</button>
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginTop: 12, letterSpacing: "0.1em" }}>
        AVG · 14 PLAYERS AT THIS HOUR
      </div>
    </div>
  );
}

Object.assign(window, { DisconnectionOverlay, InviteToast, EmptyLobbyState });
