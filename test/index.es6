const ObjectLogger = require('object-logger');

ObjectLogger.getInstance()
  .then(function(logger) {
    setTimeout(function() {
      logger.log(null, {data: 'somedata here', warning: 'no warning'});
    }, 1)
  });
