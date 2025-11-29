// --- PKCE Helpers ---
function generateRandomString(length) {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Main Auth Flow ---
export async function startSpotifyLogin(config) {
  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("pkce_verifier", verifier);

  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: "code",
    redirect_uri: config.redirect_uri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-library-read user-library-modify"
  });

  window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function finishSpotifyLogin(config) {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (!code) return null;

  const verifier = localStorage.getItem("pkce_verifier");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: config.redirect_uri,
    client_id: config.client_id,
    code_verifier: verifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body
  });

  const tokenData = await res.json();
  tokenData.timestamp = Date.now();

  localStorage.setItem("spotify_token", JSON.stringify(tokenData));
  return tokenData;
}

export function getStoredToken() {
  const data = JSON.parse(localStorage.getItem("spotify_token") || "{}");
  if (!data.access_token) return null;

  const expires = data.timestamp + (data.expires_in * 1000);
  if (Date.now() > expires) return null;

  return data.access_token;
}

export async function refreshToken(config) {
  const data = JSON.parse(localStorage.getItem("spotify_token") || "{}");
  if (!data.refresh_token) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: data.refresh_token,
    client_id: config.client_id
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const fresh = await res.json();
  fresh.timestamp = Date.now();

  localStorage.setItem("spotify_token", JSON.stringify(fresh));
  return fresh.access_token;
}
