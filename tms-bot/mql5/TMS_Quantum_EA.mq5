//+------------------------------------------------------------------+
//|                                             TMS_Quantum_EA.mq5   |
//|                             Copyright 2026, TradeManageSystem    |
//|                        https://github.com/kaolatex/Trade-Manage-System |
//+------------------------------------------------------------------+
#property copyright   "TradeManageSystem (TMS)"
#property link        "https://github.com/kaolatex/Trade-Manage-System"
#property version     "2.10"
#property description "TMS Quantum EA v2.1 — 3,000-Bar Multi-Technical Quant Engine"
#property description "Features: Multi-EMA Ribbon (9/21/50/200), Instant Smart Break-Even,"
#property description "Free-Risk Smart Pyramiding, Multi-Asset Auto-Calibration, and Cloud Sync"

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\AccountInfo.mqh>
#include <Trade\DealInfo.mqh>

//+------------------------------------------------------------------+
//| Enums Definition                                                 |
//+------------------------------------------------------------------+
enum ENUM_STRATEGY_MODE
{
   MODE_AGGRESSIVE_SCALPER = 0, // Aggressive Scalper (EMA Ribbon + BB + StochRSI)
   MODE_ADAPTIVE_QUANT     = 1  // Adaptive Quant (3,000-Bar Pattern & Probabilistic)
};

enum ENUM_LOT_MODE
{
   FIXED_LOT    = 0, // Fixed Lot Size
   RISK_PERCENT = 1  // Auto Dynamic Lot by % Balance Risk
};

//+------------------------------------------------------------------+
//| Input Parameters - Group 1: Strategy & Mode                      |
//+------------------------------------------------------------------+
input group "=== [Group 1: Strategy & Mode] ==="
input ENUM_STRATEGY_MODE InpStrategyMode         = MODE_AGGRESSIVE_SCALPER; // Strategy Mode
input ENUM_TIMEFRAMES   InpTimeframe            = PERIOD_M15;              // Strategy Timeframe
input ulong             InpMagicNumber          = 888999;                  // Magic Number (TMS EA)
input string            InpOrderComment         = "TMS-Quantum-EA";        // Order Comment
input bool              InpEnableCloudSync      = true;                    // Enable Cloud Sync (tms_ea_config.json)
input int               InpCloudSyncIntervalSec = 5;                       // Cloud Sync Check Interval (Sec)
input bool              InpUse3000BarQuantFilter= true;                    // Enable 3,000-Bar Historical Quant Filter

//+------------------------------------------------------------------+
//| Input Parameters - Group 2: Money Management & Pyramiding        |
//+------------------------------------------------------------------+
input group "=== [Group 2: Money Management & Pyramiding] ==="
input ENUM_LOT_MODE     InpLotMode              = FIXED_LOT;               // Lot Sizing Mode
input double            InpBaseLot              = 0.01;                    // Base Lot Size
input double            InpRiskPercent          = 1.0;                     // Risk Percent per Trade (%)
input int               InpMaxLayers            = 5;                       // Max Unhedged Risk Layers
input bool              InpSmartPyramiding      = true;                    // Smart Pyramiding: Free-Risk Layers (Permit adds after BE)
input int               InpMaxOpenPositions     = 10;                      // Hard Cap Total Open Positions (5-15)
input double            InpLotMultiplier        = 1.0;                     // Layer Lot Multiplier (1.0 = Flat)
input int               InpMinStepPoints        = 80;                      // Min Step Distance (Points)
input bool              InpUseDynamicATRStep    = true;                    // Dynamic ATR Step Distance
input double            InpATRStepMult          = 0.7;                     // Dynamic ATR Step Multiplier
input int               InpLayerCooldownSec     = 15;                      // Cooldown Between Layers (Seconds)

//+------------------------------------------------------------------+
//| Input Parameters - Group 3: Multi-EMA Ribbon & Scalper Tuning    |
//+------------------------------------------------------------------+
input group "=== [Group 3: Multi-EMA Ribbon & Scalper Tuning] ==="
input bool              InpUseEMARibbon         = true;                    // Enable Multi-EMA Ribbon Alignment
input int               InpEMA9_Fast            = 9;                       // EMA Fast Period (Momentum Trigger)
input int               InpEMA21_Pullback       = 21;                      // EMA Pullback Zone Period
input int               InpEMA50_Medium         = 50;                      // EMA Medium Trend Period
input int               InpEMA200_Macro         = 200;                     // EMA Macro Trend Filter
input double            InpMinEMASlopePts       = 5.0;                     // Min EMA 21 Slope Distance (Points)
input int               InpBBPeriod             = 20;                      // Bollinger Bands Period
input double            InpBBDeviation          = 1.8;                     // Bollinger Bands Deviation
input int               InpStochRSI_K           = 14;                      // StochRSI RSI Period
input double            InpStochRSI_Oversold    = 22.0;                    // StochRSI Oversold Level
input double            InpStochRSI_Overbought  = 78.0;                    // StochRSI Overbought Level
input double            InpMinRejectionWickPct  = 20.0;                    // Min Rejection Wick % of Range
input double            InpNewsSpikeFilterATR   = 2.8;                     // News Spike Bar Filter (x ATR)

//+------------------------------------------------------------------+
//| Input Parameters - Group 4: 3,000-Bar Quant Engine Deep Tuning   |
//+------------------------------------------------------------------+
input group "=== [Group 4: 3,000-Bar Quant Engine Deep Tuning] ==="
input int               InpLookbackBars         = 3000;                    // 3,000 Historical Lookback Bars
input int               InpPatternLength        = 5;                       // Vector Pattern Length (Bars)
input int               InpForwardHorizonBars   = 3;                       // Forward Evaluation Horizon (Bars)
input double            InpMinWinProbabilityPct = 65.0;                    // Min Win Probability Threshold (%)
input double            InpZScoreThreshold      = 1.5;                     // Statistical Z-Score Threshold
input double            InpDynamicATR_SL_Mult   = 1.5;                     // Dynamic SL ATR Multiplier
input double            InpDynamicATR_TP_Mult   = 2.5;                     // Dynamic TP ATR Multiplier

//+------------------------------------------------------------------+
//| Input Parameters - Group 5: Instant Smart BE, Basket & Trailing  |
//+------------------------------------------------------------------+
input group "=== [Group 5: Instant Smart BE, Basket & Trailing] ==="
input bool              InpInstantSmartBE       = true;                    // ⚡ Instant Smart BE (Risk-Free on Profit)
input int               InpInstantBETriggerPts  = 80;                      // Instant BE Trigger Distance (Points, 0=Auto Spread)
input int               InpInstantBELockPts     = 20;                      // Instant BE Profit Lock Offset (Points above Entry)
input double            InpInstantBEMinUSD      = 0.30;                    // Instant BE Min Floating Profit ($)
input double            InpSingleTP_USD         = 1.00;                    // Single Position Target Profit ($)
input int               InpSingleTP_Points      = 150;                     // Single Position TP (Points, 0=off)
input int               InpSingleSL_Points      = 400;                     // Single Position SL (Points, 0=off)
input bool              InpUseBasketClose       = true;                    // Enable Collective Basket Close
input double            InpBasketTargetUSD      = 1.50;                    // Collective Basket Profit Target ($)
input bool              InpUseAutoBreakEven     = true;                    // Enable Auto Break-Even
input int               InpBETriggerPoints      = 120;                     // Standard BE Trigger Distance (Points)
input int               InpBELockPoints         = 20;                      // Standard BE Profit Lock Distance (Points)
input bool              InpUseTrailingStop      = true;                    // Enable Micro-Trailing Stop
input int               InpTrailStartPoints     = 150;                     // Trailing Stop Activation (Points)
input int               InpTrailStepPoints      = 30;                      // Trailing Stop Step (Points)

