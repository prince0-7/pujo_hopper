import { Compass, LocateFixed, MapPin, ShieldCheck } from 'lucide-react'

interface PermissionModalProps {
  onUseLocation: () => void
  onUseApproximate: () => void
}

export function PermissionModal({ onUseLocation, onUseApproximate }: PermissionModalProps) {
  return (
    <div className="modal-scrim" role="presentation">
      <section className="permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-title" aria-describedby="permission-copy">
        <div className="permission-mark"><Compass size={25} strokeWidth={1.7} aria-hidden="true" /></div>
        <p className="eyebrow">A little closer to the celebrations</p>
        <h2 id="permission-title">Start from where<br />you are.</h2>
        <p id="permission-copy" className="permission-copy">We use your location to find nearby pandals and plan the shortest hopping route. Your location stays on this device.</p>
        <div className="privacy-note"><ShieldCheck size={16} aria-hidden="true" /> Only used while planning your visit</div>
        <button className="location-primary" type="button" onClick={onUseLocation}><LocateFixed size={17} aria-hidden="true" /> Use my location</button>
        <button className="location-secondary" type="button" onClick={onUseApproximate}><MapPin size={15} aria-hidden="true" /> Explore around Kolkata instead</button>
      </section>
    </div>
  )
}
