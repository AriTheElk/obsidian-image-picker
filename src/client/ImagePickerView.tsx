import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useApp, useFiles, usePlugin } from './ImagePickerContext'
import { debounce, isEqual, set, truncate } from 'lodash'
import { copyToClipboard, getSizeInKb, nodeToEmbed } from '../utils'
import { Notice, TFile } from 'obsidian'
import { AbstractIndexerNode, IndexerNode } from '../backend/Indexer'
import { deepStrictEqual } from 'assert'

export const ROW_HEIGHT = 100

const MOBILE_MAX_FILE_SIZE = 5000
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
  const cachedImages = useRef<IndexerNode[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState<
    ReturnType<typeof tokenizeSearchQuery>
  >({
    queryTokens: [],
    remainingQuery: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(0)

  const prevColumns = useRef(0)
  const [columns, setColumns] = useState(0)
  const gridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (columns !== prevColumns.current) {
      setLoadedImages({})
      prevColumns.current = columns
    }
  }, [columns])

  const trashNode = useCallback(
    async (file: IndexerNode | AbstractIndexerNode) => {
      try {
        await app.vault.trash(
          app.vault.getAbstractFileByPath(file.path)!,
          false
        )
        await plugin.indexer.removeIndex(file.path)
      } catch (e) {
        console.error('Failed to trash node:', e)
      }
    },
    [app.vault, plugin.indexer]
  )

  const filterImages = useMemo(
    () =>
      debounce((query: string) => {
        setSearchQuery(tokenizeSearchQuery(query))
        setCurrentPage(1)
        setNextImageIndex(0)
        setLoadedImages({})
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

  const paginatedImages = useMemo((): IndexerNode[] => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredImages.slice(startIndex, endIndex)
  }, [filteredImages, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredImages.length / itemsPerPage)

  const handlePrevPage = () => {
    setNextImageIndex(0)
    setLoadedImages({})
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setNextImageIndex(0)
    setLoadedImages({})
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const [loadedImages, setLoadedImages] = useState<Record<string, string>>({})
  const [nextImageIndex, setNextImageIndex] = useState(0)

  const loadNextImage = useCallback(
    async (imageIndex: number) => {
      try {
        if (imageIndex < paginatedImages.length) {
          const file = await plugin.indexer.getAbstractNode(
            paginatedImages[imageIndex]
          )
          const img = new Image()
          img.src = file.thumbnail.data

          const onLoad = () => {
            setLoadedImages((prev) => ({
              ...prev,
              [file.path]: file.thumbnail.data,
            }))
            loadNextImage(imageIndex + 1)
          }

          img.addEventListener('load', onLoad)
          // img.addEventListener('error', handleErrors)
        }
      } catch (_) {
        console.warn('FAILED:', paginatedImages[imageIndex])
        plugin.indexer.removeIndex(paginatedImages[imageIndex].path)
        setNextImageIndex((prev) => prev + 1)
        loadNextImage(imageIndex + 1)
      }
    },
    [paginatedImages, plugin.indexer]
  )

  useEffect(() => {
    if (Object.keys(loadedImages).length === 0) {
      loadNextImage(nextImageIndex)
    }
  }, [loadNextImage, loadedImages, nextImageIndex])

  useEffect(() => {
    if (!isEqual(images, cachedImages.current)) {
      console.log('Images changed:', images.length)
      setLoadedImages({})
      setNextImageIndex(0)
      setCurrentPage(1)
      cachedImages.current = images
    }
  }, [images])

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
              <select
                value="default"
                onChange={async (e) => {
                  switch (e.target.value) {
                    case 'copy':
                      copyToClipboard(nodeToEmbed(file))
                      new Notice('Copied image embed to clipboard')
                      break
                    case 'path':
                      copyToClipboard(file.path)
                      new Notice('Copied image path to clipboard')
                      break
                    case 'delete':
                      // removeImage(file)
                      await trashNode(file)
                      new Notice(`Moved ${file.name} to trash`)
                      break
                    default:
                      break
                  }
                }}
              >
                <option disabled selected value="default">
                  {truncate(file.name, {
                    length: 30,
                  })}
                </option>
                <option value="copy">Copy Image Embed</option>
                <option value="path">Copy Image Path</option>
                <option value="delete">Delete Image</option>
              </select>
              {Object.keys(loadedImages).includes(file.path) ? (
                <img
                  src={loadedImages[file.path]}
                  alt={file.name}
                  style={{ width: '100%', height: '100%' }}
                  loading="lazy"
                />
              ) : (
                <div className="image-placeholder">⏳</div>
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
