//import { handleRequest } from './handler'
import { sendEmails, getFailedEmailResolutioIds } from './email'
import { fetchAccessToken, getAuthErrorTimestamp } from './auth'
import { fetchLatestResolutionIds, getGraphErrorTimestamp } from './graph'
import { Router } from 'itty-router'

// Create a new router
const router = Router()

router.get('/', async (request: Request, event: FetchEvent) => {
  const accessToken = await fetchAccessToken(event)
  const resolutions = await fetchLatestResolutionIds(event)

  const previousFailedIds = await getFailedEmailResolutioIds()
  await sendEmails(
    resolutions.map((res) => res.id).concat(previousFailedIds),
    accessToken,
    event,
  )

  return new Response('OK')
})

router.get('/health/email', async (request: Request, event: FetchEvent) => {
  const notEmailedResolutionIds = await getFailedEmailResolutioIds()
  if (notEmailedResolutionIds.length == 0) {
    return new Response('OK')
  } else {
    return new Response(
      `${notEmailedResolutionIds.length} emails weren't sent. Check the logs for details`,
      {
        status: 500,
      },
    )
  }
})

router.get('/health/graph', async (request: Request, event: FetchEvent) => {
  const graphErrorTimestamp = await getGraphErrorTimestamp()
  if (graphErrorTimestamp === null) {
    return new Response('OK')
  } else {
    return new Response("Can't connect to graph. Check logs for details.", {
      status: 500,
    })
  }
})

router.get('/health/auth', async (request: Request, event: FetchEvent) => {
  const authErrorTimestamp = await getAuthErrorTimestamp()
  if (authErrorTimestamp === null) {
    return new Response('OK')
  } else {
    return new Response("Can't get access token. Check logs for details.", {
      status: 500,
    })
  }
})

router.get('/health/mail', async (request: Request, event: FetchEvent) => {
  const graphErrorTimestamp = await getGraphErrorTimestamp()
  if (graphErrorTimestamp == '') {
    return new Response('OK')
  } else {
    return new Response("Can't connect to graph. Check logs for details.", {
      status: 500,
    })
  }
})

addEventListener('fetch', (event) => {
  event.respondWith(router.handle(event.request, event))
})
