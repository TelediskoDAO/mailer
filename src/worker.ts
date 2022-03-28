//import { handleRequest } from './handler'
import {
  sendApprovalEmails,
  sendVotingEmails,
  getFailedApprovalEmailResolutionIds,
  getFailedVotingEmailResolutionIds,
} from './email'
import { fetchAccessToken, getAuthErrorTimestamp } from './auth'
import {
  fetchLastCreatedResolutionIds,
  fetchLastApprovedResolutionIds,
  getGraphErrorTimestamp,
  getVotersErrorTimestamp,
  fetchVoters,
} from './graph'
import { fetchOdooUsers } from './odoo'

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
    const ethToEmails: any = await fetchOdooUsers()

    if (Object.keys(ethToEmails).length > 0) {
      const resolutionVotersMap: any = {}
      await Promise.all(
        previousFailedIds.concat(newResolutions).map(async (resolution) => {
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

async function handleVoters() {
  const graphVotersErrorTimestamp = await getVotersErrorTimestamp()
  if (graphVotersErrorTimestamp === null) {
    return new Response('OK')
  } else {
    return new Response(
      "Can't fetch voters from graph. Check logs for details.",
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

  return new Response('OK')
}

async function handle(event: FetchEvent) {
  if (event.request.url.includes('/mails/created')) {
    return await handleCreatedResolutions(event)
  }

  if (event.request.url.includes('/mails/approved')) {
    return await handleApprovedResolutions(event)
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

  if (event.request.url.includes('/health/voters')) {
    return await handleVoters()
  }

  return new Response('Non existing route', { status: 404 })
}

addEventListener('fetch', (event) => {
  event.respondWith(handle(event))
})

addEventListener('scheduled', (event) => {
  event.waitUntil(handleEmails(event))
})
