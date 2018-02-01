const Promise = require('bluebird');
const Datastore = require('nedb');
const winston = require('winston');

let db = Promise.promisifyAll(new Datastore({filename: './log.nedb'}));

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console()
  ]
});

const defaultLevels = {
  emerg: 0,
  alert: 1,
  crit: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7
};


require('longjohn'); //long stack traces

const runQuery = {run: {$exists: true}};
let run = 0;

function getInstance(options) {

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
        run = result[0].run;
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
      this.logLevels = defaultLevels;

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
    let document = {};
    document.createdAt = options.createdAt || new Date().toJSON();
    'logLevel' in options ? document.logLevel = parseLogLevel(options.logLevel, this.logLevels) : null;
    'component' in options ? document.component = options.component : null;

    document.stackTrace = new Error(); //a stack trace of "here", in addition to any stack traces that may be in the objects

    document.primary = primaryObject;

    document.extra = extraObject;

    db.insert(document);

    logger.log(document.logLevel, JSON.stringify(document.primary));
  }
}

function parseLogLevel(logLevel, logLevels) {
  if(logLevel in logLevels) //it's a string value that's a key
    return logLevels[logLevel] + 0.0;
  if(logLevel === +logLevel) //it's a number
    return logLevel + 0.0;

  throw new Error('Attempt to use an unknown error level')
}

module.exports = getInstance;
module.exports.getInstance = getInstance;
