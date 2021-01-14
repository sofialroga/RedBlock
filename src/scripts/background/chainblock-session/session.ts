import * as Scraper from './scraper.js'
import * as TwitterAPI from '../twitter-api.js'
import { EventEmitter, SessionStatus, copyFrozenObject, sleep, getCountOfUsersToBlock } from '../../common.js'
import Blocker from './blocker.js'
import BlockLimiter from '../block-limiter.js'

export type SessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest | ImportBlockSessionRequest

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': TwitterAPI.Limit
  'rate-limit-reset': null
  started: SessionInfo
  stopped: SessionInfo
  complete: SessionInfo
  error: string
}

export interface FollowerBlockSessionRequest {
  purpose: ChainKind
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
    mutualBlocked: Verb
  }
}

export interface TweetReactionBlockSessionRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  purpose: 'chainblock'
  target: {
    type: 'tweet_reaction'
    // author of tweet
    // user: TwitterUser
    tweet: Tweet
    // reaction: ReactionKind
    blockRetweeters: boolean
    blockLikers: boolean
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
  }
}

export interface ImportBlockSessionRequest {
  purpose: ChainKind
  target: {
    type: 'import'
    userIds: string[]
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
  }
}

export interface SessionInfo<ReqT = SessionRequest> {
  sessionId: string
  request: ReqT
  progress: {
    success: {
      [verb in VerbSomething]: number
    }
    failure: number
    already: number
    skipped: number
    error: number
    scraped: number
    total: number | null
  }
  confirmed: boolean
  status: SessionStatus
  limit: TwitterAPI.Limit | null
}

function isAlreadyDone(follower: TwitterUser, verb: VerbSomething): boolean {
  if (!('blocking' in follower && 'muting' in follower)) {
    return false
  }
  const { blocking, muting } = follower
  if (blocking && verb === 'Block') {
    return true
  } else if (!blocking && verb === 'UnBlock') {
    return true
  } else if (muting && verb === 'Mute') {
    return true
  } else if (!muting && verb === 'UnMute') {
    return true
  }
  return false
}

// 더 나은 타입이름 없을까...
type ApiKind = FollowKind | 'tweet-reactions' | 'lookup-users'

function extractRateLimit(limitStatuses: TwitterAPI.LimitStatus, apiKind: ApiKind): TwitterAPI.Limit {
  switch (apiKind) {
    case 'followers':
      return limitStatuses.followers['/followers/list']
    case 'friends':
      return limitStatuses.friends['/friends/list']
    case 'mutual-followers':
      return limitStatuses.followers['/followers/list']
    case 'tweet-reactions':
      return limitStatuses.statuses['/statuses/retweeted_by']
    case 'lookup-users':
      return limitStatuses.users['/users/lookup']
  }
}

