import { parseAbi } from 'viem'

/**
 * pons v2 ABIs.
 *
 * Every signature here was checked against the deployed bytecode on Robinhood
 * Chain before it was written down: the 4-byte selector for each one is present
 * in the contract's own code, and each read was called against a live launch.
 * A signature the chain does not implement is worse than no integration at all,
 * because it fails at the moment a user is spending money.
 *
 * Human-readable form rather than JSON, so the shape a call takes stays legible
 * next to the call itself.
 */

/** Shared between the factory, the router and the launch token. */
const SOCIALS =
  'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }'

/**
 * What a creator supplies at launch. The field order is the contract's, and it
 * is load-bearing: a struct is encoded positionally, not by name.
 *
 * One literal on one line, deliberately: viem infers the call and return types
 * from the string itself, and a concatenation is typed as `string`, which
 * silently degrades every struct in the ABI to `unknown`.
 */
const TOKEN_PARAMS =
  'struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }'

/* --------------------------------- Errors --------------------------------- */

/**
 * The custom errors an integration is most likely to surface. Carrying them
 * lets viem decode a revert into a name instead of a hex blob, which is the
 * difference between "your creator tax is above the protocol cap" and
 * "execution reverted".
 */
export const ponsErrorsAbi = parseAbi([
  'error SlippageExceeded()',
  'error CurveGraduated()',
  'error LaunchEconomicsMismatch()',
  'error PairTokenNotApproved()',
  'error PairTokenDecimalsMismatch()',
  'error NativeValueMismatch()',
  'error UnexpectedNativeValue()',
  'error LaunchFeeNotPaid()',
  'error CreatorTaxTooHigh()',
  'error NotWhitelisted()',
  'error LaunchConfigDisabled()',
  'error ExemptionListTooLong()',
  'error WrongGraduationPhase()',
  'error NotCreatorFeeRecipient()',
  'error TimelockNotElapsed()',
  'error TimelockExpired()',
])

/* -------------------------------- Factory -------------------------------- */

export const factoryAbi = parseAbi([
  SOCIALS,
  TOKEN_PARAMS,
  'struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }',
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'struct FeePolicy { address protocolFeeRecipient; uint16 protocolFeeShareBps; uint16 buybackBurnBps; uint16 hookFeeBps; uint16 maxInternalPriceImpactBps; }',

  // Launch configuration
  'function launchConfigCount() view returns (uint256)',
  'function getLaunchConfig(uint256 id) view returns (LaunchConfig)',
  'function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)',
  'function launchFee() view returns (uint256)',
  'function maxCreatorTaxBps() view returns (uint16)',

  // The launch gate
  'function canLaunch(address account) view returns (bool)',
  'function launchEnabled() view returns (bool)',
  'function whitelistedLaunchers(address account) view returns (bool)',

  // Quote assets
  'function approvedPairTokens(address pairToken) view returns (bool)',
  'function pairTokenEconomics(address pairToken) view returns (uint256 phantomQuote, uint256 graduationThreshold, uint8 decimals)',

  // Launching. The four-argument overload carries the snipe-tax exemptions.
  'function launchToken(TokenParams params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)',
  'function launchToken(TokenParams params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)',

  // Launch state
  'function getLaunchedToken(address token) view returns (LaunchedToken)',
  'function getLaunchFeePolicy(address token) view returns (FeePolicy)',
  'function pendingCreatorFeeRecipient(address token) view returns (address recipient, uint256 effectiveAt, uint256 expiresAt)',

  // Creator controls and graduation
  'function transferCreatorFeeRecipient(address token, address newRecipient)',
  'function createGraduatedPool(address token)',

  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
])

/* ------------------------- Launch and buy router ------------------------- */

export const launchAndBuyAbi = parseAbi([
  SOCIALS,
  TOKEN_PARAMS,
  'function launchAndBuy(TokenParams params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)',
])

/* --------------------------------- Curve --------------------------------- */

export const curveAbi = parseAbi([
  // Trading
  'function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)',

  // Pricing inputs. getReserves() is the pricing pair and includes the phantom
  // quote; realQuoteReserve() is what the curve physically holds, and is the
  // wrong input for a quote.
  'function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)',
  'function realQuoteReserve() view returns (uint256)',
  'function quoteReserve() view returns (uint256)',
  'function tokenReserve() view returns (uint256)',
  'function sellableTokens() view returns (uint256)',
  'function reservedTokens() view returns (uint256)',
  'function graduationThreshold() view returns (uint256)',
  'function readyToGraduate() view returns (bool)',
  'function graduated() view returns (bool)',

  // Rates
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function currentSnipeTaxBps(address recipient) view returns (uint256)',
  'function buybackEnabled() view returns (bool)',

  // Quote asset
  'function isNativeQuote() view returns (bool)',
  'function pairToken() view returns (address)',

  'event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)',
  'event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)',
  'event CurveBuyRefunded(address indexed buyer, uint256 refund)',
])

/* ------------------------------ Launch token ------------------------------ */

export const launchTokenAbi = parseAbi([
  SOCIALS,
  'function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, Socials tokenSocials)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

/* ------------------------------- Fee escrow ------------------------------- */

export const feeEscrowAbi = parseAbi([
  'function balanceOf(address recipient) view returns (uint256)',
  'function balanceOfToken(address recipient, address token) view returns (uint256)',
  'function claim()',
  'function claimToken(address token)',
])
