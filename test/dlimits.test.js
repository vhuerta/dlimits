import Dlimits, { defaultStore, defaultDelayStrategy, defaultResetStrategy } from './../src/dlimits.js';

describe.only('dlimits class', () =>  {

  describe('delays array', () => {

    it('should build a delays array with the default strategy (fibonnaci)', () => {
      let dlimits = new Dlimits(300, 1000, defaultStore, { minWait: 1000, maxWait: 8000 });
      dlimits._delays.should.be.an.Array();
      dlimits._delays.should.have.length(6);
      dlimits._delays.should.be.containDeepOrdered([1000, 1000, 2000, 3000, 5000, 8000]);
    });

    it('should build a delays array with specified strategy (same)', () => {

      let sameDelayStrategy = (arr) => {
        return arr[arr.length - 1];
      };

      let dlimits = new Dlimits(300, 1000, defaultStore, { minWait: 1000, maxWait: 8000, delayStrategy: sameDelayStrategy });
      dlimits._delays.should.be.an.Array();
      dlimits._delays.should.have.length(100);
      dlimits._delays.should.be.containDeepOrdered([1000, 1000, 1000, 1000, 1000]);

    });

    it('should build a delays array with specified strategy (double)', () => {

      let doubleDelayStrategy = (arr) => {
        return arr[arr.length - 1] * 2;
      };

      let dlimits = new Dlimits(300, 1000, defaultStore, { minWait: 1000, maxWait: 8000, delayStrategy: doubleDelayStrategy });
      dlimits._delays.should.be.an.Array();
      dlimits._delays.should.have.length(4);
      dlimits._delays.should.be.containDeepOrdered([1000, 2000, 4000, 8000]);

    });

  });

  it('should accepr 1 single request', done => {

    let key = '1';
    let dlimits = new Dlimits(10, 1000, defaultStore, { minWait: 200, maxWait: 8000 });
    console.time('delimit[0]');
    dlimits.limit(key).then(record => {
      console.timeEnd('delimit[0]');
      console.time('delimit[1]');
      dlimits.limit(key).then(record => {
        console.timeEnd('delimit[1]');
        done();
      });
    });
  });

  it('should ban the key after 1 single request', done => {

    let key = '1';

    let dlimits = new Dlimits(1, 1000, defaultStore, { minWait: 200, maxWait: 8000 });
    let promise = dlimits.limit(key)
      .then(record => dlimits.limit(key)) // Send one request
      .then(record => dlimits.limit(key)); // Send another request, so ban the key and reject the promise

    promise.should.be.a.Promise();
    promise.should.be.rejected();

    done();
  });

  it('should ban the key after 1 single request and after tow seconds unban', done => {

    let key = '1';

    let dlimits = new Dlimits(1, 1000, defaultStore, { minWait: 200, maxWait: 8000, resetStrategy: () => false });
    let promise = dlimits.limit(key)
      .then(record => dlimits.limit(key)) // Send one request
      .then(record => dlimits.limit(key)); // Send another request, so ban the key and reject the promise

    promise.should.be.a.Promise();
    promise.should.be.rejected(); // Inmediate request should be rejected

    setTimeout(() => { // Request after min time banned should be fulfilled
      promise = dlimits.limit(key)
        .catch(done);
      promise.should.be.a.Promise();
      promise.should.be.fulfilled();
      done();
    }, 200);


  });

  it('should count number of bans', done => {

    let key = '1';

    let dlimits = new Dlimits(1, 1000, defaultStore, { minWait: 500, maxWait: 8000, resetStrategy: () => false });
    let promises = [];

    for(let i = 1; i <= 3; i++) {
      promises.push(new Promise((resolve, reject) => {
        setTimeout(() => {
          dlimits.limit(key).catch(() => 0);
          dlimits.limit(key).catch(() => 0);
          resolve();
        }, 600 * i);
      }));

    }

    Promise.all(promises).then(() => {
      setTimeout(() => {
        dlimits.limit(key).catch(() => 0);
        let promise = dlimits.limit(key);

        promise.should.be.a.Promise();
        promise.should.be.rejected();
        promise.catch(err => {
          err.should.have.ownProperty('bannedTimes', 4);
          done();
        });
      }, 1500);
    });


  });

});
