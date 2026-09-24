import { type MouseEvent, type PointerEvent, useEffect, useMemo, useState } from 'react'
import { CircleUserRound, Hand, MapPinned, Redo2, RotateCw, Trash2, Triangle, Undo2, Users, Waves } from 'lucide-react'
import { type CanvasShapeClient, useCanvas } from 'deepspace'
import { Button, Input } from '@/components/ui'

const BOARD_WIDTH = 1200
const BOARD_HEIGHT = 720
const GRID_SIZE = 48

type BoardTool = 'select' | 'token' | 'enemy' | 'wall' | 'difficult-terrain'
type ShapePosition = Pick<CanvasShapeClient, 'x' | 'y'>
type ShapeSize = Pick<CanvasShapeClient, 'width' | 'height'>
type TokenAppearance = { color?: string; label?: string }

const boardTools: Array<{ id: BoardTool; label: string; icon: typeof Hand }> = [
  { id: 'select', label: 'Select', icon: Hand },
  { id: 'token', label: 'Token', icon: CircleUserRound },
  { id: 'enemy', label: 'Add enemy', icon: Triangle },
  { id: 'wall', label: 'Wall', icon: MapPinned },
  { id: 'difficult-terrain', label: 'Difficult terrain', icon: Waves },
]

function shapeColor(shape: CanvasShapeClient, fallback: string): string {
  return typeof shape.props.color === 'string' ? shape.props.color : fallback
}

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
}

function positionForEvent(event: MouseEvent<SVGElement> | PointerEvent<SVGElement>) {
  const svg = event.currentTarget instanceof SVGSVGElement
    ? event.currentTarget
    : event.currentTarget.ownerSVGElement
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * BOARD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * BOARD_HEIGHT,
  }
}

interface PartyBoardCanvasProps {
  partyId: string
  onAttendanceChange?: (attendance: { connected: boolean; userIds: string[] }) => void
}

