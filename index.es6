require('longjohn'); //long stack traces
const Promise = require('bluebird');
const Datastore = require('nedb');
const winston = require('winston');
const StackTrace = require('stacktrace-js');

let db = Promise.promisifyAll(new Datastore({filename: './log.nedb'}));

const winstonLogger = winston.createLogger({
  transports: [
    new winston.transports.Console()
  ]
});

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

const runQuery = {run: {$exists: true}};
let run = 0;

function getInstance(options) {
  options = options || {};

  return db.loadDatabaseAsync()
    .then(function() {
      return db.ensureIndexAsync({fieldName: 'createdAt'});
    })
    .then(function() {
      return db.ensureIndexAsync({fieldName: 'logLevel'});
    })
    .then(function() {
      return db.ensureIndexAsync({fieldName: 'component'});
    })
    .then(function() {
      return db.findAsync(runQuery);
    })
    .then(function(result) {
      if(result.length > 0)
        run = ++result[0].run;
      return db.updateAsync(runQuery, {run: run}, {upsert: true});
    })
    .then(function(result) {
      options.db = db;
      let objectLogger = new ObjectLogger(options);
      if(options.cb)
        options.cb(objectLogger);

      return objectLogger;
    });
}


class ObjectLogger {
  constructor(options) {
    if('logLevels' in options)
      this.logLevels = options.logLevels;
    else
      this.logLevels = defaultLogLevels;

    if('defaultLogLevel' in options)
      this.defaultLogLevel = options.defaultLogLevel;
    else
      this.defaultLogLevel = defaultLogLevel;

    if('defaultComponent' in options)
      this.defaultComponent = options.defaultComponent;

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

  log(options, primaryObject, extraObject) {
    options = options || {};

    let document = {};
    document.createdAt = options.createdAt || new Date().toJSON();
    document.logLevel = 'logLevel' in options ? parseLogLevel(options.logLevel, this.logLevels) : parseLogLevel(this.defaultLogLevel, this.logLevels);
    'defaultComponent' in this ? document.component = this.defaultComponent : null;
    'component' in options ? document.component = options.component : null;

    document.run = run;

    document.primary = primaryObject;

    document.extra = extraObject;

    StackTrace.get() //a stack trace of "here", in addition to any stack traces that may be in the objects
      .then(stacktrace => {
        document.stacktrace = stacktrace;
        db.insert(document);
        winstonLogger.log(getTextualLevel(document.logLevel, this.logLevels), document);
      });
  }
}

function parseLogLevel(logLevel, logLevels) {
  if(logLevel in logLevels) //it's a string value that's a key
    return logLevels[logLevel] + 0.0;
  if(logLevel === +logLevel) //it's a number
    return logLevel + 0.0;

  throw new Error('Attempt to use an unknown error level')
}

function getTextualLevel(numericalLevel, logLevels) {
  for(key in logLevels) {
    if(logLevels[key] === numericalLevel) {
      return key;
    }
  }
}

module.exports = getInstance;
module.exports.getInstance = getInstance;
