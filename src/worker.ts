//import { handleRequest } from './handler'
import {
  sendApprovalEmails,
  sendVotingEmails,
  sendNewOffersEmails,
  getFailedApprovalEmailResolutionIds,
  getFailedVotingEmailResolutions,
} from './email'
import { fetchAccessToken, getAuthErrorTimestamp } from './auth'
import {
  fetchLastCreatedResolutionIds,
  fetchLastApprovedResolutionIds,
  fetchApprovedResolutionsIds,
  getGraphErrorTimestamp,
  fetchVoters,
  fetchNewOffers,
  fetchContributors,
} from './graph'
import { fetchOdooUsers, getOdooErrorTimestamp } from './odoo'

async function handleCreatedResolutions(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const resolutions = await fetchLastCreatedResolutionIds(event)

    const previousFailedIds = await getFailedApprovalEmailResolutionIds()
    await sendApprovalEmails(
      resolutions.map((res) => res.id).concat(previousFailedIds),
      accessToken,
      event,
    )
  }

  return new Response('OK')
}

async function handleApprovedResolutions(event: FetchEvent | ScheduledEvent) {
  // Login
  // Login with user name, then with UID e password

  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const newResolutions = (await fetchLastApprovedResolutionIds(event)).map(
      (r) => ({
        id: r.id,
        votingStarts: r.approveTimestamp + r.resolutionType.noticePeriod,
      }),
    )
    const previousFailedIds = await getFailedVotingEmailResolutions()
    const totalResolutions = previousFailedIds.concat(newResolutions)
    if (totalResolutions.length > 0) {
      const ethToEmails: any = await fetchOdooUsers(event)

      if (Object.keys(ethToEmails).length > 0) {
        const resolutionVotersMap: any = {}
        await Promise.all(
          totalResolutions.map(async (resolution) => {
            const voters = await fetchVoters(event, resolution.id)
            const emails = voters
              .map((voter) => ethToEmails[voter.address.toLowerCase()])
              .filter((email) => email)

            resolutionVotersMap[resolution.id] = emails
          }),
        )

        await sendVotingEmails(
          resolutionVotersMap,
          totalResolutions,
          accessToken,
          event,
        )
      }
    }
  }

  return new Response('OK')
}

async function handleVotingAlerts(event: FetchEvent | ScheduledEvent) {
  // Get resolutions approved within the last 30 days
  const today = new Date().getTime()
  const todaySeconds = Math.floor(today / 1000)
  const aMonthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000).getTime()
  const aMonthAgoSeconds = Math.floor(aMonthAgo / 1000)
  const resolutions = await fetchApprovedResolutionsIds(aMonthAgoSeconds, event)
  const lastVotingEmailSent = 0

  // Get those whose approved_timestamp + notice_period is less than today
  const resolutionsToAlert = resolutions
    .filter(
      (resolution) =>
        resolution.approveTimestamp + resolution.resolutionType.noticePeriod <
        todaySeconds,
    )
    .filter(
      (resolution) =>
        resolution.approveTimestamp + resolution.resolutionType.noticePeriod >
        lastVotingEmailSent,
    )

  // and greater than the last voting email sent

  // ex: Voting starts on 11th May at 12:00
  //     Today: 11th May 13:00
  //     Last email sent: 11th May 12:30 -> don't send
  //     Last email sent: 11th May 11:30 -> send
  // Get upcoming resolution voting start times
  // Filter those that started and for which a notification was not yet sent
  // Send notification to all contributors that can vote that resolution
}

async function handleNewOffers(event: FetchEvent | ScheduledEvent) {
  // Login
  // Login with user name, then with UID e password

  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const offers = await fetchNewOffers(event)
    if (offers.length > 0) {
      const ethToEmails: any = await fetchOdooUsers(event)
      const contributors = await fetchContributors(event)
      const emails = contributors
        .map((contributor) => ethToEmails[contributor.address.toLowerCase()])
        .filter((email) => email)

      await sendNewOffersEmails(emails, accessToken, event)
    }
  }
  return new Response('OK')
}

async function handleEmail() {
  const notEmailedResolutionIds = (
    await getFailedApprovalEmailResolutionIds()
  ).concat((await getFailedVotingEmailResolutions()).map((r) => r.id))
  if (notEmailedResolutionIds.length === 0) {
    return new Response('OK')
  } else {
    return new Response(
      `${notEmailedResolutionIds.length} emails weren't sent. Check the logs for details`,
      {
        status: 500,
      },
    )
  }
}

async function handleOdoo() {
  const graphVotersErrorTimestamp = await getOdooErrorTimestamp()
  if (graphVotersErrorTimestamp === null) {
    return new Response('OK')
  } else {
    return new Response(
      "Can't communicate with Odoo. Either login or user fetching are broken. Check the logs for more details.",
      {
        status: 500,
      },
    )
  }
}

async function handleGraph() {
  const graphErrorTimestamp = await getGraphErrorTimestamp()
  if (graphErrorTimestamp === null) {
    return new Response('OK')
  } else {
    return new Response("Can't connect to graph. Check logs for details.", {
      status: 500,
    })
  }
}

async function handleAuth() {
  const authErrorTimestamp = await getAuthErrorTimestamp()
  if (authErrorTimestamp === null) {
    return new Response('OK')
  } else {
    return new Response("Can't get access token. Check logs for details.", {
      status: 500,
    })
  }
}

async function handleEmails(event: ScheduledEvent) {
  await handleCreatedResolutions(event)
  await handleApprovedResolutions(event)
  await handleNewOffers(event)

  return new Response('OK')
}

async function handle(event: FetchEvent) {
  if (event.request.url.includes('/mails/created')) {
    return await handleCreatedResolutions(event)
  }

  if (event.request.url.includes('/mails/approved')) {
    return await handleApprovedResolutions(event)
  }

  if (event.request.url.includes('/mails/offers')) {
    return await handleNewOffers(event)
  }

  if (event.request.url.includes('/health/auth')) {
    return await handleAuth()
  }

  if (event.request.url.includes('/health/email')) {
    return await handleEmail()
  }

  if (event.request.url.includes('/health/graph')) {
    return await handleGraph()
  }

  if (event.request.url.includes('/health/odoo')) {
    return await handleOdoo()
  }

  return new Response('Non existing route', { status: 404 })
}

addEventListener('fetch', (event) => {
  event.respondWith(handle(event))
})

addEventListener('scheduled', (event) => {
  event.waitUntil(handleEmails(event))
})
