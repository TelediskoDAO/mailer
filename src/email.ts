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

const bodyTemplate1 = `<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="font-family:'Courier New'">`

const bodyTemplate2 = `<br/>
Cheers,<br/>
The Oracle
<br/>
<br/>
<img src="https://static.wixstatic.com/media/24c98e_b8ee544aed6f4f9c8956b4683c38f677~mv2.jpg/v1/fill/w_630,h_196,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/TelediskoColor1Glow.jpg" width="160" height="50" border="0">
</body>
</html>`

function buildEmailPage(content: string) {
  return `${bodyTemplate1}${content}${bodyTemplate2}`
}

async function sendResolutionApprovalEmail(
  resolutionId: string,
  accessToken: string,
) {
  const body = buildEmailPage(
    `<p>Dear Board Member,</p><p>a new pre-draft resolution has been created.<br/>Would you mind <h href="https://dao.teledisko.com/#resolutions/${resolutionId}/edit" reviewing it?</p>`,
  )
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

  const body = buildEmailPage(`<p>Dear Contributor,</p> 
      <p>new TelediskoTokens have been offered internally.<br/>
      If you are interested in an exchange, please check them out <a href="https://dao-staging.teledisko.com/#/tokens">in the token page.</a>
      </p>`)

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
  votingStarts: number,
) {
  if (voters.length == 0) {
    throw new Error(`Resolution ${resolutionId} has no recipients.`)
  }

  let date = new Date()
  date.setTime(votingStarts * 1000)
  const votingStartsString = date.toUTCString()
  const body = buildEmailPage(
    `<p>Dear Contributor,</p><p>a new resolution has been approved.<br/>The polls open ${votingStartsString}. Remember to cast your vote then.<br>You can find more details <a href="https://dao.teledisko.com/#resolutions/${resolutionId}">on the resolution page</a></p> .`,
  )
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

type ResolutionData = {
  id: string
  votingStarts: number
}

async function getFailedEmailResolutions(key: string) {
  const notEmailedResolutions = await MAIN_NAMESPACE.get(key)
  var ids: ResolutionData[] = []
  if (notEmailedResolutions != null) {
    ids = JSON.parse(notEmailedResolutions) as ResolutionData[]
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
  resolutions: ResolutionData[],
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
        resolutions.filter((r) => r.id == id)[0].votingStarts,
      )
    },
  )

  const failedResolutions = resolutions.filter((r) => failedIds.includes(r.id))
  event.waitUntil(
    MAIN_NAMESPACE.put(
      FAILED_VOTIGN_EMAILS_KEY,
      JSON.stringify(failedResolutions),
    ),
  )

  return failedIds
}

export async function getFailedApprovalEmailResolutionIds() {
  return getFailedEmailResolutionIds(FAILED_EMAILS_KEY)
}

export async function getFailedVotingEmailResolutions() {
  return getFailedEmailResolutions(FAILED_VOTIGN_EMAILS_KEY)
}
