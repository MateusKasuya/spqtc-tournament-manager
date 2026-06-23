// Distributes a bounty from victim to one or more eliminators.
// Returns the bounty transaction values to insert, or [] if not bounty mode.
export function computeBountyDistribution(
  victimParticipantId: number,
  victimBounty: number,
  eliminatorPlayerIds: number[],
  tournamentId: number
): Array<{ tournamentId: number; playerId: number; type: "bounty_earned"; amount: number; bountyChange: number; relatedParticipantId: number }> {
  const ids = Array.from(new Set(eliminatorPlayerIds));
  if (ids.length === 0 || victimBounty <= 0) return [];

  const n = ids.length;
  const halfPayment = Math.floor(victimBounty / 2);
  const halfAccrual = victimBounty - halfPayment;

  return ids.map((playerId, i) => {
    const basePayment = Math.floor(halfPayment / n);
    const baseAccrual = Math.floor(halfAccrual / n);
    const extraPayment = i < (halfPayment % n) ? 1 : 0;
    const extraAccrual = i < (halfAccrual % n) ? 1 : 0;
    return {
      tournamentId,
      playerId,
      type: "bounty_earned" as const,
      amount: basePayment + extraPayment,
      bountyChange: baseAccrual + extraAccrual,
      relatedParticipantId: victimParticipantId,
    };
  });
}
