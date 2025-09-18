import type { Queue } from "../lib/queue";
import { verifyQueueAttribValue } from "../common/utils";
import { verifyMessageAttributes } from "./verifyMessageAttributes";
import { ALPHANUM_PUNCT_PATTERN } from "../common/constants";

export const verifyStandartQueueBatchMsgEntry = (msg: any, i: number, queue: Queue) => {
  if ("MessageDeduplicationId" in msg) {
    return {
      Code: "InvalidParameterValue",
      Id: msg.Id,
      Message: "The request include parameter that is not valid for this queue type",
      SenderFault: "true",
    };
  }

  if ("MessageGroupId" in msg) {
    const err = {
      Code: "InvalidParameterValue",
      Id: msg.Id,
      Message: "MessageGroupId can only include alphanumeric and punctuation characters. 1 to 128 in length",
      SenderFault: "true",
    };

    if (typeof msg.MessageGroupId != "string") {
      return err;
    }

    if (!ALPHANUM_PUNCT_PATTERN.test(msg.MessageGroupId)) {
      return err;
    }
  }

  if (!msg.MessageBody) {
    return {
      Code: "MissingParameter",
      Id: msg.Id,
      Message: `The request must contain the parameter SendMessageBatchRequestEntry.${i + 1}.MessageBody.`,
      SenderFault: "true",
    };
  }

  if ("DelaySeconds" in msg) {
    if (isNaN(msg.DelaySeconds)) {
      return { Id: msg.Id, Code: "MalformedInput", Message: "STRING_VALUE can not be converted to an Integer", SenderFault: "true" };
    }

    const delayIsInvalid = verifyQueueAttribValue.DelaySeconds(msg.DelaySeconds);
    if (delayIsInvalid) {
      return {
        Code: "InvalidParameterValue",
        Id: msg.Id,
        Message: delayIsInvalid,
        SenderFault: "true",
      };
    }
  }

  let messageLength = msg.MessageBody.length;
  const MessageAttribute = msg.MessageAttributes;

  if (MessageAttribute) {
    try {
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
    } catch (error: any) {
      return {
        Code: error.Code,
        Id: msg.Id,
        Message: error.message,
        SenderFault: "true",
      };
    }
  }

  if (messageLength > queue.MaximumMessageSize) {
    return {
      Code: "InvalidParameterValue",
      Id: msg.Id,
      Message: `One or more parameters are invalid. Reason: Message must be shorter than ${queue.MaximumMessageSize} bytes.`,
      SenderFault: "true",
    };
  }

  const MessageSystemAttribute = msg.MessageSystemAttribute ?? msg.MessageSystemAttributes;

  if (MessageSystemAttribute) {
    try {
      verifyMessageAttributes(MessageSystemAttribute, "system");
    } catch (error: any) {
      return {
        Code: error.Code,
        Id: msg.Id,
        Message: error.message,
        SenderFault: "true",
      };
    }
  }
};
