import { UnsupportedOperation, throwOnNoPrimitiveType } from "../common/errors";

export const verifyAttributeValueStructure = (v: Record<string, any>) => {
  const { StringValue, BinaryValue, DataType, StringListValues, BinaryListValues } = v;
  if (typeof StringListValues != "undefined" || typeof BinaryListValues != "undefined") {
    throw new UnsupportedOperation("Message attribute list values in SendMessage operation are not supported.");
  }

  throwOnNoPrimitiveType(StringValue);
  throwOnNoPrimitiveType(BinaryValue);
  throwOnNoPrimitiveType(DataType);
};
