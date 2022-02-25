//import { handleRequest } from './handler'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = '0x3E3fCa9Da850E22495590b7482043ad61e24CE09'

const ABI = [
  'event ResolutionCreated(address indexed from, uint256 indexed resolutionId)',
]

const provider = new ethers.providers.InfuraProvider(
  'rinkeby',
  '0e6b0dec423b4763af39a538fc7dcbf7',
)
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)

async function handleRequest(request: Request): Promise<Response> {
  var filter = contract.filters.ResolutionCreated()
  let events = await contract.queryFilter(filter, 10203587, 'latest')

  var messages: string[] = []
  events.forEach((event) => {
    if (event.args !== undefined) {
      const content = event.args

      const address = content[0].toString()
      const resolutionId = content[1].toString()
      messages.push(
        `Address ${address} created pre draft with id ${resolutionId}`,
      )
    }
  })

  return new Response(messages.join('\n'))
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
