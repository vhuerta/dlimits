# dlimits

Generic rate-limiter and Express rate-limiter middleware



## How to use it
```javascript
  import Dlimits from 'dlimits';
  // Constructir allow 300 requests each 1000ms
  const key = 'my-func';
  const funcRateLimit = new Dlimits(300, 1000, defaultStore, { minWait: 1000, maxWait: 8000 });

  const myFunc = async () => {
    try {
      await funcRateLimit(key).limit();
    } catch(e) {
      // Handle rate time limit
    }
  }
```

## express middleware
```javascript
  import Dlimits from 'dlimits-express-middleware';
  

  app.use(Dlimits(200, 1000, () => 'my-func'), /*on rate limit */ (req, res, next) => res.send('rate limit'));
```