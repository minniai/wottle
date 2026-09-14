/* =====================================================
   Shared primitives — Avatar, Tile, Chip, SmallStat, Logo
   ===================================================== */

function initials(name) {
  return name.split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name, slot = "p1", size = 42 }) {
  const cls = slot === "p2" ? "avatar p2" : "avatar p1";
  return (
    <div className={cls} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials(name)}
    </div>
  );
}

function Wordmark({ small = false }) {
  return (
    <div className="wordmark" style={small ? { fontSize: 16 } : null}>
      <span><em style={{ fontStyle: "italic" }}>Wottle</em></span>
      <small>word · battle</small>
    </div>
  );
}

function Pill({ children, tone = "default" }) {
  const cls = tone === "p1" ? "pill p1" : tone === "p2" ? "pill p2" : tone === "solid" ? "pill solid" : "pill";
  return <span className={cls}>{children}</span>;
}

function Chip({ on, onClick, children }) {
  return <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
}

function Clock({ ms, active, low }) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cls = `hud-clock ${active ? "active" : ""} ${low ? "low" : ""}`;
  return <div className={cls}>{`${String(m).padStart(1,"0")}:${String(s).padStart(2,"0")}`}</div>;
}

function RoundBar({ current = 7, total = 10 }) {
  return (
    <div className="round-bar" aria-label={`Round ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const cls = n < current ? "done" : n === current ? "current" : "";
        return <span key={n} className={`round-pip ${cls}`} />;
      })}
    </div>
  );
}

/* A letter tile (10×10 board) */
function Tile({ ch, frozen, selected, scored, size, onClick, hint, persona = "p1" }) {
  let cls = "tile";
  if (frozen === "p1") cls += " frozen-p1";
  else if (frozen === "p2") cls += " frozen-p2";
  else if (frozen === "both") cls += " frozen-both";
  if (selected) cls += " selected";
  if (scored) cls += " scored-glow";
  if (hint) cls += " hint";

  return (
    <div className={cls} onClick={onClick} style={size ? { width: size, height: size, fontSize: size * 0.56 } : null}>
      {ch}
      <span className="val">{letterValue(ch)}</span>
    </div>
  );
}

function Board({
  grid = SAMPLE_BOARD,
  frozen = FROZEN,
  selected = [],
  scored = [],
  hints = [],
  size = 48,
  onTileClick,
  showCoords = true,
}) {
  const sel = new Set(selected.map(([x,y]) => `${x},${y}`));
  const sc  = new Set(scored.map(([x,y]) => `${x},${y}`));
  const hi  = new Set(hints.map(([x,y]) => `${x},${y}`));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 0 }}>
      <div />
      {showCoords && (
        <div className="board-coords-top" style={{ gridTemplateColumns: `repeat(10, ${size}px)` }}>
          {"ABCDEFGHIJ".split("").map(c => <span key={c}>{c}</span>)}
        </div>
      )}
      {showCoords && (
        <div className="board-coords-left" style={{ gridTemplateRows: `repeat(10, ${size}px)` }}>
          {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
        </div>
      )}
      <div className="board-wrap">
        <div className="board" style={{ gridTemplateColumns: `repeat(10, ${size}px)`, gridTemplateRows: `repeat(10, ${size}px)` }}>
          {grid.map((row, y) => row.map((ch, x) => (
            <Tile
              key={`${x},${y}`}
              ch={ch}
              size={size}
              frozen={frozen[`${x},${y}`]}
              selected={sel.has(`${x},${y}`)}
              scored={sc.has(`${x},${y}`)}
              hint={hi.has(`${x},${y}`)}
              onClick={() => onTileClick && onTileClick(x, y)}
            />
          )))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  initials, Avatar, Wordmark, Pill, Chip, Clock, RoundBar, Tile, Board,
});
