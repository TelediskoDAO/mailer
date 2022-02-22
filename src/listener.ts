import Web3 from 'web3'
import { AbiItem } from 'web3-utils'
import { EventData } from 'web3-eth-contract'

const INFURA_KEY = 'todo'
const web3 = new Web3('wss://mainnet.infura.io/ws/v3/' + INFURA_KEY)
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

const contract = new web3.eth.Contract(ABI as AbiItem[], CONTRACT_ADDRESS)

contract.events.ResolutionCreated(
  {
    fromBlock: 0,
  },
  function (error: Error, event: EventData) {
    console.log(event)
  },
)
