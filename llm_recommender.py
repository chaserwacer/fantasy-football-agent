from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import requests


class LLMRecommendationError(RuntimeError):
    """Raised when OpenAI-backed recommendation generation fails."""


class OpenAIRecommendationClient:
    """Generates fantasy recommendation overlays and chat replies via OpenAI."""

    CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self, *, api_key: str, model: str, timeout_seconds: int = 25) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = max(10, timeout_seconds)
        self._session = requests.Session()

    @property
    def model(self) -> str:
        return self._model

    @classmethod
    def from_env(cls) -> Optional["OpenAIRecommendationClient"]:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return None

        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
        timeout_raw = os.getenv("OPENAI_TIMEOUT_SECONDS", "25")
        try:
            timeout_seconds = int(timeout_raw)
        except ValueError:
            timeout_seconds = 25

        return cls(api_key=api_key, model=model, timeout_seconds=timeout_seconds)

    def generate_recommendations(self, *, context: Dict[str, Any]) -> Dict[str, Any]:
        """Returns structured recommendation overlays for lineup and waiver decisions."""
        system_prompt = (
            "You are CommissionerAI, a fantasy football co-manager. "
            "Use deterministic recommendations as a baseline, then add independent viewpoints "
            "based on matchup, projection deltas, team form, and risk context. "
            "Be specific, avoid hype, and prefer concise reasoning. "
            "Return strict JSON only."
        )
        user_prompt = (
            "Build an additive recommendation overlay using this league snapshot.\n"
            "Output this JSON object schema exactly:\n"
            "{\n"
            '  "summary": string,\n'
            '  "lineup": [{"slot": string, "recommendStart": string, "recommendSit": string, '
            '"confidence": number, "rationale": [string], "risk": string}],\n'
            '  "waivers": [{"player": string, "pos": string, "team": string, "priority": number, '
            '"rationale": string}],\n'
            '  "matchupFocus": [string],\n'
            '  "riskAlerts": [string],\n'
            '  "tradeAngles": [string]\n'
            "}\n"
            "Limit lineup to 3, waivers to 3, matchupFocus to 3, riskAlerts to 3, tradeAngles to 3.\n"
            f"Context JSON:\n{json.dumps(context, ensure_ascii=True)}"
        )

        content = self._complete_json(system_prompt=system_prompt, user_prompt=user_prompt, max_tokens=1200)
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMRecommendationError(f"OpenAI returned invalid JSON: {exc}") from exc

        lineup = self._normalize_lineup(parsed.get("lineup"))
        waivers = self._normalize_waivers(parsed.get("waivers"))
        matchup_focus = self._normalize_string_list(parsed.get("matchupFocus"), limit=3)
        risk_alerts = self._normalize_string_list(parsed.get("riskAlerts"), limit=3)
        trade_angles = self._normalize_string_list(parsed.get("tradeAngles"), limit=3)

        return {
            "enabled": True,
            "provider": "openai",
            "model": self._model,
            "summary": str(parsed.get("summary") or "AI perspective is available for this week.").strip(),
            "lineup": lineup,
            "waivers": waivers,
            "matchupFocus": matchup_focus,
            "riskAlerts": risk_alerts,
            "tradeAngles": trade_angles,
        }

    def generate_chat_reply(self, *, context: Dict[str, Any], user_message: str) -> str:
        """Returns a contextual chat response grounded in league, roster, and recommendation state."""
        system_prompt = (
            "You are CommissionerAI, a fantasy football co-manager assistant. "
            "Use the provided context only. If uncertain, acknowledge uncertainty. "
            "Keep responses actionable and under 120 words unless the user asks for deep detail."
        )
        user_prompt = (
            f"User message: {user_message}\n"
            f"League context JSON: {json.dumps(context, ensure_ascii=True)}"
        )
        return self._complete_text(system_prompt=system_prompt, user_prompt=user_prompt, max_tokens=350)

    def _complete_json(self, *, system_prompt: str, user_prompt: str, max_tokens: int) -> str:
        payload = {
            "model": self._model,
            "temperature": 0.25,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        return self._invoke(payload)

    def _complete_text(self, *, system_prompt: str, user_prompt: str, max_tokens: int) -> str:
        payload = {
            "model": self._model,
            "temperature": 0.35,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        return self._invoke(payload)

    def _invoke(self, payload: Dict[str, Any]) -> str:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        response = self._session.post(
            self.CHAT_COMPLETIONS_URL,
            headers=headers,
            json=payload,
            timeout=self._timeout_seconds,
        )

        if response.status_code >= 400:
            detail = self._extract_error_message(response)
            raise LLMRecommendationError(
                f"OpenAI request failed ({response.status_code}): {detail}"
            )

        body = response.json()
        choices = body.get("choices") or []
        if not choices:
            raise LLMRecommendationError("OpenAI response did not contain choices.")

        message = choices[0].get("message") or {}
        content = str(message.get("content") or "").strip()
        if not content:
            raise LLMRecommendationError("OpenAI response was empty.")
        return content

    def _extract_error_message(self, response: requests.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text.strip() or "Unknown OpenAI error"

        error = payload.get("error") or {}
        message = error.get("message")
        if message:
            return str(message)
        return json.dumps(payload, ensure_ascii=True)

    def _normalize_lineup(self, raw_value: Any) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        if not isinstance(raw_value, list):
            return result

        for item in raw_value:
            if not isinstance(item, dict):
                continue
            slot = str(item.get("slot") or "FLEX").upper()[:16]
            recommend_start = str(item.get("recommendStart") or "").strip()
            recommend_sit = str(item.get("recommendSit") or "").strip()
            if not recommend_start or not recommend_sit:
                continue
            confidence_raw = item.get("confidence")
            if isinstance(confidence_raw, (int, float)):
                confidence = int(max(1, min(99, round(confidence_raw))))
            else:
                confidence = 60
            rationale = self._normalize_string_list(item.get("rationale"), limit=3)
            risk = str(item.get("risk") or "Monitor final status and inactives.").strip()
            result.append(
                {
                    "slot": slot,
                    "recommendStart": recommend_start,
                    "recommendSit": recommend_sit,
                    "confidence": confidence,
                    "rationale": rationale,
                    "risk": risk,
                }
            )
            if len(result) >= 3:
                break
        return result

    def _normalize_waivers(self, raw_value: Any) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        if not isinstance(raw_value, list):
            return result

        for item in raw_value:
            if not isinstance(item, dict):
                continue
            player = str(item.get("player") or "").strip()
            position = str(item.get("pos") or "FLEX").upper()[:8]
            team = str(item.get("team") or "FA").upper()[:8]
            rationale = str(item.get("rationale") or "").strip()
            if not player or not rationale:
                continue
            priority_raw = item.get("priority")
            if isinstance(priority_raw, (int, float)):
                priority = int(max(1, min(3, round(priority_raw))))
            else:
                priority = len(result) + 1
            result.append(
                {
                    "player": player,
                    "pos": position,
                    "team": team,
                    "priority": priority,
                    "rationale": rationale,
                }
            )
            if len(result) >= 3:
                break
        return result

    def _normalize_string_list(self, raw_value: Any, *, limit: int) -> List[str]:
        if not isinstance(raw_value, list):
            return []

        values: List[str] = []
        for item in raw_value:
            text = str(item or "").strip()
            if not text:
                continue
            values.append(text)
            if len(values) >= limit:
                break
        return values
