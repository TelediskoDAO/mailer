//import { handleRequest } from './handler'
import { getAccessToken, sendEmail } from './email'
import { getLatestEvents, checkpoint } from './blockchain'

async function handleRequest(request: Request): Promise<Response> {
  const accessToken = await getAccessToken()
  const events = await getLatestEvents()
  var responseCodes: string[] = []

  await Promise.all(
    events.map(async (event) => {
      const body = `Hi Benjamin, the wallet ${event.address} has created a new pre-draft. Would you mind reviewing it at https://dao.teledisko.com/#resolutions/${event.resolutionId}/edit .`

      const result = await sendEmail(body, accessToken)
      responseCodes.push(result.status.toString())
    }),
  )

  await checkpoint(responseCodes)

  return new Response(responseCodes.join('\n'))
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