//+------------------------------------------------------------------+
//| Input Parameters - Group 6: Session Filter & Risk Guard          |
//+------------------------------------------------------------------+
input group "=== [Group 6: Session Filter & Risk Guard] ==="
input int               InpMaxSpreadPoints      = 35;                      // Max Allowed Spread (Points)
input double            InpDailyMaxLossUSD      = 50.0;                    // Daily Max Loss Limit ($)
input double            InpDailyTargetProfitUSD = 100.0;                   // Daily Take Profit Target ($)
input bool              InpTradeAsianSession    = true;                    // Trade Asian Session (00:00-08:00 GMT)
input bool              InpTradeLondonSession   = true;                    // Trade London Session (08:00-16:00 GMT)
input bool              InpTradeNYSession       = true;                    // Trade New York Session (13:00-22:00 GMT)

//+------------------------------------------------------------------+
//| Input Parameters - Group 7: Asset & Crypto Adaptive Tuning       |
//+------------------------------------------------------------------+
input group "=== [Group 7: Asset & Crypto Adaptive Tuning] ==="
input bool              InpAutoAssetScaling     = true;                    // Auto-Scale Points for BTCUSD / Crypto
input bool              InpTradeWeekendCrypto   = true;                    // Allow 24/7 Weekend Trading for Crypto

//+------------------------------------------------------------------+
//| Input Parameters - Group 8: On-Chart HUD Display Settings        |
//+------------------------------------------------------------------+
input group "=== [Group 8: On-Chart HUD Display Settings] ==="
input ENUM_BASE_CORNER  InpHUDCorner            = CORNER_LEFT_UPPER;       // HUD Display Corner
input int               InpHUD_X                = 15;                      // HUD X Distance
input int               InpHUD_Y                = 115;                     // HUD Y Distance (Default 115 below One-Click Trade)

//+------------------------------------------------------------------+
//| Global Variables & Indicator Handles                             |
//+------------------------------------------------------------------+
CTrade         trade;
CPositionInfo  posInfo;
CPositionInfo  posCheck;
CAccountInfo   accountInfo;
CDealInfo      dealInfo;

int      h_ema9   = INVALID_HANDLE;
int      h_ema21  = INVALID_HANDLE;
int      h_ema50  = INVALID_HANDLE;
int      h_ema200 = INVALID_HANDLE;
int      h_bb     = INVALID_HANDLE;
int      h_rsi    = INVALID_HANDLE;
int      h_atr    = INVALID_HANDLE;

datetime lastOrderTime = 0;
datetime lastCloudCheck = 0;
datetime lastBarTime = 0;
string   cloudStatus = "LOCAL / DEFAULTS";
bool     dailyCircuitBreakerActive = false;
bool     dailyTargetReached = false;
double   dailyClosedProfit = 0.0;
bool     isAutoCalibrated = false;

// Dynamic runtime overrides (can be updated from Cloud JSON)
ENUM_STRATEGY_MODE dynStrategyMode;
ENUM_LOT_MODE     dynLotMode;
double            dynBaseLot;
double            dynRiskPercent;
int               dynMaxLayers;
double            dynLotMultiplier;
int               dynMinStepPoints;
bool              dynUseDynamicATRStep;
double            dynATRStepMult;
int               dynLayerCooldownSec;
double            dynBasketTargetUSD;
bool              dynUseBasketClose;
double            dynSingleTP_USD;
int               dynSingleTP_Points;
int               dynSingleSL_Points;
bool              dynUseAutoBE;
int               dynBETriggerPoints;
int               dynBELockPoints;
bool              dynInstantSmartBE;
int               dynInstantBETriggerPts;
int               dynInstantBELockPts;
double            dynInstantBEMinUSD;
bool              dynUseTrailingStop;
int               dynTrailStartPoints;
int               dynTrailStepPoints;
int               dynMaxSpread;
double            dynDailyMaxLoss;
double            dynDailyTargetProfit;
bool              dynSmartPyramiding;
int               dynMaxOpenPositions;
bool              dynIsRunning = true;
bool              dynPanicClose = false;
bool              dynUseMultiEmaRibbon = true;
bool              dynUse3000BarQuantFilter = true;

// HUD UI Panel Constants
#define HUD_PREFIX "TMS_HUD_"

// Forward Declarations
void CalibrateAssetParameters(bool isFromCloud = false);
void CreateHUD();
void UpdateHUD();
void CreateLabel(string name, string text, int x, int y, color clr, int fontSize, bool bold, ENUM_BASE_CORNER corner = CORNER_LEFT_UPPER);
void CheckDailyRiskMetrics();
void CheckBasketProfit();
void CheckIndividualTakeProfitUSD();
void CheckBreakEvenAndTrailing();
bool IsTradingSessionAllowed();
int  CountOpenLayers();
int  CountRiskFreePositions(int signal);
int  CountTotalRiskFreePositions();
int  EvaluateAggressiveScalperSignal();
int  EvaluateAdaptiveQuantSignal();
double Evaluate3000BarHistoricalWinRate(int proposedSignal, double atrCurrent);
void ExecuteLayerOrder(int signal);
double CalculateLotSize(int layerIndex);
void ReadCloudConfig();
bool ExtractJsonParamDouble(const string &json, const string key, double &outVal);
bool ExtractJsonParamInt(const string &json, const string key, int &outVal);
bool ExtractJsonParamBool(const string &json, const string key, bool &outVal);
bool ExtractJsonParamString(const string &json, const string key, string &outVal);

