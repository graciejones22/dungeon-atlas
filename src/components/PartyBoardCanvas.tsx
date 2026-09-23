import { type MouseEvent, useMemo, useState } from 'react'
import { Redo2, Trash2, Undo2, Users } from 'lucide-react'
import { type CanvasShapeClient, useCanvas } from 'deepspace'
import { Button } from '@/components/ui'

const BOARD_WIDTH = 1200
const BOARD_HEIGHT = 720

function markerColor(shape: CanvasShapeClient): string {
  return typeof shape.props.color === 'string' ? shape.props.color : '#818cf8'
}

export function PartyBoardCanvas({ partyId }: { partyId: string }) {
  const { shapes, viewports, connected, canWrite, addShape, deleteShape, undo, redo } = useCanvas(partyId)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const markers = useMemo(() => shapes.filter((shape) => shape.type === 'marker'), [shapes])

  function addMarker(event: MouseEvent<SVGSVGElement>) {
    if (!canWrite) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * BOARD_WIDTH
    const y = ((event.clientY - rect.top) / rect.height) * BOARD_HEIGHT
    addShape({
      type: 'marker',
      x: x - 16,
      y: y - 16,
      width: 32,
      height: 32,
      props: { color: '#818cf8' },
    })
  }

  function selectMarker(event: MouseEvent<SVGGElement>, shapeId: string) {
    event.stopPropagation()
    setSelectedShapeId(shapeId)
  }

  function removeSelectedMarker() {
    if (!canWrite || !selectedShapeId) return
    deleteShape(selectedShapeId)
    setSelectedShapeId(null)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`size-2 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} aria-hidden />
          {connected ? 'Live board connected' : 'Connecting to board…'}
          <span className="text-border" aria-hidden>·</span>
          <Users className="size-4" aria-hidden />
          {viewports.length + 1} at the table
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={undo} disabled={!canWrite}> <Undo2 aria-hidden /> Undo </Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={!canWrite}> <Redo2 aria-hidden /> Redo </Button>
          <Button size="sm" variant="destructive" onClick={removeSelectedMarker} disabled={!canWrite || !selectedShapeId}>
            <Trash2 aria-hidden /> Remove marker
          </Button>
        </div>
      </header>

      <div className="relative aspect-[5/3] min-h-[360px] bg-[#12151c]">
        <svg
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          className={`absolute inset-0 size-full ${canWrite ? 'cursor-crosshair' : 'cursor-default'}`}
          role="application"
          aria-label={canWrite ? 'Collaborative party board. Click to place a marker.' : 'Collaborative party board. DM controls are read-only for players.'}
          onClick={addMarker}
        >
          <defs>
            <pattern id="party-board-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#party-board-grid)" />
          {markers.map((shape) => {
            const selected = shape.id === selectedShapeId
            return (
              <g key={shape.id} onClick={(event) => selectMarker(event, shape.id)} className="cursor-pointer">
                <circle
                  cx={shape.x + shape.width / 2}
                  cy={shape.y + shape.height / 2}
                  r={shape.width / 2}
                  fill={markerColor(shape)}
                  stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.35)'}
                  strokeWidth={selected ? 3 : 1}
                />
                <circle
                  cx={shape.x + shape.width / 2}
                  cy={shape.y + shape.height / 2}
                  r={shape.width / 5}
                  fill="rgba(255,255,255,0.7)"
                />
              </g>
            )
          })}
        </svg>
        {!canWrite && connected && (
          <p className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            Player view — your DM controls the board.
          </p>
        )}
        {canWrite && markers.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            Click the board to place your first marker.
          </p>
        )}
      </div>
    </section>
  )
}
