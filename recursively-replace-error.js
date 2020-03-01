const ErrorStackParser = require('error-stack-parser');

function recursivelyReplaceError(obj) {
  if(obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stacktrace: ErrorStackParser.parse(obj)
    }
  } else if(obj instanceof Object) {
    const objClone = Object.assign({}, obj);
    const props = Object.getOwnPropertyNames(objClone);
    for(prop of props) {
      objClone[prop] = recursivelyReplaceError(objClone[prop]);
    }
    return objClone;
  }
  return obj;
}

module.exports = recursivelyReplaceError;