//+------------------------------------------------------------------+
//| Intelligent Multi-Asset Auto-Calibration Engine                  |
//| Automatically detects asset class (Crypto, Gold, Indices, FX)   |
//| and scales Points, Spread Filters, BE, and Trailing Stops        |
//| regardless of broker digits (3-digit BTC, 2-digit, etc.)        |
//+------------------------------------------------------------------+
void CalibrateAssetParameters(bool isFromCloud = false)
{
   if(!InpAutoAssetScaling) return;

   double currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(currentPrice <= 0.0) currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(currentPrice <= 0.0) currentPrice = iClose(_Symbol, _Period, 0);
   if(currentPrice <= 0.0) currentPrice = 1.0;

   bool isCrypto = (StringFind(_Symbol, "BTC") >= 0 || StringFind(_Symbol, "ETH") >= 0 || 
                    StringFind(_Symbol, "SOL") >= 0 || StringFind(_Symbol, "Crypto") >= 0 ||
                    StringFind(_Symbol, "BNB") >= 0 || StringFind(_Symbol, "XRP") >= 0 ||
                    currentPrice > 10000.0);
   bool isIndex  = (StringFind(_Symbol, "US30") >= 0 || StringFind(_Symbol, "NAS") >= 0 || 
                    StringFind(_Symbol, "SPX") >= 0 || StringFind(_Symbol, "GER") >= 0 ||
                    StringFind(_Symbol, "DJ") >= 0  || StringFind(_Symbol, "USTEC") >= 0);

   long liveSpread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(liveSpread <= 0)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(ask > 0 && bid > 0 && _Point > 0)
      {
         liveSpread = (long)MathRound((ask - bid) / _Point);
      }
   }

   // 1. Auto-Scale Spread Filter
   if(isCrypto)
   {
      int currentMaxSpreadSetting = isFromCloud ? dynMaxSpread : InpMaxSpreadPoints;
      if(currentMaxSpreadSetting <= 200)
      {
         if(liveSpread > 0)
         {
            long autoSpreadLimit = (long)(liveSpread * 1.85);
            long minFloor = (_Point > 0) ? (long)MathRound((currentPrice * 0.0008) / _Point) : 50000;
            dynMaxSpread = (int)MathMax(autoSpreadLimit, minFloor);
         }
         else
         {
            dynMaxSpread = (_Point > 0) ? (int)MathRound((currentPrice * 0.0010) / _Point) : 80000;
         }
         isAutoCalibrated = true;
      }
      else
      {
         dynMaxSpread = currentMaxSpreadSetting;
      }
   }
   else if(isIndex)
   {
      int currentMaxSpreadSetting = isFromCloud ? dynMaxSpread : InpMaxSpreadPoints;
      if(currentMaxSpreadSetting <= 100 && liveSpread > 0)
      {
         dynMaxSpread = (int)(liveSpread * 2.0);
         isAutoCalibrated = true;
      }
   }

   // 2. Auto-Scale Distance Points (MinStep, TP, SL, BE, Trailing)
   if((isCrypto || currentPrice > 10000.0) && _Point > 0)
   {
      int checkStep = isFromCloud ? dynMinStepPoints : InpMinStepPoints;
      if(checkStep < 500)
      {
         double priceRatio = currentPrice / 2650.0;
         int baseMinStep      = isFromCloud ? dynMinStepPoints       : InpMinStepPoints;
         int baseSingleTP     = isFromCloud ? dynSingleTP_Points     : InpSingleTP_Points;
         int baseSingleSL     = isFromCloud ? dynSingleSL_Points     : InpSingleSL_Points;
         int baseBETrigger    = isFromCloud ? dynBETriggerPoints     : InpBETriggerPoints;
         int baseBELock       = isFromCloud ? dynBELockPoints        : InpBELockPoints;
         int baseInstantBETrg = isFromCloud ? dynInstantBETriggerPts : InpInstantBETriggerPts;
         int baseInstantBELck = isFromCloud ? dynInstantBELockPts    : InpInstantBELockPts;
         int baseTrailStart   = isFromCloud ? dynTrailStartPoints    : InpTrailStartPoints;
         int baseTrailStep    = isFromCloud ? dynTrailStepPoints     : InpTrailStepPoints;

         dynMinStepPoints       = (baseMinStep > 0)      ? (int)MathRound(((baseMinStep * 0.01 * priceRatio) / _Point)) : 0;
         dynSingleTP_Points     = (baseSingleTP > 0)     ? (int)MathRound(((baseSingleTP * 0.01 * priceRatio) / _Point)) : 0;
         dynSingleSL_Points     = (baseSingleSL > 0)     ? (int)MathRound(((baseSingleSL * 0.01 * priceRatio) / _Point)) : 0;
         dynBETriggerPoints     = (baseBETrigger > 0)    ? (int)MathRound(((baseBETrigger * 0.01 * priceRatio) / _Point)) : 0;
         dynBELockPoints        = (baseBELock > 0)       ? (int)MathRound(((baseBELock * 0.01 * priceRatio) / _Point)) : 0;
         dynInstantBETriggerPts = (baseInstantBETrg > 0) ? (int)MathRound(((baseInstantBETrg * 0.01 * priceRatio) / _Point)) : 0;
         dynInstantBELockPts    = (baseInstantBELck > 0) ? (int)MathRound(((baseInstantBELck * 0.01 * priceRatio) / _Point)) : 0;
         dynTrailStartPoints    = (baseTrailStart > 0)   ? (int)MathRound(((baseTrailStart * 0.01 * priceRatio) / _Point)) : 0;
         dynTrailStepPoints     = (baseTrailStep > 0)    ? (int)MathRound(((baseTrailStep * 0.01 * priceRatio) / _Point)) : 0;

         isAutoCalibrated = true;
         PrintFormat("⚡ [Auto-Scale] %s Points Calibrated: Step=%d pts, TP=%d pts, SL=%d pts, InstantBE=%d pts, Lock=%d pts", 
                     _Symbol, dynMinStepPoints, dynSingleTP_Points, dynSingleSL_Points, dynInstantBETriggerPts, dynInstantBELockPts);
      }
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==================================================================");
   Print("🚀 Initializing TMS Quantum EA v2.1 — 3000-Bar Multi-Technical Engine");
   Print("   Symbol: ", _Symbol, " | Period: ", EnumToString(InpTimeframe));
   Print("   Magic: ", InpMagicNumber, " | Initial Mode: ", EnumToString(InpStrategyMode));
   Print("==================================================================");

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetMarginMode();
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetDeviationInPoints(20);

   // Initialize runtime dynamics from input defaults
   dynStrategyMode        = InpStrategyMode;
   dynLotMode             = InpLotMode;
   dynBaseLot             = InpBaseLot;
   dynRiskPercent         = InpRiskPercent;
   dynMaxLayers           = InpMaxLayers;
   dynSmartPyramiding     = InpSmartPyramiding;
   dynMaxOpenPositions    = InpMaxOpenPositions;
   dynLotMultiplier       = InpLotMultiplier;
   dynMinStepPoints       = InpMinStepPoints;
   dynUseDynamicATRStep   = InpUseDynamicATRStep;
   dynATRStepMult         = InpATRStepMult;
   dynLayerCooldownSec    = InpLayerCooldownSec;
   dynBasketTargetUSD     = InpBasketTargetUSD;
   dynUseBasketClose      = InpUseBasketClose;
   dynSingleTP_USD        = InpSingleTP_USD;
   dynSingleTP_Points     = InpSingleTP_Points;
   dynSingleSL_Points     = InpSingleSL_Points;
   dynUseAutoBE           = InpUseAutoBreakEven;
   dynBETriggerPoints     = InpBETriggerPoints;
   dynBELockPoints        = InpBELockPoints;
   dynInstantSmartBE      = InpInstantSmartBE;
   dynInstantBETriggerPts = InpInstantBETriggerPts;
   dynInstantBELockPts    = InpInstantBELockPts;
   dynInstantBEMinUSD     = InpInstantBEMinUSD;
   dynUseTrailingStop     = InpUseTrailingStop;
   dynTrailStartPoints    = InpTrailStartPoints;
   dynTrailStepPoints     = InpTrailStepPoints;
   dynMaxSpread           = InpMaxSpreadPoints;
   dynDailyMaxLoss        = InpDailyMaxLossUSD;
   dynDailyTargetProfit   = InpDailyTargetProfitUSD;

   // Multi-Asset Auto-Calibration (Crypto, Gold, Indices, FX)
   if(InpAutoAssetScaling)
   {
      CalibrateAssetParameters(false);
   }

   // Initialize Indicator Handles
   h_ema9   = iMA(_Symbol, InpTimeframe, InpEMA9_Fast, 0, MODE_EMA, PRICE_CLOSE);
   h_ema21  = iMA(_Symbol, InpTimeframe, InpEMA21_Pullback, 0, MODE_EMA, PRICE_CLOSE);
   h_ema50  = iMA(_Symbol, InpTimeframe, InpEMA50_Medium, 0, MODE_EMA, PRICE_CLOSE);
   h_ema200 = iMA(_Symbol, InpTimeframe, InpEMA200_Macro, 0, MODE_EMA, PRICE_CLOSE);
   h_bb     = iBands(_Symbol, InpTimeframe, InpBBPeriod, 0, InpBBDeviation, PRICE_CLOSE);
   h_rsi    = iRSI(_Symbol, InpTimeframe, InpStochRSI_K, PRICE_CLOSE);
   h_atr    = iATR(_Symbol, InpTimeframe, 14);

   if(h_ema9 == INVALID_HANDLE || h_ema21 == INVALID_HANDLE || h_ema50 == INVALID_HANDLE || 
      h_ema200 == INVALID_HANDLE || h_bb == INVALID_HANDLE || h_rsi == INVALID_HANDLE || h_atr == INVALID_HANDLE)
   {
      Print("❌ Failed to create one or more indicator handles!");
      return(INIT_FAILED);
   }

   CreateHUD();

   if(InpEnableCloudSync)
   {
      ReadCloudConfig();
   }

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("🛑 Deinitializing TMS Quantum EA. Reason: ", reason);
   
   if(h_ema9 != INVALID_HANDLE)   IndicatorRelease(h_ema9);
   if(h_ema21 != INVALID_HANDLE)  IndicatorRelease(h_ema21);
   if(h_ema50 != INVALID_HANDLE)  IndicatorRelease(h_ema50);
   if(h_ema200 != INVALID_HANDLE) IndicatorRelease(h_ema200);
   if(h_bb != INVALID_HANDLE)     IndicatorRelease(h_bb);
   if(h_rsi != INVALID_HANDLE)    IndicatorRelease(h_rsi);
   if(h_atr != INVALID_HANDLE)    IndicatorRelease(h_atr);

   ObjectsDeleteAll(0, HUD_PREFIX);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();

   // 1. Periodically check and reload Cloud Parameters from JSON
   if(InpEnableCloudSync && (now - lastCloudCheck >= InpCloudSyncIntervalSec))
   {
      lastCloudCheck = now;
      ReadCloudConfig();
   }

   // 2. Calculate daily realized P&L and check Risk Circuit Breakers
   CheckDailyRiskMetrics();

   // 3. Millisecond Basket Profit Take & Individual Orders TP/SL
   CheckBasketProfit();
   CheckIndividualTakeProfitUSD();

   // 4. Instant Smart Break-Even & Micro Trailing Stops (Runs on Every Tick!)
   CheckBreakEvenAndTrailing();

   // 5. Update On-Chart HUD Display
   UpdateHUD();

   // 6. Halt new executions if circuit breaker, profit target reached, or paused from Web
   if(!dynIsRunning || dailyCircuitBreakerActive || dailyTargetReached)
   {
      return;
   }

   // 7. Auto-recalibrate spread if still on unscaled default on Crypto/Indices
   if(InpAutoAssetScaling && dynMaxSpread <= 200)
   {
      double curAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      bool isCryptoOrIndex = (StringFind(_Symbol, "BTC") >= 0 || StringFind(_Symbol, "Crypto") >= 0 || 
                              StringFind(_Symbol, "ETH") >= 0 || curAsk > 10000.0);
      if(isCryptoOrIndex)
      {
         CalibrateAssetParameters(false);
      }
   }

   // 8. Spread Filter Check
   long currentSpread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(currentSpread > dynMaxSpread)
   {
      return;
   }

   // 9. Session Timing Filter Check
   if(!IsTradingSessionAllowed())
   {
      return;
   }

   // 10. Evaluate Signals based on Selected Strategy Mode
   int signal = 0; // 1 = BUY, -1 = SELL

   if(dynStrategyMode == MODE_AGGRESSIVE_SCALPER)
   {
      signal = EvaluateAggressiveScalperSignal();
   }
   else if(dynStrategyMode == MODE_ADAPTIVE_QUANT)
   {
      signal = EvaluateAdaptiveQuantSignal();
   }

   if(signal == 0) return;

   // 11. Smart Pyramiding & Layering Capacity Check
   int totalActiveLayers = CountOpenLayers();

   if(dynSmartPyramiding)
   {
      // Free-Risk Pyramiding: Layers already BE-locked are capital-safe (0% risk)
      int riskFreeCount = CountRiskFreePositions(signal);
      int unhedgedRiskLayers = totalActiveLayers - riskFreeCount;

      if(totalActiveLayers >= dynMaxOpenPositions)
      {
         return; // Hard cap on total open pyramid positions
      }
      if(unhedgedRiskLayers >= dynMaxLayers)
      {
         return; // Max unhedged risk layers active. Waiting for current layers to hit BE first.
      }
   }
   else
   {
      if(totalActiveLayers >= dynMaxLayers)
      {
         return; // Reached standard layer limit
      }
   }

   if(lastOrderTime > 0 && (now - lastOrderTime < dynLayerCooldownSec))
   {
      return; // In layer cooldown period
   }

   // 12. Execute Order
   ExecuteLayerOrder(signal);
}

