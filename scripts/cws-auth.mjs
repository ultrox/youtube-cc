// Chrome Web Store auth shared by release.mjs and store-status.mjs.
//
// We authorize as the publisher's Google account (OAuth client + refresh token). The v2 API accepts
// that token, but `wxt submit` only takes v2 credentials as a service account or a ready-made access
// token, so we mint the access token here and hand it over (valid ~1 hour, plenty for one run).

export const CREDENTIALS = [
  'CHROME_CLIENT_ID',
  'CHROME_CLIENT_SECRET',
  'CHROME_REFRESH_TOKEN',
  'CHROME_PUBLISHER_ID',
];

export const missingCredentials = () => CREDENTIALS.filter((k) => !process.env[k]);

/** Exchange the refresh token for an access token; throws with a readable reason on failure. */
export async function getAccessToken() {
  const { CHROME_CLIENT_ID = '', CHROME_CLIENT_SECRET = '', CHROME_REFRESH_TOKEN = '' } = process.env;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: CHROME_CLIENT_ID,
      client_secret: CHROME_CLIENT_SECRET,
      refresh_token: CHROME_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${body.error} ${body.error_description ?? ''}\n` +
        'invalid_grant = wrong/expired refresh token, or it was made with a different OAuth client.',
    );
  }
  return body.access_token;
}
