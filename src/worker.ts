//import { handleRequest } from './handler'
import {
  sendApprovalEmails,
  sendVotingEmails,
  sendNewOffersEmails,
  getFailedApprovalEmailResolutionIds,
  getFailedVotingEmailResolutionIds,
} from './email'
import { fetchAccessToken, getAuthErrorTimestamp } from './auth'
import {
  fetchLastCreatedResolutionIds,
  fetchLastApprovedResolutionIds,
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
      (r) => r.id,
    )
    const previousFailedIds = await getFailedVotingEmailResolutionIds()
    const totalResolutions = previousFailedIds.concat(newResolutions)
    if (totalResolutions.length > 0) {
      const ethToEmails: any = await fetchOdooUsers(event)

      if (Object.keys(ethToEmails).length > 0) {
        const resolutionVotersMap: any = {}
        await Promise.all(
          totalResolutions.map(async (resolution) => {
            const voters = await fetchVoters(event, resolution)
            const emails = voters
              .map((voter) => ethToEmails[voter.address.toLowerCase()])
              .filter((email) => email)

            resolutionVotersMap[resolution] = emails
          }),
        )

        await sendVotingEmails(resolutionVotersMap, accessToken, event)
      }
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

async function handleEmail() {
  const notEmailedResolutionIds = (
    await getFailedApprovalEmailResolutionIds()
  ).concat(await getFailedVotingEmailResolutionIds())
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
