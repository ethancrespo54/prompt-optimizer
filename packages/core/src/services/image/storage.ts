import Dexie, { Table } from 'dexie'
import type {
  FullImageData,
  ImageMetadata,
  IImageStorageService,
  ImageStorageConfig
} from './types'

/**
 * Image storage database (IndexedDB)
 * Uses a separate database, isolated from the main application database
 *
 * Architecture optimization: split metadata and data into two tables
 * - imageMetadata: lightweight metadata, used for statistics and queries
 * - imageData: the actual base64 data, loaded on demand
 */
class ImageDB extends Dexie {
  imageMetadata!: Table<MetadataRecord, string>
  imageData!: Table<DataRecord, string>

  constructor(dbName: string) {
    super(dbName)

    // Dexie version declarations must be in ascending order (v1 -> v2); the upgrade callback is attached to the target version (v2).
    // v1: single images table (metadata + base64 data)
    this.version(1).stores({
      images: 'id, createdAt, accessedAt, sizeBytes, source'
    })

    // v2: split into metadata and data tables to improve statistics performance; drop the old images table
    this.version(2)
      .stores({
        imageMetadata: 'id, createdAt, accessedAt, sizeBytes, source',
        imageData: 'id',
        images: null
      })
      .upgrade(async tx => {
        // Migrate old data into the new table structure (in batches, to avoid loading a lot of base64 at once and causing a memory spike)
        const oldImages = tx.table<ImageRecordV1>('images')
        const newMetadata = tx.table<MetadataRecord>('imageMetadata')
        const newData = tx.table<DataRecord>('imageData')

        let lastId: string | undefined
        const CHUNK_SIZE = 25

        while (true) {
          const chunk: ImageRecordV1[] = lastId
            ? await oldImages.where('id').above(lastId).limit(CHUNK_SIZE).toArray()
            : await oldImages.orderBy('id').limit(CHUNK_SIZE).toArray()
          if (chunk.length === 0) break

          await newMetadata.bulkPut(
            chunk.map((record: ImageRecordV1) => ({
              id: record.id,
              metadata: record.metadata,
              createdAt: record.createdAt,
              accessedAt: record.accessedAt,
              sizeBytes: record.sizeBytes,
              source: record.source
            }))
          )
          await newData.bulkPut(
            chunk.map((record: ImageRecordV1) => ({
              id: record.id,
              data: record.data
            }))
          )

          lastId = chunk[chunk.length - 1]?.id
        }
      })
  }
}

/**
 * v1 legacy table structure (used for the v1 -> v2 migration)
 */
interface ImageRecordV1 {
  id: string
  metadata: string
  data: string
  createdAt: number
  accessedAt: number
  sizeBytes: number
  source: 'generated' | 'uploaded'
}

/**
 * Metadata table record (lightweight)
 */
interface MetadataRecord {
  id: string
  metadata: string          // JSON-serialized ImageMetadata
  createdAt: number
  accessedAt: number
  sizeBytes: number
  source: 'generated' | 'uploaded'
}

/**
 * Data table record (heavyweight, loaded on demand)
 */
interface DataRecord {
  id: string
  data: string              // base64-encoded image data
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ImageStorageConfig = {
  maxCacheSize: 50 * 1024 * 1024,      // 50 MB
  maxAge: 7 * 24 * 60 * 60 * 1000,     // 7 days
  maxCount: 100,                       // At most 100 images
  autoCleanupThreshold: 0.8,           // Trigger cleanup at 80%
  dbName: 'PromptOptimizerImageDB',
}

/**
 * Image storage service implementation
 *
 * Core features:
 * 1. Saving, reading, and deleting images
 * 2. LRU cache cleanup strategy
 * 3. Quota enforcement
 * 4. Storage statistics (queries the metadata table only)
 */
export class ImageStorageService implements IImageStorageService {
  private readonly db: ImageDB
  private config: ImageStorageConfig

  constructor(config?: Partial<ImageStorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.db = new ImageDB(this.config.dbName || DEFAULT_CONFIG.dbName || 'PromptOptimizerImageDB')
  }

