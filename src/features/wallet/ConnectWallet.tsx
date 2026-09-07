import { Wallet as WalletIcon } from 'lucide-react'
import { connectReown } from '@/store/actions'
import { Button } from '@/components/ui/Button'

/**
 * Connecting a wallet.
 *
 * There is no picker here any more. Reown AppKit owns that screen: it detects
 * the extensions already installed, searches several hundred more, deep-links
 * into a phone wallet and falls back to a QR code. MESH used to run a second
 * picker in front of it, over EIP-6963, which knew about fewer wallets and made
 * people choose twice for one decision.
 *
 * `openWalletPicker` keeps its name because half the app calls it — the button
 * that used to open our sheet now opens Reown's.
 */
export const openWalletPicker = () => {
  void connectReown()
}

export function ConnectWalletButton({ block }: { block?: boolean }) {
  return (
    <Button block={block} icon={<WalletIcon className="size-[18px]" />} onClick={openWalletPicker}>
      Connect wallet
    </Button>
  )
}