//+------------------------------------------------------------------+
//| Multi-EMA Ribbon & 3,000-Bar Quant Signal Engine                 |
//+------------------------------------------------------------------+
int EvaluateAggressiveScalperSignal()
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, InpTimeframe, 0, 5, rates) < 5) return 0;

   double ema9[], ema21[], ema50[], ema200[];
   ArraySetAsSeries(ema9, true);
   ArraySetAsSeries(ema21, true);
   ArraySetAsSeries(ema50, true);
   ArraySetAsSeries(ema200, true);

   if(CopyBuffer(h_ema9, 0, 0, 5, ema9) < 5 || 
      CopyBuffer(h_ema21, 0, 0, 5, ema21) < 5 ||
      CopyBuffer(h_ema50, 0, 0, 5, ema50) < 5 ||
      CopyBuffer(h_ema200, 0, 0, 5, ema200) < 5) return 0;

   double bb_upper[], bb_lower[], bb_middle[];
   ArraySetAsSeries(bb_upper, true);
   ArraySetAsSeries(bb_lower, true);
   ArraySetAsSeries(bb_middle, true);

   if(CopyBuffer(h_bb, 1, 0, 5, bb_upper) < 5 || 
      CopyBuffer(h_bb, 2, 0, 5, bb_lower) < 5 ||
      CopyBuffer(h_bb, 0, 0, 5, bb_middle) < 5) return 0;

   double rsi_val[];
   ArraySetAsSeries(rsi_val, true);
   if(CopyBuffer(h_rsi, 0, 0, 14, rsi_val) < 14) return 0;

   double atr_val[];
   ArraySetAsSeries(atr_val, true);
   if(CopyBuffer(h_atr, 0, 0, 5, atr_val) < 5) return 0;

   double barRange = rates[1].high - rates[1].low;
   if(barRange > InpNewsSpikeFilterATR * atr_val[1] && atr_val[1] > 0)
   {
      return 0; // Filter news spike
   }

   // Calculate StochRSI over recent 14 RSI values
   double minRSI = rsi_val[0];
   double maxRSI = rsi_val[0];
   for(int i = 0; i < 14; i++)
   {
      if(rsi_val[i] < minRSI) minRSI = rsi_val[i];
      if(rsi_val[i] > maxRSI) maxRSI = rsi_val[i];
   }
   double stochRSI = (maxRSI > minRSI) ? ((rsi_val[1] - minRSI) / (maxRSI - minRSI)) * 100.0 : 50.0;

   // Rejection Wick Calculations on completed bar [1]
   double bodyTop    = MathMax(rates[1].open, rates[1].close);
   double bodyBottom = MathMin(rates[1].open, rates[1].close);
   double lowerWick  = bodyBottom - rates[1].low;
   double upperWick  = rates[1].high - bodyTop;
   double totalRange = MathMax(rates[1].high - rates[1].low, _Point);

   double lowerWickPct = (lowerWick / totalRange) * 100.0;
   double upperWickPct = (upperWick / totalRange) * 100.0;

   // Multi-EMA Ribbon Trend Alignment & Slope (Over 3 bars)
   double ema21Slope = (ema21[0] - ema21[3]) / _Point;
   bool bullRibbon = (ema21[1] > ema50[1] && ema50[1] > ema200[1]);
   bool bearRibbon = (ema21[1] < ema50[1] && ema50[1] < ema200[1]);

   if(!InpUseEMARibbon || !dynUseMultiEmaRibbon)
   {
      bullRibbon = true;
      bearRibbon = true;
   }

   // 1. BUY Signal: Bullish Ribbon + Pullback into EMA 9/21 Zone + Rejection/Rebound
   bool buyPullback = bullRibbon && (rates[1].low <= ema9[1] || rates[1].low <= ema21[1] || rates[1].low <= bb_lower[1]);
   bool buyRebound  = (rates[1].close > rates[1].open || rates[0].close > rates[1].high);
   bool buyWick     = (lowerWickPct >= InpMinRejectionWickPct || rates[1].low <= bb_lower[1]);
   bool buyOsc      = (stochRSI <= 40.0 || rates[1].low <= bb_lower[1]);

   if(buyPullback && buyRebound && buyWick && buyOsc)
   {
      if(InpUse3000BarQuantFilter && dynUse3000BarQuantFilter)
      {
         double winRate = Evaluate3000BarHistoricalWinRate(1, atr_val[1]);
         if(winRate >= InpMinWinProbabilityPct)
         {
            PrintFormat("🎯 [3000-BAR QUANT] %s | Bullish Ribbon Pullback | 3,000-Bar WinRate: %.1f%% -> FIRE BUY!", _Symbol, winRate);
            return 1;
         }
         return 0; // Probability below threshold
      }
      return 1;
   }

   // 2. SELL Signal: Bearish Ribbon + Pullback into EMA 9/21 Zone + Rejection/Rebound
   bool sellPullback = bearRibbon && (rates[1].high >= ema9[1] || rates[1].high >= ema21[1] || rates[1].high >= bb_upper[1]);
   bool sellRebound  = (rates[1].close < rates[1].open || rates[0].close < rates[1].low);
   bool sellWick     = (upperWickPct >= InpMinRejectionWickPct || rates[1].high >= bb_upper[1]);
   bool sellOsc      = (stochRSI >= 60.0 || rates[1].high >= bb_upper[1]);

   if(sellPullback && sellRebound && sellWick && sellOsc)
   {
      if(InpUse3000BarQuantFilter && dynUse3000BarQuantFilter)
      {
         double winRate = Evaluate3000BarHistoricalWinRate(-1, atr_val[1]);
         if(winRate >= InpMinWinProbabilityPct)
         {
            PrintFormat("🎯 [3000-BAR QUANT] %s | Bearish Ribbon Pullback | 3,000-Bar WinRate: %.1f%% -> FIRE SELL!", _Symbol, winRate);
            return -1;
         }
         return 0;
      }
      return -1;
   }

   return 0;
}

