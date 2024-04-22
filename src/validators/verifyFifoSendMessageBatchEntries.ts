import { ALPHANUM_PUNCT_PATTERN } from "../common/constants";
import { InvalidParameterValueException } from "../common/errors";
import type { Queue } from "../lib/queue";
import { sha256 } from "../common/utils";
import { verifyInputType } from "./verifyRequest";
import { verifyMessageAttributes } from "./verifyMessageAttributes";

export const verifyFifoSendMessageBatchEntries = (Entries: any[], queue: Queue) => {
  for (let i = 0; i < Entries.length; i++) {
    const msg = Entries[i];

    if (!msg.MessageBody) {
      throw new InvalidParameterValueException(`The request must contain the parameter SendMessageBatchRequestEntry.${i + 1}.MessageBody.`);
    }

    if (!msg.MessageGroupId) {
      throw new InvalidParameterValueException("The request must contain the parameter MessageGroupId.");
    }

    // DelaySeconds is not valid for FIFO Queues but AWS validates its type anyway
    if ("DelaySeconds" in msg) {
      verifyInputType(msg.DelaySeconds, "number");

      throw new InvalidParameterValueException(
        `Value ${msg.DelaySeconds} for parameter DelaySeconds is invalid. Reason: The request include parameter that is not valid for this queue type.`
      );
    }

    if (!ALPHANUM_PUNCT_PATTERN.test(msg.MessageGroupId)) {
      throw new InvalidParameterValueException("MessageGroupId can only include alphanumeric and punctuation characters. 1 to 128 in length");
    }

    if (msg.MessageDeduplicationId) {
      if (!ALPHANUM_PUNCT_PATTERN.test(msg.MessageDeduplicationId)) {
        throw new InvalidParameterValueException("MessageDeduplicationId can only include alphanumeric and punctuation characters. 1 to 128 in length");
      }
    } else if (queue.ContentBasedDeduplication) {
      msg.MessageDeduplicationId = sha256(msg.MessageBody);
    } else {
      throw new InvalidParameterValueException("The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly");
    }

    let messageLength = msg.MessageBody.length;
    const MessageAttribute = msg.MessageAttributes;

    if (MessageAttribute) {
      const attribValues: any[] = Object.values(MessageAttribute);

      verifyMessageAttributes(MessageAttribute);

      for (const v of attribValues) {
        const { StringValue, BinaryValue, DataType } = v;

        if (typeof DataType == "string") {
          messageLength += DataType.length;
        }

        if (typeof StringValue == "string") {
          messageLength += StringValue.length;
        }

        if (typeof BinaryValue == "string") {
          messageLength += BinaryValue.length;
        }
      }

      const keys = Object.keys(MessageAttribute);

      for (const key of keys) {
        messageLength += key.length;
      }
    }

    if (messageLength > queue.MaximumMessageSize) {
      throw new InvalidParameterValueException(`One or more parameters are invalid. Reason: Message must be shorter than ${queue.MaximumMessageSize} bytes.`);
    }

    const MessageSystemAttribute = msg.MessageSystemAttributes;

    if (MessageSystemAttribute) {
      verifyMessageAttributes(MessageSystemAttribute, "system");
    }
  }
};
