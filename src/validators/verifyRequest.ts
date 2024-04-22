import { BatchEntryIdsNotDistinct, MalformedInputException, UnexcpectedList, UnexcpectedObject } from "../common/errors";
import type { Queue } from "../lib/queue";
import { findDuplicatedIds, isJsObject } from "../common/utils";
import { verifyFifoSendMessageBatchEntries } from "./verifyFifoSendMessageBatchEntries";
import { verifyMessagesTotalSize } from "./verifyMessagesTotalSize";

export const verifyDuplicatedIds = (Entries: any[]) => {
  const repetedId = findDuplicatedIds(Entries);

  if (repetedId) {
    throw new BatchEntryIdsNotDistinct(repetedId);
  }
};

export const verifySendMessageBatch = (Entries: any[], queue: Queue) => {
  verifyDuplicatedIds(Entries);
  verifyMessagesTotalSize(Entries);

  if (queue.FifoQueue) {
    verifyFifoSendMessageBatchEntries(Entries, queue);
  }
};

export const verifyInputType = (value: any, expectedType: "string" | "number" | "object" | "array" | "boolean") => {
  const vType = typeof value;
  if (
    (expectedType == "number" && value != "" && !isNaN(value)) ||
    (expectedType == "string" && vType == "string") ||
    (expectedType == "boolean" && vType == "boolean") ||
    (expectedType == "object" && isJsObject(value)) ||
    (expectedType == "array" && Array.isArray(value))
  ) {
    return;
  }

  if (Array.isArray(value)) {
    throw UnexcpectedList;
  }

  if (isJsObject(value)) {
    throw UnexcpectedObject;
  }

  if (expectedType == "number") {
    if (vType == "string") {
      throw new MalformedInputException("STRING_VALUE can not be converted to an Integer");
    }
  }
};
