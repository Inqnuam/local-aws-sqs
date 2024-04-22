import {
  VALIDE_SYSTEM_ATTRIBUTES,
  MAX_MESSAGE_ATTRIBUTES_KEYS,
  MAX_MESSAGE_ATTRIBUTE_NAME_LENGTH,
  VALIDE_DATA_TYPES,
  MAX_MESSAGE_ATTRIBUTE_TYPE_LENGTH,
} from "../common/constants";
import { InvalidParameterValueException } from "../common/errors";

export const verifyMessageAttributes = (MessageAttributes: Record<string, any>, messageAttributesType: "(user)" | "system" = "(user)") => {
  const keys = Object.keys(MessageAttributes);

  if (messageAttributesType == "system") {
    const foundInvalidAttribute = keys.find((x) => !VALIDE_SYSTEM_ATTRIBUTES.includes(x));

    if (foundInvalidAttribute) {
      throw new InvalidParameterValueException(`Message system attribute name '${foundInvalidAttribute}' is invalid.`);
    }
  }

  if (keys.length > MAX_MESSAGE_ATTRIBUTES_KEYS) {
    throw new InvalidParameterValueException(`Number of message attributes [${keys.length}] exceeds the allowed maximum [${MAX_MESSAGE_ATTRIBUTES_KEYS}].`);
  }

  for (const attribName of keys) {
    if (attribName.length > MAX_MESSAGE_ATTRIBUTE_NAME_LENGTH) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute name must be shorter than ${MAX_MESSAGE_ATTRIBUTE_NAME_LENGTH} bytes.`);
    }

    const v = MessageAttributes[attribName];

    if (!attribName.trim()) {
      throw new InvalidParameterValueException(`The request must contain non-empty message ${messageAttributesType} attribute names.`);
    }

    const normalizedName = attribName.trim().toLocaleLowerCase();

    if (normalizedName.startsWith("aws.") || normalizedName.startsWith("amazon.")) {
      throw new InvalidParameterValueException("You can't use message attribute names beginning with 'AWS.' or 'Amazon'. These strings are reserved for internal use.");
    }

    if (normalizedName.startsWith(".")) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute name must not begin with character '.'.`);
    }
    if (normalizedName.endsWith(".")) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute name must not end with character '.'.`);
    }

    if (normalizedName.includes("..")) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute name must not have successive '.' characters.`);
    }

    const keys = Object.keys(v);
    if (!keys.length) {
      throw new InvalidParameterValueException(`The message ${messageAttributesType} attribute '${attribName}' must contain a non-empty message attribute value.`);
    }

    if (!keys.includes("DataType")) {
      throw new InvalidParameterValueException(`The message ${messageAttributesType} attribute '${attribName}' must contain a non-empty message attribute type.`);
    }

    if (!VALIDE_DATA_TYPES.test(v.DataType)) {
      throw new InvalidParameterValueException(
        `The type of message ${messageAttributesType} attribute '${attribName}' is invalid. You must use only the following supported type prefixes: Binary, Number, String.`
      );
    }

    if (typeof v.StringValue == "number" || typeof v.StringValue == "boolean") {
      v.StringValue = String(v.StringValue);
    }
    if ((keys.includes("StringValue") && v.StringValue == "") || (keys.includes("BinaryValue") && v.BinaryValue == "")) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute '${attribName}' must contain a non-empty value of type '${v.DataType}'.`);
    }

    if (keys.length == 1) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute '${attribName}' must contain a non-empty value of type '${v.DataType}'.`);
    }

    if (keys.length > 2) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute '${attribName}' must have a single value.`);
    }

    if (v.DataType.length > MAX_MESSAGE_ATTRIBUTE_TYPE_LENGTH) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute type must be shorter than 256 bytes.`);
    }

    if ((v.DataType == "String" || v.DataType == "Number") && !v.StringValue) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute '${attribName}' with type '${v.DataType}' must use field 'String'.`);
    }
    if (v.DataType == "Binary" && !v.BinaryValue) {
      throw new InvalidParameterValueException(`Message ${messageAttributesType} attribute '${attribName}' with type 'Binary' must use field 'Binary'.`);
    }

    if (v.DataType == "Number" && isNaN(v.StringValue)) {
      throw new InvalidParameterValueException(`Can't cast the value of message ${messageAttributesType} attribute '${attribName}' to a number.`);
    }
  }
};
