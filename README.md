# dlimits

Generic rate-limiter and Express rate-limiter middleware



## How to use it
```javascript
  const {default: Dlimits, defaultStore} = require('dlimits');
  
  // Constructor allow 1 requests each 2 seconds for my-func key
  const key = 'my-func';
  const funcRateLimit = new Dlimits(1, 2e3, defaultStore, { minWait: 1000, maxWait: 8000 });

  const myFunc = async () => {
    try {
      await funcRateLimit.limit(key);
      console.log('protected code')
    } catch(e) {
      console.log(e);
      // Handle rate time limit
    }
  }

  (async () => {
    await myFunc(); // Will execute
    await myFunc(); // Will show an error
    await new Promise(res => setTimeout(res, 3e3));
    await myFunc(); // Will execute
  })();
```

## express middleware
```javascript
  import Dlimits from 'dlimits-express-middleware';
  

  app.use(Dlimits(200, 1000, () => 'my-func'), /*on rate limit */ (req, res, next) => res.send('rate limit'));
```