/**
 *
 *    Copyright (c) 2020 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * @module JS API: type related utilities
 */

const queryZcl = require('../db/query-zcl.js')
const queryAtomic = require('../db/query-atomic.js')
const queryPackages = require('../db/query-package.js')
const dbEnum = require('../../src-shared/db-enum.js')
const bin = require('./bin')
const env = require('./env')

/**
 * This function resolves with the size of a given type.
 * -1 means that this size is variable.
 *
 * @param {*} db
 * @param {*} zclPackageId
 * @param {*} type
 */
async function typeSize(db, zclPackageId, type) {
  return queryZcl.selectSizeFromType(db, [zclPackageId], type)
}

/**
 * Returns the size of a real attribute, taking type size and defaults
 * into consideration, so that strings are properly sized.
 *
 * @param {*} db
 * @param {*} zclPackageIds
 * @param {*} at
 * @param {*} [defaultValue=null]
 * @returns Promise that resolves into the size of the attribute.
 */
async function typeSizeAttribute(db, zclPackageIds, at, defaultValue = null) {
  let sizeType
  if (at.typeInfo) {
    if (!at.typeInfo.atomicType && !at.typeInfo.size) {
      if (at.storage != dbEnum.storageOption.external) {
        throw new Error(
          `ERROR: Unknown size for non-external attribute: ${at.name} / ${at.code}`
        )
      }
      return 0
    }
  }
  sizeType = at.type
  let size = await queryZcl.selectSizeFromType(db, zclPackageIds, sizeType)

  if (size) {
    return size
  } else if (at.maxLength != null) {
    return at.maxLength
  } else if (at.defaultValue) {
    return at.defaultValue.length + 1
  } else {
    if (defaultValue != null) {
      return defaultValue
    } else {
      throw new Error(
        `ERROR: Unknown size for attribute: ${at.label} / ${at.code}`
      )
    }
  }
}

/**
 *
 * @param {*} value
 * @param {*} size
 * @returns The big endian value for a given float value padded with
 * the given size. The value is returned in hex format and prefixed with '0x'.
 */
function convertFloatToBigEndian(value, size) {
  let res = ''
  const arrayBuffer = new ArrayBuffer(size)
  const dataView = new DataView(arrayBuffer)
  if (size == 4) {
    dataView.setFloat32(0, value, false)
  } else if (size == 8) {
    dataView.setFloat64(0, value, false)
  } else {
    // Throwing a warning for unknown float type and continuing with 64bit float
    env.logWarning('Unknown Float Type value: ' + value)
    dataView.setFloat64(0, value, false)
  }
  for (let i = 0; i < size; i++) {
    let t = dataView.getUint8(i).toString(16)
    if (t.length == 1) {
      t = '0' + t
    }
    res += t
  }
  return '0x' + res
}

/**
 *
 * @param {*} value
 * @param {*} size
 * @returns The big endian value for a given integer value padded with
 * the given size. The value is returned in hex format and prefixed with '0x'.
 */
function convertIntToBigEndian(value, size) {
  const arrayBuffer = new ArrayBuffer(Math.pow(2, Math.ceil(Math.log2(size))))
  const dataView = new DataView(arrayBuffer)
  let i = 0
  if (size == 1) {
    dataView.setInt8(0, value, false)
  } else if (size == 2) {
    dataView.setInt16(0, value, false)
  } else if (size == 3) {
    dataView.setInt32(0, value, false)
    i = 1 // Read from 2nd byte after conversion
  } else if (size == 4) {
    dataView.setInt32(0, value, false)
  } else if (size == 5) {
    dataView.setBigInt64(0, BigInt(value), false)
    i = 3 // Read from 4th byte after conversion
  } else if (size == 6) {
    dataView.setBigInt64(0, BigInt(value), false)
    i = 2 // Read from 3rd byte after conversion
  } else if (size == 7) {
    dataView.setBigInt64(0, BigInt(value), false)
    i = 1 // Read from 2nd byte after conversion
  } else if (size == 8) {
    dataView.setBigInt64(0, BigInt(value), false)
  } else {
    env.logWarning('Unknown Integer Type value: ' + value)
    dataView.setBigInt64(0, BigInt(value), false)
  }
  let res = ''
  for (let j = i; j < size + i; j++) {
    let t = dataView.getUint8(j).toString(16)
    if (t.length == 1) {
      t = '0' + t
    }
    res += t
  }
  return '0x' + res
}

/**
 * If the type is more than 2 bytes long, then this method creates
 * the default byte array.
 *
 * @param {*} size Size of bytes generated.
 * @param {*} type Type of the object.
 * @param {*} value Default value.
 * @returns string which is a C-formatted byte array.
 */
