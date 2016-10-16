import Dlimits from './dlimits';

export default(tries, time, store, keyResolver, limitHandler, options) => {

  // Create dlimits instance
  let dlimits = new Dlimits(tries, time, store, options);

  return(req, res, next) => {
      // Get the key from the resolver
      keyResolver(req, res, function(err, key) {
        dlimits.limit(key)
          .then(record => {
            req.dlimit = record;
            next();
          })
          .catch(record => {
            req.dlimit = record;
            limitHandler(req, res, next);
          });
      });
  };
};
