//@flow
// i use flow to assist WebStorm's completion, not used to fully type-checking

import assert from './assert0';
import _ from 'lodash';
import sum from 'hash-sum';

let AsyncStorage = null;
let GLogger = null;
let GEventListener = null; //接受两个参数 (eventName,vars)

//CacheKeysList is used to track all keys，it is useful when clear cache
const KEY_fetchCacheKeysList = 'KEY_fetchCacheKeysList';

const EVENT_WILL_saveCache = 'EVENT_WILL_saveCache'
const EVENT_WILL_calcCacheKey= 'EVENT_WILL_calcCacheKey'
const EVENT_DID_calcCacheKey= 'EVENT_DID_calcCacheKey'
const EVENT_GOTCACHE_WILL_Resolve = 'EVENT_GOTCACHE_WILL_Resolve'
const EVENT_GOTNetwork_WILL_SaveCache = 'EVENT_GOTNetwork_WILL_SaveCache'

const CacheKeysListManager = {
  latestKeysList: [], //always keep a newest version

  isKeyExistsInLatestKeysList(key) {
    const exists = CacheKeysListManager.latestKeysList.includes(key);
    return exists;
  },
  //save to disk
  async saveCacheKeysList(keysList) {
    assert(_.isArray(keysList));
    const keysListStr = JSON.stringify(keysList);
    return await AsyncStorage.setItem(KEY_fetchCacheKeysList, keysListStr);
  },

  //read from disk
  async getCacheKeysList(): Array {
    let keysList = [];
    try {
      const keysListStr = await AsyncStorage.getItem(KEY_fetchCacheKeysList);
      // log('keysListStr:' + keysListStr);
      if (_.isString(keysListStr)) {
        keysList = JSON.parse(keysListStr);
        assert(_.isArray(keysList));
      }
    } catch (e) {}
    // log('will set latestKeysList to' + keysList);
    CacheKeysListManager.latestKeysList = keysList;
    return keysList;
  },
  async updateCacheKeysList(action, key) {
    assert(_.isString(action));

    assert(action === 'append'|| action === 'delete'|| action === 'clear');

    //when update always read from disk
    const keysList = await CacheKeysListManager.getCacheKeysList();

    if (action === 'append') {
      assert(_.isString(key));
      if (keysList.includes(key)) {
        return true;
      } else {
        keysList.push(key);
      }
      return await CacheKeysListManager.saveCacheKeysList(keysList);
    } else if (action === 'delete') {
      _.remove(keysList, (x) => x === key);
      return await CacheKeysListManager.saveCacheKeysList(keysList);
    } else if (action === 'clear') {
      await AsyncStorage.multiRemove(keysList);
      return await CacheKeysListManager.saveCacheKeysList([]);
    } else {
      throw new Error('should not go here');
    }
  },
};

const Converter = {
  //this method may throw！need catch!
  async stringFromReponse(response: Response) {
    assert(_.isObject(response));
    const clonedOne = response.clone();
    const text = await clonedOne.text(); //may throw in text()
    const url = response.url;
    const headersObj = Converter.objectFromHeaders(response.headers);
    const responseObj = { url,text, headersObj };

    const responseStr = JSON.stringify(responseObj);
    return responseStr;
  },

  responseFromString(responseStr: string): Response {
    const responseObj = JSON.parse(responseStr);
    const { text, headersObj } = responseObj;
    const headers = Converter.headersFromObject(headersObj);
    const response = new Response(text, headers);
    return response;
  },

  objectFromHeaders(headers: Headers) {
    assert(_.isObject(headers));
    const headersObj = {};
    const keyVals = [...headers.entries()];
    keyVals.forEach(([key, val]) => {
      headersObj[key] = val;
    });
    return headersObj;
  },

  headersFromObject(headersObj) {
    assert(_.isObject(headersObj));
    const headers = new Headers(headersObj);
    return headers;
  },
};

function replaceAll(target, str, newstr) {
  return target.replace(new RegExp(str, 'g'), newstr);
}

function calcCacheKey(input, init): string {
  assert(_.isObject(init));
  assert(_.isString(input));
  GEventListener(EVENT_WILL_calcCacheKey,{input,init});
  const method = _.get(init, 'method', 'GET');
  const headers = _.get(init, 'headers');
  let headersSum = null;
  if (_.isObject(headers)) {
    let headersObj = null;
    if (_.isFunction(headers.entries)) {
      //Headers
      headersObj = Converter.objectFromHeaders(headers); // a new object
    } else {
      headersObj = _.clone(headers); // a new object
    }

    const headersObjAfterPopulate = calcCacheKey.headersPopulator(headersObj);
    headersSum = sum(headersObjAfterPopulate); //plain object
  } else {
    headersSum = String(headers);
  }
  const body = _.get(init, 'body');
  const url = replaceAll(input,'/','!')
  const key = `${method}_${url}_${headersSum}_${sum(body)}`;
  GEventListener(EVENT_DID_calcCacheKey,{input,init,key});

  return key;
}