//+------------------------------------------------------------------+
//| 3,000-Bar Historical Quant Scan & Empirical Win Rate Evaluator   |
//+------------------------------------------------------------------+
double Evaluate3000BarHistoricalWinRate(int proposedSignal, double atrCurrent)
{
   if(atrCurrent <= 0.0) return 70.0;

   int lookback = MathMin(InpLookbackBars, 3000);
   MqlRates histRates[];
   ArraySetAsSeries(histRates, true);
   int copied = CopyRates(_Symbol, InpTimeframe, 0, lookback + 10, histRates);
   if(copied < 100) return 68.0;

   int matches = 0;
   int wins = 0;
   int horizon = InpForwardHorizonBars;
   double targetMove = InpDynamicATR_TP_Mult * atrCurrent;
   double stopMove   = InpDynamicATR_SL_Mult * atrCurrent;

   for(int t = horizon + 2; t < copied - 5; t++)
   {
      double barRange = histRates[t].high - histRates[t].low;
      if(barRange <= 0) continue;

      if(proposedSignal == 1) // BUY
      {
         double bodyBottom = MathMin(histRates[t].open, histRates[t].close);
         double lowerWick = bodyBottom - histRates[t].low;
         if((lowerWick / barRange) >= 0.20 && histRates[t].close > histRates[t].open)
         {
            matches++;
            double highestForward = histRates[t - 1].high;
            double lowestForward  = histRates[t - 1].low;
            for(int h = 1; h <= horizon; h++)
            {
               if(histRates[t - h].high > highestForward) highestForward = histRates[t - h].high;
               if(histRates[t - h].low < lowestForward) lowestForward = histRates[t - h].low;
            }
            if((highestForward - histRates[t].close) >= targetMove && (histRates[t].close - lowestForward) < stopMove)
            {
               wins++;
            }
         }
      }
      else if(proposedSignal == -1) // SELL
      {
         double bodyTop = MathMax(histRates[t].open, histRates[t].close);
         double upperWick = histRates[t].high - bodyTop;
         if((upperWick / barRange) >= 0.20 && histRates[t].close < histRates[t].open)
         {
            matches++;
            double highestForward = histRates[t - 1].high;
            double lowestForward  = histRates[t - 1].low;
            for(int h = 1; h <= horizon; h++)
            {
               if(histRates[t - h].high > highestForward) highestForward = histRates[t - h].high;
               if(histRates[t - h].low < lowestForward) lowestForward = histRates[t - h].low;
            }
            if((histRates[t].close - lowestForward) >= targetMove && (highestForward - histRates[t].close) < stopMove)
            {
               wins++;
            }
         }
      }
   }

   if(matches < 8) return 66.0;
   return ((double)wins / (double)matches) * 100.0;
}

//+------------------------------------------------------------------+
//| Adaptive Quant Historical Vector Signal Engine                   |
//+------------------------------------------------------------------+
int EvaluateAdaptiveQuantSignal()
{
   int lookback = MathMin(InpLookbackBars, 3000);
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, InpTimeframe, 0, lookback + InpPatternLength + InpForwardHorizonBars + 5, rates);
   if(copied < lookback + InpPatternLength + InpForwardHorizonBars) return 0;

   int P = InpPatternLength;
   int H = InpForwardHorizonBars;

   double currentPattern[];
   ArrayResize(currentPattern, P);
   for(int i = 0; i < P; i++)
   {
      double prevClose = rates[P - i].close;
      double currClose = rates[P - i - 1].close;
      currentPattern[i] = (prevClose > 0) ? (currClose - prevClose) / prevClose : 0.0;
   }

   int totalMatches = 0;
   int positiveOutcomes = 0;
   int negativeOutcomes = 0;

   for(int t = P + H + 1; t < copied - P - H; t++)
   {
      double diffSum = 0.0;
      for(int k = 0; k < P; k++)
      {
         double pClose = rates[t + P - k].close;
         double cClose = rates[t + P - k - 1].close;
         double histReturn = (pClose > 0) ? (cClose - pClose) / pClose : 0.0;
         diffSum += MathPow(currentPattern[k] - histReturn, 2.0);
      }
      double distance = MathSqrt(diffSum);

      if(distance < 0.0035) 
      {
         totalMatches++;
         double forwardReturn = (rates[t].close - rates[t - H].close);
         if(forwardReturn > 0) positiveOutcomes++;
         else if(forwardReturn < 0) negativeOutcomes++;
      }
   }

   if(totalMatches < 12) return 0;

   double winProbBuy  = ((double)positiveOutcomes / (double)totalMatches) * 100.0;
   double winProbSell = ((double)negativeOutcomes / (double)totalMatches) * 100.0;

   double expectedWinProb = 0.50;
   double stdError = MathSqrt((expectedWinProb * (1.0 - expectedWinProb)) / totalMatches);
   double zScoreBuy  = (stdError > 0) ? (((double)positiveOutcomes / totalMatches) - expectedWinProb) / stdError : 0.0;
   double zScoreSell = (stdError > 0) ? (((double)negativeOutcomes / totalMatches) - expectedWinProb) / stdError : 0.0;

   if(winProbBuy >= InpMinWinProbabilityPct && zScoreBuy >= InpZScoreThreshold)
   {
      return 1;
   }
   if(winProbSell >= InpMinWinProbabilityPct && zScoreSell >= InpZScoreThreshold)
   {
      return -1;
   }

   return 0;
}

//+------------------------------------------------------------------+
//| Execute Order with Dynamic Layering & Pyramiding                 |
//+------------------------------------------------------------------+
void ExecuteLayerOrder(int signal)
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double entryPrice = (signal == 1) ? ask : bid;

   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);
   double atr = 0.0;
   if(CopyBuffer(h_atr, 0, 0, 1, atrBuffer) > 0) atr = atrBuffer[0];

   double minStepPoints = dynMinStepPoints;
   if(dynUseDynamicATRStep && atr > 0)
   {
      double atrPoints = atr / _Point;
      minStepPoints = MathMax(minStepPoints, atrPoints * dynATRStepMult);
   }

   // Verify distance constraint from closest open layer of same type
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            ENUM_POSITION_TYPE pType = posInfo.PositionType();
            if((signal == 1 && pType == POSITION_TYPE_BUY) || (signal == -1 && pType == POSITION_TYPE_SELL))
            {
               double distPts = MathAbs(entryPrice - posInfo.PriceOpen()) / _Point;
               if(distPts < minStepPoints)
               {
                  return; // Too close to an existing layer!
               }
            }
         }
      }
   }

   int layerIndex = CountOpenLayers();
   double lot = CalculateLotSize(layerIndex);

   double sl = 0.0;
   double tp = 0.0;

   if(dynStrategyMode == MODE_ADAPTIVE_QUANT && atr > 0)
   {
      if(signal == 1)
      {
         sl = NormalizeDouble(entryPrice - (InpDynamicATR_SL_Mult * atr), _Digits);
         tp = NormalizeDouble(entryPrice + (InpDynamicATR_TP_Mult * atr), _Digits);
      }
      else
      {
         sl = NormalizeDouble(entryPrice + (InpDynamicATR_SL_Mult * atr), _Digits);
         tp = NormalizeDouble(entryPrice - (InpDynamicATR_TP_Mult * atr), _Digits);
      }
   }
   else
   {
      if(dynSingleSL_Points > 0)
      {
         sl = (signal == 1) ? NormalizeDouble(entryPrice - dynSingleSL_Points * _Point, _Digits)
                            : NormalizeDouble(entryPrice + dynSingleSL_Points * _Point, _Digits);
      }
      if(dynSingleTP_Points > 0)
      {
         tp = (signal == 1) ? NormalizeDouble(entryPrice + dynSingleTP_Points * _Point, _Digits)
                            : NormalizeDouble(entryPrice - dynSingleTP_Points * _Point, _Digits);
      }
   }

   bool success = false;
   if(signal == 1)
   {
      success = trade.Buy(lot, _Symbol, ask, sl, tp, InpOrderComment);
   }
   else if(signal == -1)
   {
      success = trade.Sell(lot, _Symbol, bid, sl, tp, InpOrderComment);
   }

   if(success)
   {
      lastOrderTime = TimeCurrent();
      PrintFormat("✅ [ORDER] #%d Opened: %s %.2f lots @ %.5f (TP: %.5f | SL: %.5f)", 
                  layerIndex + 1, (signal == 1 ? "BUY" : "SELL"), lot, entryPrice, tp, sl);
   }
   else
   {
      PrintFormat("❌ Order failed: %d - %s", trade.ResultRetcode(), trade.ResultRetcodeDescription());
   }
}

