process.env.DEBUG = '*';
const ObjectLogger = require('../index.js');

let logger = new ObjectLogger();
logger.log({data: 'somedata here', warning: 'no warning'});
logger.log({something:'else'});
logger.log({number:3});
setTimeout(
  () => logger.log({afterTimeout: true}),
  400
);