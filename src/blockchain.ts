import { ethers } from 'ethers'

const ABI = [
  'event ResolutionCreated(address indexed from, uint256 indexed resolutionId)',
]
const PROVIDER = new ethers.providers.InfuraProvider(
  'rinkeby',
  '0e6b0dec423b4763af39a538fc7dcbf7',
)
const CONTRACT = new ethers.Contract(CONTRACT_ADDRESS, ABI, PROVIDER)

type ResolutionCreatedEvent = {
  address: string
  resolutionId: string
}

export async function getLatestEvents(): Promise<ResolutionCreatedEvent[]> {
  var filter = CONTRACT.filters.ResolutionCreated()
  const lastBlock = await MAIN_NAMESPACE.get('lastBlock')
  let events = await CONTRACT.queryFilter(
    filter,
    lastBlock ? Number(lastBlock) : CONTRACT_GENESIS_BLOCK,
    'latest',
  )

  return events
    .filter((event) => event.args !== undefined)
    .map((event) => {
      const content = event.args!

      return {
        address: content[0].toString(),
        resolutionId: content[1].toString(),
      }
    })
}

export async function checkpoint(responseCodes: string[]) {
  if (responseCodes.filter((code) => code !== '200').length === 0) {
    const currentBlock = await PROVIDER.getBlockNumber()
    await MAIN_NAMESPACE.put('lastBlock', currentBlock.toString())
  }
}
