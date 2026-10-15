import { useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MapPin, Route, Trash2, X } from 'lucide-react'
import type { Pandal } from '../types'

interface VisitingDrawerProps {
  open: boolean
  pandals: Pandal[]
  onClose: () => void
  onRemove: (id: string) => void
  onReorder: (activeId: string, overId: string) => void
}

function SortableStop({ pandal, index, onRemove }: { pandal: Pandal; index: number; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pandal.id })
  return (
    <li ref={setNodeRef} className={`stop-item ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <span className="stop-index">{index + 1}</span>
      <div className="stop-copy"><strong>{pandal.name}</strong><span>{pandal.area}</span></div>
      <button className="icon-button drag-handle" type="button" aria-label={`Reorder ${pandal.name}`} {...attributes} {...listeners}><GripVertical size={17} /></button>
      <button className="icon-button remove-stop" type="button" aria-label={`Remove ${pandal.name} from route`} onClick={() => onRemove(pandal.id)}><Trash2 size={15} /></button>
    </li>
  )
}

export function VisitingDrawer({ open, pandals, onClose, onRemove, onReorder }: VisitingDrawerProps) {
  const [dragAnnouncement, setDragAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id))
    setDragAnnouncement('Visiting list order updated.')
  }

  return (
    <>
      {open && <button className="drawer-scrim" aria-label="Close visiting list" onClick={onClose} />}
      <aside className={`visiting-drawer ${open ? 'drawer-open' : ''}`} aria-label="My visiting list" aria-hidden={!open}>
        <header className="drawer-header">
          <div><p className="eyebrow">Your Pujo trail</p><h2>Visiting list <span>{pandals.length}</span></h2></div>
          <button className="icon-button close-drawer" onClick={onClose} aria-label="Close visiting list"><X size={19} /></button>
        </header>
        {pandals.length === 0 ? (
          <div className="drawer-empty"><div className="empty-icon"><Route size={22} /></div><h3>Your route begins here</h3><p>Tap any pandal on the map and add it to your visiting list.</p></div>
        ) : (
          <>
            <p className="drawer-hint"><GripVertical size={14} /> Drag to put your must-sees first</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={pandals.map((pandal) => pandal.id)} strategy={verticalListSortingStrategy}>
                <ol className="stops-list">{pandals.map((pandal, index) => <SortableStop key={pandal.id} pandal={pandal} index={index} onRemove={onRemove} />)}</ol>
              </SortableContext>
            </DndContext>
            <p className="drawer-footnote"><MapPin size={13} /> Route will be optimized from your current location</p>
          </>
        )}
        <span className="sr-only" aria-live="polite">{dragAnnouncement}</span>
      </aside>
    </>
  )
}
