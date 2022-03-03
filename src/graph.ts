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

type ResolutionArray = {
  resolutions: ResolutionData[]
}

type GraphResponse = {
  data: ResolutionArray
}

async function fetchFromGraphql(query: string) {
  const response = await fetch(SUBGRAPH_API, {
    method: 'POST',
    body: JSON.stringify({
      query,
    }),
  })

  return response
}

export async function fetchLatestResolutionIds(
  event: FetchEvent,
): Promise<ResolutionData[]> {
  var lastCreateTimestamp = await MAIN_NAMESPACE.get(LAST_CREATE_TIMESTAMP_KEY)
  lastCreateTimestamp = lastCreateTimestamp ? lastCreateTimestamp : '0'

  const response = await fetchFromGraphql(
    RESOLUTIONS_QUERY(lastCreateTimestamp),
  )
  var jsonBody
  if (response.status === 200) {
    jsonBody = await response.json()
  }

  try {
    const body = jsonBody as GraphResponse
    event.waitUntil(MAIN_NAMESPACE.put(GRAPH_ERROR_TIMESTAMP_KEY, ''))
    const resolutions = body.data.resolutions

    if (resolutions.length > 0) {
      const lastId = resolutions[resolutions.length - 1].createTimestamp
      event.waitUntil(MAIN_NAMESPACE.put(LAST_CREATE_TIMESTAMP_KEY, lastId))
    }

    return resolutions
  } catch {
    console.error(jsonBody)
    event.waitUntil(
      MAIN_NAMESPACE.put(GRAPH_ERROR_TIMESTAMP_KEY, Date.now().toString()),
    )
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
