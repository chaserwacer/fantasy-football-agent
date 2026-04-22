from __future__ import annotations

import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from sleeper_client import SleeperApiError, SleeperClient, TTLCache


class CommissionerService:
    """Builds app-ready fantasy context from Sleeper and external team signals."""

    POS_COLORS = {
        "QB": "#C44536",
        "RB": "#2B7A4B",
        "WR": "#3A6EA5",
        "TE": "#B88A2F",
        "K": "#6B6760",
        "DEF": "#6B6760",
        "FLEX": "#141413",
    }

    SLOT_ELIGIBILITY = {
        "QB": {"QB"},
        "RB": {"RB"},
        "WR": {"WR"},
        "TE": {"TE"},
        "K": {"K"},
        "DEF": {"DEF"},
        "DST": {"DEF"},
        "DL": {"DL", "DE", "DT"},
        "LB": {"LB"},
        "DB": {"DB", "CB", "S"},
        "IDP": {"DL", "DE", "DT", "LB", "DB", "CB", "S"},
        "FLEX": {"RB", "WR", "TE"},
        "REC_FLEX": {"WR", "TE"},
        "WRRB_FLEX": {"WR", "RB"},
        "RBWR_FLEX": {"RB", "WR"},
        "WRT_FLEX": {"WR", "RB", "TE"},
        "SUPER_FLEX": {"QB", "RB", "WR", "TE"},
        "OP": {"QB", "RB", "WR", "TE"},
    }

    def __init__(self, sleeper_client: SleeperClient) -> None:
        self._sleeper = sleeper_client
        self._cache = TTLCache()

    def build_context(
        self,
        *,
        username: str,
        season: Optional[int] = None,
        week: Optional[int] = None,
    ) -> Dict[str, Any]:
        cache_key = f"ctx:{username}:{season or 'auto'}:{week or 'auto'}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        state = self._sleeper.get_state()
        state_season = int(state.get("season", 0) or 0)
        requested_season = season or state_season
        requested_week = week or int(state.get("week", 1) or 1)
        if requested_week <= 0:
            requested_week = 1

        user = self._sleeper.get_user_by_username(username)
        user_id = str(user.get("user_id"))
        leagues = self._collect_leagues(user_id=user_id, season=requested_season)
        league, league_detail, rosters = self._select_viable_league(leagues, user_id)
        league_id = str(league["league_id"])

        season = int(league.get("season") or requested_season)
        week = requested_week if season == state_season else 17
        users = self._sleeper.get_league_users(league_id)
        matchups = self._sleeper.get_matchups(league_id, week)

        players = self._sleeper.get_players()
        scoring = league_detail.get("scoring_settings") or {}
        projections = self._sleeper.get_projections(season, week)
        stats = self._sleeper.get_stats(season, week)
        previous_week = max(1, week - 1)
        previous_projections = self._sleeper.get_projections(season, previous_week)
        team_strength = self._get_external_team_strength()

        users_by_id = {str(u.get("user_id")): u for u in users}
        my_roster = self._find_user_roster(rosters, user_id)
        if my_roster is None:
            raise SleeperApiError("Unable to locate roster for the requested user in the active league.")

        roster_rows, starters, bench = self._build_roster_rows(
            league=league_detail,
            roster=my_roster,
            players=players,
            projections=projections,
            stats=stats,
            previous_projections=previous_projections,
            scoring=scoring,
        )

        startsit = self._build_start_sit_recommendations(
            starters=starters,
            bench=bench,
            team_strength=team_strength,
        )

        next_opponent, opp_roster, my_projection, opp_projection = self._build_matchup_view(
            league=league_detail,
            rosters=rosters,
            users_by_id=users_by_id,
            my_roster=my_roster,
            matchups=matchups,
            week=week,
            players=players,
            projections=projections,
            scoring=scoring,
        )

        draft_queue = self._build_priority_queue(
            roster_rows=roster_rows,
            players=players,
            projections=projections,
            scoring=scoring,
        )
        draft_board = self._build_priority_board(draft_queue, self._team_label(users_by_id.get(user_id), my_roster))
        news = self._build_news(startsit, roster_rows, draft_queue, team_strength)

        ranked = self._rank_rosters(rosters)
        roster_id = int(my_roster.get("roster_id", 0))
        rank = next((idx + 1 for idx, r in enumerate(ranked) if int(r.get("roster_id", -1)) == roster_id), 0)
        settings = my_roster.get("settings") or {}

        league_payload = {
            "name": league_detail.get("name") or league.get("name") or "Sleeper League",
            "format": self._format_league(league_detail),
            "teams": int(league_detail.get("total_rosters") or len(rosters) or 0),
            "week": week,
            "season": season,
            "scoring": self._scoring_summary(scoring),
            "user": {
                "handle": user.get("username") or username,
                "team": self._team_label(users_by_id.get(user_id), my_roster),
                "record": self._record_label(settings),
                "rank": rank,
                "pointsFor": round(self._points_for(settings), 1),
            },
            "nextOpponent": next_opponent,
            "myProjection": round(my_projection, 1),
            "oppProjection": round(opp_projection, 1),
        }

        payload = {
            "LEAGUE": league_payload,
            "ROSTER": roster_rows,
            "STARTSIT": startsit,
            "DRAFT_QUEUE": draft_queue,
            "DRAFT_BOARD": draft_board,
            "OPP_ROSTER": opp_roster,
            "NEWS": news,
            "POS_COLORS": self.POS_COLORS,
            "META": {
                "league_id": league_id,
                "roster_id": int(my_roster.get("roster_id", 0)),
                "username": username,
            },
        }
        self._cache.set(cache_key, payload, ttl_seconds=90)
        return payload

    def answer_chat(self, *, message: str, username: str, season: Optional[int] = None, week: Optional[int] = None) -> str:
        """Returns lightweight assistant responses grounded in current context."""
        ctx = self.build_context(username=username, season=season, week=week)
        text = (message or "").strip().lower()

        startsit = ctx.get("STARTSIT") or []
        queue = ctx.get("DRAFT_QUEUE") or []
        league = ctx.get("LEAGUE") or {}

        if any(k in text for k in ["start", "sit", "lineup", "flex"]):
            if startsit:
                top = startsit[0]
                return (
                    f"Top lineup call: start {top['recommendStart']} at {top['slot']} over {top['recommendSit']} "
                    f"({top['edge']} pts edge, {top['confidence']}% confidence)."
                )
            return "No start or sit edge found yet."

        if any(k in text for k in ["waiver", "wire", "pickup", "add"]):
            if queue:
                best = queue[0]
                return f"Best waiver-style add right now: {best['n']} ({best['pos']}, {best['team']}). {best['note']}"
            return "Waiver recommendations are currently unavailable."

        if any(k in text for k in ["matchup", "win", "opponent", "spread"]):
            opp = league.get("nextOpponent") or {}
            return (
                f"You are facing {opp.get('team', 'your opponent')} with win probability {opp.get('winProb', 50)}%. "
                f"Current spread: {opp.get('projSpread', 0)} points."
            )

        if any(k in text for k in ["trade", "target"]):
            if queue:
                top_two = ", ".join(p["n"] for p in queue[:2])
                return f"Trade target archetypes to probe this week: {top_two}. Start with 2-for-1 offers from bench depth."
            return "Trade targets are still loading."

        if startsit:
            first = startsit[0]
            return (
                f"This week, your highest-value move is {first['recommendStart']} over {first['recommendSit']} in {first['slot']}. "
                "Ask me about matchup, waivers, or trade targets for deeper guidance."
            )
        return "I am synced but waiting for enough projection data to make a recommendation."

    def _league_score(self, item: Dict[str, Any]) -> Tuple[int, int, int]:
        status = str(item.get("status", "")).lower()
        status_rank = {
            "in_season": 5,
            "drafting": 4,
            "pre_draft": 3,
            "complete": 2,
        }.get(status, 1)
        total_rosters = int(item.get("total_rosters") or 0)
        season = int(item.get("season") or 0)
        return status_rank, total_rosters, season

    def _collect_leagues(self, *, user_id: str, season: int) -> List[Dict[str, Any]]:
        seasons = [season, max(0, season - 1)]
        merged: Dict[str, Dict[str, Any]] = {}
        for season_candidate in seasons:
            for league in self._sleeper.get_user_leagues(user_id=user_id, season=season_candidate):
                league_id = str(league.get("league_id"))
                if league_id and league_id not in merged:
                    merged[league_id] = league
        return list(merged.values())

    def _select_viable_league(
        self,
        leagues: List[Dict[str, Any]],
        user_id: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
        if not leagues:
            raise SleeperApiError("No NFL leagues were found for this user.")

        fallback: Optional[Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]] = None
        for candidate in sorted(leagues, key=self._league_score, reverse=True):
            league_id = str(candidate.get("league_id"))
            league_detail = self._sleeper.get_league(league_id)
            rosters = self._sleeper.get_league_rosters(league_id)
            if fallback is None:
                fallback = (candidate, league_detail, rosters)
            my_roster = self._find_user_roster(rosters, user_id)
            if my_roster and (my_roster.get("players") or my_roster.get("starters")):
                return candidate, league_detail, rosters

        if fallback is None:
            raise SleeperApiError("Unable to load league data from Sleeper.")
        return fallback

    def _find_user_roster(self, rosters: List[Dict[str, Any]], user_id: str) -> Optional[Dict[str, Any]]:
        for roster in rosters:
            if str(roster.get("owner_id")) == user_id:
                return roster
            co_owners = roster.get("co_owners") or []
            if any(str(owner) == user_id for owner in co_owners):
                return roster
        return None

    def _starter_slots(self, league: Dict[str, Any]) -> List[str]:
        blocked = {"BN", "IR", "TAXI", "RES", "PUP"}
        return [slot for slot in (league.get("roster_positions") or []) if slot not in blocked]

    def _build_roster_rows(
        self,
        *,
        league: Dict[str, Any],
        roster: Dict[str, Any],
        players: Dict[str, Dict[str, Any]],
        projections: Dict[str, Dict[str, Any]],
        stats: Dict[str, Dict[str, Any]],
        previous_projections: Dict[str, Dict[str, Any]],
        scoring: Dict[str, Any],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        starter_slots = self._starter_slots(league)
        starter_ids = [str(pid) for pid in (roster.get("starters") or []) if pid and str(pid) != "0"]
        all_ids = [str(pid) for pid in (roster.get("players") or []) if pid and str(pid) != "0"]
        starter_set = set(starter_ids)

        starters: List[Dict[str, Any]] = []
        for index, player_id in enumerate(starter_ids):
            slot = starter_slots[index] if index < len(starter_slots) else "FLEX"
            starters.append(
                self._player_row(
                    player_id=player_id,
                    slot=slot,
                    players=players,
                    projections=projections,
                    stats=stats,
                    previous_projections=previous_projections,
                    scoring=scoring,
                )
            )

        bench: List[Dict[str, Any]] = []
        for player_id in all_ids:
            if player_id in starter_set:
                continue
            bench.append(
                self._player_row(
                    player_id=player_id,
                    slot="BN",
                    players=players,
                    projections=projections,
                    stats=stats,
                    previous_projections=previous_projections,
                    scoring=scoring,
                )
            )

        bench.sort(key=lambda item: item["proj"], reverse=True)
        return starters + bench, starters, bench

    def _player_row(
        self,
        *,
        player_id: str,
        slot: str,
        players: Dict[str, Dict[str, Any]],
        projections: Dict[str, Dict[str, Any]],
        stats: Dict[str, Dict[str, Any]],
        previous_projections: Dict[str, Dict[str, Any]],
        scoring: Dict[str, Any],
    ) -> Dict[str, Any]:
        profile = players.get(str(player_id), {})
        projected = projections.get(str(player_id), {})
        actual = stats.get(str(player_id), {})
        prior = previous_projections.get(str(player_id), {})

        eligible_positions = [
            str(pos).upper() for pos in (profile.get("fantasy_positions") or [profile.get("position") or "FLEX"]) if pos
        ]
        primary_pos = str(profile.get("position") or (eligible_positions[0] if eligible_positions else "FLEX")).upper()

        projected_points = self._fantasy_points(projected, scoring)
        previous_points = self._fantasy_points(prior, scoring)
        trend = round(projected_points - previous_points, 1)

        share = self._metric_fraction(
            projected,
            actual,
            keys=["target_share", "targets_share", "team_target_share", "target_rate"],
        )
        snap = self._metric_fraction(
            projected,
            actual,
            keys=["off_pct", "off_snap_pct", "snap_pct", "snaps_pct", "snap_share"],
        )

        injury_status = str(profile.get("status") or profile.get("injury_status") or "").lower()
        status = "healthy"
        if any(x in injury_status for x in ["question", "probable", "limited"]):
            status = "questionable"
        elif any(x in injury_status for x in ["out", "doubt", "ir", "suspend"]):
            status = "out"

        note = profile.get("injury_notes") or profile.get("injury_body_part")

        return {
            "player_id": str(player_id),
            "eligible_positions": eligible_positions,
            "n": profile.get("full_name") or profile.get("search_full_name") or "Unknown Player",
            "pos": primary_pos,
            "team": profile.get("team") or "FA",
            "slot": slot,
            "proj": round(projected_points, 1),
            "status": status,
            "share": round(share, 2),
            "snap": round(snap, 2),
            "trend": trend,
            "note": note,
        }

    def _metric_fraction(self, projection: Dict[str, Any], actual: Dict[str, Any], keys: List[str]) -> float:
        for key in keys:
            value = projection.get(key)
            if value is None:
                value = actual.get(key)
            if isinstance(value, (int, float)):
                if value > 1.0:
                    return max(0.0, min(1.0, float(value) / 100.0))
                return max(0.0, min(1.0, float(value)))
        return 0.0

    def _fantasy_points(self, statline: Dict[str, Any], scoring: Dict[str, Any]) -> float:
        if not statline:
            return 0.0

        for key in ["pts_half_ppr", "pts_ppr", "pts_std", "fantasy_points"]:
            value = statline.get(key)
            if isinstance(value, (int, float)):
                return float(value)

        total = 0.0
        for stat_name, stat_value in statline.items():
            if not isinstance(stat_value, (int, float)):
                continue
            scoring_weight = scoring.get(stat_name)
            if scoring_weight is None:
                continue
            try:
                total += float(stat_value) * float(scoring_weight)
            except (TypeError, ValueError):
                continue
        return total

    def _is_eligible(self, slot: str, eligible_positions: List[str]) -> bool:
        slot = str(slot).upper()
        allowed = self.SLOT_ELIGIBILITY.get(slot)
        if allowed is None:
            return slot in set(eligible_positions)
        return bool(allowed.intersection(set(eligible_positions)))

    def _build_start_sit_recommendations(
        self,
        *,
        starters: List[Dict[str, Any]],
        bench: List[Dict[str, Any]],
        team_strength: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        recommendations: List[Dict[str, Any]] = []

        for starter in starters:
            slot = starter["slot"]
            candidates = [player for player in bench if self._is_eligible(slot, player["eligible_positions"]) ]
            if not candidates:
                continue

            best_option = max(candidates, key=lambda row: row.get("proj", 0.0))
            edge = round(best_option["proj"] - starter["proj"], 1)
            if edge < 0.6:
                continue

            confidence = int(max(55, min(92, 58 + edge * 11 - (8 if best_option["status"] != "healthy" else 0))))
            boom = int(max(20, min(70, 34 + edge * 7)))
            bust = int(max(12, min(58, 36 - edge * 4 + (8 if best_option["status"] != "healthy" else 0))))
            caution = None
            if best_option["status"] != "healthy":
                caution = f"{best_option['n']} carries {best_option['status']} status. Keep a backup pivot ready."

            start_team_strength = team_strength.get(best_option["team"], 0.5)
            sit_team_strength = team_strength.get(starter["team"], 0.5)
            rationale = [
                f"Projection edge is {edge:+.1f} points for {best_option['n']} in this slot.",
                f"Trend delta favors {best_option['n']} ({best_option['trend']:+.1f}) vs {starter['n']} ({starter['trend']:+.1f}).",
                (
                    f"External team form leans {best_option['team']} ({start_team_strength:.3f} win%) "
                    f"over {starter['team']} ({sit_team_strength:.3f} win%)."
                ),
            ]

            recommendations.append(
                {
                    "slot": slot,
                    "recommendStart": best_option["n"],
                    "recommendSit": starter["n"],
                    "confidence": confidence,
                    "edge": f"{edge:+.1f}",
                    "rationale": rationale,
                    "bust": bust,
                    "boom": boom,
                    "caution": caution,
                    "startMetrics": {
                        "proj": best_option["proj"],
                        "snap": best_option["snap"],
                        "share": best_option["share"],
                    },
                    "sitMetrics": {
                        "proj": starter["proj"],
                        "snap": starter["snap"],
                        "share": starter["share"],
                    },
                }
            )

        recommendations.sort(key=lambda item: float(item["edge"]), reverse=True)
        if recommendations:
            return recommendations[:3]

        if starters and bench:
            best_bench = max(bench, key=lambda row: row.get("proj", 0.0))
            fallback_starter = min(starters, key=lambda row: row.get("proj", 0.0))
            return [
                {
                    "slot": fallback_starter["slot"],
                    "recommendStart": best_bench["n"],
                    "recommendSit": fallback_starter["n"],
                    "confidence": 51,
                    "edge": "+0.0",
                    "rationale": ["No decisive edge found. This is a neutral-risk upside pivot."],
                    "bust": 32,
                    "boom": 32,
                    "caution": "Monitor injury reports before kickoff.",
                    "startMetrics": {"proj": best_bench["proj"], "snap": best_bench["snap"], "share": best_bench["share"]},
                    "sitMetrics": {
                        "proj": fallback_starter["proj"],
                        "snap": fallback_starter["snap"],
                        "share": fallback_starter["share"],
                    },
                }
            ]

        return []

    def _build_matchup_view(
        self,
        *,
        league: Dict[str, Any],
        rosters: List[Dict[str, Any]],
        users_by_id: Dict[str, Dict[str, Any]],
        my_roster: Dict[str, Any],
        matchups: List[Dict[str, Any]],
        week: int,
        players: Dict[str, Dict[str, Any]],
        projections: Dict[str, Dict[str, Any]],
        scoring: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], float, float]:
        my_roster_id = int(my_roster.get("roster_id", 0))
        my_entry = next((entry for entry in matchups if int(entry.get("roster_id", -1)) == my_roster_id), None)

        empty_next = {
            "team": "TBD",
            "owner": "unknown",
            "record": "0-0",
            "rank": 0,
            "projSpread": 0.0,
            "winProb": 50,
        }

        if not my_entry:
            return empty_next, [], 0.0, 0.0

        matchup_id = my_entry.get("matchup_id")
        if matchup_id is None:
            return empty_next, [], 0.0, 0.0

        opponent_entry = next(
            (
                entry
                for entry in matchups
                if entry.get("matchup_id") == matchup_id and int(entry.get("roster_id", -1)) != my_roster_id
            ),
            None,
        )
        if opponent_entry is None:
            return empty_next, [], 0.0, 0.0

        rosters_by_id = {int(r.get("roster_id", -1)): r for r in rosters}
        opponent_roster = rosters_by_id.get(int(opponent_entry.get("roster_id", -1)))
        if opponent_roster is None:
            return empty_next, [], 0.0, 0.0

        starter_slots = self._starter_slots(league)

        def starter_projection(starter_ids: List[Any]) -> Tuple[float, List[Dict[str, Any]]]:
            rows: List[Dict[str, Any]] = []
            total = 0.0
            for idx, pid in enumerate(starter_ids):
                if not pid or str(pid) == "0":
                    continue
                player_id = str(pid)
                slot = starter_slots[idx] if idx < len(starter_slots) else "FLEX"
                profile = players.get(player_id, {})
                projected = self._fantasy_points(projections.get(player_id, {}), scoring)
                total += projected
                rows.append(
                    {
                        "n": profile.get("full_name") or profile.get("search_full_name") or "Unknown Player",
                        "pos": str(profile.get("position") or "FLEX").upper(),
                        "team": profile.get("team") or "FA",
                        "slot": slot,
                        "proj": round(projected, 1),
                    }
                )
            return total, rows

        my_total, _ = starter_projection(my_entry.get("starters") or [])
        opp_total, opp_rows = starter_projection(opponent_entry.get("starters") or [])

        spread = round(my_total - opp_total, 1)
        win_prob = int(round(100 / (1 + math.exp(-spread / 14.0))))

        ranked = self._rank_rosters(rosters)
        opponent_roster_id = int(opponent_roster.get("roster_id", 0))
        opp_rank = next((idx + 1 for idx, r in enumerate(ranked) if int(r.get("roster_id", -1)) == opponent_roster_id), 0)

        owner_id = str(opponent_roster.get("owner_id"))
        owner = users_by_id.get(owner_id, {})
        next_opponent = {
            "team": self._team_label(owner, opponent_roster),
            "owner": owner.get("username") or owner.get("display_name") or "unknown",
            "record": self._record_label(opponent_roster.get("settings") or {}),
            "rank": opp_rank,
            "projSpread": round(spread, 1),
            "winProb": max(1, min(99, win_prob)),
        }

        opp_roster_view = [{"n": row["n"], "pos": row["pos"], "proj": row["proj"]} for row in opp_rows[:7]]
        return next_opponent, opp_roster_view, my_total, opp_total

    def _build_priority_queue(
        self,
        *,
        roster_rows: List[Dict[str, Any]],
        players: Dict[str, Dict[str, Any]],
        projections: Dict[str, Dict[str, Any]],
        scoring: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        position_counts = Counter(row["pos"] for row in roster_rows if row["slot"] != "BN")
        need_bias = {
            "QB": 1 if position_counts.get("QB", 0) <= 1 else 0,
            "RB": 1 if position_counts.get("RB", 0) <= 2 else 0,
            "WR": 1 if position_counts.get("WR", 0) <= 2 else 0,
            "TE": 1 if position_counts.get("TE", 0) <= 1 else 0,
        }

        trending = self._sleeper.get_trending(kind="add", lookback_hours=24, limit=25)
        queue: List[Dict[str, Any]] = []

        for rank, item in enumerate(trending, start=1):
            player_id = str(item.get("player_id") or "")
            profile = players.get(player_id)
            if not profile:
                continue
            name = profile.get("full_name") or profile.get("search_full_name")
            position = str(profile.get("position") or "FLEX").upper()
            if not name or position not in {"QB", "RB", "WR", "TE", "K", "DEF"}:
                continue

            proj = self._fantasy_points(projections.get(player_id, {}), scoring)
            fit_score = need_bias.get(position, 0) + (1 if proj >= 10 else 0)
            fit_label = "High" if fit_score >= 2 else "Mid" if fit_score == 1 else "Low"
            tier = "T1" if proj >= 15 else "T2" if proj >= 10 else "T3"

            queue.append(
                {
                    "rank": len(queue) + 1,
                    "n": name,
                    "pos": position,
                    "team": profile.get("team") or "FA",
                    "adp": "--",
                    "tier": tier,
                    "fit": fit_label,
                    "note": f"Trending adds +{int(item.get('count') or 0)} over the last 24h.",
                }
            )
            if len(queue) >= 8:
                break

        return queue

    def _build_priority_board(self, queue: List[Dict[str, Any]], my_team_name: str) -> List[Dict[str, Any]]:
        picks = []
        for index in range(6):
            status = "future"
            if index < 2:
                status = "past"
            elif index == 2:
                status = "onclock"

            player_name = queue[index]["n"] if index < len(queue) and status == "past" else "—"
            player_pos = queue[index]["pos"] if index < len(queue) and status == "past" else ""
            picks.append(
                {
                    "pk": f"1.0{index + 1}",
                    "team": my_team_name if index == 2 else f"Queue {index + 1}",
                    "player": player_name,
                    "pos": player_pos,
                    "status": status,
                    "ours": index == 2,
                }
            )
        return picks

    def _build_news(
        self,
        startsit: List[Dict[str, Any]],
        roster_rows: List[Dict[str, Any]],
        draft_queue: List[Dict[str, Any]],
        team_strength: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        times = ["just now", "18m", "1h", "3h", "6h"]

        if startsit:
            top = startsit[0]
            items.append(
                {
                    "time": times[0],
                    "tag": "LINEUP",
                    "player": top["recommendStart"],
                    "pos": "",
                    "team": "",
                    "body": f"Best edge this week: start over sit call at {top['slot']} for {top['edge']} pts.",
                    "impact": "your-team",
                }
            )

        injuries = [row for row in roster_rows if row.get("status") in {"questionable", "out"}]
        for idx, row in enumerate(injuries[:2], start=1):
            items.append(
                {
                    "time": times[idx],
                    "tag": "INJURY",
                    "player": row["n"],
                    "pos": row["pos"],
                    "team": row["team"],
                    "body": f"Status is {row['status']}. Keep an alternate lineup path ready.",
                    "impact": "your-team",
                }
            )

        if draft_queue:
            top = draft_queue[0]
            items.append(
                {
                    "time": "2h",
                    "tag": "WAIVER",
                    "player": top["n"],
                    "pos": top["pos"],
                    "team": top["team"],
                    "body": top["note"],
                    "impact": "monitor",
                }
            )

        strong_teams = sorted(team_strength.items(), key=lambda item: item[1], reverse=True)
        if strong_teams:
            best_team, strength = strong_teams[0]
            items.append(
                {
                    "time": "5h",
                    "tag": "EXTERNAL",
                    "player": best_team,
                    "pos": "",
                    "team": best_team,
                    "body": f"External team-performance model has {best_team} at {strength:.3f} win%.",
                    "impact": "context",
                }
            )

        return items[:5]

    def _scoring_summary(self, scoring: Dict[str, Any]) -> List[str]:
        labels: List[str] = []
        rec_value = float(scoring.get("rec", 0) or 0)
        if rec_value >= 1:
            labels.append("PPR")
        elif rec_value >= 0.5:
            labels.append("Half PPR")
        elif rec_value > 0:
            labels.append(f"{rec_value:g} PPR")
        else:
            labels.append("Standard")

        pass_td = float(scoring.get("pass_td", 4) or 4)
        labels.append(f"{pass_td:g}pt Pass TD")
        labels.append(f"{float(scoring.get('pass_int', -2) or -2):g} INT")
        labels.append("Sleeper Live Data")
        return labels

    def _format_league(self, league: Dict[str, Any]) -> str:
        settings = league.get("settings") or {}
        scoring = league.get("scoring_settings") or {}

        if int(settings.get("best_ball", 0) or 0) == 1:
            league_type = "Best Ball"
        elif int(settings.get("type", 0) or 0) == 2:
            league_type = "Dynasty"
        else:
            league_type = "Redraft"

        rec_value = float(scoring.get("rec", 0) or 0)
        if rec_value >= 1:
            scoring_label = "PPR"
        elif rec_value >= 0.5:
            scoring_label = "Half PPR"
        elif rec_value > 0:
            scoring_label = f"{rec_value:g} PPR"
        else:
            scoring_label = "Standard"

        return f"{league_type} — {scoring_label}"

    def _record_label(self, settings: Dict[str, Any]) -> str:
        wins = int(settings.get("wins", 0) or 0)
        losses = int(settings.get("losses", 0) or 0)
        ties = int(settings.get("ties", 0) or 0)
        if ties:
            return f"{wins}-{losses}-{ties}"
        return f"{wins}-{losses}"

    def _points_for(self, settings: Dict[str, Any]) -> float:
        whole = int(settings.get("fpts", 0) or 0)
        decimal = int(settings.get("fpts_decimal", 0) or 0)
        return whole + (decimal / 100.0)

    def _rank_rosters(self, rosters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        def score(roster: Dict[str, Any]) -> Tuple[int, float]:
            settings = roster.get("settings") or {}
            wins = int(settings.get("wins", 0) or 0)
            points_for = self._points_for(settings)
            return wins, points_for

        return sorted(rosters, key=score, reverse=True)

    def _team_label(self, user: Optional[Dict[str, Any]], roster: Dict[str, Any]) -> str:
        if user:
            metadata = user.get("metadata") or {}
            if metadata.get("team_name"):
                return str(metadata["team_name"])
            if user.get("display_name"):
                return str(user["display_name"])
            if user.get("username"):
                return str(user["username"])
        return f"Roster {roster.get('roster_id', '')}".strip()

    def _get_external_team_strength(self) -> Dict[str, float]:
        try:
            payload = self._sleeper.request_external_json(
                "https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings",
                ttl_key="espn:standings",
                ttl_seconds=21600,
            )
        except SleeperApiError:
            return {}

        strengths: Dict[str, float] = {}

        children = payload.get("children") or []
        for child in children:
            standings = child.get("standings") or {}
            entries = standings.get("entries") or []
            for entry in entries:
                team = entry.get("team") or {}
                abbreviation = str(team.get("abbreviation") or "").upper()
                if not abbreviation:
                    continue
                stats = entry.get("stats") or []
                for stat in stats:
                    name = str(stat.get("name") or "").lower()
                    if name in {"winpercent", "winpct", "winpercentage"}:
                        value = stat.get("value")
                        if isinstance(value, (int, float)):
                            strengths[abbreviation] = float(value)
                            break

        return strengths
