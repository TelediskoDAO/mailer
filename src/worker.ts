//import { handleRequest } from './handler'
import { sendEmails, getFailedEmailResolutioIds } from './email'
import { fetchAccessToken, getAuthErrorTimestamp } from './auth'
import { fetchLatestResolutionIds, getGraphErrorTimestamp } from './graph'

async function handleRoot(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const resolutions = await fetchLatestResolutionIds(event)

    const previousFailedIds = await getFailedEmailResolutioIds()
    await sendEmails(
      resolutions.map((res) => res.id).concat(previousFailedIds),
      accessToken,
      event,
    )
  }

  return new Response('OK')
}

async function handleEmail() {
  const notEmailedResolutionIds = await getFailedEmailResolutioIds()
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

async function handle(event: FetchEvent) {
  if (event.request.url.includes('/health/auth')) {
    return await handleAuth()
  } else if (event.request.url.includes('/health/email')) {
    return await handleEmail()
  } else if (event.request.url.includes('/health/graph')) {
    return await handleGraph()
  } else {
    return await handleRoot(event)
  }
}

addEventListener('fetch', (event) => {
  event.respondWith(handle(event))
})

addEventListener('scheduled', (event) => {
  event.waitUntil(handleRoot(event))
})
