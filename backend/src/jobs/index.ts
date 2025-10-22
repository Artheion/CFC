export const JOB_QUEUE_NAMES = {
  FIGHT_ENGINE: 'fight-engine',
  ECONOMY_TICK: 'economy-tick',
  REFERRAL_PAYOUT: 'referral-payout',
} as const;

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[keyof typeof JOB_QUEUE_NAMES];
