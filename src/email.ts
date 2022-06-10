const FAILED_EMAILS_KEY = 'notEmailedResolutionIds'
const FAILED_VOTIGN_EMAILS_KEY = 'notEmailedVotingResolutionIds'

async function sendEmail(
  accessToken: string,
  to: string,
  cc: string,
  subject: string,
  body: string,
) {
  const mailBody = {
    fromAddress: EMAIL_FROM,
    toAddress: to,
    ccAddress: cc,
    subject: subject,
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

async function sendResolutionApprovalEmail(
  resolutionId: string,
  accessToken: string,
) {
  const body = `Hi Benjamin, new pre-draft resolution created. Would you mind reviewing it at https://dao.teledisko.com/#resolutions/${resolutionId}/edit .`
  return await sendEmail(
    accessToken,
    EMAIL_TO,
    EMAIL_CC,
    'New Pre-Draft to Review',
    body,
  )
}

async function sendNewOffersEmail(accessToken: string, contributors: string[]) {
  if (contributors.length == 0) {
    throw new Error(`No recipients.`)
  }

  const body = `Dear Contributor, new TelediskoToken offers has been made. Check them out at https://dao-staging.teledisko.com/#/tokens .`
  return await sendEmail(
    accessToken,
    EMAIL_TO,
    contributors.join(','),
    'New Offers',
    body,
  )
}

async function sendResolutionVotingEmail(
  resolutionId: string,
  accessToken: string,
  voters: string[],
) {
  if (voters.length == 0) {
    throw new Error(`Resolution ${resolutionId} has no recipients.`)
  }

  const body = `Dear Contributor, a new resolution has been approved. Please provide your vote as soon as the voting starts. More details at: https://dao.teledisko.com/#resolutions/${resolutionId} .`
  return await sendEmail(
    accessToken,
    EMAIL_TO,
    voters.join(','),
    'New Resolution',
    body,
  )
}

async function sendEmails(
  ids: string[],
  sendMailFunc: (id: string) => Promise<Response>,
) {
  const failedIds: string[] = []
  await Promise.all(
    ids.map(async (resolutionId) => {
      try {
        const response = await sendMailFunc(resolutionId)
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

  return failedIds
}

async function getFailedEmailResolutionIds(key: string) {
  const notEmailedResolutionIds = await MAIN_NAMESPACE.get(key)
  var ids: string[] = []
  if (notEmailedResolutionIds != null) {
    ids = JSON.parse(notEmailedResolutionIds) as string[]
  }

  return ids
}

export async function sendApprovalEmails(
  ids: string[],
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  const failedIds: string[] = await sendEmails(ids, async (id: string) => {
    return await sendResolutionApprovalEmail(id, accessToken)
  })

  event.waitUntil(
    MAIN_NAMESPACE.put(FAILED_EMAILS_KEY, JSON.stringify(failedIds)),
  )

  return failedIds
}

export async function sendNewOffersEmails(
  contributors: string[],
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  await sendNewOffersEmail(accessToken, contributors)
}

export async function sendVotingEmails(
  resolutionVotersMap: any,
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  const failedIds: string[] = await sendEmails(
    Object.keys(resolutionVotersMap),
    async (id: string) => {
      return await sendResolutionVotingEmail(
        id,
        accessToken,
        resolutionVotersMap[id],
      )
    },
  )

  event.waitUntil(
    MAIN_NAMESPACE.put(FAILED_VOTIGN_EMAILS_KEY, JSON.stringify(failedIds)),
  )

  return failedIds
}

export async function getFailedApprovalEmailResolutionIds() {
  return getFailedEmailResolutionIds(FAILED_EMAILS_KEY)
}

export async function getFailedVotingEmailResolutionIds() {
  return getFailedEmailResolutionIds(FAILED_VOTIGN_EMAILS_KEY)
}
