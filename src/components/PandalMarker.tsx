import { divIcon } from 'leaflet'
import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import type { Pandal } from '../types'

const placeholderImage = '/pandal-placeholder.svg'

interface PandalMarkerProps {
  pandal: Pandal
  distanceKm: number
  added: boolean
  onAdd: (pandal: Pandal) => void
}

function markerIcon() {
  return divIcon({
    className: 'pandal-pin-wrap',
    html: '<span class="pandal-pin"><span></span></span>',
    iconSize: [32, 38],
    iconAnchor: [16, 34],
    popupAnchor: [0, -32],
  })
}

export function PandalMarker({ pandal, distanceKm, added, onAdd }: PandalMarkerProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasVerifiedPhoto = Boolean(pandal.imageAttribution && pandal.imageLicense && pandal.imageLicenseUrl && pandal.imageSourceUrl && !imageFailed)

  return (
    <Marker position={[pandal.lat, pandal.lng]} icon={markerIcon()} riseOnHover title={pandal.name} alt={pandal.name}>
      <Popup className="pandal-popup" minWidth={250} maxWidth={290} maxHeight={Math.floor(window.innerHeight * 0.62)}>
        <article className="popup-card">
          <img
            src={hasVerifiedPhoto ? pandal.imageUrl : placeholderImage}
            alt={hasVerifiedPhoto ? `${pandal.name} Durga Puja pandal` : ''}
            className="popup-image"
            onError={() => setImageFailed(true)}
          />
          <div className="popup-image-credit">
            {hasVerifiedPhoto ? (
              <>Photo: {pandal.imageAttribution} · <a href={pandal.imageLicenseUrl} target="_blank" rel="noreferrer">{pandal.imageLicense}</a> · <a href={pandal.imageSourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons</a></>
            ) : 'Illustration · verified pandal photo unavailable'}
          </div>
          <div className="popup-body">
            <div className="popup-eyebrow">{pandal.zone} · {pandal.area}</div>
            <h2>{pandal.name}</h2>
            <p>{pandal.theme}</p>
            <div className="popup-meta">
              <span><MapPin size={13} aria-hidden="true" /> {distanceKm.toFixed(1)} km away</span>
              <span className={`crowd crowd-${pandal.crowdLevel}`}>{pandal.crowdLevel} crowd</span>
            </div>
            <button className={`popup-add ${added ? 'is-added' : ''}`} onClick={() => onAdd(pandal)} disabled={added}>
              {added ? 'Added to your route' : 'Add to my route'}
            </button>
          </div>
        </article>
      </Popup>
    </Marker>
  )
}