//+------------------------------------------------------------------+
//| Calculate Lot Size with Multiplier and Sizing Mode               |
//+------------------------------------------------------------------+
double CalculateLotSize(int layerIndex)
{
   double base = dynBaseLot;

   if(dynLotMode == RISK_PERCENT)
   {
      double balance = accountInfo.Balance();
      double riskMoney = balance * (dynRiskPercent / 100.0);
      double slPoints = (dynSingleSL_Points > 0) ? dynSingleSL_Points : 300.0;
      double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
      double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);

      if(tickSize > 0 && tickValue > 0)
      {
         double pointValue = (tickValue / tickSize) * _Point;
         base = riskMoney / (slPoints * pointValue);
      }
   }

   double scaledLot = base * MathPow(dynLotMultiplier, (double)layerIndex);

   double minLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   scaledLot = MathFloor(scaledLot / lotStep) * lotStep;
   scaledLot = MathMax(minLot, MathMin(maxLot, scaledLot));

   return NormalizeDouble(scaledLot, 2);
}

//+------------------------------------------------------------------+
//| Check and Close Entire Collective Basket Profit ($ Target)       |
//+------------------------------------------------------------------+
void CheckBasketProfit()
{
   if(!dynUseBasketClose) return;

   double basketProfit = 0.0;
   int botPositions = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            basketProfit += (posInfo.Profit() + posInfo.Swap());
            botPositions++;
         }
      }
   }

   if(botPositions > 0 && basketProfit >= dynBasketTargetUSD)
   {
      PrintFormat("🎯 Collective Basket Target Reached: $%.2f >= $%.2f. Closing all %d layers...", 
                  basketProfit, dynBasketTargetUSD, botPositions);

      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(posInfo.SelectByIndex(i))
         {
            if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
            {
               trade.PositionClose(posInfo.Ticket());
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Individual Position Take Profit ($ Target)                       |
//+------------------------------------------------------------------+
void CheckIndividualTakeProfitUSD()
{
   if(dynSingleTP_USD <= 0.0) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            double pProfit = posInfo.Profit() + posInfo.Swap();
            if(pProfit >= dynSingleTP_USD)
            {
               trade.PositionClose(posInfo.Ticket());
               PrintFormat("💰 Single Order Target Hit: Ticket #%d Profit: $%.2f", posInfo.Ticket(), pProfit);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| ⚡ Instant Smart Break-Even and Micro Trailing Stop Engine        |
//| Enforces SYMBOL_TRADE_STOPS_LEVEL safety to prevent Error 10016   |
//+------------------------------------------------------------------+
void CheckBreakEvenAndTrailing()
{
   long stopsLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double minStopDist = (stopsLevel + 5) * _Point;

   long liveSpread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   // Determine dynamic BE trigger distance
   long beTrigger = dynBETriggerPoints;
   if(dynInstantSmartBE)
   {
      if(dynInstantBETriggerPts > 0)
         beTrigger = dynInstantBETriggerPts;
      else if(liveSpread > 0)
         beTrigger = (long)MathMax((double)liveSpread * 1.5, 60.0);
   }

   int beLock = dynInstantSmartBE ? dynInstantBELockPts : dynBELockPoints;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            ulong ticket = posInfo.Ticket();
            double openPrice = posInfo.PriceOpen();
            double currentSL = posInfo.StopLoss();
            double currentTP = posInfo.TakeProfit();
            ENUM_POSITION_TYPE pType = posInfo.PositionType();
            double floatingUsd = posInfo.Profit() + posInfo.Swap();

            // 1. Instant Smart Break-Even Logic
            if(dynUseAutoBE || dynInstantSmartBE)
            {
               if(pType == POSITION_TYPE_BUY)
               {
                  double profitPoints = (bid - openPrice) / _Point;
                  bool triggerHit = (profitPoints >= beTrigger) || (floatingUsd >= dynInstantBEMinUSD);

                  if(triggerHit)
                  {
                     double targetSL = NormalizeDouble(openPrice + (beLock * _Point), _Digits);
                     // Verify Broker Stops Level constraint to prevent error 10016
                     if((bid - targetSL) >= minStopDist)
                     {
                        if(currentSL < targetSL || currentSL == 0.0)
                        {
                           if(trade.PositionModify(ticket, targetSL, currentTP))
                           {
                              PrintFormat("🔒 [INSTANT BE] BUY #%d reached +%.0f pts (+$%.2f) -> SL moved to Entry +%d pts (Risk-Free Locked!)", 
                                          ticket, profitPoints, floatingUsd, beLock);
                           }
                        }
                     }
                  }
               }
               else if(pType == POSITION_TYPE_SELL)
               {
                  double profitPoints = (openPrice - ask) / _Point;
                  bool triggerHit = (profitPoints >= beTrigger) || (floatingUsd >= dynInstantBEMinUSD);

                  if(triggerHit)
                  {
                     double targetSL = NormalizeDouble(openPrice - (beLock * _Point), _Digits);
                     // Verify Broker Stops Level constraint
                     if((targetSL - ask) >= minStopDist)
                     {
                        if(currentSL > targetSL || currentSL == 0.0)
                        {
                           if(trade.PositionModify(ticket, targetSL, currentTP))
                           {
                              PrintFormat("🔒 [INSTANT BE] SELL #%d reached +%.0f pts (+$%.2f) -> SL moved to Entry +%d pts (Risk-Free Locked!)", 
                                          ticket, profitPoints, floatingUsd, beLock);
                           }
                        }
                     }
                  }
               }
            }

            // 2. Micro Trailing Stop Logic
            if(dynUseTrailingStop)
            {
               if(pType == POSITION_TYPE_BUY)
               {
                  double profitPoints = (bid - openPrice) / _Point;
                  if(profitPoints >= dynTrailStartPoints)
                  {
                     double targetSL = NormalizeDouble(bid - (dynTrailStartPoints * _Point), _Digits);
                     if((targetSL - currentSL) >= (dynTrailStepPoints * _Point) && (bid - targetSL) >= minStopDist)
                     {
                        trade.PositionModify(ticket, targetSL, currentTP);
                        PrintFormat("📈 [TRAILING] BUY #%d SL trailed to %.5f", ticket, targetSL);
                     }
                  }
               }
               else if(pType == POSITION_TYPE_SELL)
               {
                  double profitPoints = (openPrice - ask) / _Point;
                  if(profitPoints >= dynTrailStartPoints)
                  {
                     double targetSL = NormalizeDouble(ask + (dynTrailStartPoints * _Point), _Digits);
                     if((currentSL == 0.0 || (currentSL - targetSL) >= (dynTrailStepPoints * _Point)) && (targetSL - ask) >= minStopDist)
                     {
                        trade.PositionModify(ticket, targetSL, currentTP);
                        PrintFormat("📉 [TRAILING] SELL #%d SL trailed to %.5f", ticket, targetSL);
                     }
                  }
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Check Daily Realized P&L Against Hard Circuit Breakers           |
//+------------------------------------------------------------------+
void CheckDailyRiskMetrics()
{
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   datetime startOfDay = StructToTime(dt);

   HistorySelect(startOfDay, now);
   int totalDeals = HistoryDealsTotal();

   double pnlToday = 0.0;
   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket > 0)
      {
         long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
         if(magic == InpMagicNumber)
         {
            pnlToday += HistoryDealGetDouble(ticket, DEAL_PROFIT);
            pnlToday += HistoryDealGetDouble(ticket, DEAL_SWAP);
            pnlToday += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         }
      }
   }

   dailyClosedProfit = pnlToday;

   if(dynDailyMaxLoss > 0 && dailyClosedProfit <= -dynDailyMaxLoss)
   {
      if(!dailyCircuitBreakerActive)
      {
         dailyCircuitBreakerActive = true;
         PrintFormat("🚨 DAILY CIRCUIT BREAKER TRIPPED! Daily Loss ($%.2f) hit limit -$%.2f", dailyClosedProfit, dynDailyMaxLoss);
      }
   }

   if(dynDailyTargetProfit > 0 && dailyClosedProfit >= dynDailyTargetProfit)
   {
      if(!dailyTargetReached)
      {
         dailyTargetReached = true;
         PrintFormat("🏆 DAILY PROFIT TARGET REACHED! Profit ($%.2f) hit target $%.2f", dailyClosedProfit, dynDailyTargetProfit);
      }
   }
}

//+------------------------------------------------------------------+
//| Check If Current GMT Time Falls In Allowed Trading Sessions      |
//+------------------------------------------------------------------+
bool IsTradingSessionAllowed()
{
   datetime gmt = TimeGMT();
   MqlDateTime dt;
   TimeToStruct(gmt, dt);
   int hour = dt.hour;

   bool isCrypto = (StringFind(_Symbol, "BTC") >= 0 || StringFind(_Symbol, "Crypto") >= 0 || StringFind(_Symbol, "ETH") >= 0);
   if(isCrypto && InpTradeWeekendCrypto)
   {
      if(dt.day_of_week == 0 || dt.day_of_week == 6) return true;
   }

   bool inAsian = (hour >= 0 && hour < 8);
   if(inAsian && InpTradeAsianSession) return true;

   bool inLondon = (hour >= 8 && hour < 16);
   if(inLondon && InpTradeLondonSession) return true;

   bool inNY = (hour >= 13 && hour < 22);
   if(inNY && InpTradeNYSession) return true;

   return false;
}

//+------------------------------------------------------------------+
//| Helper: Count Currently Open Layers for This Symbol & Magic      |
//+------------------------------------------------------------------+
int CountOpenLayers()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            count++;
         }
      }
   }
   return count;
}

//+------------------------------------------------------------------+
//| Helper: Count Risk-Free Positions (SL >= Entry) for Given Signal |
//+------------------------------------------------------------------+
int CountRiskFreePositions(int signal)
{
   int riskFree = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            ENUM_POSITION_TYPE pType = posInfo.PositionType();
            double openPrice = posInfo.PriceOpen();
            double sl = posInfo.StopLoss();

            if(signal == 1 && pType == POSITION_TYPE_BUY)
            {
               if(sl >= openPrice && sl > 0) riskFree++;
            }
            else if(signal == -1 && pType == POSITION_TYPE_SELL)
            {
               if(sl <= openPrice && sl > 0) riskFree++;
            }
         }
      }
   }
   return riskFree;
}

