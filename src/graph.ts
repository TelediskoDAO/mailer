const GRAPH_ERROR_TIMESTAMP_KEY = 'graphErrorTimestamp'
const LAST_CREATE_TIMESTAMP_KEY = 'lastCreateTimestamp'

const RESOLUTIONS_QUERY = (timestamp: string) => `
  query GetResolutions {
    resolutions(orderBy: createTimestamp, orderDirection: asc, where: {createTimestamp_gt: ${timestamp}}) {
      id
      createTimestamp
    }
  }
`

type ResolutionData = {
  id: string
  createTimestamp: string
}

type GraphResponse = Record<'data', Record<'resolutions', ResolutionData[]>>
type GraphResponseError = Record<'errors', any[]>

async function fetchFromGraphql(query: string) {
  const response = await fetch(SUBGRAPH_API, {
    method: 'POST',
    body: JSON.stringify({
      query,
    }),
  })

  return response
}

async function handleError(
  message: string,
  event: FetchEvent | ScheduledEvent,
) {
  console.error(message)
  event.waitUntil(
    MAIN_NAMESPACE.put(GRAPH_ERROR_TIMESTAMP_KEY, Date.now().toString()),
  )
}

export async function fetchLatestResolutionIds(
  event: FetchEvent | ScheduledEvent,
): Promise<ResolutionData[]> {
  const lastCreateTimestamp =
    (await MAIN_NAMESPACE.get(LAST_CREATE_TIMESTAMP_KEY)) || '0'

  try {
    const response = await fetchFromGraphql(
      RESOLUTIONS_QUERY(lastCreateTimestamp),
    )
    if (response.status !== 200) {
      throw new Error(await response.text())
    }

    const jsonBody = await response.json()
    const body = jsonBody as GraphResponse | GraphResponseError

    if ('data' in body) {
      const resolutions = body.data.resolutions
      event.waitUntil(MAIN_NAMESPACE.put(GRAPH_ERROR_TIMESTAMP_KEY, ''))

      if (resolutions.length > 0) {
        const { createTimestamp: lastId } = resolutions[resolutions.length - 1]
        event.waitUntil(MAIN_NAMESPACE.put(LAST_CREATE_TIMESTAMP_KEY, lastId))
      }

      return resolutions
    }

    throw new Error(JSON.stringify(jsonBody))
  } catch (e) {
    await handleError((e as Error).message, event)
    return []
  }
}

export async function getGraphErrorTimestamp(): Promise<string | null> {
  const value = await MAIN_NAMESPACE.get(GRAPH_ERROR_TIMESTAMP_KEY)
  if (value == '') {
    return null
  }

  return value
}
