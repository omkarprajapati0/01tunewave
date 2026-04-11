const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

const readEnvValue = (env, key) => (env?.[key] || "").toString().trim();

const getSpotifyCredentials = (env) => {
  const clientId =
    readEnvValue(env, "VITE_SPOTIFY_CLIENT_ID") ||
    readEnvValue(env, "SPOTIFY_CLIENT_ID");
  const clientSecret =
    readEnvValue(env, "VITE_SPOTIFY_CLIENT_SECRET") ||
    readEnvValue(env, "SPOTIFY_CLIENT_SECRET");

  return { clientId, clientSecret };
};

export const createSpotifyTokenResult = async ({
  env = process.env,
  fetchImpl = fetch,
  bufferImpl = Buffer,
} = {}) => {
  const { clientId, clientSecret } = getSpotifyCredentials(env);

  if (!clientId || !clientSecret) {
    return {
      status: 500,
      body: {
        error: {
          code: "MISSING_SPOTIFY_CREDENTIALS",
          message:
            "Spotify credentials are not configured on the server. Set VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET in your deployment environment.",
        },
      },
    };
  }

  const credentials = bufferImpl
    .from(`${clientId}:${clientSecret}`)
    .toString("base64");

  const response = await fetchImpl(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let message = `Spotify token request failed with status ${response.status}.`;

    if (response.status === 401) {
      message =
        "Invalid Spotify credentials. Please check the Client ID and Client Secret.";
    } else if (response.status === 403) {
      message = "Spotify API access denied for this app.";
    } else if (response.status === 429) {
      message = "Spotify API rate limit reached. Please try again later.";
    } else if (errorText) {
      message = errorText;
    }

    return {
      status: response.status,
      body: {
        error: {
          code: `HTTP_${response.status}`,
          message,
        },
      },
    };
  }

  const data = await response.json();

  if (!data?.access_token) {
    return {
      status: 502,
      body: {
        error: {
          code: "TOKEN_MISSING",
          message: "Spotify token endpoint returned no access token.",
        },
      },
    };
  }

  return {
    status: 200,
    body: {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    },
  };
};