export function PartyBoardCanvas({ partyId, onAttendanceChange }: PartyBoardCanvasProps) {
  const { shapes, viewports, connected, canWrite, addShape, moveShape, resizeShape, updateShape, deleteShape, setViewport, undo, redo } = useCanvas(partyId)
  const [activeTool, setActiveTool] = useState<BoardTool>('select')
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [localPositions, setLocalPositions] = useState<Record<string, ShapePosition>>({})
  const [localSizes, setLocalSizes] = useState<Record<string, ShapeSize>>({})
  const [localTokenAppearances, setLocalTokenAppearances] = useState<Record<string, TokenAppearance>>({})
  const [dragging, setDragging] = useState<{ shapeId: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ shapeId: string } | null>(null)

  const boardShapes = useMemo(
    () => [...shapes]
      .filter((shape) => ['marker', 'token', 'enemy', 'wall', 'difficult-terrain'].includes(shape.type))
      .sort((a, b) => {
        const aIsTerrain = a.type === 'wall' || a.type === 'difficult-terrain'
        const bIsTerrain = b.type === 'wall' || b.type === 'difficult-terrain'
        return Number(aIsTerrain) - Number(bIsTerrain)
      }),
    [shapes],
  )
  const selectedToken = boardShapes.find(
    (shape) => shape.id === selectedShapeId && ['token', 'marker', 'enemy'].includes(shape.type),
  )
  const selectedTerrain = boardShapes.find(
    (shape) => shape.id === selectedShapeId && (shape.type === 'wall' || shape.type === 'difficult-terrain'),
  )

  useEffect(() => {
    if (connected) {
      setViewport({ x: 0, y: 0, zoom: 1, width: BOARD_WIDTH, height: BOARD_HEIGHT })
    }
  }, [connected, setViewport])

  useEffect(() => {
    onAttendanceChange?.({ connected, userIds: [...new Set(viewports.map((viewport) => viewport.userId))] })
  }, [connected, onAttendanceChange, viewports])

  function createShape(event: MouseEvent<SVGSVGElement>) {
    if (!canWrite || activeTool === 'select' || dragging || resizing) return
    const point = positionForEvent(event)

    if (activeTool === 'token' || activeTool === 'enemy') {
      addShape({
        type: activeTool,
        x: clamp(snap(point.x) - GRID_SIZE / 2, BOARD_WIDTH - GRID_SIZE),
        y: clamp(snap(point.y) - GRID_SIZE / 2, BOARD_HEIGHT - GRID_SIZE),
        width: GRID_SIZE,
        height: GRID_SIZE,
        props: activeTool === 'enemy' ? { color: '#dc2626', label: 'E' } : { color: '#f59e0b', label: 'T' },
      })
      return
    }

    addShape({
      type: activeTool,
      x: clamp(snap(point.x), BOARD_WIDTH - GRID_SIZE * 2),
      y: clamp(snap(point.y), BOARD_HEIGHT - GRID_SIZE),
      width: GRID_SIZE * 2,
      height: GRID_SIZE,
      props: { color: activeTool === 'wall' ? '#64748b' : '#8b5cf6' },
    })
  }

  function selectShape(event: PointerEvent<SVGGElement>, shape: CanvasShapeClient) {
    event.stopPropagation()
    setSelectedShapeId(shape.id)
    if (!canWrite) return

    const position = localPositions[shape.id] ?? shape
    const point = positionForEvent(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(null)
    setDragging({ shapeId: shape.id, offsetX: point.x - position.x, offsetY: point.y - position.y })
  }

  function startResize(event: PointerEvent<SVGRectElement>, shape: CanvasShapeClient) {
    event.stopPropagation()
    if (!canWrite) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedShapeId(shape.id)
    setDragging(null)
    setResizing({ shapeId: shape.id })
  }

  function moveSelectedShape(event: PointerEvent<SVGSVGElement>) {
    if ((!dragging && !resizing) || !canWrite) return
    const activeShapeId = dragging?.shapeId ?? resizing?.shapeId
    const shape = shapes.find(({ id }) => id === activeShapeId)
    if (!shape) return
    const point = positionForEvent(event)

    if (resizing) {
      const position = localPositions[shape.id] ?? shape
      const width = Math.max(GRID_SIZE / 2, Math.min(point.x - position.x, BOARD_WIDTH - position.x))
      const height = Math.max(GRID_SIZE / 2, Math.min(point.y - position.y, BOARD_HEIGHT - position.y))
      setLocalSizes((sizes) => ({ ...sizes, [shape.id]: { width, height } }))
      return
    }

    const size = localSizes[shape.id] ?? shape
    const x = clamp(point.x - dragging!.offsetX, BOARD_WIDTH - size.width)
    const y = clamp(point.y - dragging!.offsetY, BOARD_HEIGHT - size.height)
    setLocalPositions((positions) => ({ ...positions, [shape.id]: { x, y } }))
  }

  function finishInteraction() {
    if (!canWrite) return
    if (resizing) {
      const size = localSizes[resizing.shapeId]
      if (size) resizeShape(resizing.shapeId, size.width, size.height)
      setResizing(null)
    }
    if (dragging) {
      const position = localPositions[dragging.shapeId]
      if (position) moveShape(dragging.shapeId, position.x, position.y)
    }
    setDragging(null)
  }

  function changeTokenAppearance(shape: CanvasShapeClient, appearance: TokenAppearance) {
    if (!canWrite) return
    setLocalTokenAppearances((appearances) => ({
      ...appearances,
      [shape.id]: { ...appearances[shape.id], ...appearance },
    }))
    updateShape(shape.id, appearance)
  }

  function rotateSelectedTerrain() {
    if (!canWrite || !selectedTerrain) return
    const size = localSizes[selectedTerrain.id] ?? selectedTerrain
    const position = localPositions[selectedTerrain.id] ?? selectedTerrain
    const width = Math.min(size.height, BOARD_WIDTH)
    const height = Math.min(size.width, BOARD_HEIGHT)
    const x = clamp(position.x + (size.width - width) / 2, BOARD_WIDTH - width)
    const y = clamp(position.y + (size.height - height) / 2, BOARD_HEIGHT - height)

    setLocalSizes((sizes) => ({ ...sizes, [selectedTerrain.id]: { width, height } }))
    setLocalPositions((positions) => ({ ...positions, [selectedTerrain.id]: { x, y } }))
    resizeShape(selectedTerrain.id, width, height, x, y)
  }

  function removeSelectedShape() {
    if (!canWrite || !selectedShapeId) return
    deleteShape(selectedShapeId)
    setLocalPositions((positions) => {
      const { [selectedShapeId]: _, ...remaining } = positions
      return remaining
    })
    setLocalSizes((sizes) => {
      const { [selectedShapeId]: _, ...remaining } = sizes
      return remaining
    })
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
          <Button size="sm" variant="outline" onClick={undo} disabled={!canWrite}><Undo2 aria-hidden /> Undo</Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={!canWrite}><Redo2 aria-hidden /> Redo</Button>
          {selectedTerrain && (
            <Button size="sm" variant="outline" onClick={rotateSelectedTerrain} disabled={!canWrite}>
              <RotateCw aria-hidden /> Rotate
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={removeSelectedShape} disabled={!canWrite || !selectedShapeId}>
            <Trash2 aria-hidden /> Remove selected
          </Button>
        </div>
      </header>

      {canWrite && (
        <div className="flex flex-wrap gap-2 border-b border-border bg-muted/30 px-4 py-3" aria-label="Board tools">
          {boardTools.map(({ id, label, icon: Icon }) => (
            <Button key={id} size="sm" variant={activeTool === id ? 'default' : 'outline'} onClick={() => setActiveTool(id)} aria-pressed={activeTool === id}>
              <Icon aria-hidden /> {label}
            </Button>
          ))}
          <p className="self-center text-xs text-muted-foreground">Choose a tool, then click to place. Drag objects to move them.</p>
        </div>
      )}

      {canWrite && selectedToken && (
        <div className="grid gap-3 border-b border-border bg-card px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium text-foreground">
            Token letter
            <Input
              value={localTokenAppearances[selectedToken.id]?.label ?? (typeof selectedToken.props.label === 'string' ? selectedToken.props.label : 'T')}
              maxLength={2}
              className="max-w-32 uppercase"
              onChange={(event) => changeTokenAppearance(selectedToken, { label: event.target.value.toUpperCase() })}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-foreground">
            Token color
            <input
              type="color"
              aria-label="Token color"
              value={localTokenAppearances[selectedToken.id]?.color ?? shapeColor(selectedToken, '#818cf8')}
              className="h-10 w-16 cursor-pointer rounded-md border border-input bg-transparent p-1"
              onChange={(event) => changeTokenAppearance(selectedToken, { color: event.target.value })}
            />
          </label>
        </div>
      )}

      <div className="relative aspect-[5/3] min-h-[360px] bg-[#12151c]">
        <svg
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          className={`absolute inset-0 size-full ${canWrite && activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
          role="application"
          aria-label={canWrite ? 'Collaborative party board with tokens and terrain.' : 'Collaborative party board. DM controls are read-only for players.'}
          onClick={createShape}
          onPointerMove={moveSelectedShape}
          onPointerUp={finishInteraction}
          onPointerCancel={finishInteraction}
        >
          <defs>
            <pattern id="party-board-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            </pattern>
            <pattern id="difficult-terrain" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="12" height="12" fill="rgba(139,92,246,0.35)" />
              <rect width="4" height="12" fill="rgba(221,214,254,0.18)" />
            </pattern>
          </defs>
          <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#party-board-grid)" />
          {boardShapes.map((shape) => {
            const position = localPositions[shape.id] ?? shape
            const size = localSizes[shape.id] ?? shape
            const tokenAppearance = localTokenAppearances[shape.id]
            const selected = shape.id === selectedShapeId
            const isWall = shape.type === 'wall'
            const isDifficultTerrain = shape.type === 'difficult-terrain'
            const isToken = shape.type === 'token' || shape.type === 'marker'
            const isEnemy = shape.type === 'enemy'

            return (
              <g
                key={shape.id}
                onPointerDown={(event) => selectShape(event, shape)}
                onClick={(event) => event.stopPropagation()}
                className={canWrite ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
              >
                {isWall && (
                  <rect x={position.x} y={position.y} width={size.width} height={size.height} rx="4" fill={shapeColor(shape, '#64748b')} stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.2)'} strokeWidth={selected ? 3 : 1} />
                )}
                {isDifficultTerrain && (
                  <rect x={position.x} y={position.y} width={size.width} height={size.height} rx="4" fill="url(#difficult-terrain)" stroke={selected ? '#ffffff' : shapeColor(shape, '#8b5cf6')} strokeWidth={selected ? 3 : 2} />
                )}
                {isToken && (
                  <>
                    <circle cx={position.x + size.width / 2} cy={position.y + size.height / 2} r={size.width / 2 - 3} fill={tokenAppearance?.color ?? shapeColor(shape, '#818cf8')} stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.45)'} strokeWidth={selected ? 3 : 1} />
                    <text x={position.x + size.width / 2} y={position.y + size.height / 2 + 6} textAnchor="middle" className="select-none fill-white text-base font-bold">
                      {(tokenAppearance?.label ?? (typeof shape.props.label === 'string' ? shape.props.label : 'T')).slice(0, 2).toUpperCase()}
                    </text>
                  </>
                )}
                {isEnemy && (
                  <>
                    <path
                      d={`M ${position.x + size.width / 2} ${position.y + 3} L ${position.x + size.width - 3} ${position.y + size.height - 3} L ${position.x + 3} ${position.y + size.height - 3} Z`}
                      fill={tokenAppearance?.color ?? shapeColor(shape, '#dc2626')}
                      stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.45)'}
                      strokeWidth={selected ? 3 : 1}
                    />
                    <text x={position.x + size.width / 2} y={position.y + size.height - 11} textAnchor="middle" className="select-none fill-white text-sm font-bold">
                      {(tokenAppearance?.label ?? (typeof shape.props.label === 'string' ? shape.props.label : 'E')).slice(0, 2).toUpperCase()}
                    </text>
                  </>
                )}
                {selected && (isWall || isDifficultTerrain) && (
                  <rect
                    x={position.x + size.width - 10}
                    y={position.y + size.height - 10}
                    width="20"
                    height="20"
                    rx="3"
                    fill="#ffffff"
                    stroke="#1f2937"
                    strokeWidth="2"
                    className="cursor-nwse-resize"
                    onPointerDown={(event) => startResize(event, shape)}
                  />
                )}
              </g>
            )
          })}
        </svg>
        {!canWrite && connected && (
          <p className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            Player view — your DM controls the board.
          </p>
        )}
        {canWrite && boardShapes.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            Select Token, Wall, or Difficult terrain to begin building the encounter.
          </p>
        )}
      </div>
    </section>
  )
}
