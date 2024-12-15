import { debounce, isEqual, throttle, truncate } from 'lodash'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Notice, TFile } from 'obsidian'

import {
  queryTokens,
  MOBILE_MAX_FILE_SIZE,
  DESKTOP_MAX_FILE_SIZE,
  ROW_HEIGHT,
  DEFAULT_SETTINGS,
} from '../../constants'
import {
  calculateGrid,
  copyToClipboard,
  getSizeInKb,
  nodeToEmbed,
  setGridHeight,
} from '../../utils'
import { AbstractIndexerNode, IndexerNode } from '../../backend/Indexer'
import { useApp, useFiles, usePlugin } from '../ImagePickerContext'

import { Pagination } from './Pagination'
import { Search } from './Search'

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

  const [loadedImages, setLoadedImages] = useState<Record<string, string>>({})
  const [nextImageIndex, setNextImageIndex] = useState(0)

  const hydratedCSS = useRef(false)
  const [zoom, setZoom] = useState(
    plugin.settings.zoom || DEFAULT_SETTINGS.zoom
  )
  const [rowHeight, setRowHeight] = useState(zoom * ROW_HEIGHT)

  useEffect(() => {
    if (!hydratedCSS.current) {
      setGridHeight(zoom)
      hydratedCSS.current = true
    }
  }, [zoom])

  const updateZoomSetting = useMemo(
    () =>
      debounce((zoom: number) => {
        plugin.settings.zoom = zoom
        plugin.backgrounder.enqueue({
          type: 'saveSettings',
          disableDoubleQueue: true,
          action: plugin.saveSettings,
        })
      }, 500),
    [plugin.backgrounder, plugin.saveSettings, plugin.settings]
  )

  const updateVisualZoom = useCallback(
    throttle((zoom: number) => {
      setGridHeight(zoom)
      setRowHeight(zoom * ROW_HEIGHT)
    }, 50),
    []
  )

  const onZoom = useCallback(
    (zoom: number) => {
      setZoom(zoom)
      updateZoomSetting(zoom)
      updateVisualZoom(zoom)
    },
    [updateVisualZoom, updateZoomSetting]
  )

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
        const tfile = app.vault.getAbstractFileByPath(file.path)
        const resource = app.vault.getResourcePath(tfile as TFile).toLowerCase()

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

  const updateCalculations = useCallback(
    (container: HTMLDivElement) => {
      const height = container.clientHeight
      const width = container.clientWidth
      const [col, row] = calculateGrid(gridRef, [width, height], rowHeight)
      setColumns(col)
      setItemsPerPage(col * row)
    },
    [rowHeight]
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

  /**
   * When the search query changes, reset the current page
   */
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  /**
   * Recursively load the next image in the list
   * until all images are loaded
   */
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

  /**
   * Load the first image when the component mounts
   */
  useEffect(() => {
    if (Object.keys(loadedImages).length === 0) {
      loadNextImage(nextImageIndex)
    }
  }, [loadNextImage, loadedImages, nextImageIndex])

  /**
   * When the root images change, reset the loaded images
   * This needs done because currently there is no
   * reconciliation between the old and new images and
   * Image Picker doesn't know there are unloaded images.
   */
  useEffect(() => {
    if (!isEqual(images, cachedImages.current)) {
      setLoadedImages({})
      setNextImageIndex(0)
      cachedImages.current = images
    }
  }, [images, totalPages])

  return (
    <>
      <Search onSearch={filterImages} />
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
                // TODO: add a self-queueing system for images in this state
                <div className="image-placeholder">⏳</div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Pagination
        total={totalPages}
        current={currentPage}
        onNext={handleNextPage}
        onPrev={handlePrevPage}
        zoom={zoom}
        onZoom={onZoom}
      />
    </>
  )
}
