// Fetches live market prices for the demo portfolio simulation.
// Falls back to fixed demo prices if the public API is unreachable (e.g. offline sandbox).

let cache = { data: null, ts: 0 };
const TTL_MS = 30 * 1000; // 30s

const ASSET_IDS = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin' };
const FALLBACK = { BTC: 60000, ETH: 3000, BNB: 550 };

async function getPrices() {
  const now = Date.now();
  if (cache.data && now - cache.ts < TTL_MS) return cache.data;

  try {
    const ids = Object.values(ASSET_IDS).join(',');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`API responded ${resp.status}`);
    const data = await resp.json();

    const prices = {
      BTC: data.bitcoin?.usd ?? FALLBACK.BTC,
      ETH: data.ethereum?.usd ?? FALLBACK.ETH,
      BNB: data.binancecoin?.usd ?? FALLBACK.BNB,
    };
    cache = { data: prices, ts: now };
    return prices;
  } catch (err) {
    console.warn('Price API unreachable, using fallback demo prices:', err.message);
    cache = { data: FALLBACK, ts: now };
    return FALLBACK;
  }
}

module.exports = { getPrices, ASSET_IDS };
