import { kMaximumMessageSize } from "../common/constants";
import { BatchRequestTooLong } from "../common/errors";
import { isJsObject } from "../common/utils";
import { verifyInputType } from "./verifyRequest";

export const verifyMessagesTotalSize = (Entries: any[]) => {
  let totalSize = 0;

  for (const msg of Entries) {
    if (typeof msg.MessageBody == "number" || typeof msg.MessageBody == "boolean") {
      msg.MessageBody = String(msg.MessageBody);
    }

    verifyInputType(msg.MessageBody, "string");

    if (typeof msg.MessageBody == "string") {
      totalSize += msg.MessageBody.length;
    }

    if (isJsObject(msg.MessageAttributes)) {
      for (const key of Object.keys(msg.MessageAttributes)) {
        totalSize += key.length;

        const value = msg.MessageAttributes[key];
        if (!isJsObject(value)) {
          continue;
        }

        const { StringValue, BinaryValue, DataType } = value;

        if (typeof DataType == "string") {
          totalSize += DataType.length;
        }

        if (typeof StringValue == "string") {
          totalSize += StringValue.length;
        }

        if (typeof BinaryValue == "string") {
          totalSize += BinaryValue.length;
        }
      }
    }
  }

  if (totalSize > kMaximumMessageSize) {
    throw new BatchRequestTooLong(totalSize);
  }
};
