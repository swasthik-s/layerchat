import { MongoClient, Db, Collection } from 'mongodb'

// MongoDB configuration - allow build time without throwing errors
const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'layerchat'

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

// Function to validate MongoDB URI at runtime
function validateMongoConfig() {
  if (!uri) {
    throw new Error('MongoDB is not configured. Please set MONGODB_URI environment variable.')
  }
}

// Function to check if MongoDB is available
export function isMongoDBAvailable(): boolean {
  return !!uri
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// Initialize MongoDB connection lazily
function initializeMongoDB(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('MongoDB is not configured. Please set MONGODB_URI environment variable.')
  }

  if (clientPromise) {
    return clientPromise
  }

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri)
      global._mongoClientPromise = client.connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri)
    clientPromise = client.connect()
  }

  return clientPromise
}

export async function getDatabase(): Promise<Db> {
  const client = await initializeMongoDB()
  return client.db(dbName)
}

export async function getChatCollection(): Promise<Collection> {
  const db = await getDatabase()
  return db.collection('chats')
}

export async function getMessagesCollection(): Promise<Collection> {
  const db = await getDatabase()
  return db.collection('messages')
}

export default {
  getDatabase,
  getChatCollection,
  getMessagesCollection,
  isMongoDBAvailable
}
