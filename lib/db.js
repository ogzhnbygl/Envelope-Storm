import { MongoClient } from 'mongodb';

let client = null;
let clientPromise = null;

// Bağlantıyı modül seviyesinde önbelleğe alır: Vercel'de sıcak (warm) çağrılarda
// aynı bağlantı tekrar kullanılır, her istekte yeniden bağlanılmaz.
export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ortam değişkeni tanımlı değil');
  const dbName = process.env.MONGODB_DB || 'envelope-storm';

  if (!clientPromise) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    clientPromise = client.connect();
  }
  await clientPromise;
  return client.db(dbName);
}
