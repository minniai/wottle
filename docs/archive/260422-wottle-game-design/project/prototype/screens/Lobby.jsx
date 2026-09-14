/* =========================================================
   Lobby screen — the hub
   ========================================================= */
function LobbyHero({ goTo }) {
  return (
    <div className="hero">
      <div className="hero-inner">
        <div>
          <div className="eyebrow">Live lobby · 12 players online · 4 matches in progress</div>
          <h1>
            Good evening,<br/>
            <em>Ásta.</em><br/>
            Who will it be?
          </h1>
          <p className="hero-sub">
            Pick a player from the floor below to challenge directly, or press <b>Play now</b> and we&rsquo;ll pair you by rating.
          </p>

          <div className="row" style={{ marginTop: 28, gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => goTo("matchmaking")} style={{ padding: "14px 22px" }}>
              ◆ Play now
            </button>
            <div className="chip-row" style={{ marginLeft: 8 }}>
              <Chip on>Ranked</Chip>
              <Chip>Casual</Chip>
              <Chip>Challenge</Chip>
            </div>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-row">
            <span className="stat-k">Your rating</span>
            <span className="stat-v">1,728</span>
          </div>
          <div className="stat-row">
            <span className="stat-k">Record</span>
            <span className="stat-v">146-112-14</span>
          </div>
          <div className="stat-row">
            <span className="stat-k">Longest word</span>
            <span className="stat-v" style={{ fontSize: 22 }}>SKÓGURINN</span>
          </div>
          <div className="stat-row">
            <span className="stat-k">Today</span>
            <span className="stat-v">+24</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ p, onChallenge, onPeek }) {
  const slot = p.handle.length % 2 === 0 ? "p1" : "p2";
  return (
    <div
      className={`player-card ${p.queueing ? "queueing" : ""}`}
      onClick={() => onPeek(p)}
    >
      <div className="player-card-top">
        <Avatar name={p.name} slot={slot} />
        <div style={{ minWidth: 0 }}>
          <div className="player-name" title={p.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </div>
          <div className="player-handle">@{p.handle} · {p.elo}</div>
        </div>
      </div>
      <div className="player-meta">
        <span>
          {p.status === "queueing" && <><span className="dot-status" style={{ background: "var(--ochre-deep)" }} /> Queueing</>}
          {p.status === "available" && <><span className="dot-status" /> Available</>}
          {p.status === "in-game" && <><span className="dot-status" style={{ background: "var(--ink-soft)" }} /> In game</>}
        </span>
        <span>W <b>{p.wins}</b></span>
      </div>
      {p.status === "available" && (
        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onChallenge(p); }}>
          Challenge →
        </button>
      )}
      {p.status === "queueing" && (
        <button className="btn btn-accent btn-sm" onClick={(e) => { e.stopPropagation(); onChallenge(p); }}>
          Accept queue match →
        </button>
      )}
      {p.status === "in-game" && (
        <button className="btn btn-ghost btn-sm" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
          Spectate (soon)
        </button>
      )}
    </div>
  );
}

function LobbyScreen({ goTo, onInvite, onPeek }) {
  const [filter, setFilter] = React.useState("all");
  const players = LOBBY_PLAYERS.filter(p => filter === "all" ? true : p.status === filter);

  return (
    <div className="screen">
      <LobbyHero goTo={goTo} />

      <div className="section">
        <div className="section-head">
          <div>
            <h2>The floor</h2>
            <div className="meta" style={{ marginTop: 4 }}>{LOBBY_PLAYERS.length} players · updated live</div>
          </div>
          <div className="chip-row">
            <Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
            <Chip on={filter === "available"} onClick={() => setFilter("available")}>Available</Chip>
            <Chip on={filter === "queueing"} onClick={() => setFilter("queueing")}>In queue</Chip>
            <Chip on={filter === "in-game"} onClick={() => setFilter("in-game")}>Playing</Chip>
          </div>
        </div>

        <div className="lobby-grid">
          {players.map(p => (
            <PlayerCard key={p.handle} p={p} onChallenge={onInvite} onPeek={onPeek} />
          ))}
        </div>

        {/* Recent activity */}
        <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 28 }}>
          <div className="card">
            <div className="panel-head"><h3>Your recent games</h3><span className="mono muted" style={{ fontSize: 11 }}>Last 7 days</span></div>
            <div>
              {RECENT_GAMES.map((g, i) => (
                <div className="hist-row" key={i}>
                  <span className={`hist-result ${g.result}`}>{g.result === "win" ? "W" : g.result === "loss" ? "L" : "D"}</span>
                  <span>vs <b>@{g.opp}</b></span>
                  <span className="mono muted">{g.score}</span>
                  <span className="mono muted">{g.words} words</span>
                  <span className="mono muted">{g.d}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="panel-head"><h3>Top of the board</h3><span className="mono muted" style={{ fontSize: 11 }}>Season 1</span></div>
            <div>
              {LOBBY_PLAYERS.slice().sort((a,b) => b.elo - a.elo).slice(0, 6).map((p, i) => (
                <div className="hist-row" key={i} style={{ gridTemplateColumns: "18px 34px 1fr auto" }}>
                  <span className="mono muted">{i + 1}</span>
                  <Avatar name={p.name} slot={i % 2 ? "p2" : "p1"} size={28} />
                  <span>{p.name}</span>
                  <span className="mono" style={{ color: "var(--ink)" }}>{p.elo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.LobbyScreen = LobbyScreen;
