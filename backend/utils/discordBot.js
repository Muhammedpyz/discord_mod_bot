let cachedBotGuilds = [
  { id: '1062369725067304990', name: 'FarLands' },
  { id: '1441769969133293621', name: 'Nyx Community' }
];
let lastBotGuildsFetch = 0;
const CACHE_DURATION = 60 * 1000; // 60 seconds

async function getBotGuilds(token) {
  const now = Date.now();
  if (cachedBotGuilds.length > 0 && (now - lastBotGuildsFetch < CACHE_DURATION)) {
    return cachedBotGuilds;
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', {
      headers: { Authorization: 'Bot ' + token }
    });

    if (res.ok) {
      cachedBotGuilds = await res.json();
      lastBotGuildsFetch = now;
      return cachedBotGuilds;
    } else if (res.status === 429) {
      console.warn('[RateLimit] Discord 429 hit on bot guilds, using cached fallback');
      return cachedBotGuilds;
    }
  } catch (err) {
    console.error('getBotGuilds error:', err.message);
  }

  return cachedBotGuilds;
}

module.exports = {
  getBotGuilds
};
