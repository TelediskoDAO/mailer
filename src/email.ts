export async function getAccessToken(): Promise<string> {
  const authTokenResponse = await fetch(ZOHO_API_AUTH, {
    body: `client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}&grant_type=refresh_token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  return JSON.parse(await authTokenResponse.text())['access_token']
}

export async function sendEmail(body: string, accessToken: string) {
  const mailBody = {
    fromAddress: EMAIL_FROM,
    toAddress: EMAIL_TO,
    ccAddress: EMAIL_CC,
    subject: 'New Pre-Draft to Review',
    content: body,
    askReceipt: 'no',
  }

  return await fetch(ZOHO_API_MAIL, {
    body: JSON.stringify(mailBody),
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
}
