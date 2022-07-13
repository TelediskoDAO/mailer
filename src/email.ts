import { ResolutionData } from './model'

const FAILED_PRE_DRAFT_KEY = 'notEmailedResolutionIds'
const FAILED_APPROVED_RESOLUTION_EMAILS_KEY = 'notEmailedVotingResolutionIds'
const FAILED_VOTING_START_EMAILS_KEY = 'notEmailedVotingStartResolutionIds'

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
  console.log('send mail')
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

async function sendPreDraftEmail(resolutionId: string, accessToken: string) {
  const body = buildEmailPage(
    `<p>Dear Board Member,</p><p>a new pre-draft resolution has been created.<br/>Would you mind <a href="https://dao.teledisko.com/#resolutions/${resolutionId}/edit">reviewing it?</a></p>`,
  )
  return await sendEmail(
    accessToken,
    EMAIL_TO,
    EMAIL_CC,
    'New Pre-Draft to Review',
    body,
  )
}

async function sendToContributors(
  accessToken: string,
  contributors: string[],
  content: string,
  subject: string,
) {
  if (contributors.length == 0) {
    throw new Error(`No recipients.`)
  }

  const body = buildEmailPage(content)

  return await sendEmail(
    accessToken,
    EMAIL_TO,
    contributors.join(','),
    subject,
    body,
  )
}

async function sendNewOffersEmail(accessToken: string, contributors: string[]) {
  return await sendToContributors(
    accessToken,
    contributors,
    `<p>Dear Contributor,</p> 
      <p>new TelediskoTokens have been offered internally.<br/>
      If you are interested in an exchange, please check them out <a href="https://dao-staging.teledisko.com/#/tokens">in the token page.</a>
      </p>`,
    'New TelediskoToken offers',
  )
}

async function sendVotingStartsEmail(
  resolutionId: string,
  accessToken: string,
  contributors: string[],
) {
  return await sendToContributors(
    accessToken,
    contributors,
    `<p>Dear Contributor,</p> 
      <p>The voting for <a href="https://dao.teledisko.com/#resolutions/${resolutionId}">the resolution #${resolutionId}</a> starts now!<br/>
      Please case your vote before its expiration.
      </p>`,
    'Voting starts!',
  )
}

async function sendResolutionApprovedEmail(
  resolutionId: string,
  accessToken: string,
  voters: string[],
  votingStarts: number,
) {
  let date = new Date()
  date.setTime(votingStarts * 1000)
  const votingStartsString = date.toUTCString()
  const content = `<p>Dear Contributor,</p><p>a new resolution has been approved.<br/>The polls open ${votingStartsString}. Remember to cast your vote then.<br>You can find more details <a href="https://dao.teledisko.com/#resolutions/${resolutionId}">on the resolution page.</a></p>`

  return await sendToContributors(
    accessToken,
    voters,
    content,
    'New Draft Resolution approved',
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

export async function getFailedEmailResolutions(key: string) {
  const notEmailedResolutions = await MAIN_NAMESPACE.get(key)
  var ids: ResolutionData[] = []
  if (notEmailedResolutions != null) {
    ids = JSON.parse(notEmailedResolutions) as ResolutionData[]
  }

  return ids
}

export async function sendPreDraftEmails(
  resolutions: ResolutionData[],
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  const failedIds: string[] = await sendEmails(
    resolutions.map((r) => r.id),
    async (id: string) => {
      return await sendPreDraftEmail(id, accessToken)
    },
  )

  event.waitUntil(
    MAIN_NAMESPACE.put(FAILED_PRE_DRAFT_KEY, JSON.stringify(failedIds)),
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

export async function sendResolutionApprovedEmails(
  resolutionVotersMap: any,
  resolutions: ResolutionData[],
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  const failedIds: string[] = await sendEmails(
    Object.keys(resolutionVotersMap),
    async (id: string) => {
      return await sendResolutionApprovedEmail(
        id,
        accessToken,
        resolutionVotersMap[id],
        resolutions.filter((r) => r.id == id)[0].votingStarts!,
      )
    },
  )

  const failedResolutions = resolutions.filter((r) => failedIds.includes(r.id))
  event.waitUntil(
    MAIN_NAMESPACE.put(
      FAILED_APPROVED_RESOLUTION_EMAILS_KEY,
      JSON.stringify(failedResolutions),
    ),
  )

  return failedIds
}

export async function sendVotingStartsEmails(
  resolutionVotersMap: any,
  resolutions: ResolutionData[],
  accessToken: string,
  event: FetchEvent | ScheduledEvent,
) {
  const failedIds: string[] = await sendEmails(
    Object.keys(resolutionVotersMap),
    async (id: string) => {
      return await sendVotingStartsEmail(
        id,
        accessToken,
        resolutionVotersMap[id],
      )
    },
  )

  const failedResolutions = resolutions.filter((r) => failedIds.includes(r.id))
  event.waitUntil(
    MAIN_NAMESPACE.put(
      FAILED_VOTING_START_EMAILS_KEY,
      JSON.stringify(failedResolutions),
    ),
  )

  return failedIds
}

export async function getFailedPreDraftEmailResolution() {
  return getFailedEmailResolutions(FAILED_PRE_DRAFT_KEY)
}

export async function getFailedApprovedEmailResolutions() {
  return getFailedEmailResolutions(FAILED_APPROVED_RESOLUTION_EMAILS_KEY)
}

export async function getFailedVotingStartEmailResolutions() {
  return getFailedEmailResolutions(FAILED_VOTING_START_EMAILS_KEY)
}
