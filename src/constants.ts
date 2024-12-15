import { ImagePickerSettings } from './ImagePickerSettings'

export const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

/**
 * The view type for the image picker
 */
export const VIEW_TYPE_IMAGE_PICKER = 'image-picker-view'

/**
 * Backgrounder: Time to sleep between jobs
 */
export const TIME_BETWEEN_JOBS = 5000

/**
 * Fixed height for each row in the image picker
 */
export const ROW_HEIGHT = 100

/**
 * Maximum image size to render in the image picker
 * on mobile devices.
 *
 * Images larger than this will be ignored. This is to
 * prevent Obsidian from reloading when loading a
 * large library.
 */
export const MOBILE_MAX_FILE_SIZE = 5000
/**
 * Maximum image size to render in the image picker
 * on desktop devices.
 *
 * Images larger than this will be ignored.
 */
export const DESKTOP_MAX_FILE_SIZE = 5000

/**
 * Query tokens to search for in the image picker
 */
export const queryTokens = ['ext']

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: ImagePickerSettings = {
  imageFolder: '',
  animateGifs: false,
  debugMode: false,
  zoom: 1,
}

/**
 * The min/max thumbnail zoom for the image picker
 *
 * The zoom is applied to the baseline ROW_HEIGHT
 * to determine the thumbnail size.
 */
export const MIN_THUMBNAIL_ZOOM = 0.5
export const MAX_THUMBNAIL_ZOOM = 2
