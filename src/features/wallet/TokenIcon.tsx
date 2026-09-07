import { cn } from '@/lib/utils'
import type { TokenSymbol } from '@/types'

const TOKENS: Record<TokenSymbol, { bg: string; glyph: string }> = {
  ETH: { bg: 'linear-gradient(135deg,#454A75,#8A92B2)', glyph: 'Ξ' },
  USDC: { bg: 'linear-gradient(135deg,#2775CA,#57A0EE)', glyph: '$' },
  MESH: { bg: 'linear-gradient(135deg,#6C5CE7,#9A83FB)', glyph: 'M' },
  RHB: { bg: 'linear-gradient(135deg,#059669,#34D399)', glyph: 'R' },
}

const SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-[13px]',
  lg: 'size-11 text-[15px]',
}

export function TokenIcon({
  symbol,
  size = 'md',
  className,
}: {
  symbol: TokenSymbol
  size?: keyof typeof SIZES
  className?: string
}) {
  const token = TOKENS[symbol]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        SIZES[size],
        className,
      )}
      style={{ backgroundImage: token.bg }}
    >
      {token.glyph}
    </span>
  )
}
