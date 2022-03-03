//import { handleRequest } from './handler'
import { getAccessToken, sendEmail } from './email'
import { getLatestResolutionIds, checkpoint } from './resolutions'

async function handleEvent(event: FetchEvent): Promise<Response> {
  const accessToken = await getAccessToken()
  const resolutions = await getLatestResolutionIds()
  var responseCodes: string[] = []

  if (resolutions.length > 0) {
    await Promise.all(
      resolutions.map(async (resolution) => {
        const body = `Hi Benjamin, new pre-draft resolution created. Would you mind reviewing it at https://dao.teledisko.com/#resolutions/${resolution.id}/edit .`

        const result = await sendEmail(body, accessToken)
        responseCodes.push(result.status.toString())
      }),
    )

    await checkpoint(
      responseCodes,
      resolutions[resolutions.length - 1].createTimestamp,
      event,
    )
  }

  return new Response(responseCodes.join('\n'))
}

addEventListener('fetch', (event) => {
  event.respondWith(handleEvent(event))
})
