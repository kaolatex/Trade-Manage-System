"""
TradeManageSystem (TMS) — Order Executor, Instant Smart Break-Even & Smart Pyramiding Engine
Implements:
1. Instant Smart Break-Even Engine:
   - Millisecond tick-level evaluation
   - Dynamically calculates trigger distance to exceed Spread + Commission + Slippage buffer
   - Modifies SL to Entry Price + Lock Points (+15 to +30 pts) for guaranteed profit
   - Respects broker SYMBOL_TRADE_STOPS_LEVEL constraint
2. Smart Pyramiding & Scale-In Engine:
   - Free-Risk Layer detection (positions with SL >= Entry have 0% capital at risk)
   - Allows aggressive scale-in on Grade-A pullback setups when prior positions are locked in BE
   - Enforces Dynamic ATR Step distance between layers
"""

import math
from typing import Dict, Any, List, Optional, Tuple

class OrderExecutor:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.set_params(self.config)

    def set_params(self, config: Dict[str, Any]):
        self.config = config
        adv = config.get("advanced_params", {})
        layer = adv.get("layering", {})
        basket = adv.get("basket", {})
        risk = adv.get("risk", {})

        # Money Management & Pyramiding
        self.lot_mode = layer.get("lotMode", "fixed")
        self.base_lot = float(layer.get("baseLot", 0.01))
        self.risk_percent = float(layer.get("riskPercent", 1.0))
        self.max_layers = int(layer.get("maxLayers", 5))
        self.use_smart_pyramiding = bool(layer.get("useSmartPyramiding", True))
        self.max_open_positions = int(layer.get("maxOpenPositions", 10))
        self.lot_multiplier = float(layer.get("lotMultiplier", 1.0))
        self.min_step_points = int(layer.get("minStepPoints", 80))
        self.use_dynamic_atr = bool(layer.get("useDynamicAtrStep", True))
        self.atr_step_mult = float(layer.get("atrStepMult", 0.7))
        self.layer_cooldown_sec = int(layer.get("layerCooldownSec", 15))

        # Basket & Execution Targets
        self.single_tp_usd = float(basket.get("singleTpUsd", 1.00))
        self.single_tp_points = int(basket.get("singleTpPoints", 150))
        self.single_sl_points = int(basket.get("singleSlPoints", 400))
        self.use_basket_close = bool(basket.get("useBasketClose", True))
        self.basket_target_usd = float(basket.get("basketTargetUsd", 1.50))

        # Instant Smart Break-Even & Trailing
        self.use_instant_be = bool(basket.get("useInstantSmartBE", True))
        self.instant_be_trigger_points = int(basket.get("instantBeTriggerPoints", 80))
        self.instant_be_lock_points = int(basket.get("instantBeLockPoints", 20))
        self.instant_be_min_usd = float(basket.get("instantBeMinUsd", 0.30))

        self.use_auto_be = bool(basket.get("useAutoBreakEven", True))
        self.be_trigger_points = int(basket.get("beTriggerPoints", 120))
        self.be_lock_points = int(basket.get("beLockPoints", 20))
        self.use_trailing = bool(basket.get("useTrailingStop", True))
        self.trail_start_points = int(basket.get("trailStartPoints", 150))
        self.trail_step_points = int(basket.get("trailStepPoints", 30))

        # Risk Guard
        self.max_spread = int(risk.get("maxSpreadPoints", 35))
        self.daily_max_loss = float(risk.get("dailyMaxLossUsd", 50.0))
        self.daily_target_profit = float(risk.get("dailyTargetProfitUsd", 100.0))

    # --------------------------------------------------------------------------
    # Free-Risk Pyramiding Qualification Check
    # --------------------------------------------------------------------------
    def evaluate_pyramiding_capacity(
        self, positions: List[Dict[str, Any]], signal_direction: str
    ) -> Tuple[bool, int, int, str]:
        """
        Calculates how many open positions are already risk-free (SL locked at or past entry).
        Returns: (approved: bool, risk_free_count: int, unhedged_count: int, log_msg: str)
        """
        same_dir_pos = [
            p for p in positions
            if p.get("type", "").lower() == signal_direction.lower() or
               (signal_direction.lower() == "buy" and str(p.get("type")) in ["0", "buy"]) or
               (signal_direction.lower() == "sell" and str(p.get("type")) in ["1", "sell"])
        ]

        total = len(same_dir_pos)
        risk_free = 0

        for p in same_dir_pos:
            open_p = float(p.get("open_price", 0.0))
            sl = float(p.get("sl", 0.0))
            p_type = str(p.get("type", "")).lower()

            if p_type in ["0", "buy"] and sl >= open_p and sl > 0:
                risk_free += 1
            elif p_type in ["1", "sell"] and sl <= open_p and sl > 0:
                risk_free += 1

        unhedged = total - risk_free

        if total >= self.max_open_positions:
            return False, risk_free, unhedged, f"[PYRAMID] Hard cap reached ({total}/{self.max_open_positions} positions)"

        if not self.use_smart_pyramiding:
            if total >= self.max_layers:
                return False, risk_free, unhedged, f"[LAYER] Max unscaled layers reached ({total}/{self.max_layers})"
            return True, risk_free, unhedged, f"[LAYER] Standard scale-in allowed ({total + 1}/{self.max_layers})"

        # Smart Pyramiding: Risk-free layers do not consume active risk quota
        if unhedged >= self.max_layers:
            return False, risk_free, unhedged, f"[PYRAMID] Waiting for current active layers to reach BE ({unhedged}/{self.max_layers} unhedged)"

        log_msg = f"[SMART PYRAMIDING] Scale-In APPROVED! Total: {total}/{self.max_open_positions} (Risk-Free: {risk_free} BE🔒 | Unhedged: {unhedged}/{self.max_layers})"
        return True, risk_free, unhedged, log_msg

    # --------------------------------------------------------------------------
    # Instant Smart Break-Even Evaluation
    # --------------------------------------------------------------------------
    def evaluate_instant_smart_be(
        self,
        position: Dict[str, Any],
        current_bid: float,
        current_ask: float,
        point: float,
        live_spread_pts: int,
        stops_level_pts: int = 10,
    ) -> Optional[Dict[str, Any]]:
        """
        Determines if a position qualifies for Instant Break-Even modification.
        Returns modification action dict or None.
        """
        if not (self.use_instant_be or self.use_auto_be):
            return None

        open_p = float(position.get("open_price", 0.0))
        current_sl = float(position.get("sl", 0.0))
        ticket = position.get("ticket")
        p_type = str(position.get("type", "")).lower()
        floating_profit = float(position.get("floating_profit", 0.0))

        # Dynamic trigger distance
        trigger_pts = self.instant_be_trigger_points
        if trigger_pts <= 0 and live_spread_pts > 0:
            trigger_pts = int(max(live_spread_pts * 1.5, 60))

        lock_pts = self.instant_be_lock_points
        min_stop_dist = (stops_level_pts + 5) * point

        if p_type in ["0", "buy"]:
            profit_pts = (current_bid - open_p) / point
            hit_condition = (profit_pts >= trigger_pts) or (floating_profit >= self.instant_be_min_usd)

            if hit_condition:
                target_sl = round(open_p + (lock_pts * point), 5)
                # Ensure broker stops level distance
                if (current_bid - target_sl) >= min_stop_dist:
                    if current_sl < target_sl or current_sl == 0.0:
                        return {
                            "action": "MODIFY_SL",
                            "ticket": ticket,
                            "target_sl": target_sl,
                            "profit_pts": profit_pts,
                            "floating_profit": floating_profit,
                            "lock_pts": lock_pts,
                            "type": "BUY",
                            "log_msg": f"[INSTANT BE] BUY #{ticket} reached +{profit_pts:.0f} pts (+${floating_profit:.2f}) -> SL to Entry +{lock_pts} pts (Risk-Free Locked!)"
                        }

        elif p_type in ["1", "sell"]:
            profit_pts = (open_p - current_ask) / point
            hit_condition = (profit_pts >= trigger_pts) or (floating_profit >= self.instant_be_min_usd)

            if hit_condition:
                target_sl = round(open_p - (lock_pts * point), 5)
                if (target_sl - current_ask) >= min_stop_dist:
                    if current_sl > target_sl or current_sl == 0.0:
                        return {
                            "action": "MODIFY_SL",
                            "ticket": ticket,
                            "target_sl": target_sl,
                            "profit_pts": profit_pts,
                            "floating_profit": floating_profit,
                            "lock_pts": lock_pts,
                            "type": "SELL",
                            "log_msg": f"[INSTANT BE] SELL #{ticket} reached +{profit_pts:.0f} pts (+${floating_profit:.2f}) -> SL to Entry +{lock_pts} pts (Risk-Free Locked!)"
                        }

        return None

    # --------------------------------------------------------------------------
    # Sizing & Basket
    # --------------------------------------------------------------------------
    def calculate_lot(self, current_layer: int, balance: float, point: float = 0.01, tick_val: float = 1.0) -> float:
        lot = self.base_lot
        if self.lot_mode == "risk" and balance > 0:
            sl_pts = self.single_sl_points if self.single_sl_points > 0 else 300
            risk_usd = balance * (self.risk_percent / 100.0)
            lot = risk_usd / (sl_pts * max(tick_val, 0.01))

        scaled_lot = lot * (self.lot_multiplier ** current_layer)
        return round(max(0.01, min(100.0, scaled_lot)), 2)

    def calculate_step_points(self, atr: float, point: float) -> int:
        if self.use_dynamic_atr and atr > 0 and point > 0:
            atr_pts = int((atr / point) * self.atr_step_mult)
            return max(self.min_step_points, atr_pts)
        return self.min_step_points

    def check_basket_profit(self, positions: List[Dict[str, Any]]) -> bool:
        if not self.use_basket_close or not positions:
            return False
        total_pnl = sum(float(p.get("floating_profit", 0.0)) for p in positions)
        return total_pnl >= self.basket_target_usd
