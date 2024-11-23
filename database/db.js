const { MongoClient } = require('mongodb');
const url = process.env.MONGO_URL;
const client = new MongoClient(url);
const AigisError = require('../utils/AigisError');

let database;

async function createConnection(dbName) {
  if (!database) {
    try {
      await client.connect();
      database = client.db(dbName);
    } catch (err) {
      console.error(err);
      await client.close();
      throw new AigisError('Something went wrong with opening the database connection. Trashpanda-san will not like this.');
    }
  }
  return database;
}

async function closeConnection() {
  if (database) {
    await client.close();
    database = null;
  }
}

exports.init = async function init(dbName, collectionNames) {
  try {
    await client.connect();
    const database = client.db(dbName);
    for (let collectionName of collectionNames) {
      database.collection(collectionName, (err, result) => { if (err) throw err; });
    }
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  } finally {
    await client.close();
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
  } catch (err) {
    console.error(err);
    throw new AigisError('Something went wrong with the database, please report this.');
  } finally {
    await closeConnection();
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
  } finally {
    await closeConnection();
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
  } finally {
    await closeConnection();
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
  } finally {
    await closeConnection();
  }
}

/**
 * generic update function. Filter used to determine what to update, "update" used as the actual update function EX: { $set: { 'count': 50 } }
 * returns newly updated data. Upsert will insert if no documents match the filter
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
  } finally {
    await closeConnection();
  }
}

/**
 * generic update many function. Filter used to determine what to update, "update" used as the actual update function EX: { $set: { 'count': 50 } }
 * returns newly updated data. Upsert will insert if no documents match the filter
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
  } finally {
    await closeConnection();
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
  } finally {
    await closeConnection();
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
  } finally {
    await closeConnection();
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
  } finally {
    await closeConnection();
  }
}


