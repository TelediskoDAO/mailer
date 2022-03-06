const FAILED_EMAILS_KEY = 'notEmailedResolutionIds'

export async function sendEmail(resolutionId: string, accessToken: string) {
  const body = `Hi Benjamin, new pre-draft resolution created. Would you mind reviewing it at https://dao.teledisko.com/#resolutions/${resolutionId}/edit .`

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

export async function sendEmails(
  ids: string[],
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  const failedIds: string[] = []
  await Promise.all(
    ids.map(async (resolutionId) => {
      try {
        const response = await sendEmail(resolutionId, accessToken)
        if (response.status != 200) {
          failedIds!.push(resolutionId)
          console.error(await response.text())
        } else {
          console.log(
            `Email ${resolutionId} sent. Response: ${await response.text()}`,
          )
        }
      } catch (e) {
        failedIds!.push(resolutionId)
        console.error(e)
      }
    }),
  )

  event.waitUntil(
    MAIN_NAMESPACE.put(FAILED_EMAILS_KEY, JSON.stringify(failedIds)),
  )

  return failedIds
}

export async function getFailedEmailResolutioIds() {
  const notEmailedResolutionIds = await MAIN_NAMESPACE.get(FAILED_EMAILS_KEY)
  var ids: string[] = []
  if (notEmailedResolutionIds != null) {
    ids = JSON.parse(notEmailedResolutionIds) as string[]
  }

  return ids
}
