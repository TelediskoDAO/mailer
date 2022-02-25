//import { handleRequest } from './handler'
import { ethers } from 'ethers'

const ZOHO_API = 'https://mail.zoho.com/api/accounts/<accountId>/messages'
const ZOHO_AUTH_TOKEN = 'noidea'
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

  var results: string[] = []
  await Promise.all(
    events.map(async (event) => {
      if (event.args !== undefined) {
        const content = event.args

        const address = content[0].toString()
        const resolutionId = content[1].toString()
        const mailBody = {
          fromAddress: 'mailer@teledisko.com',
          toAddress: 'miotto@posteo.de',
          subject: 'New Pre-Draft to Review',
          content: `Hi Benjamin, the wallet ${address} has created a new pre-draft. Would you mind reviewing it at https://dao.teledisko.com/resolutions/${resolutionId}.`,
          askReceipt: 'yes',
        }
        const result = await fetch(ZOHO_API, {
          body: JSON.stringify(mailBody),
          headers: {
            Authorization: `Zoho-oauthtoken ${ZOHO_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })
        results.push(result.status.toString())
      }
    }),
  )

  return new Response(results.join('\n'))
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
