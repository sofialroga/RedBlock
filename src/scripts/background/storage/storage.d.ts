type InactivePeriod = 'never' | '1y' | '2y' | '3y'
type NonLinkedMentionPattern = 'common' | 'aggressive'

interface RedBlockStorage {
  $$version$$: 'v0.14.0.0'
  savedUsers: TwitterUser[]
  bookmarks: BookmarkItem[]
  options: {
    removeSessionAfterComplete: boolean
    skipInactiveUser: InactivePeriod
    revealBioBlockMode: boolean
    enableBlockBuster: boolean
    enableBlockBusterWithTweetDeck: boolean
    firstPartyIsolationCompatibleMode: boolean
    delayBlockRequest: number
    muteEvenAlreadyBlocking: boolean
    enableReactionsV2Support: boolean
    oneClickBlockModeForAllTabs: boolean
    allowSelfChainBlock: boolean
    recurringSessionInterval: number
  }
  uiOptions: {
    menus: {
      chainBlockFollowers: boolean
      chainBlockFollowings: boolean
      chainBlockMutualFollowers: boolean
      chainBlockRetweeters: boolean
      chainBlockLikers: boolean
      chainBlockRetweetersAndLikers: boolean
      chainBlockMentioned: boolean
      chainBlockAudioSpaceSpeakers: boolean
      chainBlockAudioSpaceSpeakersAndListeners: boolean
      chainBlockHashTagInUsersProfile: boolean
    }
  }
  badWords: BadWordItem[]
}

type RedBlockOptions = RedBlockStorage['options']
type RedBlockUIOptions = RedBlockStorage['uiOptions']

type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
