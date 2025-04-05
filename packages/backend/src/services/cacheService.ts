import mongoose, { type Document, Schema } from "mongoose";

interface ICache extends Document {
  key: string;
  value: any;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const defaultExpirationInSeconds = 60 * 60 * 24 * 7; // 7 days

const CacheSchema = new Schema<ICache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CacheModel = mongoose.model<ICache>("Cache", CacheSchema);

export class CacheService {
  /**
   * Write data to cache
   * @param key - Unique key for the cached data
   * @param value - Data to cache
   * @param expirationInSeconds - Time to live in seconds (optional)
   * @returns Promise resolving to the cached document
   */
  async write(
    key: string,
    value: any,
    expirationInSeconds?: number,
  ): Promise<ICache> {
    const expiresAt = expirationInSeconds
      ? new Date(Date.now() + expirationInSeconds * 1000)
      : new Date(Date.now() + defaultExpirationInSeconds * 1000);

    const update = {
      value,
      ...(expiresAt && { expiresAt }),
    };

    return CacheModel.findOneAndUpdate({ key }, update, {
      upsert: true,
      new: true,
    });
  }

  /**
   * Read data from cache
   * @param key - Key of the cached data
   * @returns Promise resolving to the cached value or null if not found or expired
   */
  async read<T = any>(key: string): Promise<T | null> {
    const cacheItem = await CacheModel.findOne({
      key,
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
    });

    return cacheItem ? (cacheItem.value as T) : null;
  }

  /**
   * Fetch data from cache or generate and cache if not found
   * @param key - Key for the cached data
   * @param generator - Function to generate data if not in cache
   * @param expirationInSeconds - Time to live in seconds (optional)
   * @returns Promise resolving to the data
   */
  async fetch<T = any>(
    key: string,
    generator: () => Promise<T>,
    expirationInSeconds?: number,
  ): Promise<T> {
    const cachedValue = await this.read<T>(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const generatedValue = await generator();
    await this.write(key, generatedValue, expirationInSeconds);

    return generatedValue;
  }
}

export default new CacheService();