export default class ChainBlockSession {
  private shouldStop = false
  private preparePromise = Promise.resolve()
  private isPrepared = false
  private readonly sessionInfo = this.initSessionInfo()
  private readonly scraper = Scraper.initScraper(this.request)
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: SessionRequest, private limiter: BlockLimiter) {}
  public getSessionInfo() {
    return copyFrozenObject(this.sessionInfo)
  }
  public isSameTarget(givenTarget: SessionRequest['target']) {
    const thisTarget = this.request.target
    if (thisTarget.type !== givenTarget.type) {
      return false
    }
    switch (thisTarget.type) {
      case 'follower':
        const givenUser = (givenTarget as FollowerBlockSessionRequest['target']).user
        return thisTarget.user.id_str === givenUser.id_str
      case 'tweet_reaction':
        const givenTweet = (givenTarget as TweetReactionBlockSessionRequest['target']).tweet
        return thisTarget.tweet.id_str === givenTweet.id_str
      case 'import':
        return false
    }
  }
  public setConfirmed() {
    this.sessionInfo.confirmed = true
  }
  public async prepare() {
    if (this.isPrepared) {
      return
    }
    this.preparePromise = this.scraper.prepare()
    this.isPrepared = true
  }
  public cancelPrepare() {
    this.scraper.stopPrepare()
  }
  public async start() {
    if (!this.sessionInfo.confirmed) {
      throw new Error('session not confirmed')
    }
    const blocker = new Blocker()
    let apiKind: ApiKind
    switch (this.request.target.type) {
      case 'follower':
        apiKind = this.request.target.list
        break
      case 'tweet_reaction':
        apiKind = 'tweet-reactions'
        break
      case 'import':
        apiKind = 'lookup-users'
        break
    }
    const incrementSuccess = (v: VerbSomething) => this.sessionInfo.progress.success[v]++
    const incrementFailure = () => this.sessionInfo.progress.failure++
    blocker.onSuccess = (user, whatIDid) => {
      incrementSuccess(whatIDid)
      this.eventEmitter.emit('mark-user', {
        userId: user.id_str,
        verb: whatIDid,
      })
    }
    blocker.onError = () => {
      incrementFailure()
    }
    let stopped = false
    try {
      if (!this.isPrepared) {
        this.prepare()
      }
      this.scraper.stopPrepare()
      await this.preparePromise
      for await (const scraperResponse of this.scraper) {
        if (this.shouldStop) {
          stopped = true
          await blocker.flush()
          break
        }
        this.sessionInfo.progress.scraped = this.calculateScrapedCount()
        const blockLimitReached = this.limiter.check() !== 'ok'
        if (blockLimitReached) {
          this.stop()
          continue
        }
        if (!scraperResponse.ok) {
          if (scraperResponse.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit(this.sessionInfo, this.eventEmitter, apiKind)
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw scraperResponse.error
          }
        }
        if (this.sessionInfo.progress.total === null) {
          this.sessionInfo.progress.total = this.scraper.totalCount
        }
        this.handleRunning()
        for (const user of scraperResponse.value.users) {
          const whatToDo = this.whatToDoGivenUser(this.request, user)
          // console.debug('whatToDo(req: %o / user: %o) = "%s"', this.request, user, whatToDo)
          if (whatToDo === 'Skip') {
            this.sessionInfo.progress.skipped++
            continue
          } else if (whatToDo === 'AlreadyDone') {
            this.sessionInfo.progress.already++
            continue
          }
          blocker.add(whatToDo, user)
          await blocker.flushIfNeeded()
        }
      }
      await blocker.flush()
      if (stopped) {
        this.sessionInfo.status = SessionStatus.Stopped
        this.eventEmitter.emit('stopped', this.getSessionInfo())
      } else {
        this.sessionInfo.status = SessionStatus.Completed
        this.eventEmitter.emit('complete', this.getSessionInfo())
      }
    } catch (error) {
      this.sessionInfo.status = SessionStatus.Error
      this.eventEmitter.emit('error', error.toString())
      throw error
    }
  }
  public async stop() {
    this.shouldStop = true
    return new Promise(resolve => {
      this.eventEmitter.on('stopped', resolve)
    })
  }
  public async rewind() {
    this.resetCounts()
    this.sessionInfo.status = SessionStatus.Initial
  }
  private initProgress(): SessionInfo['progress'] {
    return {
      already: 0,
      success: {
        Block: 0,
        UnBlock: 0,
        Mute: 0,
        UnMute: 0,
      },
      failure: 0,
      skipped: 0,
      error: 0,
      scraped: 0,
      total: getCountOfUsersToBlock(this.request),
    }
  }
  private resetCounts() {
    this.sessionInfo.progress = this.initProgress()
  }
  private initSessionInfo(): SessionInfo {
    return {
      sessionId: this.generateSessionId(),
      request: this.request,
      progress: this.initProgress(),
      status: SessionStatus.Initial,
      limit: null,
      confirmed: false,
    }
  }
  private generateSessionId(): string {
    return `session/${Date.now()}`
  }
  private async handleRateLimit(
    sessionInfo: SessionInfo,
    eventEmitter: EventEmitter<SessionEventEmitter>,
    apiKind: ApiKind
  ) {
    sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await TwitterAPI.getRateLimitStatus()
    const limit = extractRateLimit(limitStatuses, apiKind)
    sessionInfo.limit = limit
    eventEmitter.emit('rate-limit', limit)
  }
  private handleRunning() {
    const { sessionInfo, eventEmitter } = this
    if (sessionInfo.status === SessionStatus.Initial) {
      eventEmitter.emit('started', sessionInfo)
    }
    if (sessionInfo.status === SessionStatus.RateLimited) {
      eventEmitter.emit('rate-limit-reset', null)
    }
    sessionInfo.limit = null
    sessionInfo.status = SessionStatus.Running
  }
  private calculateScrapedCount() {
    const { success, already, failure, error, skipped } = this.sessionInfo.progress
    return _.sum([...Object.values(success), already, failure, error, skipped])
  }
  private whatToDoGivenUser(request: SessionRequest, follower: TwitterUser): Verb {
    const { purpose, options, target } = request
    const { following, followed_by, follow_request_sent } = follower
    if (!(typeof following === 'boolean' && typeof followed_by === 'boolean')) {
      throw new Error('following/followed_by property missing?')
    }
    const isMyFollowing = following || follow_request_sent
    const isMyFollower = followed_by
    const isMyMutualFollower = isMyFollower && isMyFollowing
    // 주의!
    // 팝업 UI에 나타난 순서를 고려할 것.
    if (isMyMutualFollower) {
      return 'Skip'
    }
    if (isMyFollower) {
      return options.myFollowers
    }
    if (isMyFollowing) {
      return options.myFollowings
    }
    if (purpose === 'unchainblock' && 'mutualBlocked' in options) {
      const blockedBy = target.type === 'follower' && follower.blocked_by
      if (blockedBy) {
        return options.mutualBlocked
      }
    }
    let defaultVerb: Verb
    switch (purpose) {
      case 'chainblock':
        defaultVerb = 'Block'
        break
      case 'unchainblock':
        defaultVerb = 'UnBlock'
        break
    }
    if (isAlreadyDone(follower, defaultVerb)) {
      return 'AlreadyDone'
    }
    return defaultVerb
  }
}

export const followerBlockDefaultOption: Readonly<FollowerBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  mutualBlocked: 'Skip',
})

export const tweetReactionBlockDefaultOption: Readonly<TweetReactionBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
})
