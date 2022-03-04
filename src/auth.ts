const AUTH_ERROR_TIMESTAMP_KEY = 'authErrorTimestamp'

export async function fetchAccessToken(
  event: FetchEvent,
): Promise<string | undefined> {
  const authTokenResponse = await fetch(ZOHO_API_AUTH, {
    body: `client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}&grant_type=refresh_token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (authTokenResponse.status === 200) {
    event.waitUntil(MAIN_NAMESPACE.put(AUTH_ERROR_TIMESTAMP_KEY, ''))
    return JSON.parse(await authTokenResponse.text())['access_token']
  }

  console.error(await authTokenResponse.text())
  event.waitUntil(
    MAIN_NAMESPACE.put(AUTH_ERROR_TIMESTAMP_KEY, Date.now().toString()),
  )
  return undefined
}

export async function getAuthErrorTimestamp(): Promise<string | null> {
  const value = await MAIN_NAMESPACE.get(AUTH_ERROR_TIMESTAMP_KEY)
  if (value == '') {
    return null
  }

  return value
}
