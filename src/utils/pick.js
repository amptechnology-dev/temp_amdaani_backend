/**
 * Creates an object composed of the picked object properties.
 * @param {Object} source - The source object
 * @param {Array<string>} keys - The list of keys to pick
 * @returns {Object} - New object with only picked properties
 */
const pick = (source, keys) => {
  return keys.reduce((result, key) => {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
    return result;
  }, {});
};

export default pick;
