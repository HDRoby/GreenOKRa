import Image from 'next/image'

/**
 * The app's name, set rather than drawn.
 *
 * The logo artwork's wordmark reads "GreenOKR" — it predates the trailing "a"
 * and cannot gain one without redrawing the type — so the mark is used on its
 * own and the name is typed beside it, in the two greens sampled from that
 * artwork. Being text, it also scales, translates and reads to a screen reader.
 */
export function Wordmark({ size = 'small' }: { size?: 'small' | 'large' }) {
  const large = size === 'large'
  // The mark is 160×135, so height drives width to keep it undistorted. Sized
  // below the cap height of the name beside it, so the words lead and the pod
  // accompanies them rather than competing.
  const height = large ? 60 : 18
  const width = Math.round((height * 160) / 135)

  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/logo-mark.png"
        alt=""
        width={width}
        height={height}
        priority
        // h-auto keeps the ratio when flex sizes the width, which Next warns about
        className="h-auto shrink-0"
      />
      <span
        className={`font-semibold tracking-tight ${large ? 'text-5xl' : 'text-base'}`}
      >
        <span className="text-brand-light">Green</span>
        <span className="text-brand-dark">OKR</span>
        <span className="text-brand-light">a</span>
      </span>
    </span>
  )
}
