import { HsnCode } from '../models/hsncode.model.js';
import { handleDuplicateKeyError } from '../utils/dbErrorHandler.js';

export const createHsnCode = async (data) => {
  try {
    const hsnCode = await HsnCode.create(data);
    return hsnCode;
  } catch (error) {
    handleDuplicateKeyError(error, HsnCode);
  }
};

export const getHsnCodes = async (store) => {
  return HsnCode.find({ store });
};

export const getHsnCodeByCode = async (code) => {
  return HsnCode.findOne({ code });
};

export const updateHsnCodeById = async (id, data) => {
  try {
    return HsnCode.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    handleDuplicateKeyError(error, HsnCode);
  }
};

export const deleteHsnCodeById = async (id) => {
  return HsnCode.findByIdAndDelete(id);
};
