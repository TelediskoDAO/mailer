//import { handleRequest } from './handler'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = '0x3E3fCa9Da850E22495590b7482043ad61e24CE09'

const ABI = [
  {
    type: 'event',
    name: 'ResolutionCreated',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'resolutionId', type: 'uint256' },
    ],
    anonymous: false,
  },
]

const provider = new ethers.providers.InfuraProvider(
  'rinkeby',
  '0e6b0dec423b4763af39a538fc7dcbf7',
)
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)

async function handleRequest(request: Request): Promise<Response> {
  var filter = contract.filters.ResolutionCreated()
  let events = await contract.queryFilter(filter, 14263618, 14269618)
  console.log(events)
  const response = new Response('Hello')

  return response
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
