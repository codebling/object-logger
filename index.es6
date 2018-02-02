const path = require('path');
const longjohn = require('longjohn'); //long stack traces
const Promise = require('bluebird');
const NeDB = require('nedb');
const Debug = require('debug');
const StackTrace = require('stacktrace-js');

const defaultLogLevels = {
  emerg: 0,
  alert: 1,
  crit: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7
};

const defaultLogLevel = 6;

let stats;

function fixBufferStats(buffer) {
  for(let log of buffer) {
    log.stats = Object.assign({}, stats);
    ++stats.idInAll;
    ++stats.idInRun;
  }
}

const dbConstructScript = {
  nedb: (options) => Promise.promisifyAll(new NeDB(options))
};
const dbInitScripts = {
  nedb: (db) => db.loadDatabaseAsync()
};

function init(db) {
  return db.loadDatabaseAsync()
    .then(() => db.ensureIndexAsync({fieldName: 'createdAt', sparse: true}))
    .then(() => db.ensureIndexAsync({fieldName: 'logLevel', sparse: true}))
    .then(() => db.ensureIndexAsync({fieldName: 'component', sparse: true}))
    .then(() => db.ensureIndexAsync({fieldName: 'stats.idInAll'}))
    .then(() => db.ensureIndexAsync({fieldName: 'stats.run'}))
    .then(() => Promise.fromCallback((cb) => db.find({stats: {$exists: true}}).sort({'stats.idInAll': -1}).limit(1).exec(cb))) //find the highest/latest record
    .then((results) => {
      if(results.length > 0) {
        stats = {
          run: 1 + results[0].stats.run,
          idInAll: 1 + results[0].stats.idInAll,
          idInRun: 1
        };
      } else {
        stats = {
          run: 1,
          idInAll: 1,
          idInRun: 1
        }
      }
    })
  ;
}


class ObjectLogger {
  constructor(options) {
    options = options || {};
    
    if('logLevels' in options)
      this.logLevels = options.logLevels;
    else
      this.logLevels = defaultLogLevels;

    if('defaultLogLevel' in options)
      this.defaultLogLevel = options.defaultLogLevel;
    else
      this.defaultLogLevel = defaultLogLevel;

    this.defaultComponent = 'defaultComponent' in options ? options.defaultComponent : path.basename(path.resolve('./'));
    this.debugMap = new Map();
    this.debugMap.set(this.defaultComponent, Debug(this.defaultComponent));


    this._buffer = [];

    options.db = options.db || {type: 'nedb', options: {filename: './log.nedb'}};

    this.db = dbConstructScript[options.db.type](options.db.options);
    this.busyPromise = dbInitScripts[options.db.type](this.db)
      .then(() => init(this.db))
      .then(() => fixBufferStats(this._buffer)) //fix the statless logs in buffer, if any.
      .then(() => this.busyPromise = null)
    ;

    /*

    if(nedb)
      //check if instance or just set to use that
      if(filename)
        //use filename or default
    if(mongodb)
      if(hostname)

    this.db = lazy init db here and only instatiate storage once
    look out for dependencies trying to set the storage, how can we solve this?

    //accept a winston transport or an alternative logger

    //allow multiple instances which share db but only
    this.defaultComponent = options.defaultcomponent

    if(options.stacktrace) //true or false, take a stack trace every log
    */

  }
  _bufferLog(log) {
    this._buffer.push(log);
  }
  _flushBufferedLogs() {
    if(this._buffer.length > 0) {
      if(this.busyPromise == null) {
        let buf = this._buffer;
        this._buffer = [];
        this.busyPromise = this.db.insertAsync(buf)
          .then(() => this.busyPromise = null);
        return this.busyPromise;
      } else {
        return this.busyPromise
          .then(() => this._flushBufferedLogs());
      }
    } else {
      return Promise.resolve();
    }
  }

  log(primaryObject, extraObject, options) {
    options = options || {};

    let document = {};
    document.createdAt = options.createdAt || new Date().toJSON();
    document.logLevel = 'logLevel' in options ? parseLogLevel(options.logLevel, this.logLevels) : parseLogLevel(this.defaultLogLevel, this.logLevels);
    document.component = this.defaultComponent;
    'component' in options ? document.component = options.component : null;
    let debug;
    if(!this.debugMap.has(document.component)) {
      this.debugMap.set(document.component, Debug(document.component));
    }
    debug = this.debugMap.get(document.component);

    if(stats) {
      document.stats = Object.assign({}, stats); //copy the object, otherwise it could be updated before it is written
      ++stats.idInAll;
      ++stats.idInRun;
    }

    document.primary = primaryObject;

    document.extra = extraObject;

    document.stacktrace = StackTrace.getSync(); //a stack trace of "here", in addition to any stack traces that may be in the objects

    debug(document.primary);

    this._bufferLog(document);
    return this._flushBufferedLogs();
  }
}

function parseLogLevel(logLevel, logLevels) {
  if(logLevel in logLevels) //it's a string value that's a key
    return logLevels[logLevel] + 0.0;
  if(logLevel === +logLevel) //it's a number
    return logLevel + 0.0;

  throw new Error('Attempt to use an unknown error level')
}

module.exports = ObjectLogger;
