// Design-sync bundle entry: the curated public surface of Wottle's Warm
// Editorial design system. The app has no library build, so this file IS the
// package entry the converter bundles (cfg.entry). Data-bound screen clients
// (MatchClient, LobbyList, MatchmakingClient, …) and server components
// (TopBar) are deliberately not exported.
import "./stubs/process-shim";

// ui primitives
export { Avatar } from "../components/ui/Avatar";
export { Badge } from "../components/ui/Badge";
export { Button } from "../components/ui/Button";
export { Card } from "../components/ui/Card";
export { Dialog } from "../components/ui/Dialog";
export { GearMenu } from "../components/ui/GearMenu";
export { LogoutConfirmDialog } from "../components/ui/LogoutConfirmDialog";
export { SettingsPanel } from "../components/ui/SettingsPanel";
export { Skeleton } from "../components/ui/Skeleton";
export { Toast } from "../components/ui/Toast";
export { ToastProvider } from "../components/ui/ToastProvider";

// game board
export { Board } from "../components/game/Board";
export { BoardCoordLabels } from "../components/game/BoardCoordLabels";
export { BoardGrid } from "../components/game/BoardGrid";
export { MoveFeedback } from "../components/game/MoveFeedback";

// lobby
export { EmptyLobbyState } from "../components/lobby/EmptyLobbyState";
export { InviteToast } from "../components/lobby/InviteToast";
export { LobbyCard } from "../components/lobby/LobbyCard";
export { LobbyDirectory } from "../components/lobby/LobbyDirectory";
export { LobbyHero } from "../components/lobby/LobbyHero";
export { RecentGamesCard } from "../components/lobby/RecentGamesCard";
export { TopOfBoardCard } from "../components/lobby/TopOfBoardCard";

// match
export { DisconnectionModal } from "../components/match/DisconnectionModal";
export { HowToPlayCard } from "../components/match/HowToPlayCard";
export { HudCard } from "../components/match/HudCard";
export { LegendCard } from "../components/match/LegendCard";
export { MatchCenterChrome } from "../components/match/MatchCenterChrome";
export { MatchLeftRail } from "../components/match/MatchLeftRail";
export { MatchShell } from "../components/match/MatchShell";
export { PlayerAvatar } from "../components/match/PlayerAvatar";
export { PlayerPanel } from "../components/match/PlayerPanel";
export { PostGameScoreboard } from "../components/match/PostGameScoreboard";
export { PostGameVerdict } from "../components/match/PostGameVerdict";
export { RematchBanner } from "../components/match/RematchBanner";
export { RematchInterstitial } from "../components/match/RematchInterstitial";
export { RoundByRoundChart } from "../components/match/RoundByRoundChart";
export { RoundHistoryPanel } from "../components/match/RoundHistoryPanel";
export { RoundPipBar } from "../components/match/RoundPipBar";
export { RoundSummaryPanel } from "../components/match/RoundSummaryPanel";
export { ScoreDeltaPopup } from "../components/match/ScoreDeltaPopup";
export { ScoredWordsCard } from "../components/match/ScoredWordsCard";
export { TilesClaimedCard } from "../components/match/TilesClaimedCard";
export { TimerDisplay } from "../components/match/TimerDisplay";
export { WordHighlightOverlay } from "../components/match/WordHighlightOverlay";
export { WordsOfMatch } from "../components/match/WordsOfMatch";
export { YourMoveCard } from "../components/match/YourMoveCard";

// matchmaking
export { MatchRing } from "../components/matchmaking/MatchRing";
export { MatchmakingVsBlock } from "../components/matchmaking/MatchmakingVsBlock";

// player
export { PlayerProfileModal } from "../components/player/PlayerProfileModal";
export { ProfileActions } from "../components/player/ProfileActions";
export { ProfileFormChips } from "../components/player/ProfileFormChips";
export { ProfileSparkline } from "../components/player/ProfileSparkline";

// profile
export { ProfileMatchHistoryList } from "../components/profile/ProfileMatchHistoryList";
export { ProfilePage } from "../components/profile/ProfilePage";
export { ProfileRatingChart } from "../components/profile/ProfileRatingChart";
export { ProfileSidebar } from "../components/profile/ProfileSidebar";
export { ProfileStat } from "../components/profile/ProfileStat";
export { ProfileWordCloud } from "../components/profile/ProfileWordCloud";