function longTypeDefaultValue(size, type, value) {
  let v = ''
  if (value == null || value.length == 0) {
    v = '0x00, '.repeat(size)
  } else if (isString(type)) {
    // String Value
    if (isOneBytePrefixedString(type)) {
      v = bin.stringToOneByteLengthPrefixCBytes(value, size).content
    } else if (isTwoBytePrefixedString(type)) {
      v = bin.stringToTwoByteLengthPrefixCBytes(value, size).content
    } else {
      v = bin.hexToCBytes(bin.stringToHex(value))
    }
  } else {
    let temp = ''
    // Float value
    if (!isNaN(value) && value.toString().indexOf('.') != -1) {
      temp = convertFloatToBigEndian(value, size)
    } else {
      // Positive value
      if (value > 0) {
        let ret = value.trim()
        if (ret.startsWith('0x') || ret.startsWith('0X')) {
          temp = `0x${value.slice(2).toUpperCase()}`
        } else {
          let tempVal = parseInt(value)
          temp = `0x${tempVal.toString(16).toUpperCase()}`
        }
      } else {
        // Negative value
        temp = convertIntToBigEndian(value, size)
      }
    }
    // Padding based on attribute size
    let default_macro = temp.replace('0x', '').match(/.{1,2}/g)
    let padding_length = size - default_macro.length
    for (let i = 0; i < padding_length; i++) {
      v += '0x00, '
    }
    for (let m of default_macro) {
      v += ' 0x' + m + ','
    }
  }
  return v
}

/**
 * Conversion to a CLI type. THis is here temporarily until we come up
 * with a proper type engine.
 *
 * @param {*} str
 * @returns converted type
 */
function convertToCliType(str) {
  str = str.trim()
  if (str.toLowerCase().endsWith('u')) {
    str = str.substring(0, str.length - 1)
    str = 'u' + str
  } else if (
    str.toLowerCase().startsWith('int') &&
    str.toLowerCase().endsWith('s')
  ) {
    str = str.substring(0, str.length - 1)
  } else if (str.toLowerCase().endsWith('char_string')) {
    str = 'string'
  } else if (str.toLowerCase().startsWith('bitmap')) {
    str = str.toLowerCase().replace('bitmap', 'uint')
  } else if (str.toLowerCase().startsWith('enum')) {
    str = str.toLowerCase().replace('enum', 'uint')
  } else {
    env.logInfo('Cli type not found: ' + str)
  }
  return str
}

/**
 * Returns true if a given ZCL type is a string type.
 * @param {*} type
 * @returns true if type is string, false otherwise
 */
function isString(type) {
  switch (type.toLowerCase()) {
    case 'char_string':
    case 'octet_string':
    case 'long_char_string':
    case 'long_octet_string':
      return true
    default:
      return false
  }
}

/**
 * Returns true if a given ZCL type is a float type.
 * @param {*} type
 * @returns true if type is float, false otherwise
 */
function isFloat(type) {
  switch (type.toLowerCase()) {
    case 'float_semi':
    case 'float_single':
    case 'float_double':
      return true
    default:
      return false
  }
}

/**
 * Checks if a given ZCL type is a signed integer.
 *
 * @param {object} db - The database connection object.
 * @param {string} sessionId - The session ID.
 * @param {string} type - The name of the ZCL type.
 * @returns {Promise<boolean>} - A promise that resolves to true if the type is a signed integer, false otherwise.
 */
async function isSignedInteger(db, sessionId, type) {
  let sessionPackages = await queryPackages.getSessionPackages(db, sessionId)
  return await queryAtomic.isTypeSignedByNameAndPackage(
    db,
    type,
    sessionPackages
  )
}

/**
 * Checks if type is a one-byte lengh string.
 *
 * @param {*} type
 * @returns true if the said type is a string prefixed by one byte length
 */
function isOneBytePrefixedString(type) {
  type = type.toLowerCase()
  return type == 'char_string' || type == 'octet_string'
}
/**
 * Checks if type is a two-byte lengh string.
 *
 * @param {*} type
 * @returns true if the said type is a string prefixed by two byte length
 */
function isTwoBytePrefixedString(type) {
  type = type.toLowerCase()
  return type == 'long_char_string' || type == 'long_octet_string'
}

/**
 * Generates a default value for a null string based on its type.
 * This function is designed to abstract away the specific null representation
 * of strings from the longTypeDefaultValue function, ensuring that the latter
 * does not need to be aware of these details.
 *
 * @param {string} type - The type of the string, which determines its null representation.
 * @returns {string} The default value for a null string of the specified type.
 * @throws {Error} Throws an error if the string type is unknown.
 */
