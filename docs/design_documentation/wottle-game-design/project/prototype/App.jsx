/* =========================================================
   App shell — routes between screens + tweaks panel
   ========================================================= */
const SCREENS = [
  { id: "landing",     label: "Landing" },
  { id: "lobby",       label: "Lobby" },
  { id: "matchmaking", label: "Matchmaking" },
  { id: "match",       label: "In match" },
  { id: "postgame",    label: "Post‑game" },
  { id: "profile",     label: "Profile" },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "screen": "lobby",
  "tileSize": 52,
  "tileStyle": "letterpress",
  "frozenStyle": "band",
  "hudVariant": "classic",
  "lobbyVariant": "classic",
  "p1Hue": 60,
  "p2Hue": 220,
  "coordsVisible": true,
  "showLetterValues": true,
  "lang": "en",
  "lobbyEmpty": false,
  "showToast": false,
  "showDisconnect": false
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweaks] = React.useState(() => {
    try {
      const saved = localStorage.getItem("wottle-tweaks");
      if (saved) return { ...TWEAK_DEFAULTS, ...JSON.parse(saved) };
    } catch (e) {}
    return TWEAK_DEFAULTS;
  });
  const [screen, setScreen] = React.useState(() => {
    const saved = localStorage.getItem("wottle-screen");
    return saved || tweaks.screen || "lobby";
  });
  const [inviteFor, setInviteFor] = React.useState(null);
  const [peekPlayer, setPeekPlayer] = React.useState(null);
  const [selfProfile, setSelfProfile] = React.useState(false);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [editModeOn, setEditModeOn] = React.useState(false);
  const [toastVisible, setToastVisible] = React.useState(false);

  // Persist screen + tweaks
  React.useEffect(() => { localStorage.setItem("wottle-screen", screen); }, [screen]);
  React.useEffect(() => { localStorage.setItem("wottle-tweaks", JSON.stringify(tweaks)); }, [tweaks]);

  // Invite toast controlled via tweak
  React.useEffect(() => { setToastVisible(!!tweaks.showToast); }, [tweaks.showToast]);

  // Apply dynamic CSS vars
  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--p1", `oklch(0.68 0.14 ${tweaks.p1Hue})`);
    r.style.setProperty("--p1-tint", `oklch(0.92 0.06 ${tweaks.p1Hue})`);
    r.style.setProperty("--p1-deep", `oklch(0.48 0.14 ${tweaks.p1Hue})`);
    r.style.setProperty("--p2", `oklch(0.56 0.08 ${tweaks.p2Hue})`);
    r.style.setProperty("--p2-tint", `oklch(0.92 0.035 ${tweaks.p2Hue})`);
    r.style.setProperty("--p2-deep", `oklch(0.38 0.08 ${tweaks.p2Hue})`);
    r.style.setProperty("--tile-size", `${tweaks.tileSize}px`);

    const existing = document.getElementById("dyn-style");
    if (existing) existing.remove();
    const s = document.createElement("style");
    s.id = "dyn-style";
    let css = "";
    if (tweaks.frozenStyle === "tint") {
      css += `.tile.frozen-p1::before, .tile.frozen-p2::before { box-shadow: none !important; }`;
    } else if (tweaks.frozenStyle === "bold") {
      css += `
        .tile.frozen-p1 { background: var(--p1) !important; color: var(--paper) !important; }
        .tile.frozen-p2 { background: var(--p2) !important; color: var(--paper) !important; }
        .tile.frozen-p1::before, .tile.frozen-p2::before { box-shadow: none !important; }
        .tile.frozen-p1 .val, .tile.frozen-p2 .val { color: color-mix(in oklab, var(--paper) 75%, transparent) !important; }
        .tile.frozen-both { background: linear-gradient(135deg, var(--p1) 50%, var(--p2) 50%) !important; color: var(--paper) !important; }
        .tile.frozen-both .val { color: color-mix(in oklab, var(--paper) 75%, transparent) !important; }
      `;
    }
    if (!tweaks.showLetterValues) css += `\n.tile .val { display: none; }`;
    s.textContent = css;
    document.head.appendChild(s);
  }, [tweaks]);

  // Edit mode plumbing
  React.useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "__activate_edit_mode") setEditModeOn(true);
      if (e.data?.type === "__deactivate_edit_mode") setEditModeOn(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  // Tweak helper
  const updateTweak = (k, v) => {
    setTweaks(prev => {
      const next = { ...prev, [k]: v };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
      return next;
    });
  };

  const goTo = (s) => setScreen(s);
  const lang = tweaks.lang || "en";
  const brand = BRAND[lang];

  return (
    <div className={`app-shell tiles-${tweaks.tileStyle} lobby-${tweaks.lobbyVariant}`} data-screen-label={screen} data-lang={lang}>
      {/* Top bar */}
      <div className="topbar">
        <div className="row" style={{ gap: 20, alignItems: "center" }}>
          <div className="wordmark" style={{ fontSize: 18 }}>
            <span><em style={{ fontStyle: "italic" }}>{brand.name}</em></span>
            <small>{brand.tagline}</small>
          </div>
          <div className="lang-switch">
            <button className={lang === "en" ? "on" : ""} onClick={() => updateTweak("lang", "en")}>EN</button>
            <button className={lang === "is" ? "on" : ""} onClick={() => updateTweak("lang", "is")}>IS</button>
          </div>
        </div>
        <div className="top-nav">
          {SCREENS.map(s => (
            <a key={s.id} className={screen === s.id ? "active" : ""} onClick={() => goTo(s.id)}>
              {t(lang, s.id) || s.label}
            </a>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setTweaksOpen(o => !o)}
            style={{ marginLeft: 8 }}
          >
            ⚙ {t(lang, "tweaks")}
          </button>
        </div>
      </div>

      {/* Current screen */}
      {screen === "landing"     && <LandingScreen goTo={goTo} lang={lang} />}
      {screen === "lobby"       && (
        tweaks.lobbyEmpty
          ? <EmptyLobbyScreen goTo={goTo} lang={lang} />
          : <LobbyScreen goTo={goTo} onInvite={setInviteFor} onPeek={setPeekPlayer} lang={lang} variant={tweaks.lobbyVariant} />
      )}
      {screen === "matchmaking" && <MatchmakingScreen goTo={goTo} />}
      {screen === "match"       && (
        <MatchScreen
          goTo={goTo}
          hudVariant={tweaks.hudVariant}
          tileStyle={tweaks.tileStyle}
          showDisconnect={tweaks.showDisconnect}
        />
      )}
      {screen === "postgame"    && <PostGameScreen goTo={goTo} />}
      {screen === "profile"     && <ProfilePage goTo={goTo} />}

      {/* Overlays */}
      {inviteFor && (
        <InviteDialog
          opponent={inviteFor}
          mode="sent"
          onClose={() => setInviteFor(null)}
          onAccept={() => { setInviteFor(null); goTo("match"); }}
        />
      )}
      {peekPlayer && (
        <PlayerProfile
          player={peekPlayer}
          onClose={() => setPeekPlayer(null)}
          onChallenge={setInviteFor}
        />
      )}
      {selfProfile && (
        <PlayerProfile onClose={() => setSelfProfile(false)} />
      )}

      {/* Invite toast (tweak-controlled) */}
      {toastVisible && (
        <InviteToast
          player={LOBBY_PLAYERS[2]}
          onAccept={() => { setToastVisible(false); updateTweak("showToast", false); goTo("match"); }}
          onDecline={() => { setToastVisible(false); updateTweak("showToast", false); }}
          onClose={() => { setToastVisible(false); updateTweak("showToast", false); }}
        />
      )}

      {/* Tweaks panel */}
      {(tweaksOpen || editModeOn) && (
        <div className="tweaks">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h4>Tweaks</h4>
            <button className="btn btn-ghost btn-sm" onClick={() => setTweaksOpen(false)} style={{ padding: "3px 8px" }}>✕</button>
          </div>

          <div className="tweak-row">
            <label>Screen</label>
            <select value={screen} onChange={e => goTo(e.target.value)}>
              {SCREENS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div style={{ margin: "8px 0", padding: "8px 0", borderTop: "1px dashed var(--hair)", borderBottom: "1px dashed var(--hair)" }}>
            <div className="mono muted" style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Match</div>

            <div className="tweak-row">
              <label>HUD layout</label>
              <select value={tweaks.hudVariant} onChange={e => updateTweak("hudVariant", e.target.value)}>
                <option value="classic">Classic · side-by-side</option>
                <option value="chess">Chess clock · large timer</option>
                <option value="topbottom">Top / bottom strips</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Tile style</label>
              <select value={tweaks.tileStyle} onChange={e => updateTweak("tileStyle", e.target.value)}>
                <option value="letterpress">Letterpress · editorial</option>
                <option value="dimensional">Dimensional · Scrabble</option>
                <option value="paper">Paper · crossword</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Tile size</label>
              <select value={tweaks.tileSize} onChange={e => updateTweak("tileSize", Number(e.target.value))}>
                <option value={42}>Compact · 42</option>
                <option value={48}>Regular · 48</option>
                <option value={52}>Comfort · 52</option>
                <option value={60}>Large · 60</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Frozen tiles</label>
              <select value={tweaks.frozenStyle} onChange={e => updateTweak("frozenStyle", e.target.value)}>
                <option value="band">Balanced · corner band</option>
                <option value="tint">Subtle · tint only</option>
                <option value="bold">Bold · solid territory</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Letter values</label>
              <select value={tweaks.showLetterValues ? "yes" : "no"} onChange={e => updateTweak("showLetterValues", e.target.value === "yes")}>
                <option value="yes">Shown · subscript</option>
                <option value="no">Hidden</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Disconnection</label>
              <select value={tweaks.showDisconnect ? "yes" : "no"} onChange={e => updateTweak("showDisconnect", e.target.value === "yes")}>
                <option value="no">Normal play</option>
                <option value="yes">Opponent dropped</option>
              </select>
            </div>
          </div>

          <div style={{ margin: "8px 0", padding: "8px 0", borderBottom: "1px dashed var(--hair)" }}>
            <div className="mono muted" style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Lobby</div>

            <div className="tweak-row">
              <label>Lobby layout</label>
              <select value={tweaks.lobbyVariant} onChange={e => updateTweak("lobbyVariant", e.target.value)}>
                <option value="classic">Classic · hero + grid</option>
                <option value="arena">Arena · dark cinematic</option>
                <option value="minimal">Minimal · big CTA</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Lobby state</label>
              <select value={tweaks.lobbyEmpty ? "empty" : "full"} onChange={e => updateTweak("lobbyEmpty", e.target.value === "empty")}>
                <option value="full">Populated</option>
                <option value="empty">Empty · nobody online</option>
              </select>
            </div>

            <div className="tweak-row">
              <label>Invite toast</label>
              <select value={tweaks.showToast ? "yes" : "no"} onChange={e => updateTweak("showToast", e.target.value === "yes")}>
                <option value="no">Hidden</option>
                <option value="yes">Showing</option>
              </select>
            </div>
          </div>

          <div className="tweak-row">
            <label>Your hue</label>
            <select value={tweaks.p1Hue} onChange={e => updateTweak("p1Hue", Number(e.target.value))}>
              <option value={60}>Ochre</option>
              <option value={30}>Clay</option>
              <option value={145}>Moss</option>
              <option value={320}>Plum</option>
              <option value={200}>Cerulean</option>
            </select>
          </div>

          <div className="tweak-row">
            <label>Opponent hue</label>
            <select value={tweaks.p2Hue} onChange={e => updateTweak("p2Hue", Number(e.target.value))}>
              <option value={220}>Slate‑teal</option>
              <option value={260}>Slate‑violet</option>
              <option value={170}>Emerald</option>
              <option value={15}>Rust</option>
              <option value={290}>Wine</option>
            </select>
          </div>

          <div className="tweak-row">
            <label>Language</label>
            <select value={lang} onChange={e => updateTweak("lang", e.target.value)}>
              <option value="en">English · Wottle</option>
              <option value="is">Íslenska · Orðusta</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

window.App = App;

// Empty lobby wrapper screen
function EmptyLobbyScreen({ goTo, lang }) {
  return (
    <div className="screen">
      <div className="hero" style={{ padding: "64px 48px 40px" }}>
        <div className="hero-inner" style={{ gridTemplateColumns: "1fr" }}>
          <div>
            <div className="eyebrow">{t(lang, "liveLobby")} · 0 {t(lang, "playersOnline")}</div>
            <h1 style={{ fontSize: "clamp(48px, 6vw, 80px)", margin: "14px 0 0" }}>
              {t(lang, "goodEvening")}<br/>
              <em style={{ fontStyle: "normal", color: "var(--ochre-deep)" }}>Ásta.</em>
            </h1>
          </div>
        </div>
      </div>
      <div className="section">
        <EmptyLobbyState goTo={goTo} />
      </div>
    </div>
  );
}
window.EmptyLobbyScreen = EmptyLobbyScreen;

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
