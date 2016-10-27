import Dlimits from './dlimits';

export default(tries, time, store, keyResolver = () => {}, limitHandler = () => {}, options) => {

  // Create dlimits instance
  let dlimits = new Dlimits(tries, time, store, options);

  return(req, res, next) => {
    // Get the key from the resolver
    keyResolver(req, res, function(err, key) {
      dlimits.limit(key)
        .then(record => {
          req.dlimit = record;

          res.header('X-RateLimit-Limit', tries);
          res.header('X-RateLimit-Remaining', req.dlimit.remain);
          res.header('X-RateLimit-Reset', req.dlimit.nextCountRestart);

          next();
        })
        .catch(record => {
          req.dlimit = record || {key: key};

          res.header('X-RateLimit-Limit', tries);
          res.header('X-RateLimit-Remaining', req.dlimit.remain);
          res.header('X-RateLimit-Reset', req.dlimit.bannedUntil);

          limitHandler(req, res, next);
        });
    });
  };
};
