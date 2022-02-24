//import { handleRequest } from './handler'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = '0xE84aCBE831EE9A435a9864F53DF3C8beb84ce0f6'

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

const provider = new ethers.providers.JsonRpcProvider(
  'https://rinkeby.infura.io/v3/0e6b0dec423b4763af39a538fc7dcbf7',
  'rinkeby',
)
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI)

async function handleRequest(request: Request): Promise<Response> {
  var response = new Response('diocane')
  try {
    const block = await provider.getGasPrice()
    response = new Response(block.toString())
  } catch (error) {
    console.log(error)
  }
  return response
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