//will return '' if not found
// when use dont need .catch
async function getCacheValueWithKey(key) {
  try {
    const value = await AsyncStorage.getItem(key);
    if (_.isString(value)) {
      return value;
    } else {
      return '';
    }
  } catch (e) {
    return '';
  }
}

//save to disk
async function saveCacheWithKeyValue(key, value) {
  assert(_.isString(key));
  assert(_.isString(value));

  try {
    GEventListener(EVENT_WILL_saveCache,{key,value})
    await AsyncStorage.setItem(key, value);
    await CacheKeysListManager.updateCacheKeysList('append', key);
    log(`saveCacheWithKeyValue key=${key} success`);
  } catch (e) {
    log('saveCacheItem error', e);
  }
}

function log(...msg) {
  const prefix = 'cacheFetch_RN ';
  const msgStr = prefix + msg.join(' ');
  GLogger.log(msgStr);
}

// cacheFetch is just a enhanced fetch,it's signature is same with fetch：Promise<Response> fetch(input[, init]);
// the type of input parameter must be string,while original fetch also accept Request
function cacheFetch(input, init = {}): Promise {
  assert(_.isString(input), 'input only accept string，dont support Request');
  const cacheKey = calcCacheKey(input, init);
  const keyExists = CacheKeysListManager.isKeyExistsInLatestKeysList(cacheKey);
  let shouldUseCache = null;
  if (keyExists) {
    const vetoResult = cacheFetch.veto(input, init);
    shouldUseCache = vetoResult;
  } else {
    shouldUseCache = false;
  }
  if (shouldUseCache) {
    //cache exists
    log('cache exists,cacheKey=' + cacheKey);
    return new Promise((resolve, reject) => {
      getCacheValueWithKey(cacheKey).then((cacheValue) => {
        GEventListener(EVENT_GOTCACHE_WILL_Resolve,{input,init,cacheKey,cacheValue});
        const response = Converter.responseFromString(cacheValue);
        resolve(response);
      });
    });
  } else {
    //cache not exists,need to fetch
    // fetch().then() return a Promise
    log('cache not exists! cacheKey=' + cacheKey);
    return cacheFetch.fetch(input, init).then((response) => {
      if (response.ok) {
        GEventListener(EVENT_GOTNetwork_WILL_SaveCache,{input,init,response});
        Converter.stringFromReponse(response)
          .then((responseStr) => {
            saveCacheWithKeyValue(cacheKey, responseStr);
          })
          .catch((reason) => {
            log('stringFromReponse fail,it seems that response.body cannot converto text');
          });
      }
      return response;
    });
  }
}

// need user to provide AsyncStorage
function setAsyncStorage(as) {
  AsyncStorage = as;
  //read latestKeysList when configured
  CacheKeysListManager.getCacheKeysList();
}

const defaultVeto = (input, init) => {
  return true; //always use cache
};

// you can decide which header fields to use when calcCacheKey
// default use all fields
// you can remove some field, ie Cookie/ETag/If-Modified-Since
const defaultHeadersPopulator = (headers) => {
  //headers is a plain object
  assert(_.isObject(headers));
  assert(_.isUndefined(headers.entries));
  debugger;
  return headers;
};

// high order function,return cacheFetch
// headersPopulator is only used when calcCacheKey
// veto is a function: boolean veto(input,init)，return true means allow using cache，false means do not allow using cache
// logger is a object,it contains a log function，defaults to console
// eventListener will be notified when event occur
// return a function called cacheFetch
export function makeCacheFetch({
                                 AsyncStorage,
                                 fetch,
                                 headersPopulator = defaultHeadersPopulator,
                                 veto = defaultVeto,
                                 logger = console,
                                 eventListener = ()=>{}
                               }) {
  assert(_.isFunction(veto));
  assert(_.isFunction(logger.log));
  GEventListener = eventListener;

  setAsyncStorage(AsyncStorage);
  cacheFetch.fetch = fetch; //underlaying fetch function
  calcCacheKey.headersPopulator = headersPopulator;

  cacheFetch.veto = veto;
  GLogger = logger;
  return cacheFetch;
}

export function clearFetchCache() {
  CacheKeysListManager.updateCacheKeysList('clear');
}
