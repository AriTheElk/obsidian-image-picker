import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useApp, useFiles, usePlugin } from './ImagePickerContext'
import { debounce } from 'lodash'
import { getSizeInKb } from './utils'
import { TFile } from 'obsidian'
import { IndexerNode } from './Indexer'

const ROW_HEIGHT = 100

const MOBILE_MAX_FILE_SIZE = 200
const DESKTOP_MAX_FILE_SIZE = 5000

const queryTokens = ['ext']

/**
 * Searches through a plaintext search query and
 * returns all of the tokens contained in the query.
 * Also returns the remaining query after removing
 * all of the tokens.
 */
const tokenizeSearchQuery = (query: string) => {
  const tokens = query
    .split(' ')
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.includes(':') && queryTokens.includes(token.split(':')[0])
    )
  let remainingQuery = ''

  for (const token of query.split(' ')) {
    if (!tokens.includes(token)) {
      remainingQuery += token + ' '
    }
  }

  return {
    queryTokens: tokens,
    remainingQuery: remainingQuery.trim(),
  }
}

export const ImagePickerView = () => {
  const IS_MOBILE = useRef(document.querySelector('.is-mobile') !== null)
  const plugin = usePlugin()
  const app = useApp()
  const images = useFiles()
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState<
    ReturnType<typeof tokenizeSearchQuery>
  >({
    queryTokens: [],
    remainingQuery: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(0)

  const [columns, setColumns] = useState(0)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const indexerToFile = useCallback(
    async (indexerNode: IndexerNode) => {
      const file = app.vault.getAbstractFileByPath(indexerNode.path)
      if (!file || !(file instanceof TFile)) {
        return null
      }
      return file
    },
    [app.vault]
  )

  const filterImages = useMemo(
    () =>
      debounce((query: string) => {
        setSearchQuery(tokenizeSearchQuery(query))
        setCurrentPage(1)
        setNextImageIndex(0)
        setLoadedImages(new Set())
      }, 500),
    []
  )

  const handleImageClick = useCallback((filePath: string) => {
    console.log(`Image clicked: ${filePath}`)
  }, [])

  const filteredImages = useMemo(() => {
    const { queryTokens, remainingQuery } = searchQuery
    return images
      .filter((file) => {
        const resource = app.vault.getResourcePath(file as any).toLowerCase()

        if (!resource.includes(remainingQuery.toLowerCase())) return false

        for (const token of queryTokens) {
          const [key, value] = token.split(':')
          switch (key) {
            case 'ext':
              if (file.extension.toLowerCase() !== value.toLowerCase())
                return false
              break
            default:
              // throw new Error(`Unknown query token: ${key}`)
              break
          }
        }

        if (
          getSizeInKb(file.stat.size) >
          (IS_MOBILE.current ? MOBILE_MAX_FILE_SIZE : DESKTOP_MAX_FILE_SIZE)
        )
          return false

        return true
      })
      .sort((a, b) => b.stat.ctime - a.stat.ctime)
  }, [images, app.vault, searchQuery])

  const calculateGrid = useCallback(
    (containerSize: number, assetSize: number) => {
      if (gridRef.current) {
        const computedStyle = window.getComputedStyle(gridRef.current)
        const gap = parseInt(computedStyle.getPropertyValue('gap'), 10) || 0
        const totalGapsWidth =
          containerSize < assetSize * 2 + gap
            ? 0
            : gap * (Math.floor(containerSize / assetSize) - 1)
        const newColumns = Math.floor(
          (containerSize - totalGapsWidth) / assetSize
        )
        return newColumns
      }
      return 0
    },
    []
  )

  const updateCalculations = useCallback(
    (container: HTMLDivElement) => {
      // The image height is fixed, the width is dynamic
      const height = container.clientHeight
      const newRows = Math.floor(height / ROW_HEIGHT)

      const width = container.clientWidth
      const newColumns = calculateGrid(width, 100) // Assuming 100px as the min width for grid items
      setColumns(newColumns)
      setItemsPerPage(newRows * newColumns)
    },
    [calculateGrid]
  )

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (gridRef.current) {
        updateCalculations(gridRef.current)
      }
    })

    if (gridRef.current) {
      resizeObserver.observe(gridRef.current)
    }

    return () => {
      if (gridRef.current) {
        resizeObserver.unobserve(gridRef.current)
      }
    }
  }, [updateCalculations])

  useEffect(() => {
    if (gridRef.current) {
      updateCalculations(gridRef.current)
    }
  }, [updateCalculations, filteredImages])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const paginatedImages = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredImages.slice(startIndex, endIndex)
  }, [filteredImages, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredImages.length / itemsPerPage)

  const handlePrevPage = () => {
    setNextImageIndex(0)
    setLoadedImages(new Set())
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setNextImageIndex(0)
    setLoadedImages(new Set())
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const [loadedImages, setLoadedImages] = useState(new Set())
  const [nextImageIndex, setNextImageIndex] = useState(0)

  useEffect(() => {
    if (nextImageIndex < paginatedImages.length) {
      const file = paginatedImages[nextImageIndex]
      const img = new Image()
      img.src = app.vault.getResourcePath(file as any)
      const onLoad = () => {
        setLoadedImages((prev) => new Set(prev).add(file.path))
        setNextImageIndex((prev) => prev + 1)
      }

      const handleErrors = () => {
        console.warn('FAILED:', img.src)
        plugin.indexer.removeIndex(file.path)
        setNextImageIndex((prev) => prev + 1)
      }

      img.addEventListener('load', onLoad)
      img.addEventListener('error', handleErrors)

      return () => {
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', handleErrors)
      }
    }
  }, [app.vault, nextImageIndex, paginatedImages, plugin.indexer])

  return (
    <>
      <div className="image-picker-controls">
        <input
          type="text"
          placeholder="Search images..."
          className="image-picker-search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            filterImages(e.target.value)
          }}
        />
      </div>
      <div
        ref={(ref) => {
          if (!ref) return
          gridRef.current = ref
          updateCalculations(ref)
        }}
        className="image-picker-scroll-view"
      >
        <div
          className="image-picker-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {paginatedImages.map((file, i) => (
            <div
              key={file.path}
              className="image-picker-item"
              onClick={() => handleImageClick(file.path)}
              style={{
                gridRow: Math.floor(i / columns) + 1,
                gridColumn: (i % columns) + 1,
              }}
            >
              {loadedImages.has(file.path) ? (
                <img
                  src={app.vault.getResourcePath(file as any)}
                  alt={file.name}
                  style={{ width: '100%', height: '100%' }}
                  loading="lazy"
                />
              ) : (
                <div className="image-placeholder">Loading...</div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="image-picker-pagination">
        <button onClick={handlePrevPage} disabled={currentPage === 1}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages || 1}
        </span>
        <button onClick={handleNextPage} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    </>
  )
}
