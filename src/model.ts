export type ResolutionType = {
  noticePeriod: number
  votingPeriod: number
}

export type ResolutionData = {
  id: string
  createTimestamp?: number
  approveTimestamp?: number
  votingStarts?: number
  resolutionType?: ResolutionType
}

export type ContributorData = {
  address: string
}

export type OfferData = {
  id: string
  from: string
  amount: number
  createTimestamp: number
}
