import {
  sendPreDraftEmails,
  sendResolutionApprovedEmails,
  sendNewOffersEmails,
  getFailedPreDraftEmailResolution,
  getFailedApprovedEmailResolutions,
  sendVotingStartsEmails,
  getFailedVotingStartEmailResolutions,
} from '../email'
import { fetchAccessToken } from '../auth'
import {
  fetchLastCreatedResolutions,
  fetchLastApprovedResolutionIds,
  fetchApprovedResolutions,
  fetchVoters,
  fetchNewOffers,
  fetchContributors,
} from '../graph'
import { fetchOdooUsers } from '../odoo'
import { ResolutionData } from '../model'

export async function handleCreatedResolutions(
  event: FetchEvent | ScheduledEvent,
) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const resolutions = await fetchLastCreatedResolutions(event)

    const previousFailedIds = await getFailedPreDraftEmailResolution()
    await sendPreDraftEmails(
      resolutions.concat(previousFailedIds),
      accessToken,
      event,
    )
  }

  return new Response('OK')
}

export async function handleApprovedResolutions(
  event: FetchEvent | ScheduledEvent,
) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const newResolutions = (await fetchLastApprovedResolutionIds(event)).map(
      (r) =>
        ({
          id: r.id,
          votingStarts: r.approveTimestamp! + r.resolutionType!.noticePeriod,
        } as ResolutionData),
    )
    const previousFailedIds = await getFailedApprovedEmailResolutions()
    const totalResolutions = previousFailedIds.concat(newResolutions)
    if (totalResolutions.length > 0) {
      const ethToEmails: any = await fetchOdooUsers(event)

      if (Object.keys(ethToEmails).length > 0) {
        const resolutionVotersMap: any = {}
        await Promise.all(
          totalResolutions.map(async (resolution: ResolutionData) => {
            const voters = await fetchVoters(event, resolution.id)
            const emails = voters
              .map((voter) => ethToEmails[voter.address.toLowerCase()])
              .filter((email) => email)

            resolutionVotersMap[resolution.id] = emails
          }),
        )

        await sendResolutionApprovedEmails(
          resolutionVotersMap,
          totalResolutions,
          accessToken,
          event,
        )
      }
    }
  }

  return new Response('OK')
}

export async function handleVotingStarts(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken === undefined) {
    return new Response('Invalid Access Token')
  }

  // Get resolutions approved within the last 30 days
  const today = new Date().getTime()
  const todaySeconds = Math.floor(today / 1000)
  const aMonthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000).getTime()
  const aMonthAgoSeconds = Math.floor(aMonthAgo / 1000)
  const resolutions = await fetchApprovedResolutions(aMonthAgoSeconds, event)

  const LAST_VOTING_EMAIL_SENT_KEY = 'lastVotingEmailSent'
  const lastVotingEmailSent = parseInt(
    (await MAIN_NAMESPACE.get(LAST_VOTING_EMAIL_SENT_KEY)) || '0',
  )

  // Get those whose approved_timestamp + notice_period is less than today
  // and greater than the last voting email sent
  // ex: Voting starts on 11th May at 12:00
  //     Today: 11th May 13:00
  //     Last email sent: 11th May 12:30 -> don't send
  //     Last email sent: 11th May 11:30 -> send
  const resolutionsToAlert = resolutions
    .filter(
      (resolution) =>
        parseInt(resolution.approveTimestamp!) +
          parseInt(resolution.resolutionType!.noticePeriod) <
        todaySeconds,
    )
    .filter(
      (resolution) =>
        parseInt(resolution.approveTimestamp!) +
          parseInt(resolution.resolutionType!.noticePeriod) >
        lastVotingEmailSent,
    )

  // Send notification to all contributors that can vote that resolution
  const previousFailedIds = await getFailedVotingStartEmailResolutions()
  const totalResolutions = previousFailedIds.concat(resolutionsToAlert)
  if (totalResolutions.length > 0) {
    const ethToEmails: any = await fetchOdooUsers(event)

    if (Object.keys(ethToEmails).length > 0) {
      const resolutionVotersMap: any = {}
      await Promise.all(
        totalResolutions.map(async (resolution: ResolutionData) => {
          const voters = await fetchVoters(event, resolution.id)
          const emails = voters
            .map((voter) => ethToEmails[voter.address.toLowerCase()])
            .filter((email) => email)

          resolutionVotersMap[resolution.id] = emails
        }),
      )

      console.log(resolutionVotersMap)

      await sendVotingStartsEmails(
        resolutionVotersMap,
        resolutionsToAlert,
        accessToken,
        event,
      )
    }
  }

  event.waitUntil(
    MAIN_NAMESPACE.put(
      LAST_VOTING_EMAIL_SENT_KEY,
      JSON.stringify(todaySeconds),
    ),
  )

  return new Response('OK')
}

export async function handleNewOffers(event: FetchEvent | ScheduledEvent) {
  const accessToken = await fetchAccessToken(event)

  if (accessToken !== undefined) {
    const offers = await fetchNewOffers(event)
    if (offers.length > 0) {
      const ethToEmails: any = await fetchOdooUsers(event)
      const contributors = await fetchContributors(event)
      const emails = contributors
        .map((contributor) => ethToEmails[contributor.address.toLowerCase()])
        .filter((email) => email)

      await sendNewOffersEmails(emails, accessToken, event)
    }
  }
  return new Response('OK')
}
