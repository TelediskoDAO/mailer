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

  return await response.json()
}

export async function getLatestResolutionIds(): Promise<ResolutionData[]> {
  var lastResolutionId = await MAIN_NAMESPACE.get('lastTimestamp')
  lastResolutionId = lastResolutionId ? lastResolutionId : '0'

  const response = (await fetchFromGraphql(
    RESOLUTIONS_QUERY(lastResolutionId),
  )) as GraphResponse

  return response.data.resolutions
}

export async function checkpoint(
  responseCodes: string[],
  lastTimestamp: string,
) {
  if (responseCodes.filter((code) => code !== '200').length === 0) {
    await MAIN_NAMESPACE.put('lastTimestamp', lastTimestamp)
  }
}
