import { canTransition, assertValidTransition, InvalidNoticeTransitionError, isServedOrLater } from '../noticeStateMachine';

describe('notice state machine', () => {
  it('allows the normal DRAFT -> READY_FOR_REVIEW -> READY_TO_SERVE -> SERVED path', () => {
    expect(canTransition('DRAFT', 'READY_FOR_REVIEW')).toBe(true);
    expect(canTransition('READY_FOR_REVIEW', 'READY_TO_SERVE')).toBe(true);
    expect(canTransition('READY_TO_SERVE', 'SERVED')).toBe(true);
  });

  it('rejects skipping straight from DRAFT to SERVED', () => {
    expect(canTransition('DRAFT', 'SERVED')).toBe(false);
  });

  it('throws a descriptive error on an invalid transition', () => {
    expect(() => assertValidTransition('DRAFT', 'CLOSED')).toThrow(InvalidNoticeTransitionError);
  });

  it('rejects moving out of a terminal state', () => {
    expect(canTransition('CLOSED', 'DRAFT')).toBe(false);
    expect(canTransition('CANCELLED', 'DRAFT')).toBe(false);
  });

  it('a served notice is never moved back to DRAFT (immutability boundary)', () => {
    expect(canTransition('SERVED', 'DRAFT')).toBe(false);
  });

  it('isServedOrLater correctly separates pre- and post-service states', () => {
    expect(isServedOrLater('DRAFT')).toBe(false);
    expect(isServedOrLater('READY_TO_SERVE')).toBe(false);
    expect(isServedOrLater('SERVED')).toBe(true);
    expect(isServedOrLater('WAITING_PERIOD')).toBe(true);
    expect(isServedOrLater('CLOSED')).toBe(true);
  });
});
