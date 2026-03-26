import { useCallback, useRef, useState } from "react"
import { Upload, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageDropZoneProps {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function ImageDropZone({ onFileSelected, isUploading }: ImageDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return
      onFileSelected(file)
    },
    [onFileSelected],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ""
    },
    [handleFile],
  )

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      disabled={isUploading}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors",
        "text-muted-foreground hover:border-primary/50 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragOver && "border-primary bg-primary/5 text-foreground",
        isUploading && "pointer-events-none opacity-60",
      )}
    >
      {isUploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : (
        <Upload className="h-8 w-8" />
      )}
      <span className="text-sm font-medium">
        {isUploading ? "Uploading…" : "Drop image or click to browse"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload exercise image"
      />
    </button>
  )
}
