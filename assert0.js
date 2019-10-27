//叫assert0，为了避免和assert库冲突。
//简单assert实现。
//使用方式 import assert from assert0
//assert(a>b,'a should > b')
function ok(value, messageIfError = 'assert error') {
  if (!__DEV__) {
    return;
  }
  if (value) {
    return;
  }
  const err = new Error(messageIfError);
  // console.error('assert error',err);
  debugger;
  throw err;
}

export default ok;