function nullStringDefaultValue(type) {
  // We don't want to make longTypeDefaultValue know about our null
  // string representation.
  let def
  if (isOneBytePrefixedString(type)) {
    def = '0xFF,'
  } else if (isTwoBytePrefixedString(type)) {
    def = '0xFF, 0xFF,'
  } else {
    throw new Error(`Unknown string type: ${type}`)
  }
  return def
}

/**
 * Given a zcl device type returns its sign, size and zcl data type info stored
 * in the database table.
 * Note: Enums and Bitmaps are considered to be unsigned.
 * @param {*} type
 * @param {*} context
 * @param {*} options
 * @returns returns sign, size and info of zcl device type
 * Available Options:
 * - size: Determine whether to calculate the size of zcl device type in bits
 * or bytes
 * for eg: getSignAndSizeOfZclType('int8u' this size='bits') will return
 * the size in bits which will be 8. If not mentioned then it will return the size
 * in bytes i.e. 1 in this case.
 */
async function getSignAndSizeOfZclType(db, type, packageIds, options) {
  let isTypeSigned = false
  let dataTypesize = 0
  let sizeMultiple = 1
  let isKnown = true

  if (options && options.size == 'bits') {
    sizeMultiple = 8
  }

  // Extracting the type in the data type table
  let dataType = await queryZcl.selectDataTypeByName(db, type, packageIds)

  // Checking if the type is signed or unsigned
  if (
    dataType &&
    dataType.discriminatorName.toLowerCase() == dbEnum.zclType.number
  ) {
    let number = await queryZcl.selectNumberByName(
      db,
      packageIds,
      dataType.name
    )
    if (number.isSigned) {
      isTypeSigned = true
    }
  }

  // Extracting the size of the data type
  if (dataType) {
    if (dataType.discriminatorName.toLowerCase() == dbEnum.zclType.bitmap) {
      let bitmap = await queryZcl.selectBitmapByName(
        db,
        packageIds,
        dataType.name
      )
      dataTypesize = Math.pow(2, Math.ceil(Math.log2(bitmap.size)))
    } else if (
      dataType.discriminatorName.toLowerCase() == dbEnum.zclType.enum
    ) {
      let en = await queryZcl.selectEnumByName(db, dataType.name, packageIds)
      dataTypesize = Math.pow(2, Math.ceil(Math.log2(en.size)))
    } else if (
      dataType.discriminatorName.toLowerCase() == dbEnum.zclType.number
    ) {
      let number = await queryZcl.selectNumberByName(
        db,
        packageIds,
        dataType.name
      )
      dataTypesize = Math.pow(2, Math.ceil(Math.log2(number.size)))
    }
  } else {
    isKnown = false
  }
  let ret = {
    isTypeSigned: isTypeSigned,
    dataTypesize: dataTypesize * sizeMultiple,
    dataType: dataType
  }
  // If this type was not defined, we tag it as `isNotDefined=true`.
  // One day we will do something better...
  if (!isKnown) ret.isNotDefined = true
  return ret
}

/**
 * Converts a JS number to a hex representation with padding.
 * intToHexString(17, 2) => 0x0011 .
 *
 * @param {*} n
 * @param {*} byteCount
 * @returns hex string
 */
function intToHexString(n, byteCount) {
  return '0x' + n.toString(16).padStart(2 * byteCount, '0')
}

/**
 * Converts a hex representation created by the intToHexString
 * back into a JS integer.
 *
 * @param {*} s
 * @returns integer
 */
function hexStringToInt(s) {
  let c = s
  if (s.startsWith('0x') || s.startsWith('0X')) c = s.substring(2)
  return parseInt(c, 16)
}

exports.typeSize = typeSize
exports.typeSizeAttribute = typeSizeAttribute
exports.longTypeDefaultValue = longTypeDefaultValue
exports.isOneBytePrefixedString = isOneBytePrefixedString
exports.isTwoBytePrefixedString = isTwoBytePrefixedString
exports.convertToCliType = convertToCliType
exports.isString = isString
exports.isFloat = isFloat
exports.isSignedInteger = isSignedInteger
exports.convertIntToBigEndian = convertIntToBigEndian
exports.convertFloatToBigEndian = convertFloatToBigEndian
exports.getSignAndSizeOfZclType = getSignAndSizeOfZclType
exports.intToHexString = intToHexString
exports.hexStringToInt = hexStringToInt
exports.nullStringDefaultValue = nullStringDefaultValue
