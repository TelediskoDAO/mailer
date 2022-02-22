import { handleRequest } from './handler'
import Web3 from 'web3'

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})
