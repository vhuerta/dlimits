'use strict';
/**
 * Generic class to limit everithing,
 *
 * How to use it:
 *  To limit 10 request per second:
 *
 *    let dlimits = Dlimits(10, 100);
 *    dlimits('key').then().catch();
 *
 * @author Victor Huerta <victor@compropago.com, vhuertahnz@gmail.com>
 */

import uuid from 'node-uuid';

/**
 * Strategy to determinate the banning delays, this default
 * strategy is a "fibonnaci like" function, example
 *
 *  if min: 1000 and max: 8000
 *  it will generate: [1000, 1000, 2000, 3000, 8000]
 *
 * @param  {Array} arr   Array with all the delays calculated at the time
 * @param  {Number} index Current iteration
 * @param  {Number} min   Min banned time
 * @param  {Number} max   Max banned time
 * @return {Number}       Calculated delay
 */
const defaultDelayStrategy = (arr, index, min, max) => {
  let num = arr[arr.length - 1] + (arr.length > 1 ? arr[arr.length - 2] : 0);
  return num;
};

/**
 * This function determinate when the banned count was reseted
 *
 * @param {Number} lastBan     Time of the last ban
 * @param {Number} bannedTimes Number of times banned
 * @param {Number} bannedUntil Time when was unbanned
 * @param {Number} timeBanned  Time banned
 */
const defaultResetStrategy = (lastBan, bannedTimes, bannedUntil, timeBanned) => {
  return(bannedUntil + (bannedTimes * timeBanned)) < Date.now();
};

/**
 * This is a default store that use a var in memory
 *
 * DONT USE IT IN PRODUCTION!!!
 *
 */
let storage = [];

const defaultStore = {

  set(key, data, next) {
    storage = storage.filter(s => key !== s.key);
    storage.push({ key: key, data: data });
    next(null, data);
  },

  get(key, next) {
    let record = storage.find(s => key === s.key);
    next(null, record ? record.data : null);
  },

  reset() {
    storage = [];
  }


};

/**
 * Dlimits class
 */
class Dlimits {

  constructor(tries, time, store, {
    minWait = (100 * 2),
    maxWait = (1000 * 60 * 60 * 24),
    delayStrategy = (...args) => defaultDelayStrategy.apply(null, args),
    resetStrategy = (...args) => defaultResetStrategy.apply(null, args)
  }) {

    this._tries = tries;
    this._time = time;
    this.store = store;
    this._delays = [];
    this._minWait = minWait;
    this._maxWait = maxWait;
    this._delayStrategy = delayStrategy;
    this._resetStrategy = resetStrategy;
    this._uuid = uuid.v4();

    this._buildDelaysArray();
  }

  _buildDelaysArray() {
    // Push the min wait time
    this._delays.push(this._minWait);

    // Prevent max call
    let i = 1;
    while(i < 100) {
      // Calculate the next value with the delay strategy
      let next = this._delayStrategy(this._delays, i, this._minWait, this._maxWait);
      if(isNaN(next) || next > this._maxWait) break;
      this._delays.push(next);
      i++;
    }
  }

  reset(key) {
    return this._firstRequest(key);
  }

  _getKey(key) {
    return this._uuid + '-' + key;
  }

  limit(key) {
    let _this = this;

    return new Promise((resolve, reject) => {
      // Try to get the info from the store
      if(!_this.store || !_this.store.get) return reject(new Error('No correct store implementation: get'));

      _this.store.get(_this._getKey(key), (err, res) => {
        if(err) return reject(err);

        let promise;

        if(res && typeof res === 'object' && res.key) { // Already exists
          promise = _this._subsequentRequest(key, res);
        } else { // First try
          promise = _this._firstRequest(key);
        }

        return promise
          .then(record => resolve(record))
          .catch(err => reject(err));
      });
    });
  }

  _subsequentRequest(key, res) {

    let _this = this;

    return new Promise((resolve, reject) => {
      // Get the record properties or the defaults
      let record = Object.assign({}, res);
      let now = Date.now();

      record.count += 1;

      if(record.bannedUntil && record.bannedUntil > now) { // Already banned, so reject it
        return reject(record);
      } else if(record.bannedUntil && record.bannedUntil < now) { // Banned, but its time to unban
        // Check if the banning can be reseted
        let resetBanning = _this._resetStrategy(record.lastBan, record.bannedTimes, record.bannedUntil, _this._delays[record.delay || 0]);
        record.bannedUntil = null;
        record.remain = _this._tries - 1;
        record.lastValidRequest = now;
        record.nextCountRestart = new Date(record.lastValidRequest + _this._time).getTime();
        record.bannedTimes = resetBanning ? 0 : record.bannedTimes;
        record.delay = resetBanning ? 0 : record.delay;
        return _this._save(key, record)
          .then(record => resolve(record))
          .catch(err => reject(err)); // Save it and continue!
      } else { // Not banned yet
        let remain = record.remain - 1;
        if(remain < 0 && now < record.nextCountRestart) { // No remain and isn't time to restart count? Lets bann it
          record.remain = 0; // Set remain in zero
          record.lastBan = now; // Set the ban date to now
          record.bannedTimes += 1; // Increse banned times
          record.bannedUntil = now + _this._delays[_this._delays.length >= record.delay ? record.delay : _this._delays.length]; // Add the delay time to now
          record.delay += 1; // Increse delay
          return _this._save(key, record)
            .then(record => reject(record))
            .catch(err => reject(err));
        }

        // Not need to ban, so continue
        if(Date.now() > record.nextCountRestart) { // Its time to restart the remain?
          record.remain = _this._tries - 1;
          record.nextCountRestart = now + _this._time;
        } else {
          record.remain = remain;
        }
        record.lastValidRequest = now;
        return _this._save(key, record)
          .then(record => resolve(record))
          .catch(err => reject(err)); // Save it and continue!
      }
    });

  }

  _firstRequest(key) {
    let now = Date.now();
    let record = {
      key: key,
      count: 1,
      delay: 0,
      bannedTimes: 0,
      bannedUntil: null,
      lastBan: null,
      remain: this._tries - 1,
      lastValidRequest: now,
      nextCountRestart: new Date(now + this._time).getTime()
    };
    return this._save(key, record);
  }

  _save(key, record) {
    let _this = this;
    return new Promise((resolve, reject) => {
      if(!_this.store || !_this.store.set) return reject(new Error('No correct store implementation: set'));
      key = _this._getKey(key);
      _this.store.set(key, record, (err) => {
        if(err) return reject(err);
        return resolve(record);
      });
    });
  }

}

export {
  Dlimits as default,
  defaultStore as defaultStore,
  defaultDelayStrategy as defaultDelayStrategy,
  defaultResetStrategy as defaultResetStrategy
};
