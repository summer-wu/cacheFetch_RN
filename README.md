# cachefetch_rn

+ configurable cacheFetch for react-native,using AsyncStorage to cache 
+ cacheFetch inherits the same API as [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch)

# Usage
+ Install :`npm install cacheFetch_RN`
+ example:


```js

// import { AsyncStorage } from 'react-native';
// import AsyncStorage from '@react-native-community/async-storage';
import {clearFetchCache, makeCacheFetch} from 'cachefetch_rn';

const cacheFetch = makeCacheFetch(AsyncStorage);
// or const cacheFetch = makeCacheFetch(AsyncStorage,veto,logger);

cacheFetch("https://www.google.com", {
  method: 'GET',
  headers: {
    'Content-Type': 'text/json'
  }
}).then(response => response.text())
.then(text=>alert(text.substr(0,100)))
.catch(e => {
  alert('fetch catch fail' + e);
});
```

# API
+ `clearFetchCache`, clear all cache
+ `makeCacheFetch(AsyncStorage,veto,logger)`，veto is a function return boolean

