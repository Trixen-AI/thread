import { BaseError, ContractFunctionRevertedError } from 'viem'
import { PonsWalletError } from './client'

/**
 * Turning a revert into a sentence.
 *
 * The contracts use custom errors throughout, and every one that a user can
 * trigger has a plain explanation. Anything not listed here falls through to
 * viem's own short message, which at least names the function that failed.
 */
const EXPLAINED: Record<string, string> = {
  SlippageExceeded: 'The price moved past your slippage limit before the trade settled. Try again, or allow more slippage.',
  CurveGraduated: 'This launch has finished on the curve. It now trades on Uniswap v4.',
  LaunchEconomicsMismatch: 'The launch terms changed between reading them and sending. Reload and try again.',
  PairTokenNotApproved: 'That quote asset is not approved for launches.',
  PairTokenDecimalsMismatch: 'The quote asset reports different decimals than the factory recorded.',
  NativeValueMismatch: 'The ETH sent did not match the amount of the buy.',
  UnexpectedNativeValue: 'ETH was sent to a launch that is priced in another asset.',
  LaunchFeeNotPaid: 'The launch fee sent did not match what the factory charges. Reload to read the current fee.',
  CreatorTaxTooHigh: 'The creator tax is above the protocol cap.',
  NotWhitelisted: 'Launching is restricted to whitelisted addresses right now, and this address is not on the list.',
  LaunchConfigDisabled: 'That launch configuration has been disabled. Reload to see the ones currently open.',
  ExemptionListTooLong: 'Too many snipe-tax exemptions. The contract allows at most 32.',
  WrongGraduationPhase: 'This launch is not waiting to be graduated.',
  NotCreatorFeeRecipient: 'Only the current creator fee recipient can do that.',
  TimelockNotElapsed: 'The timelock has not elapsed yet.',
  TimelockExpired: 'The timelock window has expired.',
}

const isUserRejection = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  ((error as { code?: number }).code === 4001 ||
    /user rejected|user denied|rejected the request/i.test(String((error as Error).message)))

/** A message for the user, and whether it was their own cancellation. */
export function describePonsError(error: unknown): { message: string; cancelled: boolean } {
  if (isUserRejection(error)) return { message: 'Cancelled in your wallet', cancelled: true }

  if (error instanceof PonsWalletError) return { message: error.message, cancelled: false }

  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName ?? reverted.reason
      if (name && EXPLAINED[name]) return { message: EXPLAINED[name], cancelled: false }
      if (name) return { message: `The contract refused: ${name}`, cancelled: false }
    }
    if (/insufficient funds/i.test(error.shortMessage)) {
      return { message: 'Not enough ETH in the wallet to cover this plus gas.', cancelled: false }
    }
    return { message: error.shortMessage, cancelled: false }
  }

  if (error instanceof Error) return { message: error.message, cancelled: false }
  return { message: 'Something went wrong', cancelled: false }
}
