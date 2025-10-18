const { MongoClient } = require('mongodb');
const url = config.get('MONGO_URI');
const AigisError = require('../utils/AigisError');
const config = require('../utils/config');

process.on('SIGINT', async () => {
  await closeConnection();
  process.exit();
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit();
});

let client;

/** For getting the connection for manual use. try to avoid */
exports.connect = createConnection;

async function createConnection(dbName) {
  try {
    if (!client) {
      client = new MongoClient(url, { useUnifiedTopology: true });
      await client.connect();
    }
    return client.db(dbName);
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with opening the database connection. Trashpanda-san will not like this.');
  }
}

async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
  }
}

/**
 * create index on specified collection. index will be something like { field_name: 1} for ascending or { field_name: -1 } for descending
 * can have comma separated fields for compoud indexes EX: { field1: 1, field2: -1 } 
 */
exports.addIndex = async function addIndex(dbName, collectionName, index) {
  try {
    const db = await createConnection(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.createIndex(index);
    return result;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}
/** 
 * generic insert function. If "data" is an array, will assume it is inserting multiple documents. Otherwise insert 1 document
 * returns inserted id or ids 
 */
exports.insert = async function insert(databaseName, collectionName, data) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    if (Array.isArray(data)) {
      const result = await collection.insertMany(data);
      return result.insertedIds;
    } else {
      const result = await collection.insertOne(data);
      return result.insertedId;
    }
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/**
 * generic findOne function
 * Query would be something like { 'name': 'John' }
 */
exports.findOne = async function findOne(databaseName, collectionName, query) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const result = await collection.findOne(query);
    return result;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/** 
 * generic find function (find multiple)
 * Query would be something like { 'name': 'John' }
 */
exports.find = async function find(databaseName, collectionName, query) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const results = await collection.find(query).toArray();
    return results;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/**
 * generic update function. Filter used to determine what to update, "update" used as the actual update function EX: { $set: { 'count': 50 } }
 * returns number of modified entries. Upsert will insert if no documents match the filter
 */
exports.updateOne = async function updateOne(databaseName, collectionName, filter, update, upsert = false) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const result = await collection.updateOne(filter, update, { upsert: upsert });
    return result.modifiedCount;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/**
 * generic update many function. Filter used to determine what to update, "update" used as the actual update function EX: { $set: { 'count': 50 } }
 * returns number of modified entries. Upsert will insert if no documents match the filter
 */
exports.updateMany = async function updateMany(databaseName, collectionName, filter, update, upsert = false) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const result = await collection.updateMany(filter, update, { upsert: upsert });
    return result.modifiedCount;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/**
 * generic replace function. Filter used to determine what to replace, "replacement" is the new document
 * returns the number of documents that matched the query. Upsert will insert if no documents match the filter
 */
exports.replace = async function replaceOne(databaseName, collectionName, filter, replacement, upsert = false) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const result = await collection.replaceOne(filter, replacement, { upsert: upsert });
    return result.matchedCount;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/**
 * generic delete function, deletes one document based on query
 * returns number of documents deleted
 */
exports.deleteOne = async function deleteOne(databaseName, collectionName, query) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const result = await collection.deleteOne(query);
    return result.deletedCount;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}

/**
 * generic delete many function, deletes documents based on query
 * returns number of documents deleted
 */
exports.deleteMany = async function deleteMany(databaseName, collectionName, query) {
  try {
    const db = await createConnection(databaseName);
    const collection = db.collection(collectionName);
    const result = await collection.deleteMany(query);
    return result.deletedCount;
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  }
}
