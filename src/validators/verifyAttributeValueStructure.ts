import { UnsupportedOperation, notStringSerializationException } from "../common/errors";

export const verifyAttributeValueStructure = (v: Record<string, any>) => {
  const { StringValue, BinaryValue, DataType, StringListValues, BinaryListValues } = v;
  if (typeof StringListValues != "undefined" || typeof BinaryListValues != "undefined") {
    throw new UnsupportedOperation("Message attribute list values in SendMessage operation are not supported.");
  }

  if (typeof StringValue != "undefined" && typeof StringValue != "string") {
    throw notStringSerializationException(StringValue);
  }

  if (typeof BinaryValue != "undefined" && typeof BinaryValue != "string") {
    throw notStringSerializationException(BinaryValue);
  }

  if (typeof DataType != "undefined" && typeof DataType != "string") {
    throw notStringSerializationException(DataType);
  }
};
