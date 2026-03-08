export type StoredObject = {
  path: string
  url: string
  size: number
}

export type PutObjectInput = {
  folder: string
  filename: string
  data: Buffer
  contentType: string
  cacheControl?: string
}

export interface StorageProvider {
  readonly name: string
  putObject(input: PutObjectInput): Promise<StoredObject>
  getPublicUrl(path: string): string
  toRelativePath(urlOrPath: string): string | null
}