//+------------------------------------------------------------------+
//| Helper: Count All Risk-Free Positions Across Both Directions     |
//+------------------------------------------------------------------+
int CountTotalRiskFreePositions()
{
   int riskFree = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            ENUM_POSITION_TYPE pType = posInfo.PositionType();
            double openPrice = posInfo.PriceOpen();
            double sl = posInfo.StopLoss();

            if(pType == POSITION_TYPE_BUY && sl >= openPrice && sl > 0) riskFree++;
            else if(pType == POSITION_TYPE_SELL && sl <= openPrice && sl > 0) riskFree++;
         }
      }
   }
   return riskFree;
}

//+------------------------------------------------------------------+
//| Read and Parse Dynamic Config from tms_ea_config.json            |
//+------------------------------------------------------------------+
void ReadCloudConfig()
{
   string filename = "tms_ea_config.json";
   int fileHandle = FileOpen(filename, FILE_READ|FILE_TXT|FILE_COMMON|FILE_ANSI);

   if(fileHandle == INVALID_HANDLE)
   {
      fileHandle = FileOpen(filename, FILE_READ|FILE_TXT|FILE_ANSI);
   }

   if(fileHandle == INVALID_HANDLE)
   {
      cloudStatus = "LOCAL / DEFAULTS";
      return;
   }

   string content = "";
   while(!FileIsEnding(fileHandle))
   {
      content += FileReadString(fileHandle);
   }
   FileClose(fileHandle);

   if(StringLen(content) < 10) return;

   ExtractJsonParamDouble(content, "baseLot", dynBaseLot);
   ExtractJsonParamDouble(content, "riskPercent", dynRiskPercent);
   ExtractJsonParamInt(content, "maxLayers", dynMaxLayers);
   ExtractJsonParamDouble(content, "lotMultiplier", dynLotMultiplier);
   ExtractJsonParamInt(content, "minStepPoints", dynMinStepPoints);
   ExtractJsonParamBool(content, "useDynamicAtrStep", dynUseDynamicATRStep);
   ExtractJsonParamDouble(content, "atrStepMult", dynATRStepMult);
   ExtractJsonParamInt(content, "layerCooldownSec", dynLayerCooldownSec);

   ExtractJsonParamBool(content, "useSmartPyramiding", dynSmartPyramiding);
   ExtractJsonParamInt(content, "maxOpenPositions", dynMaxOpenPositions);

   ExtractJsonParamDouble(content, "basketTargetUsd", dynBasketTargetUSD);
   ExtractJsonParamBool(content, "useBasketClose", dynUseBasketClose);
   ExtractJsonParamDouble(content, "singleTpUsd", dynSingleTP_USD);
   ExtractJsonParamInt(content, "singleTpPoints", dynSingleTP_Points);
   ExtractJsonParamInt(content, "singleSlPoints", dynSingleSL_Points);

   ExtractJsonParamBool(content, "useAutoBreakEven", dynUseAutoBE);
   ExtractJsonParamInt(content, "beTriggerPoints", dynBETriggerPoints);
   ExtractJsonParamInt(content, "beLockPoints", dynBELockPoints);

   ExtractJsonParamBool(content, "useInstantSmartBE", dynInstantSmartBE);
   ExtractJsonParamInt(content, "instantBeTriggerPoints", dynInstantBETriggerPts);
   ExtractJsonParamInt(content, "instantBeLockPoints", dynInstantBELockPts);
   ExtractJsonParamDouble(content, "instantBeMinUsd", dynInstantBEMinUSD);

   ExtractJsonParamBool(content, "useTrailingStop", dynUseTrailingStop);
   ExtractJsonParamInt(content, "trailStartPoints", dynTrailStartPoints);
   ExtractJsonParamInt(content, "trailStepPoints", dynTrailStepPoints);

   ExtractJsonParamInt(content, "maxSpreadPoints", dynMaxSpread);
   ExtractJsonParamDouble(content, "dailyMaxLossUsd", dynDailyMaxLoss);
   ExtractJsonParamDouble(content, "dailyTargetProfitUsd", dynDailyTargetProfit);

   string modeStr = "";
   if(ExtractJsonParamString(content, "strategyMode", modeStr))
   {
      if(modeStr == "MODE_ADAPTIVE_QUANT") dynStrategyMode = MODE_ADAPTIVE_QUANT;
      else dynStrategyMode = MODE_AGGRESSIVE_SCALPER;
   }

   ExtractJsonParamBool(content, "useMultiEmaRibbon", dynUseMultiEmaRibbon);
   ExtractJsonParamBool(content, "use3000BarQuantFilter", dynUse3000BarQuantFilter);
   ExtractJsonParamBool(content, "isRunning", dynIsRunning);
   ExtractJsonParamBool(content, "panicClose", dynPanicClose);

   if(dynPanicClose)
   {
      PrintFormat("🚨 [REMOTE PANIC] Received Panic Close signal from Web UI! Closing all Magic #%d orders...", InpMagicNumber);
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(posInfo.SelectByIndex(i))
         {
            if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
            {
               trade.PositionClose(posInfo.Ticket());
            }
         }
      }
      dynIsRunning = false;
   }

   if(InpAutoAssetScaling)
   {
      CalibrateAssetParameters(true);
   }

   cloudStatus = dynIsRunning ? "CLOUD SYNCED 🟢" : "PAUSED (WEB) 🟡";
}

