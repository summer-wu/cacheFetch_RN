# cachefetch_rn

+ configurable cacheFetch for react-native,using AsyncStorage to cache 
+ cacheFetch inherits the same API as [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch)

# Usage
+ Install :`npm install cacheFetch_RN`
+ example:


```js
import { AsyncStorage } from 'react-native';
import { clearFetchCache, makeCacheFetch } from 'cachefetch_rn';

const headersPopulator = (headers) => {
  //headers is a plain object
  console.log('before populate', headers);
  delete headers['Fc-Csrf'];
  delete headers['Cookie'];
  console.log('after populate', headers);
  return headers;
};
const cacheFetch = makeCacheFetch({
  AsyncStorage: AsyncStorage,
  fetch: global.fetch,
  headersPopulator: headersPopulator,
  logger: console,
});
global.fetch = cacheFetch; //optional,if you want all fetch to be cacheFetch 
```

# API
+ `clearFetchCache`, clear all cache
+ `makeCacheFetch(...)`，see code for detail 

