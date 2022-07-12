//import { handleRequest } from './handler'
import {
  sendPreDraftEmails,
  sendResolutionApprovedEmails,
  sendNewOffersEmails,
  getFailedPreDraftEmailResolution,
  getFailedApprovedEmailResolutions,
  sendVotingStartsEmails,
  getFailedVotingStartEmailResolutions,
} from './email'
import { fetchAccessToken, getAuthErrorTimestamp } from './auth'
import {
  fetchLastCreatedResolutions,
  fetchLastApprovedResolutionIds,
  fetchApprovedResolutionsIds,
  getGraphErrorTimestamp,
  fetchVoters,
  fetchNewOffers,
  fetchContributors,
} from './graph'
import { fetchOdooUsers, getOdooErrorTimestamp } from './odoo'
import { ResolutionData } from './model'

async function handleCreatedResolutions(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const resolutions = await fetchLastCreatedResolutions(event)

    const previousFailedIds = await getFailedPreDraftEmailResolution()
    await sendPreDraftEmails(
      resolutions.concat(previousFailedIds),
      accessToken,
      event,
    )
  }

  return new Response('OK')
}

async function handleApprovedResolutions(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const newResolutions = (await fetchLastApprovedResolutionIds(event)).map(
      (r) =>
        ({
          id: r.id,
          votingStarts: r.approveTimestamp! + r.resolutionType!.noticePeriod,
        } as ResolutionData),
    )
    const previousFailedIds = await getFailedApprovedEmailResolutions()
    const totalResolutions = previousFailedIds.concat(newResolutions)
    if (totalResolutions.length > 0) {
      const ethToEmails: any = await fetchOdooUsers(event)

      if (Object.keys(ethToEmails).length > 0) {
        const resolutionVotersMap: any = {}
        await Promise.all(
          totalResolutions.map(async (resolution: ResolutionData) => {
            const voters = await fetchVoters(event, resolution.id)
            const emails = voters
              .map((voter) => ethToEmails[voter.address.toLowerCase()])
              .filter((email) => email)

            resolutionVotersMap[resolution.id] = emails
          }),
        )

        await sendResolutionApprovedEmails(
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

async function handleVotingStarts(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken === undefined) {
    return new Response('Invalid Access Token')
  }

  // Get resolutions approved within the last 30 days
  const today = new Date().getTime()
  const todaySeconds = Math.floor(today / 1000)
  const aMonthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000).getTime()
  const aMonthAgoSeconds = Math.floor(aMonthAgo / 1000)
  const resolutions = await fetchApprovedResolutionsIds(aMonthAgoSeconds, event)
  const lastVotingEmailSent = 0

  // Get those whose approved_timestamp + notice_period is less than today
  // and greater than the last voting email sent
  // ex: Voting starts on 11th May at 12:00
  //     Today: 11th May 13:00
  //     Last email sent: 11th May 12:30 -> don't send
  //     Last email sent: 11th May 11:30 -> send
  const resolutionsToAlert = resolutions
    .filter(
      (resolution) =>
        resolution.approveTimestamp! + resolution.resolutionType!.noticePeriod <
        todaySeconds,
    )
    .filter(
      (resolution) =>
        resolution.approveTimestamp! + resolution.resolutionType!.noticePeriod >
        lastVotingEmailSent,
    )
  // Send notification to all contributors that can vote that resolution
  const previousFailedIds = await getFailedVotingStartEmailResolutions()
  const totalResolutions = previousFailedIds.concat(resolutionsToAlert)
  if (totalResolutions.length > 0) {
    const ethToEmails: any = await fetchOdooUsers(event)

    if (Object.keys(ethToEmails).length > 0) {
      const resolutionVotersMap: any = {}
      await Promise.all(
        totalResolutions.map(async (resolution: ResolutionData) => {
          const voters = await fetchVoters(event, resolution.id)
          const emails = voters
            .map((voter) => ethToEmails[voter.address.toLowerCase()])
            .filter((email) => email)

          resolutionVotersMap[resolution.id] = emails
        }),
      )

      await sendVotingStartsEmails(
        resolutionVotersMap,
        resolutionsToAlert,
        accessToken,
        event,
      )
    }
  }

  return new Response('OK')
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

async function handleEmailHealth() {
  const notEmailedResolutionIds = (await getFailedPreDraftEmailResolution())
    .concat(await getFailedApprovedEmailResolutions())
    .concat(await getFailedVotingStartEmailResolutions())
    .map((r) => r.id)
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

async function handleOdooHealth() {
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

async function handleGraphHealth() {
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
    return await handleEmailHealth()
  }

  if (event.request.url.includes('/health/graph')) {
    return await handleGraphHealth()
  }

  if (event.request.url.includes('/health/odoo')) {
    return await handleOdooHealth()
  }

  return new Response('Non existing route', { status: 404 })
}

addEventListener('fetch', (event) => {
  event.respondWith(handle(event))
})

addEventListener('scheduled', (event) => {
  event.waitUntil(handleEmails(event))
})
