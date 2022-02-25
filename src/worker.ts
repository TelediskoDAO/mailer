//import { handleRequest } from './handler'
import { ethers } from 'ethers'

const ZOHO_API_MAIL =
  'https://mail.zoho.com/api/accounts/3715513000000008001/messages'
const ZOHO_API_AUTH = 'https://accounts.zoho.com/oauth/v2/token'
const CONTRACT_ADDRESS = '0x3E3fCa9Da850E22495590b7482043ad61e24CE09'
const CONTRACT_GENESIS_BLOCK = 10203587
const ABI = [
  'event ResolutionCreated(address indexed from, uint256 indexed resolutionId)',
]

const provider = new ethers.providers.InfuraProvider(
  'rinkeby',
  '0e6b0dec423b4763af39a538fc7dcbf7',
)
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)

async function authZoho(): Promise<string> {
  const authTokenResponse = await fetch(ZOHO_API_AUTH, {
    body: `client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}&grant_type=refresh_token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  return JSON.parse(await authTokenResponse.text())['access_token']
}

async function handleRequest(request: Request): Promise<Response> {
  var filter = contract.filters.ResolutionCreated()

  const lastBlock = await MAIN_NAMESPACE.get('lastBlock')
  let events = await contract.queryFilter(
    filter,
    lastBlock ? Number(lastBlock) : CONTRACT_GENESIS_BLOCK,
    'latest',
  )

  console.log(await MAIN_NAMESPACE.get('lastBlock'))

  const authToken = await authZoho()
  console.log(authToken)

  var results: string[] = []

  await Promise.all(
    events.map(async (event) => {
      if (event.args !== undefined) {
        const content = event.args

        const address = content[0].toString()
        const resolutionId = content[1].toString()
        const mailBody = {
          fromAddress: 'teledisko@teledisko.com',
          toAddress: 'alberto@granzotto.net',
          subject: 'New Pre-Draft to Review',
          content: `Hi Benjamin, the wallet ${address} has created a new pre-draft. Would you mind reviewing it at https://dao.teledisko.com/#resolutions/${resolutionId}/edit .`,
          askReceipt: 'yes',
        }
        const result = await fetch(ZOHO_API_MAIL, {
          body: JSON.stringify(mailBody),
          headers: {
            Authorization: `Zoho-oauthtoken ${authToken}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })
        results.push(result.status.toString())
      }
    }),
  )

  if (results.filter((code: string) => code !== '200').length === 0) {
    const currentBlock = await provider.getBlockNumber()
    await MAIN_NAMESPACE.put('lastBlock', currentBlock.toString())
  }

  return new Response(results.join('\n'))
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