  /**
   * Save an image to storage
   * @param data Complete image data
   * @returns Image ID
   */
  async saveImage(data: FullImageData): Promise<string> {
    const now = Date.now()

    // Prepare the metadata record
    const metadataRecord: MetadataRecord = {
      id: data.metadata.id,
      metadata: JSON.stringify(data.metadata),
      createdAt: data.metadata.createdAt,
      accessedAt: now,  // Update the access time
      sizeBytes: data.metadata.sizeBytes,
      source: data.metadata.source
    }

    // Prepare the data record
    const dataRecord: DataRecord = {
      id: data.metadata.id,
      data: data.data
    }

    // Save to both tables at once (a transaction ensures consistency)
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.put(metadataRecord)
      await this.db.imageData.put(dataRecord)
    })

    // Check whether automatic cleanup is needed
    await this.autoCleanupIfNeeded()

    return data.metadata.id
  }

  /**
   * Get the complete image data
   * @param id Image ID
   * @returns Complete image data, or null if it does not exist
   */
  async getImage(id: string): Promise<FullImageData | null> {
    // Query both tables at once
    const [metadataRecord, dataRecord] = await Promise.all([
      this.db.imageMetadata.get(id),
      this.db.imageData.get(id)
    ])

    if (!metadataRecord || !dataRecord) {
      return null
    }

    // Update the access time (LRU)
    await this.db.imageMetadata.update(id, { accessedAt: Date.now() })

    // Deserialize
    return {
      metadata: JSON.parse(metadataRecord.metadata) as ImageMetadata,
      data: dataRecord.data
    }
  }

  /**
   * Get image metadata (without the actual image data)
   * @param id Image ID
   * @returns Image metadata, or null if it does not exist
   */
  async getMetadata(id: string): Promise<ImageMetadata | null> {
    const record = await this.db.imageMetadata.get(id)

    if (!record) {
      return null
    }

    // Update the access time
    await this.db.imageMetadata.update(id, { accessedAt: Date.now() })

    return JSON.parse(record.metadata) as ImageMetadata
  }

  /**
   * Delete a single image
   * @param id Image ID
   */
  async deleteImage(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.delete(id)
      await this.db.imageData.delete(id)
    })
  }

  /**
   * Delete images in bulk
   * @param ids Array of image IDs
   */
  async deleteImages(ids: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.bulkDelete(ids)
      await this.db.imageData.bulkDelete(ids)
    })
  }

  /**
   * Clear all images
   */
  async clearAll(): Promise<void> {
    await this.db.transaction('rw', this.db.imageMetadata, this.db.imageData, async () => {
      await this.db.imageMetadata.clear()
      await this.db.imageData.clear()
    })
  }

  /**
   * Clean up expired images (based on the maxAge config, using accessedAt)
   * @returns Number of images cleaned up
   */
  async cleanupOldImages(): Promise<number> {
    const now = Date.now()
    const maxAge = this.config.maxAge!
    const cutoffTime = now - maxAge

    // Find expired images (based on accessedAt, not createdAt)
    const expiredImages = await this.db.imageMetadata
      .where('accessedAt')
      .below(cutoffTime)
      .primaryKeys()

    if (expiredImages.length === 0) {
      return 0
    }

    // Delete expired images (delete from both tables)
    await this.deleteImages(expiredImages)

    return expiredImages.length
  }

  /**
   * Enforce quota limits
   * Delete by priority:
   * 1. Expired images (older than maxAge, based on accessedAt)
   * 2. The portion exceeding maxCount (delete the oldest)
   * 3. The portion exceeding maxCacheSize (delete the oldest)
   */
  async enforceQuota(): Promise<void> {
    const maxAge = this.config.maxAge!
    const maxCount = this.config.maxCount!
    const maxCacheSize = this.config.maxCacheSize!
    const now = Date.now()

    // 1. Clean up expired images (based on accessedAt)
    const cutoffTime = now - maxAge
    const expiredImages = await this.db.imageMetadata
      .where('accessedAt')
      .below(cutoffTime)
      .primaryKeys()

    if (expiredImages.length > 0) {
      await this.deleteImages(expiredImages)
    }

    // Re-fetch statistics (query the metadata table only, a performance optimization)
    const updatedStats = await this.getStorageStats()

    // 2. Check the count limit
    if (updatedStats.count > maxCount) {
      const excessCount = updatedStats.count - maxCount
      const oldestImages = await this.getOldestImages(excessCount)
      await this.deleteImages(oldestImages)
    }

    // 3. Check the size limit
    if (updatedStats.totalBytes > maxCacheSize) {
      // Delete oldest first until the total size is below 90% of the quota
      const targetSize = Math.floor(maxCacheSize * 0.9)
      let currentSize = updatedStats.totalBytes

      while (currentSize > targetSize) {
        const oldestImage = await this.getOldestMetadata()
        if (!oldestImage) break

        await this.deleteImage(oldestImage.id)
        currentSize -= oldestImage.sizeBytes
      }
    }
  }

  /**
   * Get storage statistics
   * Queries the metadata table only and does not read base64 data (performance optimization)
   */
  async getStorageStats(): Promise<{
    count: number
    totalBytes: number
    oldestAt: number | null
    newestAt: number | null
  }> {
    // Query the metadata table only to avoid reading large base64 data
    const allMetadata = await this.db.imageMetadata.toArray()

    if (allMetadata.length === 0) {
      return {
        count: 0,
        totalBytes: 0,
        oldestAt: null,
        newestAt: null
      }
    }

    const count = allMetadata.length
    const totalBytes = allMetadata.reduce((sum, meta) => sum + meta.sizeBytes, 0)
    const oldestAt = Math.min(...allMetadata.map(meta => meta.accessedAt))
    const newestAt = Math.max(...allMetadata.map(meta => meta.accessedAt))

    return {
      count,
      totalBytes,
      oldestAt,
      newestAt
    }
  }

  /**
   * List all image metadata
   * Queries the metadata table only and does not read base64 data (performance optimization)
   */
  async listAllMetadata(): Promise<ImageMetadata[]> {
    // Query the metadata table only
    const allMetadata = await this.db.imageMetadata.toArray()

    return allMetadata.map(record => JSON.parse(record.metadata) as ImageMetadata)
  }

  /**
   * List all image IDs
   * @returns Array of image IDs
   */
  async listAllIds(): Promise<string[]> {
    return await this.db.imageMetadata.toCollection().primaryKeys()
  }

  /**
   * Get the current configuration
   */
  getConfig(): ImageStorageConfig {
    return { ...this.config }
  }

  /**
   * Update the configuration
   * @param config Partial configuration update
   */
  async updateConfig(config: Partial<ImageStorageConfig>): Promise<void> {
    const { dbName, ...updatable } = config
    if (dbName && dbName !== this.config.dbName) {
      // dbName is initialization-only because DB is already opened.
      console.warn('[ImageStorageService] Ignoring dbName update after initialization')
    }

    this.config = { ...this.config, ...updatable, dbName: this.config.dbName }

    // Run cleanup immediately after the configuration is updated
    await this.enforceQuota()
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.db.close()
  }

  /**
   * Automatic cleanup check (called after saving)
   * Triggers cleanup if the threshold is reached
   */
  private async autoCleanupIfNeeded(): Promise<void> {
    const threshold = this.config.autoCleanupThreshold!
    const maxCacheSize = this.config.maxCacheSize!
    const maxCount = this.config.maxCount!

    const stats = await this.getStorageStats()

    // Check whether either threshold is reached
    const sizeThreshold = maxCacheSize * threshold
    const countThreshold = maxCount * threshold

    if (
      stats.totalBytes > sizeThreshold ||
      stats.count > countThreshold
    ) {
      await this.enforceQuota()
    }
  }

  /**
   * Get the IDs of the oldest N images (sorted by accessedAt)
   */
  private async getOldestImages(count: number): Promise<string[]> {
    const images = await this.db.imageMetadata
      .orderBy('accessedAt')
      .limit(count)
      .primaryKeys()

    return images
  }

  /**
   * Get the metadata of the oldest image (full record)
   */
  private async getOldestMetadata(): Promise<MetadataRecord | null> {
    const images = await this.db.imageMetadata
      .orderBy('accessedAt')
      .limit(1)
      .toArray()

    return images[0] || null
  }
}

/**
 * Create an image storage service instance
 */
export function createImageStorageService(
  config?: Partial<ImageStorageConfig>
): ImageStorageService {
  return new ImageStorageService(config)
}
