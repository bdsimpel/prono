import Image from 'next/image'
import { getTeamLogo } from '@/lib/teamLogos'

export default function TeamLogo({ name, size = 18 }: { name: string; size?: number }) {
  const logo = getTeamLogo(name)
  if (!logo) return null
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <Image src={logo} alt={name} width={size} height={size} className="object-contain w-full h-full" />
    </span>
  )
}
