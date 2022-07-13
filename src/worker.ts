import {
  handleAuthHealth,
  handleEmailHealth,
  handleGraphHealth,
  handleOdooHealth,
} from './controllers/health'

import {
  handleApprovedResolutions,
  handleCreatedResolutions,
  handleNewOffers,
  handleVotingStarts,
} from './controllers/mailer'

async function handleEmails(event: ScheduledEvent) {
  await handleCreatedResolutions(event)
  await handleApprovedResolutions(event)
  await handleNewOffers(event)
  await handleVotingStarts(event)

  return new Response('OK')
}

async function handle(event: FetchEvent) {
  if (event.request.url.includes('/mails/created')) {
    return await handleCreatedResolutions(event)
  }

  if (event.request.url.includes('/mails/approved')) {
    return await handleApprovedResolutions(event)
  }

  if (event.request.url.includes('/mails/offers')) {
    return await handleNewOffers(event)
  }

  if (event.request.url.includes('/mails/vote')) {
    return await handleVotingStarts(event)
  }

  if (event.request.url.includes('/health/auth')) {
    return await handleAuthHealth()
  }

  if (event.request.url.includes('/health/email')) {
    return await handleEmailHealth()
  }

  if (event.request.url.includes('/health/graph')) {
    return await handleGraphHealth()
  }

  if (event.request.url.includes('/health/odoo')) {
    return await handleOdooHealth()
  }

  return new Response('Non existing route', { status: 404 })
}

addEventListener('fetch', (event) => {
  event.respondWith(handle(event))
})

addEventListener('scheduled', (event) => {
  event.waitUntil(handleEmails(event))
})
