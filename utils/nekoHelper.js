// Melon Bot nekoHelper - nekos.best API for roleplay GIFs
const axios = require("axios");

const nekoEndpoints = {
  hug: "hug",
  kiss: "kiss",
  pat: "pat",
  slap: "slap",
  poke: "poke",
  tickle: "tickle",
  wink: "wink",
  blush: "blush",
  cry: "cry",
  dance: "dance",
  laugh: "laugh",
  smile: "smile",
  sleep: "sleep",
  shrug: "shrug",
  facepalm: "facepalm",
  thumbsup: "thumbsup",
  run: "run",
  eat: "feed",
  deathstare: "stare"
};

async function getNekoGif(action) {
  try {
    const endpoint = nekoEndpoints[action];
    if (!endpoint) return null;
    const response = await axios.get(`https://nekos.best/api/v2/${endpoint}`);
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].url;
    }
  } catch (error) {
    console.error(`[NekoHelper] GIF fetch error (${action}):`, error.message);
  }
  return null;
}

function hasNekoEndpoint(action) {
  return nekoEndpoints.hasOwnProperty(action);
}

module.exports = { getNekoGif, nekoEndpoints, hasNekoEndpoint };