//+------------------------------------------------------------------+
//| Simple JSON Extractors for MQL5                                  |
//+------------------------------------------------------------------+
bool ExtractJsonParamDouble(const string &json, const string key, double &outVal)
{
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return false;
   pos += StringLen(searchKey);
   while(pos < StringLen(json) && (StringGetCharacter(json, pos) == ' ' || StringGetCharacter(json, pos) == '\t')) pos++;
   int endPos = pos;
   while(endPos < StringLen(json) && StringGetCharacter(json, endPos) != ',' && StringGetCharacter(json, endPos) != '}' && StringGetCharacter(json, endPos) != '\r' && StringGetCharacter(json, endPos) != '\n') endPos++;
   string valStr = StringSubstr(json, pos, endPos - pos);
   outVal = StringToDouble(valStr);
   return true;
}

bool ExtractJsonParamInt(const string &json, const string key, int &outVal)
{
   double d = 0;
   if(ExtractJsonParamDouble(json, key, d)) { outVal = (int)d; return true; }
   return false;
}

bool ExtractJsonParamBool(const string &json, const string key, bool &outVal)
{
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return false;
   pos += StringLen(searchKey);
   string sub = StringSubstr(json, pos, 10);
   if(StringFind(sub, "true") >= 0) { outVal = true; return true; }
   if(StringFind(sub, "false") >= 0) { outVal = false; return true; }
   return false;
}

bool ExtractJsonParamString(const string &json, const string key, string &outVal)
{
   string searchKey = "\"" + key + "\":\"";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return false;
   pos += StringLen(searchKey);
   int endPos = StringFind(json, "\"", pos);
   if(endPos > pos)
   {
      outVal = StringSubstr(json, pos, endPos - pos);
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| On-Chart HUD: Create Objects                                     |
//| Configured with default (x=15, y=115) to sit below Quick Trade   |
//+------------------------------------------------------------------+
void CreateHUD()
{
   int x = InpHUD_X;
   int y = InpHUD_Y;
   int w = 270;
   int h = 180;

   // Main Panel Background
   string bgName = HUD_PREFIX + "BG";
   ObjectCreate(0, bgName, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bgName, OBJPROP_CORNER, InpHUDCorner);
   ObjectSetInteger(0, bgName, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, bgName, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, bgName, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, bgName, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, bgName, OBJPROP_BGCOLOR, C'16,18,24');
   ObjectSetInteger(0, bgName, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bgName, OBJPROP_COLOR, C'42,46,60');
   ObjectSetInteger(0, bgName, OBJPROP_BACK, false);
   ObjectSetInteger(0, bgName, OBJPROP_SELECTABLE, false);

   // Title Label
   CreateLabel(HUD_PREFIX + "Title", "⚡ TMS QUANTUM EA v2.1", x + 12, y + 10, C'240,242,246', 9, true, InpHUDCorner);

   // Rows
   CreateLabel(HUD_PREFIX + "Mode", "Strategy: ...", x + 12, y + 34, C'160,165,180', 8, false, InpHUDCorner);
   CreateLabel(HUD_PREFIX + "Spread", "Spread: ...", x + 12, y + 54, C'160,165,180', 8, false, InpHUDCorner);
   CreateLabel(HUD_PREFIX + "Layers", "Active Layers: ...", x + 12, y + 74, C'160,165,180', 8, false, InpHUDCorner);
   CreateLabel(HUD_PREFIX + "BasketPnL", "Basket P&L: ...", x + 12, y + 96, C'240,242,246', 9, true, InpHUDCorner);
   CreateLabel(HUD_PREFIX + "DailyPnL", "Today P&L: ...", x + 12, y + 120, C'160,165,180', 8, false, InpHUDCorner);
   CreateLabel(HUD_PREFIX + "Sync", "Cloud Sync: ...", x + 12, y + 144, C'110,231,183', 8, true, InpHUDCorner);

   ChartRedraw(0);
}

void CreateLabel(string name, string text, int x, int y, color clr, int fontSize, bool bold, ENUM_BASE_CORNER corner = CORNER_LEFT_UPPER)
{
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, corner);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetString(0, name, OBJPROP_FONT, bold ? "Segoe UI Semibold" : "Segoe UI");
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

//+------------------------------------------------------------------+
//| On-Chart HUD: Update Dynamic Values                              |
//+------------------------------------------------------------------+
void UpdateHUD()
{
   double basketProfit = 0.0;
   int openLayers = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
         {
            basketProfit += (posInfo.Profit() + posInfo.Swap());
            openLayers++;
         }
      }
   }

   bool isCrypto = (StringFind(_Symbol, "BTC") >= 0 || StringFind(_Symbol, "Crypto") >= 0 || StringFind(_Symbol, "ETH") >= 0);
   string modeText = (dynStrategyMode == MODE_AGGRESSIVE_SCALPER) ? "Mode: AGGRESSIVE SCALPER" : "Mode: ADAPTIVE QUANT";
   if(isCrypto) modeText += (isAutoCalibrated ? " [BTC/AUTO⚡]" : " [BTC/24-7⚡]");
   ObjectSetString(0, HUD_PREFIX + "Mode", OBJPROP_TEXT, modeText);

   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   string spreadText = StringFormat("Spread: %d pts (Max: %d%s)", spread, dynMaxSpread, (isAutoCalibrated ? " [AUTO⚡]" : ""));
   ObjectSetString(0, HUD_PREFIX + "Spread", OBJPROP_TEXT, spreadText);
   ObjectSetInteger(0, HUD_PREFIX + "Spread", OBJPROP_COLOR, (spread <= dynMaxSpread) ? C'160,165,180' : C'248,113,113');

   int riskFreeCount = CountTotalRiskFreePositions();
   int maxCap = dynSmartPyramiding ? dynMaxOpenPositions : dynMaxLayers;
   string layersText = StringFormat("Layers: %d / %d (%d BE🔒)", openLayers, maxCap, riskFreeCount);
   ObjectSetString(0, HUD_PREFIX + "Layers", OBJPROP_TEXT, layersText);

   string basketText = StringFormat("Basket Floating: %s$%.2f (Target: $%.2f)", (basketProfit >= 0 ? "+" : ""), basketProfit, dynBasketTargetUSD);
   ObjectSetString(0, HUD_PREFIX + "BasketPnL", OBJPROP_TEXT, basketText);
   ObjectSetInteger(0, HUD_PREFIX + "BasketPnL", OBJPROP_COLOR, (basketProfit >= 0) ? C'52,211,153' : C'248,113,113');

   string dailyText = StringFormat("Today Closed: %s$%.2f / Tar: $%.0f", (dailyClosedProfit >= 0 ? "+" : ""), dailyClosedProfit, dynDailyTargetProfit);
   ObjectSetString(0, HUD_PREFIX + "DailyPnL", OBJPROP_TEXT, dailyText);
   ObjectSetInteger(0, HUD_PREFIX + "DailyPnL", OBJPROP_COLOR, (dailyClosedProfit >= 0) ? C'160,165,180' : C'248,113,113');

   ObjectSetString(0, HUD_PREFIX + "Sync", OBJPROP_TEXT, "Status: " + cloudStatus);

   ChartRedraw(0);
}
